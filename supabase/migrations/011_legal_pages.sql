-- ────────────────────────────────────────────────────────────
-- Migration 011: Legal Pages
-- Creates a legal_pages table for managing Terms, Privacy,
-- Refund Policy, and FAQs from the admin panel.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  content     text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed default pages so they're never empty
INSERT INTO legal_pages (slug, title, content) VALUES
(
  'terms',
  'Terms of Service',
  '<h2>Using the platform</h2><p>FlowFi helps venues manage guest WiFi operations, storefront sales, rollout services, and platform operations. You agree to use the platform lawfully and not to interfere with service availability, payment flows, or other users.</p><h2>Accounts and workspace access</h2><p>Workspace owners are responsible for protecting their login credentials, keeping billing and contact details current, and ensuring that router, hotspot, and customer data entered into the platform is accurate.</p><h2>Payments and orders</h2><p>Storefront orders, workspace subscriptions, and connected payment flows may rely on third-party providers such as Paystack and M-Pesa. Payment confirmation, refunds, delivery terms, and operational follow-up may depend on the specific service or product purchased.</p><h2>Service availability</h2><p>We work to keep FlowFi available and reliable, but uptime can be affected by internet service, payment providers, router connectivity, third-party APIs, and maintenance activity. We may update or suspend features when operationally necessary.</p>'
),
(
  'privacy',
  'Privacy Policy',
  '<h2>What data we collect</h2><p>FlowFi collects information you provide when registering a workspace, placing orders, or contacting us — including name, email, phone number, and payment details. Hotspot session data (phone numbers, session times, and payment records) is stored on behalf of venue operators.</p><h2>How we use your data</h2><p>Data is used to operate the platform, process payments, send notifications, and improve service quality. We do not sell personal data to third parties.</p><h2>Data retention</h2><p>Account data is retained for as long as your workspace is active. Session and transaction records are retained as required for billing and compliance purposes. You may request deletion of your personal data by contacting us.</p><h2>Third-party services</h2><p>FlowFi integrates with Paystack, M-Pesa, and other service providers. Their privacy policies govern data they independently collect during payment processing.</p>'
),
(
  'refund-policy',
  'Refund Policy',
  '<h2>Workspace subscriptions</h2><p>Workspace plan fees are charged monthly or annually. If you cancel your subscription, access continues until the end of the current billing period. We do not issue prorated refunds for unused time on active subscriptions.</p><h2>Hardware and shop orders</h2><p>Physical products purchased through the FlowFi store may be returned within 14 days of delivery in original condition. Shipping costs for returns are the buyer''s responsibility unless the item was defective or incorrectly sent.</p><h2>Service packages</h2><p>Installation and consulting services that have been completed are non-refundable. If a service was not delivered as agreed, please contact us within 7 days to arrange a resolution.</p><h2>How to request a refund</h2><p>Contact us at the email on the Contact page with your order or workspace reference number. We aim to respond to all refund requests within 2 business days.</p>'
),
(
  'faqs',
  'Frequently Asked Questions',
  '<h2>How do I connect my MikroTik router?</h2><p>After creating a workspace, go to the Routers section in your tenant dashboard. Enter your router''s IP address, API username, and API password. FlowFi will test the connection and confirm when it is live.</p><h2>Which payment methods are supported?</h2><p>FlowFi supports M-Pesa (via Daraja API) and Paystack (card and mobile money). You configure your payment credentials in the tenant Settings page. Customers pay directly from the captive portal without needing to leave the hotspot experience.</p><h2>Can I brand the hotspot portal?</h2><p>Yes. The captive portal uses your workspace name, colours, and welcome message. Branding settings are managed from the Settings page inside your tenant dashboard.</p><h2>What happens when a customer''s session expires?</h2><p>The session is marked as expired and the customer loses internet access through the hotspot. They are redirected to the captive portal to purchase a new package or redeem loyalty points.</p><h2>How does the loyalty programme work?</h2><p>You can configure points rewards for purchases and set redemption thresholds. Customers accumulate points with each payment and can redeem them for free session time directly from the captive portal.</p>'
)
ON CONFLICT (slug) DO NOTHING;
