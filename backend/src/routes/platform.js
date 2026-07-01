const express = require('express')
const bcrypt = require('bcryptjs')
const shortUUID = require('short-uuid')
const { getSupabaseAdmin } = require('../lib/supabase')
const { logger } = require('../lib/logger')
const { sendEmail } = require('../services/notification.service')
const {
  initiateStkPush,
  initializePaystack,
  getPaymentAvailability,
  verifyPaystack,
} = require('../services/payment.service')
const { finalizeWorkspaceOrderPayment } = require('../services/workspace.service')
const {
  serializeContactMessage,
  serializeReview,
} = require('../services/feedback.service')
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
} = require('../lib/defaultPlatformContent')
const {
  loadWorkspacePlans,
} = require('../services/subscription.service')

const router = express.Router()

// ── GET /api/platform/demo-status ──────────────────────────────
router.get('/demo-status', async (req, res) => {
  try {
    const db = getSupabaseAdmin()
    const { data: meta } = await db
      .from('demo_meta')
      .select('is_enabled, banner_message')
      .limit(1)
      .maybeSingle()

    res.json({
      is_enabled: meta?.is_enabled ?? true,
      banner_message: meta?.banner_message || "You're viewing the FlowFi demo—feel free to explore the platform.",
    })
  } catch (err) {
    logger.error('Failed to load demo status: ' + err.message)
    res.status(500).json({ error: 'Failed to load demo status' })
  }
})

// ── GET /api/platform/legal/:slug ────────────────────────────
router.get('/legal/:slug', async (req, res) => {
  try {
    const db = getSupabaseAdmin()
    const { slug } = req.params
    const { data, error } = await db
      .from('legal_pages')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Page not found' })
    res.json(data)
  } catch (err) {
    logger.error('GET /platform/legal error: ' + err.message)
    res.status(500).json({ error: 'Failed to load legal page' })
  }
})

// ── GET /api/platform/faqs ──────────────────────────────
router.get('/faqs', async (req, res) => {
  try {
    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('faqs')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    logger.error('GET /platform/faqs error: ' + err.message)
    res.status(500).json({ error: 'Failed to load FAQs' })
  }
})


// Called by tenant sidebar to compute badge counts
const { authenticate } = require('../middleware/auth')
router.get('/tenant-badges', authenticate, async (req, res) => {
  try {
    const db = getSupabaseAdmin()
    const tenantId = req.user.tenant_id
    const sinceCustomers = req.query.since_customers
    const cutoff = sinceCustomers || new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const [newCustomers, pendingTxns, activeSessions] = await Promise.all([
      db.from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gt('created_at', cutoff),
      db.from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending'),
      db.from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active'),
    ])

    res.json({
      new_customers: newCustomers.count || 0,
      pending_transactions: pendingTxns.count || 0,
      active_sessions: activeSessions.count || 0,
    })
  } catch (err) {
    logger.error('GET /platform/tenant-badges error: ' + err.message)
    res.status(500).json({ error: 'Failed to load tenant badges' })
  }
})

function parseJsonSetting(value, fallback) {
  if (!value) return fallback

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed : fallback
    }
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {}

  return fallback
}

async function loadPlatformSettings() {
  const db = getSupabaseAdmin()
  const { data, error } = await db.from('platform_settings').select('key, value')
  if (error) throw error

  return (data || []).reduce((acc, item) => {
    acc[item.key] = item.value
    return acc
  }, {})
}

