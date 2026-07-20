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

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtubepartner-channel-audit",
].join(" ");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url, ...corsHeaders } });
}

async function getUserFromToken(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SERVICE_ROLE_KEY,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/youtube-oauth/, "").replace(/^\/+/, "");

  try {
    // /start — create OAuth state, return Google consent URL
    if (path === "start" || path === "" || path === "/") {
      if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

      const userId = await getUserFromToken(req);
      if (!userId) return json({ error: "Unauthorized" }, 401);

      const body = await req.json().catch(() => ({}));
      const nextPath = body?.next || "/tasks";

      const state = crypto.randomUUID();
      const redirectUri = `${url.origin}/functions/v1/youtube-oauth/callback`;

      await fetch(`${SUPABASE_URL}/rest/v1/oauth_states`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ state, user_id: userId, next_path: nextPath }),
      });

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
        state,
      });

      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }

    // /callback — Google redirects here with ?code=...&state=...
    if (path === "callback" || path === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const errorParam = url.searchParams.get("error");

      const appOrigin = url.origin;

      if (errorParam) {
        return redirect(`${appOrigin}/auth/callback?error=oauth_denied`);
      }
      if (!code || !state) {
        return redirect(`${appOrigin}/auth/callback?error=missing_params`);
      }

      // Validate state
      const stateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/oauth_states?state=eq.${encodeURIComponent(state)}&select=*`,
        { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } }
      );
      const stateRows = (await stateRes.json()) as Array<{
        state: string;
        user_id: string;
        next_path: string | null;
        used: boolean;
      }>;
      const stateRow = stateRows[0];

      if (!stateRow || stateRow.used) {
        return redirect(`${appOrigin}/auth/callback?error=invalid_state`);
      }

      // Mark state as used
      await fetch(`${SUPABASE_URL}/rest/v1/oauth_states?state=eq.${encodeURIComponent(state)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ used: true }),
      });

      // Exchange code for tokens
      const redirectUri = `${appOrigin}/functions/v1/youtube-oauth/callback`;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error("Token exchange failed:", errBody);
        return redirect(`${appOrigin}/auth/callback?error=token_exchange_failed`);
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      // Fetch channel id
      let channelId: string | null = null;
      try {
        const chRes = await fetch(
          "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        if (chRes.ok) {
          const chJson = await chRes.json();
          channelId = chJson?.items?.[0]?.id ?? null;
        }
      } catch {
        // non-fatal
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Store tokens in profile
      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${stateRow.user_id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            apikey: SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            youtube_connected: true,
            youtube_access_token: tokens.access_token,
            youtube_refresh_token: tokens.refresh_token ?? null,
            youtube_channel_id: channelId,
            youtube_token_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      if (!updateRes.ok) {
        console.error("Profile update failed:", await updateRes.text());
        return redirect(`${appOrigin}/auth/callback?error=profile_update_failed`);
      }

      const next = stateRow.next_path || "/tasks";
      return redirect(`${appOrigin}/auth/callback?success=1&next=${encodeURIComponent(next)}`);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("youtube-oauth error:", err);
    return json({ error: err.message }, 500);
  }
});
