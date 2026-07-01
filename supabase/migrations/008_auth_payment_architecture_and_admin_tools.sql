-- ============================================================
-- Auth reset flows, tenant payment architecture, trial lifecycle,
-- and admin communication tooling
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS paystack_secret_key TEXT,
  ADD COLUMN IF NOT EXISTS mpesa_consumer_key TEXT,
  ADD COLUMN IF NOT EXISTS mpesa_consumer_secret TEXT,
  ADD COLUMN IF NOT EXISTS mpesa_passkey TEXT;

ALTER TABLE tenant_subscriptions
  ADD COLUMN IF NOT EXISTS trial_ending_warning_sent_at TIMESTAMPTZ;

ALTER TABLE tenant_subscriptions
  DROP CONSTRAINT IF EXISTS tenant_subscriptions_status_check;

ALTER TABLE tenant_subscriptions
  ADD CONSTRAINT tenant_subscriptions_status_check
  CHECK (status IN ('trialing', 'active', 'past_due', 'suspended', 'cancelled'));

CREATE TABLE IF NOT EXISTS tenant_communications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sent_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  subject          TEXT NOT NULL,
  message          TEXT NOT NULL,
  channel          TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient_count  INTEGER NOT NULL DEFAULT 0,
  filter_criteria  JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_trial_warning ON tenant_subscriptions(trial_ending_warning_sent_at);
CREATE INDEX IF NOT EXISTS idx_tenant_communications_sent_at ON tenant_communications(sent_at DESC);

ALTER TABLE tenant_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON tenant_communications;
CREATE POLICY "service_role_all" ON tenant_communications
FOR ALL TO service_role USING (true);