async function buildContentPayload(settings = {}) {
  const workspacePlans = await loadWorkspacePlans()

  return {
    platformName: settings.platform_name || 'FlowFi',
    hero: parseJsonSetting(settings.landing_hero, DEFAULT_LANDING_HERO),
    services: parseJsonSetting(settings.services_catalog, DEFAULT_SERVICES),
    blogPosts: parseJsonSetting(settings.blog_posts, DEFAULT_BLOG_POSTS),
    workspacePlans: workspacePlans.length
      ? workspacePlans
      : DEFAULT_WORKSPACE_PLANS,
    trustedVenues: parseJsonSetting(settings.trusted_venues, DEFAULT_TRUSTED_VENUES),
    reviews: parseJsonSetting(settings.customer_reviews, DEFAULT_REVIEWS),
    about: parseJsonSetting(settings.about_content, DEFAULT_ABOUT_CONTENT),
    contact: {
      intro: settings.contact_intro || DEFAULT_CONTACT_DETAILS.intro,
      phone: settings.support_phone || DEFAULT_CONTACT_DETAILS.phone,
      email: settings.support_email || DEFAULT_CONTACT_DETAILS.email,
      whatsapp: settings.support_whatsapp || DEFAULT_CONTACT_DETAILS.whatsapp,
      address: settings.support_address || DEFAULT_CONTACT_DETAILS.address,
    },
    socials: {
      facebook: settings.social_facebook || DEFAULT_SOCIAL_LINKS.facebook,
      instagram: settings.social_instagram || DEFAULT_SOCIAL_LINKS.instagram,
      x: settings.social_x || DEFAULT_SOCIAL_LINKS.x,
      linkedin: settings.social_linkedin || DEFAULT_SOCIAL_LINKS.linkedin,
    },
    paymentMethods: getPaymentAvailability(),
  }
}

async function findWorkspacePlan(planId) {
  const plans = await loadWorkspacePlans({ includeInactive: true })
  return (plans || []).find((plan) => plan.id === planId)
}

function normalizePhone(phone) {
  if (!phone) return phone
  const trimmed = String(phone).replace(/\s+/g, '')
  if (trimmed.startsWith('0')) return `254${trimmed.slice(1)}`
  if (trimmed.startsWith('+')) return trimmed.slice(1)
  return trimmed
}

function serializeWorkspaceOrder(order) {
  if (!order) return null

  return {
    reference: order.reference,
    plan_id: order.plan_id,
    plan_name: order.plan_name,
    billing_period: order.billing_period,
    amount: order.amount,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    status: order.status,
    paid_at: order.paid_at,
    tenant_id: order.tenant_id,
    login_email: order.signup_email,
    business_name: order.business_name,
    created_at: order.created_at,
  }
}

router.get('/services', async (req, res) => {
  try {
    const settings = await loadPlatformSettings()
    const content = await buildContentPayload(settings)
    res.json({ services: content.services })
  } catch (err) {
    res.json({ services: DEFAULT_SERVICES })
  }
})

router.get('/services/:serviceId', async (req, res) => {
  try {
    const settings = await loadPlatformSettings()
    const content = await buildContentPayload(settings)
    const service = (content.services || []).find((entry) => entry.id === req.params.serviceId)

    if (!service) {
      return res.status(404).json({ error: 'Service not found' })
    }

    return res.json(service)
  } catch (err) {
    const service = DEFAULT_SERVICES.find((entry) => entry.id === req.params.serviceId)
    if (!service) {
      return res.status(404).json({ error: 'Service not found' })
    }

    return res.json(service)
  }
})

router.get('/content', async (req, res) => {
  try {
    const settings = await loadPlatformSettings()
    res.json(await buildContentPayload(settings))
  } catch (err) {
    res.json(await buildContentPayload())
  }
})

