-- ============================================================
-- FlowFi billing trials, grace grants, shipping rules, and guest session credits
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  period        TEXT NOT NULL DEFAULT 'monthly',
  router_limit  INTEGER,
  description   TEXT,
  features      JSONB NOT NULL DEFAULT '[]'::jsonb,
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  trial_days    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_plans_updated_at ON plans;
CREATE TRIGGER trg_plans_updated_at
BEFORE UPDATE ON plans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

WITH seeded_plans AS (
  SELECT COALESCE(
    (
      SELECT value::jsonb
      FROM platform_settings
      WHERE key = 'workspace_plans'
      LIMIT 1
    ),
    '[
      {
        "id": "starter",
        "name": "Starter",
        "price": 4000,
        "period": "monthly",
        "router_limit": 1,
        "description": "A light monthly workspace plan for smaller venues getting started with paid guest WiFi.",
        "features": [
          "M-Pesa and Paystack collections",
          "Captive portal branding",
          "Loyalty rewards",
          "Basic analytics"
        ],
        "featured": false,
        "trial_days": 14
      },
      {
        "id": "pro",
        "name": "Pro",
        "price": 8500,
        "period": "monthly",
        "router_limit": 5,
        "description": "The default production plan for active venues that need loyalty, shop sales, and deeper operations.",
        "features": [
          "M-Pesa and Paystack collections",
          "Loyalty rewards",
          "Shop storefront",
          "Priority support"
        ],
        "featured": true,
        "trial_days": 14
      },
      {
        "id": "enterprise",
        "name": "Enterprise",
        "price": 18000,
        "period": "monthly",
        "router_limit": null,
        "description": "Custom support and rollout capacity for large, multi-site, or white-label deployments.",
        "features": [
          "Multi-site operations",
          "White-label rollout support",
          "Priority incident response",
          "Dedicated onboarding",
          "Custom reporting"
        ],
        "featured": false,
        "trial_days": 30
      }
    ]'::jsonb
  ) AS plans_json
)
INSERT INTO plans (
  id,
  name,
  price,
  period,
  router_limit,
  description,
  features,
  featured,
  trial_days,
  sort_order
)
SELECT
  COALESCE(NULLIF(plan->>'id', ''), CONCAT('plan-', ordinality)),
  COALESCE(NULLIF(plan->>'name', ''), CONCAT('Plan ', ordinality)),
  COALESCE(NULLIF(plan->>'price', ''), '0')::NUMERIC(10,2),
  COALESCE(NULLIF(plan->>'period', ''), 'monthly'),
  CASE
    WHEN plan ? 'router_limit' AND jsonb_typeof(plan->'router_limit') = 'number'
      THEN (plan->>'router_limit')::INTEGER
    WHEN COALESCE(plan->>'router_limit', '') ~ '^\d+$'
      THEN (plan->>'router_limit')::INTEGER
    ELSE NULL
  END,
  NULLIF(plan->>'description', ''),
  COALESCE(plan->'features', '[]'::jsonb),
  COALESCE((plan->>'featured')::BOOLEAN, FALSE),
  CASE
    WHEN COALESCE(plan->>'trial_days', '') ~ '^\d+$' THEN (plan->>'trial_days')::INTEGER
    ELSE 0
  END,
  ordinality::INTEGER
FROM seeded_plans,
LATERAL jsonb_array_elements(plans_json) WITH ORDINALITY AS source(plan, ordinality)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                 UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id                   TEXT REFERENCES plans(id) ON DELETE SET NULL,
  plan_name                 TEXT NOT NULL,
  billing_period            TEXT NOT NULL DEFAULT 'monthly',
  amount                    NUMERIC(10,2) NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'trialing',
  trial_days                INTEGER NOT NULL DEFAULT 0,
  trial_starts_at           TIMESTAMPTZ,
  trial_ends_at             TIMESTAMPTZ,
  billing_starts_at         TIMESTAMPTZ,
  current_period_starts_at  TIMESTAMPTZ,
  current_period_ends_at    TIMESTAMPTZ,
  next_billing_date         TIMESTAMPTZ,
  last_invoiced_at          TIMESTAMPTZ,
  grace_days_total          INTEGER NOT NULL DEFAULT 0,
  metadata                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_subscriptions_status_check
    CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled'))
);

