-- ============================================================
-- FlowFi schema compatibility backfill for auth, trials, grace,
-- and guest session credits.
-- Safe to run even if earlier migrations already applied.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS workspace_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS workspace_plan_name TEXT,
  ADD COLUMN IF NOT EXISTS workspace_billing_period TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS workspace_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'tenant_admin',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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

INSERT INTO plans (id, name, price, period, router_limit, description, features, featured, trial_days, sort_order)
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
FROM (
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
) AS source,
LATERAL jsonb_array_elements(source.plans_json) WITH ORDINALITY AS plan_source(plan, ordinality)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  period = EXCLUDED.period,
  router_limit = EXCLUDED.router_limit,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  featured = EXCLUDED.featured,
  trial_days = EXCLUDED.trial_days,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

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
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  CONSTRAINT tenant_invoices_period_unique UNIQUE (subscription_id, period_start)
);

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
