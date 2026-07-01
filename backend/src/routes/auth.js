const crypto = require('crypto')
const util = require('util')
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const { getSupabaseAdmin } = require('../lib/supabase')
const { authenticate } = require('../middleware/auth')
const { logger } = require('../lib/logger')
const {
  createTenantSubscription,
  loadWorkspacePlanById,
} = require('../services/subscription.service')
const { sendPasswordResetEmail, sendWelcomeEmail, sendAdminNewTenantEmail } = require('../services/notification.service')
const { loadTenantForClient } = require('../services/tenant-profile.service')

const router = express.Router()

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  })

  return { accessToken, refreshToken }
}

function normalizeUserRole(role) {
  if (role === 'admin') return 'super_admin'
  if (role === 'tenant') return 'tenant_admin'
  return role
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
    body('business_name').trim().notEmpty(),
    body('phone').trim().notEmpty(),
    body('plan_id').trim().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      const db = getSupabaseAdmin()
      const { email, password, name, business_name, phone, business_type, plan_id } = req.body

      const normalizedEmail = String(email || '').trim().toLowerCase()

      const plan = await loadWorkspacePlanById(plan_id)
      if (!plan || plan.is_active === false) {
        return res.status(404).json({ error: 'Workspace plan not found' })
      }

      const { data: existing, error: existingError } = await db
        .from('users')
        .select('id')
        .ilike('email', normalizedEmail)
        .maybeSingle()

      if (existingError) throw existingError
      if (existing) return res.status(409).json({ error: 'Email already registered' })

      const hashedPassword = await bcrypt.hash(password, 12)

      const tenantPayload = {
        name: business_name,
        business_type: business_type || 'other',
        status: Number(plan?.trial_days || 0) > 0 ? 'trialing' : 'active',
        contact_phone: phone,
        contact_email: email,
        workspace_plan_id: plan.id,
        workspace_plan_name: plan.name,
        workspace_billing_period: plan.period,
      }

      let tenantResult = await db.from('tenants').insert(tenantPayload).select().single()
      let tenant = tenantResult.data
      let tenantError = tenantResult.error

      if (tenantError && String(tenantError?.message || tenantError).includes('workspace_')) {
        const fallback = { ...tenantPayload }
        delete fallback.workspace_billing_period
        delete fallback.workspace_plan_id
        delete fallback.workspace_plan_name
        delete fallback.workspace_paid_at
        const retry = await db.from('tenants').insert(fallback).select().single()
        tenant = retry.data
        tenantError = retry.error
      }

      if (tenantError) throw tenantError

      const subscription = await createTenantSubscription({
        tenantId: tenant.id,
        plan,
        signupContext: {
          email,
          name,
          businessName: business_name,
        },
      })

      const { data: user, error: userError } = await db
        .from('users')
        .insert({
          email: normalizedEmail,
          password_hash: hashedPassword,
          name,
          phone,
          role: 'tenant_admin',
          status: 'active',
          tenant_id: tenant.id,
        })
        .select('id, email, role, name, tenant_id')
        .single()

      if (userError) throw userError

      const { accessToken, refreshToken } = generateTokens(user.id)
      const tenantWithSubscription =
        (await loadTenantForClient(tenant.id)) || { ...tenant, subscription }

      logger.info(`New tenant registered on ${plan.name}: ${business_name} (${email})`)

      // Fire transactional notifications — fully independent, one failure never blocks the other
      ;(async () => {
        try {
          await sendWelcomeEmail(tenantWithSubscription, { name, email })
        } catch (err) {
          logger.error('Welcome email failed: ' + err.message)
          if (err?.response) logger.error('Resend detail: ' + JSON.stringify(err.response))
        }
      })()
      ;(async () => {
        try {
          await sendAdminNewTenantEmail(tenantWithSubscription, { name, email })
        } catch (err) {
          logger.error('Admin new tenant email failed: ' + err.message)
        }
      })()

      res.status(201).json({
        user: { ...user, role: normalizeUserRole(user.role) },
        accessToken,
        refreshToken,
        tenant: tenantWithSubscription,
        subscription,
      })
    } catch (err) {
      logger.error(
        'Registration error: ' +
          (err && err.message ? err.message : util.inspect(err, { depth: null }))
      )
      logger.error(err && err.stack ? err.stack : util.inspect(err, { depth: null }))
      res.status(500).json({ error: 'Registration failed' })
    }
  }
)

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      const db = getSupabaseAdmin()
      const { email, password } = req.body

      const { data: user, error: queryError } = await db
        .from('users')
        .select('id, email, password_hash, role, status, name, tenant_id')
        .ilike('email', String(email || '').trim())
        .maybeSingle()

      if (queryError) throw queryError
      if (!user) return res.status(401).json({ error: 'Invalid credentials' })
      if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' })

      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

      if (user.email === 'demo@flowfi.app') {
        const { data: demoMeta } = await db.from('demo_meta').select('*').limit(1).maybeSingle();
        if (demoMeta && !demoMeta.is_enabled) {
          return res.status(403).json({ error: 'Live demo is temporarily unavailable.' });
        }
        if (demoMeta) {
          await db.from('demo_meta')
            .update({ views_count: (demoMeta.views_count || 0) + 1 })
            .eq('id', demoMeta.id);
        }
      }

      const tenant = user.tenant_id ? await loadTenantForClient(user.tenant_id) : null
      const { accessToken, refreshToken } = generateTokens(user.id)
      const { password_hash, ...safeUser } = user

      safeUser.role = normalizeUserRole(safeUser.role)
      res.json({ user: safeUser, accessToken, refreshToken, tenant })
    } catch (err) {
      logger.error(
        'Login error: ' + (err && err.message ? err.message : util.inspect(err, { depth: null }))
      )
      logger.error(err && err.stack ? err.stack : util.inspect(err, { depth: null }))
      res.status(500).json({ error: 'Login failed' })
    }
  }
)

