-- ============================================================
-- Order tracking history + tenant session credit logs
-- ============================================================

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS courier_note TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

UPDATE shop_orders
SET estimated_delivery_date = COALESCE(estimated_delivery_date, estimated_delivery)
WHERE estimated_delivery_date IS NULL
  AND estimated_delivery IS NOT NULL;

UPDATE shop_orders
SET courier_note = COALESCE(courier_note, tracking_note)
WHERE courier_note IS NULL
  AND tracking_note IS NOT NULL;

UPDATE shop_orders
SET delivered_at = COALESCE(delivered_at, updated_at)
WHERE delivered_at IS NULL
  AND status = 'delivered';

UPDATE shop_orders
SET cancelled_at = COALESCE(cancelled_at, updated_at)
WHERE cancelled_at IS NULL
  AND status = 'cancelled';

CREATE TABLE IF NOT EXISTS shop_order_status_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  note        TEXT,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_order_status_history_order_id
  ON shop_order_status_history(order_id, created_at DESC);

CREATE OR REPLACE FUNCTION log_shop_order_status_history()
RETURNS TRIGGER AS $$
DECLARE
  history_note TEXT;
BEGIN
  history_note := NULLIF(
    BTRIM(
      COALESCE(
        CASE
          WHEN NEW.status = 'cancelled' THEN NEW.cancellation_reason
          ELSE NEW.courier_note
        END,
        NEW.courier_note,
        NEW.tracking_note,
        ''
      )
    ),
    ''
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO shop_order_status_history (order_id, status, note, updated_by, created_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.status, 'pending'),
      history_note,
      NEW.status_updated_by,
      COALESCE(NEW.created_at, NOW())
    );

    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO shop_order_status_history (order_id, status, note, updated_by, created_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.status, 'pending'),
      history_note,
      NEW.status_updated_by,
      COALESCE(NEW.updated_at, NOW())
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shop_order_status_history ON shop_orders;
CREATE TRIGGER trg_shop_order_status_history
AFTER INSERT OR UPDATE ON shop_orders
FOR EACH ROW
EXECUTE FUNCTION log_shop_order_status_history();

INSERT INTO shop_order_status_history (order_id, status, note, updated_by, created_at)
SELECT
  orders.id,
  COALESCE(orders.status, 'pending'),
  NULLIF(
    BTRIM(
      COALESCE(
        CASE
          WHEN orders.status = 'cancelled' THEN orders.cancellation_reason
          ELSE orders.courier_note
        END,
        orders.courier_note,
        orders.tracking_note,
        ''
      )
    ),
    ''
  ),
  orders.status_updated_by,
  COALESCE(orders.updated_at, orders.created_at, NOW())
FROM shop_orders AS orders
WHERE NOT EXISTS (
  SELECT 1
  FROM shop_order_status_history AS history
  WHERE history.order_id = orders.id
);

CREATE TABLE IF NOT EXISTS session_credit_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  guest_session_id UUID NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  mac_address      TEXT,
  phone            TEXT,
  minutes_credited INTEGER NOT NULL CHECK (minutes_credited > 0),
  reason           TEXT NOT NULL,
  credited_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  mikrotik_success BOOLEAN NOT NULL DEFAULT FALSE,
  mikrotik_error   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_credit_log_tenant_id_created_at
  ON session_credit_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_credit_log_guest_session_id
  ON session_credit_log(guest_session_id, created_at DESC);

ALTER TABLE shop_order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_credit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON shop_order_status_history;
CREATE POLICY "service_role_all" ON shop_order_status_history
FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all" ON session_credit_log;
CREATE POLICY "service_role_all" ON session_credit_log
FOR ALL TO service_role USING (true);