router.post('/contact-messages', async (req, res) => {
  const { name, email, phone, message } = req.body

  if (!name || !message) {
    return res.status(400).json({ error: 'name and message are required' })
  }

  try {
    const db = getSupabaseAdmin()
    const settings = await loadPlatformSettings()
    const content = await buildContentPayload(settings)
    const recipient = content.contact.email || process.env.SUPER_ADMIN_EMAIL || process.env.EMAIL_USER

    const { data: savedMessage, error: insertError } = await db
      .from('contact_messages')
      .insert({
        name: String(name).trim(),
        email: email ? String(email).trim() : null,
        phone: phone ? String(phone).trim() : null,
        message: String(message).trim(),
        status: 'new',
      })
      .select()
      .single()

    if (insertError) throw insertError

    if (recipient) {
      await sendEmail(
        recipient,
        `FlowFi contact message from ${name}`,
        `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2>New contact request</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email || 'Not provided'}</p>
            <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
            <p><strong>Message:</strong></p>
            <p>${String(message).replace(/\n/g, '<br/>')}</p>
          </div>
        `
      )
    }

    logger.info(`Platform contact message received from ${name}${email ? ` (${email})` : ''}`)
    res.json({
      message: 'Your message has been received. We will get back to you shortly.',
      contactMessage: serializeContactMessage(savedMessage),
    })
  } catch (err) {
    logger.error(`Platform contact message error: ${err.message}`)
    res.status(500).json({ error: 'Could not send your message right now' })
  }
})

router.get('/reviews', async (req, res) => {
  const { scope = 'platform', target_id: targetId } = req.query

  try {
    const db = getSupabaseAdmin()
    let query = db
      .from('review_submissions')
      .select('*')
      .eq('status', 'published')
      .eq('scope', scope)
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (targetId) {
      query = query.eq('target_id', targetId)
    }

    const { data, error } = await query
    if (error) throw error

    res.json({
      reviews: (data || []).map(serializeReview),
    })
  } catch (err) {
    logger.error(`Public reviews load error: ${err.message}`)
    res.status(500).json({ error: 'Could not load reviews right now' })
  }
})

