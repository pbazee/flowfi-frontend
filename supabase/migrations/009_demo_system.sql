-- ============================================================
-- FlowFi — Demo System Tables
-- Run this in your Supabase SQL editor
-- ============================================================

-- ─────────────────────────────────────────────────
-- PROFILES (linked to Supabase auth.users)
-- Stores role for superadmin checks
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'tenant_admin',
  full_name   TEXT,
  email       TEXT,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON profiles;
CREATE POLICY "service_role_all" ON profiles
  FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "users_own_profile" ON profiles;
CREATE POLICY "users_own_profile" ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

-- ─────────────────────────────────────────────────
-- DEMO META (tracks last reset time)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demo_meta (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reset_by      TEXT
);

ALTER TABLE demo_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON demo_meta;
CREATE POLICY "service_role_all" ON demo_meta
  FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "authenticated_read" ON demo_meta;
CREATE POLICY "authenticated_read" ON demo_meta
  FOR SELECT TO authenticated USING (true);

-- Insert default row (only if table is empty)
INSERT INTO demo_meta (last_reset_at, reset_by)
SELECT NOW(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM demo_meta);

-- ─────────────────────────────────────────────────
-- DEMO CUSTOMERS (ISP subscriber records)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demo_customers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  phone             TEXT,
  email             TEXT,
  package_id        UUID REFERENCES packages(id) ON DELETE SET NULL,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  join_date         DATE DEFAULT CURRENT_DATE,
  next_billing_date DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_customers_tenant ON demo_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_demo_customers_status ON demo_customers(status);

ALTER TABLE demo_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON demo_customers;
CREATE POLICY "service_role_all" ON demo_customers
  FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "tenant_own" ON demo_customers;
CREATE POLICY "tenant_own" ON demo_customers
  FOR ALL TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );
