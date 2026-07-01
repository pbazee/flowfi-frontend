-- ─────────────────────────────────────────────────
-- FAQS
-- ─────────────────────────────────────────────────
CREATE TABLE faqs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed some initial FAQs
INSERT INTO faqs (question, answer, display_order) VALUES
('What is FlowFi?', 'FlowFi is a captive portal and billing management platform designed for ISPs and venues to manage WiFi access, billing, and customer loyalty seamlessly.', 1),
('How do I connect my router?', 'You can connect any MikroTik router via our Routers section in the admin panel by providing the public IP address and API credentials.', 2),
('How are payments processed?', 'Payments are processed directly into your connected Paystack or M-Pesa accounts. FlowFi takes no cut of your revenue.', 3),
('Can I customize the portal?', 'Yes! You can customize colors, logos, and the welcome message to fully match your brand identity.', 4);
