-- ============================================================
-- FlowFi public feedback, social links, and moderation support
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new', -- new, read, resolved
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_submissions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope             TEXT NOT NULL, -- platform, service, product
  target_id         TEXT NOT NULL,
  target_label      TEXT,
  reviewer_name     TEXT NOT NULL,
  reviewer_email    TEXT,
  reviewer_phone    TEXT,
  reviewer_role     TEXT,
  reviewer_company  TEXT,
  rating            INTEGER NOT NULL DEFAULT 5,
  message           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending', -- pending, published, rejected
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_submissions_status ON review_submissions(status);
CREATE INDEX IF NOT EXISTS idx_review_submissions_scope_target ON review_submissions(scope, target_id);

DROP TRIGGER IF EXISTS trg_contact_messages_updated_at ON contact_messages;
CREATE TRIGGER trg_contact_messages_updated_at
BEFORE UPDATE ON contact_messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_review_submissions_updated_at ON review_submissions;
CREATE TRIGGER trg_review_submissions_updated_at
BEFORE UPDATE ON review_submissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON contact_messages;
CREATE POLICY "service_role_all" ON contact_messages FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all" ON review_submissions;
CREATE POLICY "service_role_all" ON review_submissions FOR ALL TO service_role USING (true);

INSERT INTO platform_settings (key, value, description) VALUES
  ('social_facebook', '', 'Facebook page URL'),
  ('social_instagram', '', 'Instagram page URL'),
  ('social_x', '', 'X account URL'),
  ('social_linkedin', '', 'LinkedIn page URL')
ON CONFLICT (key) DO NOTHING;