DROP TRIGGER IF EXISTS trg_tenant_subscriptions_updated_at ON tenant_subscriptions;
CREATE TRIGGER trg_tenant_subscriptions_updated_at
BEFORE UPDATE ON tenant_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS tenant_invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES tenant_subscriptions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id         TEXT REFERENCES plans(id) ON DELETE SET NULL,
  plan_name       TEXT NOT NULL,
  billing_period  TEXT NOT NULL DEFAULT 'monthly',
  amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  invoice_type    TEXT NOT NULL DEFAULT 'renewal',
  status          TEXT NOT NULL DEFAULT 'pending',
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  due_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMPTZ,
  description     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_invoices_period_unique UNIQUE (subscription_id, period_start),
  CONSTRAINT tenant_invoices_status_check
    CHECK (status IN ('pending', 'paid', 'failed', 'void')),
  CONSTRAINT tenant_invoices_type_check
    CHECK (invoice_type IN ('initial', 'renewal', 'manual'))
);

DROP TRIGGER IF EXISTS trg_tenant_invoices_updated_at ON tenant_invoices;
CREATE TRIGGER trg_tenant_invoices_updated_at
BEFORE UPDATE ON tenant_invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS grace_grants (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id       UUID REFERENCES tenant_subscriptions(id) ON DELETE SET NULL,
  days_granted          INTEGER NOT NULL CHECK (days_granted > 0),
  reason                TEXT NOT NULL,
  granted_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  previous_billing_date TIMESTAMPTZ,
  new_billing_date      TIMESTAMPTZ,
  granted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_zones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  counties        JSONB NOT NULL DEFAULT '[]'::jsonb,
  regions         JSONB NOT NULL DEFAULT '[]'::jsonb,
  towns           JSONB NOT NULL DEFAULT '[]'::jsonb,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_days  INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_shipping_zones_updated_at ON shipping_zones;
CREATE TRIGGER trg_shipping_zones_updated_at
BEFORE UPDATE ON shipping_zones
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS guest_sessions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id         UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  router_id          UUID REFERENCES routers(id) ON DELETE SET NULL,
  package_id         UUID REFERENCES packages(id) ON DELETE SET NULL,
  username           TEXT,
  phone              TEXT,
  mac_address        TEXT,
  time_purchased     INTEGER NOT NULL DEFAULT 0,
  time_used          INTEGER NOT NULL DEFAULT 0,
  time_credited      INTEGER NOT NULL DEFAULT 0,
  time_remaining     INTEGER NOT NULL DEFAULT 0,
  credited_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  last_credit_reason TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_guest_sessions_updated_at ON guest_sessions;
CREATE TRIGGER trg_guest_sessions_updated_at
BEFORE UPDATE ON guest_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_country TEXT,
  ADD COLUMN IF NOT EXISTS shipping_county TEXT,
  ADD COLUMN IF NOT EXISTS shipping_region TEXT,
  ADD COLUMN IF NOT EXISTS shipping_town TEXT,
  ADD COLUMN IF NOT EXISTS shipping_zone_id UUID REFERENCES shipping_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_quote_status TEXT NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS shipping_estimated_days INTEGER;

UPDATE shop_orders
SET
  payment_status = COALESCE(payment_status, 'pending'),
  payment_provider_data = COALESCE(payment_provider_data, '{}'::jsonb),
  shipping_quote_status = COALESCE(shipping_quote_status, 'not_requested')
WHERE
  payment_status IS NULL
  OR payment_provider_data IS NULL
  OR shipping_quote_status IS NULL;

ALTER TABLE shop_orders
  DROP CONSTRAINT IF EXISTS shop_orders_payment_status_check;
ALTER TABLE shop_orders
  ADD CONSTRAINT shop_orders_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

ALTER TABLE shop_orders
  DROP CONSTRAINT IF EXISTS shop_orders_shipping_quote_status_check;
ALTER TABLE shop_orders
  ADD CONSTRAINT shop_orders_shipping_quote_status_check
  CHECK (shipping_quote_status IN ('not_requested', 'matched', 'manual_quote'));

INSERT INTO tenant_subscriptions (
  tenant_id,
  plan_id,
  plan_name,
  billing_period,
  amount,
  status,
  trial_days,
  billing_starts_at,
  current_period_starts_at,
  current_period_ends_at,
  next_billing_date,
  last_invoiced_at
)
SELECT
  t.id,
  plan_match.id,
  COALESCE(plan_match.name, t.workspace_plan_name, 'Workspace plan'),
  COALESCE(NULLIF(t.workspace_billing_period, ''), plan_match.period, 'monthly'),
  COALESCE(plan_match.price, 0),
  'active',
  COALESCE(plan_match.trial_days, 0),
  billing_anchor,
  billing_anchor,
  CASE
    WHEN COALESCE(NULLIF(t.workspace_billing_period, ''), plan_match.period, 'monthly') = 'yearly'
      THEN billing_anchor + INTERVAL '1 year'
    WHEN COALESCE(NULLIF(t.workspace_billing_period, ''), plan_match.period, 'monthly') = 'quarterly'
      THEN billing_anchor + INTERVAL '3 months'
    WHEN COALESCE(NULLIF(t.workspace_billing_period, ''), plan_match.period, 'monthly') = 'weekly'
      THEN billing_anchor + INTERVAL '1 week'
    WHEN COALESCE(NULLIF(t.workspace_billing_period, ''), plan_match.period, 'monthly') = 'daily'
      THEN billing_anchor + INTERVAL '1 day'
    ELSE billing_anchor + INTERVAL '1 month'
  END,
  CASE
    WHEN COALESCE(NULLIF(t.workspace_billing_period, ''), plan_match.period, 'monthly') = 'yearly'
      THEN billing_anchor + INTERVAL '1 year'
    WHEN COALESCE(NULLIF(t.workspace_billing_period, ''), plan_match.period, 'monthly') = 'quarterly'
      THEN billing_anchor + INTERVAL '3 months'
    WHEN COALESCE(NULLIF(t.workspace_billing_period, ''), plan_match.period, 'monthly') = 'weekly'
      THEN billing_anchor + INTERVAL '1 week'
    WHEN COALESCE(NULLIF(t.workspace_billing_period, ''), plan_match.period, 'monthly') = 'daily'
      THEN billing_anchor + INTERVAL '1 day'
    ELSE billing_anchor + INTERVAL '1 month'
  END,
  billing_anchor
FROM (
  SELECT
    tenants.*,
    COALESCE(tenants.workspace_paid_at, tenants.created_at, NOW()) AS billing_anchor
  FROM tenants
) AS t
LEFT JOIN LATERAL (
  SELECT *
  FROM plans
  WHERE
    id = t.workspace_plan_id
    OR name = t.workspace_plan_name
  ORDER BY CASE WHEN id = t.workspace_plan_id THEN 0 ELSE 1 END
  LIMIT 1
) AS plan_match ON TRUE
WHERE
  (t.workspace_plan_id IS NOT NULL OR t.workspace_plan_name IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM tenant_subscriptions existing
    WHERE existing.tenant_id = t.id
  );

INSERT INTO guest_sessions (
  session_id,
  tenant_id,
  router_id,
  package_id,
  username,
  phone,
  mac_address,
  time_purchased,
  time_used,
  time_credited,
  time_remaining
)
SELECT
  s.id,
  s.tenant_id,
  s.router_id,
  s.package_id,
  s.username,
  s.phone,
  s.mac_address,
  purchased_minutes,
  GREATEST(0, purchased_minutes - current_remaining_minutes),
  GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.expires_at - (s.created_at + make_interval(mins => purchased_minutes)))) / 60.0)::INTEGER),
  current_remaining_minutes
