-- ============================================================
-- Add advanced demo settings and tracking
-- ============================================================

ALTER TABLE demo_meta
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banner_message TEXT NOT NULL DEFAULT 'You''re viewing the FlowFi demo—feel free to explore the platform.';
