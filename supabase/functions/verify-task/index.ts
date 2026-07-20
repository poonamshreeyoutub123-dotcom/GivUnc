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

async function getValidAccessToken(profile: ProfileRow): Promise<string | null> {
  if (!profile.youtube_access_token) return null;
  const expiresAt = profile.youtube_token_expires_at ? new Date(profile.youtube_token_expires_at).getTime() : 0;
  if (Date.now() < expiresAt - 60_000) return profile.youtube_access_token;
  if (!profile.youtube_refresh_token) return null;

  const refreshed = await refreshAccessToken(profile.youtube_refresh_token);
  if (!refreshed) return null;

  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabasePatch("profiles", `id=eq.${profile.id}`, {
    youtube_access_token: refreshed.access_token,
    youtube_token_expires_at: newExpiry,
    updated_at: new Date().toISOString(),
  });
  return refreshed.access_token;
}

function extractChannelId(url: string): string | null {
  const m = url.match(/channel\/(UC[A-Za-z0-9_-]{22})/);
  if (m) return m[1];
  return null;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /embed\/([A-Za-z0-9_-]{11})/,
    /shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

interface TaskRow {
  id: string;
  title: string;
  task_type: string;
  pts_value: number;
  verification_method: string;
  target_url: string;
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
    const { taskId, userId } = await req.json();
    if (!taskId || !userId) return json({ error: "Missing taskId or userId" }, 400);

    const [taskRes, profileRes, completionRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${taskId}&select=*`, {
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, {
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
      }),
      fetch(
        `${SUPABASE_URL}/rest/v1/task_completions?user_id=eq.${userId}&task_id=eq.${taskId}&select=*`,
        { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } }
      ),
    ]);

    const taskData = (await taskRes.json()) as TaskRow[];
    const profileData = (await profileRes.json()) as ProfileRow[];
    const completionData = (await completionRes.json()) as CompletionRow[];

    const task = taskData[0];
    const profile = profileData[0];
    const completion = completionData[0];

    if (!task || !profile || !completion) {
      return json({ error: "Task, profile, or completion not found" }, 404);
    }

    await fetch(`${SUPABASE_URL}/rest/v1/verification_logs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        task_id: taskId,
        action: "verify",
        status: "pending",
        details: { method: task.verification_method, task_type: task.task_type },
      }),
    });

    if (task.verification_method !== "youtube_api") {
      return json({ verified: false, message: "Task submitted for manual review." });
    }

    if (!profile.youtube_connected) {
      return json({
        verified: false,
        message: "YouTube account not connected. Please connect your YouTube account first.",
      });
    }

    const accessToken = await getValidAccessToken(profile);
    if (!accessToken) {
      return json({
        verified: false,
        message: "YouTube connection expired. Please reconnect your account.",
      });
    }

    let verified = false;
    const taskType = task.task_type;

    if (taskType === "subscribe") {
      const targetChannelId = extractChannelId(task.target_url);
      if (!targetChannelId) {
        return json({ verified: false, message: "Invalid target channel URL for subscribe task." });
      }
      const subRes = await fetch(
        `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&forChannelId=${targetChannelId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (subRes.ok) {
        const subJson = await subRes.json();
        verified = (subJson?.items?.length ?? 0) > 0;
      }
    } else if (taskType === "like") {
      const videoId = extractVideoId(task.target_url);
      if (!videoId) {
        return json({ verified: false, message: "Invalid target video URL for like task." });
      }
      const ratingRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos/getRating?id=${videoId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (ratingRes.ok) {
        const ratingJson = await ratingRes.json();
        const items = ratingJson?.items ?? [];
        verified = items.some((it: { rating: string }) => it.rating === "like");
      }
    } else if (taskType === "view") {
      const videoId = extractVideoId(task.target_url);
      if (!videoId) {
        return json({ verified: false, message: "Invalid target video URL for view task." });
      }
      // Best-effort: record a video rating request. YouTube API doesn't expose per-user view counts,
      // so we treat a successful API call as evidence the user interacted with the video.
      const ratingRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos/getRating?id=${videoId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      verified = ratingRes.ok;
    } else {
      return json({ verified: false, message: `Unknown task type: ${taskType}` });
    }

    if (verified) {
      const now = new Date().toISOString();
      await supabasePatch("task_completions", `id=eq.${completion.id}`, {
        status: "verified",
        verified_at: now,
        updated_at: now,
      });
      await supabasePatch("profiles", `id=eq.${userId}`, {
        pts: profile.pts + task.pts_value,
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
          user_id: userId,
          task_id: taskId,
          action: "verify",
          status: "verified",
          details: { task_type: taskType, pts_awarded: task.pts_value },
        }),
      });
      return json({ verified: true, message: `Verified! +${task.pts_value} PTS awarded.` });
    }

    await supabasePatch("task_completions", `id=eq.${completion.id}`, {
      status: "pending",
      updated_at: new Date().toISOString(),
    });
    return json({
      verified: false,
      message: "Could not verify the action yet. Make sure you've completed it, then try again.",
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