router.post('/reviews', async (req, res) => {
  const {
    scope = 'platform',
    target_id: targetId,
    target_label: targetLabel,
    reviewer_name: reviewerName,
    reviewer_email: reviewerEmail,
    reviewer_phone: reviewerPhone,
    reviewer_role: reviewerRole,
    reviewer_company: reviewerCompany,
    rating,
    message,
  } = req.body

  if (!reviewerName || !message) {
    return res.status(400).json({ error: 'reviewer_name and message are required' })
  }

  if (!['platform', 'service', 'product'].includes(scope)) {
    return res.status(400).json({ error: 'Invalid review scope' })
  }

  if (!targetId) {
    return res.status(400).json({ error: 'target_id is required' })
  }

  try {
    const db = getSupabaseAdmin()
    const safeRating = Math.max(1, Math.min(5, Number(rating || 5)))
    const { data, error } = await db
      .from('review_submissions')
      .insert({
        scope,
        target_id: String(targetId),
        target_label: targetLabel ? String(targetLabel).trim() : null,
        reviewer_name: String(reviewerName).trim(),
        reviewer_email: reviewerEmail ? String(reviewerEmail).trim() : null,
        reviewer_phone: reviewerPhone ? String(reviewerPhone).trim() : null,
        reviewer_role: reviewerRole ? String(reviewerRole).trim() : null,
        reviewer_company: reviewerCompany ? String(reviewerCompany).trim() : null,
        rating: safeRating,
        message: String(message).trim(),
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    res.status(201).json({
      message: 'Thanks for sharing your review. It will appear after a quick admin check.',
      review: serializeReview(data),
    })
  } catch (err) {
    logger.error(`Public review submit error: ${err.message}`)
    res.status(500).json({ error: 'Could not submit your review right now' })
  }
})

router.post('/workspace-checkout', async (req, res) => {
  const {
    email,
    password,
    name,
    phone,
    business_name,
    business_type,
    plan_id,
    payment_method,
  } = req.body

  if (!email || !password || !name || !phone || !business_name || !plan_id || !payment_method) {
    return res.status(400).json({
      error: 'email, password, name, phone, business_name, plan_id and payment_method are required',
    })
  }

  if (!['mpesa', 'paystack'].includes(payment_method)) {
    return res.status(400).json({ error: 'Unsupported payment method' })
  }

  try {
    const db = getSupabaseAdmin()
    const plan = await findWorkspacePlan(plan_id)
    const paymentAvailability = getPaymentAvailability()

    if (!plan) {
      return res.status(404).json({ error: 'Workspace plan not found' })
    }

    if (!paymentAvailability[payment_method]) {
      return res.status(503).json({
        error:
          payment_method === 'mpesa'
            ? 'M-Pesa checkout is not configured yet. Please use Paystack instead.'
            : 'Paystack checkout is not configured yet. Please contact support.',
      })
    }

    const { data: existingUser, error: existingUserError } = await db
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (existingUserError) throw existingUserError
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const reference = `WS-${shortUUID.generate().slice(0, 10).toUpperCase()}`
    const amount = Number(plan.price || 0)

    const { data: order, error: insertError } = await db
      .from('workspace_orders')
      .insert({
        reference,
        plan_id: plan.id,
        plan_name: plan.name,
        billing_period: plan.period || 'monthly',
        amount,
        payment_method,
        payment_status: 'pending',
        status: 'pending',
        signup_email: email,
        signup_password_hash: passwordHash,
        signup_name: name,
        signup_phone: phone,
        business_name,
        business_type: business_type || 'other',
        payload: {
          plan,
        },
      })
      .select()
      .single()

    if (insertError) throw insertError

    if (payment_method === 'mpesa') {
      const mpesaResponse = await initiateStkPush(
        normalizePhone(phone),
        amount,
        reference,
        `FlowFi Workspace - ${plan.name}`
      )

      await db
        .from('workspace_orders')
        .update({
          payment_ref: mpesaResponse.CheckoutRequestID,
          gateway_data: mpesaResponse,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      return res.status(201).json({
        reference,
        checkoutRequestId: mpesaResponse.CheckoutRequestID,
        amount,
        plan,
        payment_method,
        message: 'Complete the M-Pesa prompt on your phone to activate your FlowFi workspace.',
      })
    }

    const callbackUrl = `${process.env.FRONTEND_URL}/payment/callback?flow=workspace`
    const paystackResponse = await initializePaystack(
      email,
      amount,
      reference,
      {
        flow: 'workspace',
        plan_id: plan.id,
        workspace_order_id: order.id,
      },
      callbackUrl
    )

    await db
      .from('workspace_orders')
      .update({
        payment_ref: reference,
        gateway_data: paystackResponse.data || paystackResponse,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    return res.status(201).json({
      reference,
      amount,
      plan,
      payment_method,
      authorization_url: paystackResponse.data.authorization_url,
    })
  } catch (err) {
    logger.error(`Workspace checkout error: ${err.message}`)
    return res.status(500).json({ error: 'Could not start workspace checkout' })
  }
})

router.get('/workspace-orders/:reference/status', async (req, res) => {
  try {
    const db = getSupabaseAdmin()
    const { data: order, error } = await db
      .from('workspace_orders')
      .select('*')
      .eq('reference', req.params.reference)
      .single()

    if (error || !order) {
      return res.status(404).json({ error: 'Workspace order not found' })
    }

    return res.json(serializeWorkspaceOrder(order))
  } catch (err) {
    return res.status(500).json({ error: 'Could not load workspace order status' })
  }
})

router.get('/workspace-orders/verify/:reference', async (req, res) => {
  try {
    const verification = await verifyPaystack(req.params.reference)
    if (verification.data?.status !== 'success') {
      return res.json({ verified: false })
    }

    const db = getSupabaseAdmin()
    const { data: order, error } = await db
      .from('workspace_orders')
      .select('*')
      .eq('reference', req.params.reference)
      .single()

    if (error || !order) {
      return res.status(404).json({ error: 'Workspace order not found' })
    }

    const activation = await finalizeWorkspaceOrderPayment(
      order,
      'paystack',
      verification.data,
      req.params.reference
    )

    return res.json({
      verified: true,
      order: serializeWorkspaceOrder(activation?.order || order),
      tenant_id: activation?.tenantId || order.tenant_id,
    })
  } catch (err) {
    logger.error(`Workspace Paystack verify error: ${err.message}`)
    return res.status(500).json({ error: 'Could not verify workspace payment' })
  }
})

module.exports = router
