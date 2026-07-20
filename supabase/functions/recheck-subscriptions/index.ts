import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return await res.json();
}

async function supabasePatch(table: string, filter: string, body: object) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
}

function extractChannelId(url: string): string | null {
  const m = url.match(/channel\/(UC[A-Za-z0-9_-]{22})/);
  return m ? m[1] : null;
}

interface ProfileRow {
  id: string;
  pts: number;
  youtube_connected: boolean;
  youtube_channel_id: string | null;
  youtube_access_token: string | null;
  youtube_refresh_token: string | null;
  youtube_token_expires_at: string | null;
}

interface TaskRow {
  id: string;
  task_type: string;
  pts_value: number;
  target_url: string;
}

interface CompletionRow {
  id: string;
  user_id: string;
  task_id: string;
  status: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!GOOGLE_CLIENT_ID) {
      return json({ message: "Google OAuth not configured.", rechecked: 0 });
    }

    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?youtube_connected=eq.true&select=*`,
      { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } }
    );
    const profiles = (await profilesRes.json()) as ProfileRow[];

    const subscribeTasksRes = await fetch(
      `${SUPABASE_URL}/rest/v1/tasks?task_type=eq.subscribe&verification_method=eq.youtube_api&select=*`,
      { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } }
    );
    const subscribeTasks = (await subscribeTasksRes.json()) as TaskRow[];

    let rechecked = 0;
    let revoked = 0;

    for (const profile of profiles) {
      let accessToken = profile.youtube_access_token;
      const expiresAt = profile.youtube_token_expires_at ? new Date(profile.youtube_token_expires_at).getTime() : 0;
      if (!accessToken || Date.now() >= expiresAt - 60_000) {
        if (!profile.youtube_refresh_token) continue;
        const refreshed = await refreshAccessToken(profile.youtube_refresh_token);
        if (!refreshed) continue;
        accessToken = refreshed.access_token;
        await supabasePatch("profiles", `id=eq.${profile.id}`, {
          youtube_access_token: accessToken,
          youtube_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      for (const task of subscribeTasks) {
        const targetChannelId = extractChannelId(task.target_url);
        if (!targetChannelId) continue;

        const completionsRes = await fetch(
          `${SUPABASE_URL}/rest/v1/task_completions?user_id=eq.${profile.id}&task_id=eq.${task.id}&status=eq.verified&select=*`,
          { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } }
        );
        const completions = (await completionsRes.json()) as CompletionRow[];

        for (const completion of completions) {
          rechecked++;
          try {
            const subRes = await fetch(
              `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&forChannelId=${targetChannelId}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (subRes.ok) {
              const subJson = await subRes.json();
              const stillSubscribed = (subJson?.items?.length ?? 0) > 0;
              if (!stillSubscribed) {
                const now = new Date().toISOString();
                await supabasePatch("task_completions", `id=eq.${completion.id}`, {
                  status: "revoked",
                  updated_at: now,
                });
                await supabasePatch("profiles", `id=eq.${profile.id}`, {
                  pts: Math.max(0, profile.pts - task.pts_value),
                  updated_at: now,
                });
                await fetch(`${SUPABASE_URL}/rest/v1/verification_logs`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                    apikey: SERVICE_ROLE_KEY,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    user_id: profile.id,
                    task_id: task.id,
                    action: "recheck",
                    status: "revoked",
                    details: { reason: "unsubscribed", pts_deducted: task.pts_value },
                  }),
                });
                revoked++;
              }
            }
          } catch {
            // skip this completion on error
          }
        }
      }
    }

    return json({ message: "Re-check complete.", rechecked, revoked });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
