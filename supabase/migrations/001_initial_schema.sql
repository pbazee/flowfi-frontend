-- ============================================================
-- FlowFi — Complete Supabase Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────
-- TENANTS
-- ─────────────────────────────────────────────────
CREATE TABLE tenants (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                    TEXT NOT NULL,
  business_type           TEXT DEFAULT 'other',  -- mall, market, hotel, school, other
  status                  TEXT DEFAULT 'active', -- active, pending, suspended
  logo_url                TEXT,
  portal_primary_color    TEXT DEFAULT '#0F6E56',
  portal_secondary_color  TEXT DEFAULT '#1D9E75',
  portal_welcome_message  TEXT DEFAULT 'Welcome! Buy a package to get online.',
  custom_domain           TEXT UNIQUE,
  commission_percent      NUMERIC(5,2) DEFAULT 5.00,
  -- Payment config
  mpesa_shortcode         TEXT,
  mpesa_paybill           TEXT,
  paystack_public_key     TEXT,
  -- Contact
  contact_phone           TEXT,
  contact_email           TEXT,
  address                 TEXT,
  -- Loyalty
  loyalty_enabled         BOOLEAN DEFAULT TRUE,
  loyalty_points_per_kes  NUMERIC(5,2) DEFAULT 1.0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'tenant_admin', -- super_admin, tenant_admin
  status        TEXT NOT NULL DEFAULT 'active',        -- active, suspended
  tenant_id     UUID REFERENCES tenants(id) ON DELETE SET NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- ROUTERS
-- ─────────────────────────────────────────────────
CREATE TABLE routers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  ip_address    TEXT NOT NULL,
  port          INTEGER DEFAULT 8728,
  api_username  TEXT NOT NULL,
  api_password  TEXT NOT NULL,
  location      TEXT,
  identity      TEXT,   -- MikroTik device identity
  status        TEXT DEFAULT 'offline',  -- online, offline
  last_seen     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- PACKAGES (WiFi plans)
-- ─────────────────────────────────────────────────
CREATE TABLE packages (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  price                 NUMERIC(10,2) NOT NULL,
  duration_minutes      INTEGER NOT NULL,
  data_limit_mb         INTEGER,  -- NULL = unlimited
  speed_limit           TEXT,     -- e.g. "5M/5M" for MikroTik rate-limit
  mikrotik_profile      TEXT DEFAULT 'default',
  points_reward         INTEGER DEFAULT 0,
  happy_hour_start      TIME,     -- e.g. 21:00
  happy_hour_end        TIME,     -- e.g. 23:00
  happy_hour_discount   NUMERIC(5,2) DEFAULT 0,
  status                TEXT DEFAULT 'active',  -- active, inactive
  sort_order            INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- TRANSACTIONS
-- ─────────────────────────────────────────────────
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference       TEXT UNIQUE NOT NULL,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  package_id      UUID REFERENCES packages(id),
  phone           TEXT,
  customer_email  TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  payment_method  TEXT NOT NULL,  -- mpesa, paystack
  status          TEXT DEFAULT 'pending',  -- pending, success, failed
  mpesa_receipt   TEXT,
  gateway_ref     TEXT,           -- CheckoutRequestID or Paystack ref
  gateway_data    JSONB,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX idx_transactions_gateway_ref ON transactions(gateway_ref);
CREATE INDEX idx_transactions_status ON transactions(status);

-- ─────────────────────────────────────────────────
-- SESSIONS (active WiFi sessions)
-- ─────────────────────────────────────────────────
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  package_id      UUID REFERENCES packages(id),
  transaction_id  UUID REFERENCES transactions(id),
  voucher_id      UUID,
  router_id       UUID REFERENCES routers(id),
  username        TEXT NOT NULL,
  password        TEXT NOT NULL,
  phone           TEXT,
  mac_address     TEXT,
  ip_address      TEXT,
  status          TEXT DEFAULT 'active',  -- active, expired, terminated
  expires_at      TIMESTAMPTZ NOT NULL,
  expiry_warned   BOOLEAN DEFAULT FALSE,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_phone ON sessions(phone);

-- ─────────────────────────────────────────────────
-- VOUCHERS
-- ─────────────────────────────────────────────────
CREATE TABLE vouchers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  package_id  UUID NOT NULL REFERENCES packages(id),
  code        TEXT NOT NULL,
  batch_id    TEXT NOT NULL,
  batch_name  TEXT,
  username    TEXT NOT NULL,
  password    TEXT NOT NULL,
  status      TEXT DEFAULT 'unused',  -- unused, used, expired
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_vouchers_code ON vouchers(tenant_id, code);

-- ─────────────────────────────────────────────────
-- COMMISSION RECORDS
-- ─────────────────────────────────────────────────
CREATE TABLE commission_records (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  date                DATE NOT NULL,
  revenue             NUMERIC(10,2) NOT NULL,
  commission_percent  NUMERIC(5,2) NOT NULL,
  commission_amount   NUMERIC(10,2) NOT NULL,
  paid                BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

-- ─────────────────────────────────────────────────
-- LOYALTY
-- ─────────────────────────────────────────────────
CREATE TABLE loyalty_accounts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone             TEXT NOT NULL,
  total_points      INTEGER DEFAULT 0,
  lifetime_points   INTEGER DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);

CREATE TABLE loyalty_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  phone           TEXT NOT NULL,
  points          INTEGER NOT NULL,  -- positive = earned, negative = redeemed
  type            TEXT NOT NULL,     -- earned, redeemed, expired, bonus
  transaction_id  UUID REFERENCES transactions(id),
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loyalty_rewards (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  points_required   INTEGER NOT NULL,
  reward_type       TEXT NOT NULL,  -- free_package, discount, spin_wheel, custom
  package_id        UUID REFERENCES packages(id),
  discount_percent  NUMERIC(5,2),
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- SHOP
-- ─────────────────────────────────────────────────
CREATE TABLE shop_products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL,
  compare_price   NUMERIC(10,2),
  category        TEXT,  -- routers, cables, antennas, accessories, services
  stock_qty       INTEGER,  -- NULL = unlimited
  images          JSONB DEFAULT '[]',
  tags            JSONB DEFAULT '[]',
  specifications  JSONB DEFAULT '{}',
  rating          NUMERIC(3,2) DEFAULT 0,
  review_count    INTEGER DEFAULT 0,
  is_featured     BOOLEAN DEFAULT FALSE,
  status          TEXT DEFAULT 'active',  -- active, inactive, out_of_stock
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shop_orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference           TEXT UNIQUE NOT NULL,
  customer_name       TEXT NOT NULL,
  customer_email      TEXT,
  customer_phone      TEXT NOT NULL,
  delivery_address    TEXT,
  items               JSONB NOT NULL,
  subtotal            NUMERIC(10,2) NOT NULL,
  delivery_fee        NUMERIC(10,2) DEFAULT 0,
  total               NUMERIC(10,2) NOT NULL,
  payment_method      TEXT DEFAULT 'mpesa',
  payment_ref         TEXT,
  status              TEXT DEFAULT 'pending',  -- pending, confirmed, shipped, delivered, cancelled
  tracking_note       TEXT,
  estimated_delivery  DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- PORTAL VISITS (analytics)
-- ─────────────────────────────────────────────────
CREATE TABLE portal_visits (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  mac_address TEXT,
  ip_address  TEXT,
  device_type TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- PLATFORM SETTINGS
-- ─────────────────────────────────────────────────
CREATE TABLE platform_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insert defaults
INSERT INTO platform_settings (key, value, description) VALUES
  ('default_commission_percent', '5', 'Default platform commission %'),
  ('platform_name', 'FlowFi', 'Platform display name'),
  ('support_phone', '+254746284433', 'Support phone number'),
  ('support_email', 'peterkinuthia726@gmail.com', 'Support email address'),
  ('support_whatsapp', '+254746284433', 'Support WhatsApp number'),
  ('contact_intro', 'Talk to us about deployments, storefront products, support retainers, or a custom rollout for your venue.', 'Public contact page introduction'),
  ('mpesa_env', 'sandbox', 'sandbox or production'),
  ('maintenance_mode', 'false', 'Enable maintenance mode'),
  ('services_catalog', '[{"id":"installation-setup","name":"Installation & setup","category":"installation","description":"On-site hotspot deployment, package setup, captive portal branding, and router handover for a ready-to-sell venue.","startingPrice":"KES 7,500","turnaround":"1-2 business days","featured":true},{"id":"site-survey","name":"Coverage site survey","category":"consulting","description":"Signal mapping, access-point positioning, and capacity planning before you commit to hardware or rollout.","startingPrice":"KES 5,000","turnaround":"48 hours","featured":false},{"id":"managed-support","name":"Managed support","category":"support","description":"Ongoing troubleshooting, remote monitoring, package tuning, and operational support for busy multi-router venues.","startingPrice":"KES 3,500 / month","turnaround":"Same-day response","featured":true}]', 'Public services catalogue'),
  ('blog_posts', '[{"id":"wifi-revenue-playbook","title":"How venues turn guest WiFi into a real revenue line","category":"Growth","excerpt":"A practical playbook for malls, hotels, campuses, and markets that want paid access without making the experience feel clunky.","image":"https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80","readTime":"5 min read","publishedAt":"2026-03-12"},{"id":"mikrotik-rollout-checklist","title":"The MikroTik rollout checklist we use before go-live","category":"Operations","excerpt":"From API access and captive portal branding to package pricing and payment testing, this checklist keeps launches calm.","image":"https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80","readTime":"7 min read","publishedAt":"2026-02-20"},{"id":"loyalty-for-public-wifi","title":"Why loyalty works even for short-session public WiFi","category":"Retention","excerpt":"Customers may buy short sessions, but repeat behavior compounds quickly when points, rewards, and convenience are designed well.","image":"https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80","readTime":"4 min read","publishedAt":"2026-01-28"}]', 'Public blog catalogue'),
  ('about_content', '{"eyebrow":"About FlowFi","headline":"We help venues monetize connectivity without the usual operational mess.","summary":"FlowFi combines payments, hotspot management, storefront sales, and service delivery into one workflow so teams can launch faster and keep operations lean.","story":"We built FlowFi for operators who were tired of juggling disconnected tools for WiFi sales, router management, support, and reporting. The goal is simple: make it easy for a venue to go from ''we offer guest WiFi'' to ''our connectivity is a measurable business channel.''","values":["Simple setup that gets tenants live fast","Payments and operations tied to the same source of truth","Local support for real-world deployments, not just dashboards"],"stats":[{"label":"Launch speed","value":"Under 1 hour"},{"label":"Core focus","value":"WiFi + payments + support"},{"label":"Built for","value":"Kenyan venues"}]}', 'Public about page content');

-- ─────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────────

-- Decrement stock safely
CREATE OR REPLACE FUNCTION decrement_stock(product_id UUID, qty INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE shop_products
  SET stock_qty = GREATEST(0, stock_qty - qty)
  WHERE id = product_id AND stock_qty IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_packages_updated_at BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_shop_products_updated_at BEFORE UPDATE ON shop_products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_shop_orders_updated_at BEFORE UPDATE ON shop_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────
-- NOTE: Since we use service_role key on the backend, RLS is bypassed server-side.
-- Enable RLS on tables for extra safety if you ever expose Supabase directly.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE routers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- Service role bypass (our backend uses this)
CREATE POLICY "service_role_all" ON tenants FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON users FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON routers FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON packages FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON transactions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON sessions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON vouchers FOR ALL TO service_role USING (true);
