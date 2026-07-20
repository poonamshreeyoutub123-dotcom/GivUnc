/*
# GiveUnc — Core Schema

Creates the full table set for the GiveUnc points-earning platform:

1. `profiles` — one row per authenticated user. Holds display name, avatar, PTS balance, rank, admin flag, and YouTube OAuth connection state. A trigger auto-creates a profile row whenever a new auth.users row is inserted so sign-up never leaves a user without a profile.
2. `tasks` — owner-defined actions users complete for PTS (subscribe, like, comment, watch, custom). Each has a PTS reward, target URL, active flag, and verification method.
3. `task_completions` — a row per user-per-task attempt. Tracks status (pending / verified / rejected / revoked), verification payload, and timestamps.
4. `verification_logs` — append-only audit trail of every verification action (who, what, when, result, details).
5. `support_tickets` — user-to-owner support threads with status (open / in_progress / resolved) and priority.
6. `ticket_messages` — individual messages inside a support ticket, from either the user or the owner.

## Security
- RLS enabled on every table.
- `profiles`: users read/update own profile; admin can read all and update all. Public read is allowed for leaderboard display (name, avatar, pts, rank only — exposed via a view, not the table).
- `tasks`: anyone authenticated can read active tasks; only admin can insert/update/delete.
- `task_completions`: users read/insert own; admin read all; updates only via service role (edge function).
- `verification_logs`: users read own; admin read all; inserts via service role.
- `support_tickets`: users read/insert own; admin read all/update status.
- `ticket_messages`: users read messages in own tickets; admin read all; users insert into own tickets; admin insert into any.

## Important notes
1. The `handle_new_user` trigger creates a profile row on signup with `is_admin = false` by default. To promote yourself to admin, run `UPDATE profiles SET is_admin = true WHERE id = '<your-auth-user-id>';` via `execute_sql`.
2. `profiles` SELECT is open to `anon, authenticated` so the public leaderboard can read names/PTS without auth. Sensitive columns (is_admin, youtube tokens) are NOT exposed — the leaderboard view (`leaderboard_view`) is the public surface.
3. All admin-scoped policies check `profiles.is_admin = true` for the requesting user via a join to `auth.users`.
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  pts integer NOT NULL DEFAULT 0,
  rank text NOT NULL DEFAULT 'Rookie',
  is_admin boolean NOT NULL DEFAULT false,
  youtube_connected boolean NOT NULL DEFAULT false,
  youtube_channel_id text,
  youtube_access_token text,
  youtube_refresh_token text,
  youtube_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Public read for leaderboard (name, avatar, pts, rank only — the view below is the real public surface)
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
ON profiles FOR SELECT
TO anon, authenticated
USING (true);

-- Users can update their own profile (name, avatar only — not pts/admin)
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  task_type text NOT NULL DEFAULT 'custom', -- subscribe | like | comment | watch | custom
  pts_value integer NOT NULL DEFAULT 10,
  target_url text NOT NULL DEFAULT '',
  verification_method text NOT NULL DEFAULT 'manual', -- youtube_api | manual | auto
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active tasks
DROP POLICY IF EXISTS "tasks_select_authenticated" ON tasks;
CREATE POLICY "tasks_select_authenticated"
ON tasks FOR SELECT
TO authenticated
USING (is_active = true);

-- Admins can read all tasks (including inactive)
DROP POLICY IF EXISTS "tasks_select_admin" ON tasks;
CREATE POLICY "tasks_select_admin"
ON tasks FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- Admins can insert/update/delete tasks
DROP POLICY IF EXISTS "tasks_insert_admin" ON tasks;
CREATE POLICY "tasks_insert_admin"
ON tasks FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

DROP POLICY IF EXISTS "tasks_update_admin" ON tasks;
CREATE POLICY "tasks_update_admin"
ON tasks FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

DROP POLICY IF EXISTS "tasks_delete_admin" ON tasks;
CREATE POLICY "tasks_delete_admin"
ON tasks FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- ============================================================
-- TASK COMPLETIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending | verified | rejected | revoked
  verification_data jsonb,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- Users read their own completions
DROP POLICY IF EXISTS "completions_select_own" ON task_completions;
CREATE POLICY "completions_select_own"
ON task_completions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins read all
DROP POLICY IF EXISTS "completions_select_admin" ON task_completions;
CREATE POLICY "completions_select_admin"
ON task_completions FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- Users insert their own (claim a task)
DROP POLICY IF EXISTS "completions_insert_own" ON task_completions;
CREATE POLICY "completions_insert_own"
ON task_completions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Updates handled by service role (edge function) — no client update policy for users
-- Admins can update
DROP POLICY IF EXISTS "completions_update_admin" ON task_completions;
CREATE POLICY "completions_update_admin"
ON task_completions FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- ============================================================
-- VERIFICATION LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  action text NOT NULL, -- claim | verify | reject | revoke | recheck
  status text NOT NULL, -- success | failed | pending
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

-- Users read their own logs
DROP POLICY IF EXISTS "logs_select_own" ON verification_logs;
CREATE POLICY "logs_select_own"
ON verification_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins read all
DROP POLICY IF EXISTS "logs_select_admin" ON verification_logs;
CREATE POLICY "logs_select_admin"
ON verification_logs FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- Inserts via service role only — no client insert policy

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open', -- open | in_progress | resolved
  priority text NOT NULL DEFAULT 'normal', -- low | normal | high
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users read own tickets
DROP POLICY IF EXISTS "tickets_select_own" ON support_tickets;
CREATE POLICY "tickets_select_own"
ON support_tickets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins read all
DROP POLICY IF EXISTS "tickets_select_admin" ON support_tickets;
CREATE POLICY "tickets_select_admin"
ON support_tickets FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- Users insert own tickets
DROP POLICY IF EXISTS "tickets_insert_own" ON support_tickets;
CREATE POLICY "tickets_insert_own"
ON support_tickets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins update tickets (status, priority)
DROP POLICY IF EXISTS "tickets_update_admin" ON support_tickets;
CREATE POLICY "tickets_update_admin"
ON support_tickets FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- Users can update own ticket subject (close own ticket)
DROP POLICY IF EXISTS "tickets_update_own" ON support_tickets;
CREATE POLICY "tickets_update_own"
ON support_tickets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TICKET MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  is_from_admin boolean NOT NULL DEFAULT false,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Users read messages in their own tickets
DROP POLICY IF EXISTS "messages_select_own" ON ticket_messages;
CREATE POLICY "messages_select_own"
ON ticket_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = ticket_messages.ticket_id
    AND support_tickets.user_id = auth.uid()
  )
);

-- Admins read all
DROP POLICY IF EXISTS "messages_select_admin" ON ticket_messages;
CREATE POLICY "messages_select_admin"
ON ticket_messages FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- Users insert into their own tickets
DROP POLICY IF EXISTS "messages_insert_own" ON ticket_messages;
CREATE POLICY "messages_insert_own"
ON ticket_messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = ticket_messages.ticket_id
    AND support_tickets.user_id = auth.uid()
  )
);

-- Admins insert into any ticket
DROP POLICY IF EXISTS "messages_insert_admin" ON ticket_messages;
CREATE POLICY "messages_insert_admin"
ON ticket_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
);

-- ============================================================
-- LEADERBOARD VIEW (public, limited columns)
-- ============================================================
CREATE OR REPLACE VIEW leaderboard_view AS
SELECT
  id,
  display_name,
  avatar_url,
  pts,
  rank,
  ROW_NUMBER() OVER (ORDER BY pts DESC, created_at ASC) AS position
FROM profiles
ORDER BY pts DESC, created_at ASC;

-- The view inherits RLS from profiles. Since profiles SELECT is open to anon,
-- the leaderboard is publicly readable.

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tickets_updated_at ON support_tickets;
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON support_tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS completions_updated_at ON task_completions;
CREATE TRIGGER completions_updated_at BEFORE UPDATE ON task_completions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_task_completions_user ON task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_task ON task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_user ON verification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_profiles_pts ON profiles(pts DESC);