router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      const db = getSupabaseAdmin()
      const email = String(req.body.email || '').trim()

      const { data: user, error } = await db
        .from('users')
        .select('id, email, name')
        .ilike('email', email)
        .maybeSingle()

      if (error) throw error

      if (user?.id) {
        const token = crypto.randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

        await db
          .from('users')
          .update({
            reset_token: hashResetToken(token),
            reset_token_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)

        const resetUrl = `${
          process.env.PASSWORD_RESET_URL || 'https://flowfi-frontend.vercel.app/reset-password'
        }?token=${token}`

        await sendPasswordResetEmail({
          email: user.email,
          name: user.name,
          resetUrl,
        })
      }

      res.json({
        message: 'If that email is registered, we sent a password reset link.',
      })
    } catch (err) {
      logger.error(
        'Forgot password error: ' +
          (err && err.message ? err.message : util.inspect(err, { depth: null }))
      )
      logger.error(err && err.stack ? err.stack : util.inspect(err, { depth: null }))
      res.status(500).json({ error: 'Could not start password reset' })
    }
  }
)

router.post(
  '/reset-password',
  [body('token').isLength({ min: 20 }), body('password').isLength({ min: 8 })],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      const db = getSupabaseAdmin()
      const tokenHash = hashResetToken(req.body.token)

      const { data: user, error } = await db
        .from('users')
        .select('id, reset_token_expires_at')
        .eq('reset_token', tokenHash)
        .maybeSingle()

      if (error) throw error
      if (!user?.id) {
        return res.status(400).json({ error: 'Reset link is invalid or has expired' })
      }

      const expiresAt = new Date(user.reset_token_expires_at || 0)
      if (
        !user.reset_token_expires_at ||
        Number.isNaN(expiresAt.getTime()) ||
        expiresAt.getTime() < Date.now()
      ) {
        return res.status(400).json({ error: 'Reset link is invalid or has expired' })
      }

      const passwordHash = await bcrypt.hash(req.body.password, 12)
      await db
        .from('users')
        .update({
          password_hash: passwordHash,
          reset_token: null,
          reset_token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      res.json({ message: 'Password reset successfully' })
    } catch (err) {
      logger.error(
        'Reset password error: ' +
          (err && err.message ? err.message : util.inspect(err, { depth: null }))
      )
      logger.error(err && err.stack ? err.stack : util.inspect(err, { depth: null }))
      res.status(500).json({ error: 'Could not reset password' })
    }
  }
)

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' })

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
    const tokens = generateTokens(decoded.userId)
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' })
  }
})

router.get('/me', authenticate, async (req, res) => {
  const tenant = req.user.tenant_id ? await loadTenantForClient(req.user.tenant_id) : null
  res.json({ user: { ...req.user, role: normalizeUserRole(req.user.role) }, tenant })
})

router.post(
  '/change-password',
  authenticate,
  [body('current_password').notEmpty(), body('new_password').isLength({ min: 8 })],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      const db = getSupabaseAdmin()
      const { data: user } = await db
        .from('users')
        .select('password_hash')
        .eq('id', req.user.id)
        .single()

      const valid = await bcrypt.compare(req.body.current_password, user.password_hash)
      if (!valid) return res.status(400).json({ error: 'Current password incorrect' })

      const newHash = await bcrypt.hash(req.body.new_password, 12)
      await db
        .from('users')
        .update({ password_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', req.user.id)

      res.json({ message: 'Password changed successfully' })
    } catch {
      res.status(500).json({ error: 'Failed to change password' })
    }
  }
)

module.exports = router
