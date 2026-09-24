/*
# Email Outreach Scheduler — Supabase Schema

Migrates the app from MySQL/Express to Supabase (Postgres + Auth + RLS).

## New Tables

1. `profiles` — extends Supabase's built-in `auth.users` with display name and avatar URL.
2. `sender_configs` — per-user email sender settings (rate limits, from-name/email).
3. `campaigns` — email campaign records.
4. `recipients` — recipient email addresses per campaign.
5. `email_deliveries` — individual email delivery records.
6. `slack_integrations` — Slack connection info per user.

## Security (RLS)
- RLS enabled on ALL tables.
- All tables are owner-scoped: users can only CRUD their own rows (auth.uid() = user_id).

## Triggers
- `handle_new_user` — automatically creates a profile row and a default sender_config when a new user signs up.
*/

-- profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- sender_configs table
CREATE TABLE IF NOT EXISTS sender_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  from_name text NOT NULL DEFAULT '',
  from_email text NOT NULL,
  hourly_limit int NOT NULL DEFAULT 50,
  min_delay_sec int NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sender_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_senders" ON sender_configs;
CREATE POLICY "select_own_senders" ON sender_configs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_senders" ON sender_configs;
CREATE POLICY "insert_own_senders" ON sender_configs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_senders" ON sender_configs;
CREATE POLICY "update_own_senders" ON sender_configs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_senders" ON sender_configs;
CREATE POLICY "delete_own_senders" ON sender_configs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES sender_configs(id) ON DELETE SET NULL,
  subject text NOT NULL,
  body text NOT NULL,
  start_time timestamptz NOT NULL,
  min_delay_sec int NOT NULL DEFAULT 60,
  hourly_limit int NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'pending',
  total_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_campaigns" ON campaigns;
CREATE POLICY "select_own_campaigns" ON campaigns FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_campaigns" ON campaigns;
CREATE POLICY "insert_own_campaigns" ON campaigns FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_campaigns" ON campaigns;
CREATE POLICY "update_own_campaigns" ON campaigns FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_campaigns" ON campaigns;
CREATE POLICY "delete_own_campaigns" ON campaigns FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- recipients table
CREATE TABLE IF NOT EXISTS recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);

ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recipients" ON recipients;
CREATE POLICY "select_own_recipients" ON recipients FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = recipients.campaign_id AND campaigns.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_recipients" ON recipients;
CREATE POLICY "insert_own_recipients" ON recipients FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = recipients.campaign_id AND campaigns.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_recipients" ON recipients;
CREATE POLICY "delete_own_recipients" ON recipients FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = recipients.campaign_id AND campaigns.user_id = auth.uid())
  );

-- email_deliveries table
CREATE TABLE IF NOT EXISTS email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_uid uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES sender_configs(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  to_email text NOT NULL,
  to_name text NOT NULL DEFAULT '',
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_time timestamptz NOT NULL,
  actual_send_time timestamptz,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  last_error text,
  ethereal_preview_url text NOT NULL DEFAULT '',
  ethereal_message_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_deliveries" ON email_deliveries;
CREATE POLICY "select_own_deliveries" ON email_deliveries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_deliveries" ON email_deliveries;
CREATE POLICY "insert_own_deliveries" ON email_deliveries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_deliveries" ON email_deliveries;
CREATE POLICY "update_own_deliveries" ON email_deliveries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_deliveries" ON email_deliveries;
CREATE POLICY "delete_own_deliveries" ON email_deliveries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- slack_integrations table
CREATE TABLE IF NOT EXISTS slack_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id text NOT NULL,
  team_name text NOT NULL DEFAULT '',
  is_connected boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, team_id)
);

ALTER TABLE slack_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_slack" ON slack_integrations;
CREATE POLICY "select_own_slack" ON slack_integrations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_slack" ON slack_integrations;
CREATE POLICY "insert_own_slack" ON slack_integrations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_slack" ON slack_integrations;
CREATE POLICY "update_own_slack" ON slack_integrations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_slack" ON slack_integrations;
CREATE POLICY "delete_own_slack" ON slack_integrations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_user_id ON email_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON email_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_scheduled_time ON email_deliveries(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_deliveries_campaign_id ON email_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign_id ON recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_senders_user_id ON sender_configs(user_id);

-- Trigger: create profile + default sender when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO sender_configs (user_id, from_name, from_email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();