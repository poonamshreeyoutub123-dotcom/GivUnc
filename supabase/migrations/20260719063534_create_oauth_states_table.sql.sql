/*
# Create oauth_states table for custom YouTube OAuth flow

1. Purpose
- The app uses a custom Google OAuth flow (not Supabase's built-in Google provider)
- to connect a user's YouTube account for task verification.
- OAuth state tokens must be persisted across edge function instances,
- so we store them in this table keyed by an unguessable `state` string.

2. New Tables
- `oauth_states`
  - `id` (uuid, primary key)
  - `state` (text, unique, not null) — random unguessable token sent to Google
  - `user_id` (uuid, not null) — the authenticated user this flow belongs to
  - `next_path` (text, nullable) — where to redirect the user after completion
  - `used` (boolean, default false) — prevents replay of a consumed state
  - `created_at` (timestamptz, default now())

3. Security
- Enable RLS on `oauth_states`.
- Owner-scoped CRUD: an authenticated user can only read/insert their own states.
- The edge function uses the service role key (bypasses RLS) to validate state
- during the OAuth callback, so no public read policy is needed for cross-user access.
*/

CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  next_path text,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_oauth_states" ON oauth_states;
CREATE POLICY "select_own_oauth_states" ON oauth_states FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_oauth_states" ON oauth_states;
CREATE POLICY "insert_own_oauth_states" ON oauth_states FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_oauth_states" ON oauth_states;
CREATE POLICY "delete_own_oauth_states" ON oauth_states FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