FROM (
  SELECT
    sessions.*,
    GREATEST(
      0,
      COALESCE(packages.duration_minutes, CEIL(EXTRACT(EPOCH FROM (sessions.expires_at - sessions.created_at)) / 60.0)::INTEGER, 0)
    ) AS purchased_minutes,
    GREATEST(
      0,
      CEIL(EXTRACT(EPOCH FROM (sessions.expires_at - NOW())) / 60.0)::INTEGER
    ) AS current_remaining_minutes
  FROM sessions
  LEFT JOIN packages ON packages.id = sessions.package_id
) AS s
ON CONFLICT (session_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status ON tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_next_billing_date ON tenant_subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_tenant_invoices_tenant_id ON tenant_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invoices_status ON tenant_invoices(status);
CREATE INDEX IF NOT EXISTS idx_grace_grants_tenant_id ON grace_grants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipping_zones_active ON shipping_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_tenant_id ON guest_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_phone ON guest_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_mac_address ON guest_sessions(mac_address);
CREATE INDEX IF NOT EXISTS idx_shop_orders_shipping_zone_id ON shop_orders(shipping_zone_id);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE grace_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON plans;
CREATE POLICY "service_role_all" ON plans FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all" ON tenant_subscriptions;
CREATE POLICY "service_role_all" ON tenant_subscriptions FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all" ON tenant_invoices;
CREATE POLICY "service_role_all" ON tenant_invoices FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all" ON grace_grants;
CREATE POLICY "service_role_all" ON grace_grants FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all" ON shipping_zones;
CREATE POLICY "service_role_all" ON shipping_zones FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all" ON guest_sessions;
CREATE POLICY "service_role_all" ON guest_sessions FOR ALL TO service_role USING (true);
