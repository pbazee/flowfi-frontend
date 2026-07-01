const bcrypt = require('bcryptjs')
const { logger } = require('./logger')
const { getSupabaseAdmin } = require('./supabase')
const {
  DEFAULT_SERVICES,
  DEFAULT_BLOG_POSTS,
  DEFAULT_WORKSPACE_PLANS,
  DEFAULT_TRUSTED_VENUES,
  DEFAULT_REVIEWS,
  DEFAULT_LANDING_HERO,
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_CONTACT_DETAILS,
  DEFAULT_SOCIAL_LINKS,
} = require('./defaultPlatformContent')

const DEFAULT_PLATFORM_SETTINGS = [
  ['platform_name', 'FlowFi', 'Platform display name'],
  ['support_phone', DEFAULT_CONTACT_DETAILS.phone, 'Support phone number'],
  ['support_email', DEFAULT_CONTACT_DETAILS.email, 'Support email address'],
  ['support_whatsapp', DEFAULT_CONTACT_DETAILS.whatsapp, 'Support WhatsApp number'],
  ['support_address', DEFAULT_CONTACT_DETAILS.address, 'Support office or service address'],
  ['contact_intro', DEFAULT_CONTACT_DETAILS.intro, 'Public contact page introduction'],
  ['mpesa_env', process.env.MPESA_ENV || 'sandbox', 'sandbox or production'],
  ['maintenance_mode', 'false', 'Enable maintenance mode'],
  ['services_catalog', JSON.stringify(DEFAULT_SERVICES), 'Public services catalogue'],
  ['blog_posts', JSON.stringify(DEFAULT_BLOG_POSTS), 'Public blog catalogue'],
  ['workspace_plans', JSON.stringify(DEFAULT_WORKSPACE_PLANS), 'Public workspace pricing plans'],
  ['trusted_venues', JSON.stringify(DEFAULT_TRUSTED_VENUES), 'Trusted venues marquee'],
  ['customer_reviews', JSON.stringify(DEFAULT_REVIEWS), 'Customer reviews and testimonials'],
  ['landing_hero', JSON.stringify(DEFAULT_LANDING_HERO), 'Landing page hero section content'],
  ['about_content', JSON.stringify(DEFAULT_ABOUT_CONTENT), 'Public about page content'],
  ['social_facebook', DEFAULT_SOCIAL_LINKS.facebook, 'Facebook page URL'],
  ['social_instagram', DEFAULT_SOCIAL_LINKS.instagram, 'Instagram page URL'],
  ['social_x', DEFAULT_SOCIAL_LINKS.x, 'X account URL'],
  ['social_linkedin', DEFAULT_SOCIAL_LINKS.linkedin, 'LinkedIn page URL'],
]

async function ensurePlatformDefaults() {
  const db = getSupabaseAdmin()
  const rows = DEFAULT_PLATFORM_SETTINGS.map(([key, value, description]) => ({
    key,
    value: String(value),
    description,
  }))

  if (rows.length > 0) {
    const { error } = await db.from('platform_settings').upsert(rows, { onConflict: 'key', ignoreDuplicates: true })
    if (error) throw error
    logger.info(`Ensured ${rows.length} platform setting(s)`)
  }
}

async function ensureSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL
  const password = process.env.SUPER_ADMIN_PASSWORD

  if (!email || !password) {
    logger.warn('Super admin bootstrap skipped because credentials are missing')
    return
  }

  const db = getSupabaseAdmin()
  const passwordHash = await bcrypt.hash(password, 12)
  const payload = {
    email,
    password_hash: passwordHash,
    name: process.env.SUPER_ADMIN_NAME || 'Peter Kinuthia',
    phone: process.env.SUPER_ADMIN_PHONE || null,
    role: 'super_admin',
    status: 'active',
    tenant_id: null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await db
    .from('users')
    .upsert({
      ...payload,
      created_at: new Date().toISOString(),
    }, { onConflict: 'email' })

  if (error) throw error

  logger.info(`Ensured super admin account for ${email}`)
}

async function bootstrapPlatform() {
  await ensurePlatformDefaults()
  await ensureSuperAdmin()
}

module.exports = { bootstrapPlatform }
