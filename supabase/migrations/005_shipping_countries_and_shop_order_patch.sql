-- ============================================================
-- Safe follow-up patch for shipping countries and shop order schema
-- ============================================================

ALTER TABLE shipping_zones
  ADD COLUMN IF NOT EXISTS countries JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE shipping_zones
SET countries = CASE
  WHEN countries IS NOT NULL AND jsonb_typeof(countries) = 'array' AND jsonb_array_length(countries) > 0
    THEN countries
  WHEN counties IS NOT NULL AND jsonb_typeof(counties) = 'array' AND jsonb_array_length(counties) > 0
    THEN '["Kenya"]'::jsonb
  WHEN regions IS NOT NULL AND jsonb_typeof(regions) = 'array' AND jsonb_array_length(regions) > 0
    THEN '["Kenya"]'::jsonb
  WHEN towns IS NOT NULL AND jsonb_typeof(towns) = 'array' AND jsonb_array_length(towns) > 0
    THEN '["Kenya"]'::jsonb
  ELSE '[]'::jsonb
END
WHERE countries IS NULL
   OR jsonb_typeof(countries) <> 'array'
   OR (jsonb_typeof(countries) = 'array' AND jsonb_array_length(countries) = 0);

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
WHERE payment_status IS NULL
   OR payment_provider_data IS NULL
   OR shipping_quote_status IS NULL;

ALTER TABLE shop_orders
  DROP CONSTRAINT IF EXISTS shop_orders_payment_status_check;

ALTER TABLE shop_orders
  ADD CONSTRAINT shop_orders_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

CREATE INDEX IF NOT EXISTS idx_shop_orders_payment_status ON shop_orders(payment_status);
