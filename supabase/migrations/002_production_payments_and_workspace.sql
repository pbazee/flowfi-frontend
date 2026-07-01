-- ============================================================
-- FlowFi production readiness: shop payments and workspace checkout
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS workspace_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS workspace_plan_name TEXT,
  ADD COLUMN IF NOT EXISTS workspace_billing_period TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS workspace_paid_at TIMESTAMPTZ;

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shop_orders_payment_status ON shop_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_payment_ref ON shop_orders(payment_ref);

CREATE TABLE IF NOT EXISTS workspace_orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference           TEXT UNIQUE NOT NULL,
  plan_id             TEXT NOT NULL,
  plan_name           TEXT NOT NULL,
  billing_period      TEXT NOT NULL DEFAULT 'monthly',
  amount              NUMERIC(10,2) NOT NULL,
  payment_method      TEXT NOT NULL,
  payment_status      TEXT NOT NULL DEFAULT 'pending',
  status              TEXT NOT NULL DEFAULT 'pending', -- pending, paid, activated, failed, cancelled
  payment_ref         TEXT,
  gateway_data        JSONB DEFAULT '{}'::jsonb,
  paid_at             TIMESTAMPTZ,
  tenant_id           UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  signup_email        TEXT NOT NULL,
  signup_password_hash TEXT NOT NULL,
  signup_name         TEXT NOT NULL,
  signup_phone        TEXT NOT NULL,
  business_name       TEXT NOT NULL,
  business_type       TEXT DEFAULT 'other',
  payload             JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_orders_status ON workspace_orders(status);
CREATE INDEX IF NOT EXISTS idx_workspace_orders_payment_ref ON workspace_orders(payment_ref);
CREATE INDEX IF NOT EXISTS idx_workspace_orders_signup_email ON workspace_orders(signup_email);

CREATE TRIGGER trg_workspace_orders_updated_at
BEFORE UPDATE ON workspace_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

ALTER TABLE workspace_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON workspace_orders;
CREATE POLICY "service_role_all" ON workspace_orders FOR ALL TO service_role USING (true);
