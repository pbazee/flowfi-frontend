const express = require('express')
const shortUUID = require('short-uuid')
const util = require('util')
const { getSupabaseAdmin } = require('../lib/supabase')
const {
  buildPlatformPaymentContext,
  initiateStkPush,
  queryStkPush,
  parseMpesaCallback,
  initializePaystack,
  verifyPaystack,
  verifyPaystackWebhook,
} = require('../services/payment.service')
const {
  buildTenantPaymentContext,
  loadTenantPaymentRecord,
} = require('../services/tenant-payment.service')
const { addHotspotUser } = require('../services/mikrotik.service')
const { sendActivationNotification } = require('../services/notification.service')
const { awardLoyaltyPoints } = require('../services/loyalty.service')
const { finalizeShopOrderPayment } = require('../services/shop.service')
const { finalizeWorkspaceOrderPayment } = require('../services/workspace.service')
const { ensureGuestSessionTracking } = require('../services/session-credit.service')
const { logger } = require('../lib/logger')

const router = express.Router()

function normalizePhone(phone) {
  if (!phone) return phone
  const trimmed = String(phone).replace(/\s+/g, '')
  if (trimmed.startsWith('0')) return `254${trimmed.slice(1)}`
  if (trimmed.startsWith('+')) return trimmed.slice(1)
  return trimmed
}

function getJsonBody(body) {
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString())
  if (typeof body === 'string') return JSON.parse(body)
  return body
}

function isSuccessfulResultCode(resultCode) {
  return Number(resultCode) === 0
}

function buildClientContext(payload = {}) {
  return {
    mac_address: payload.mac_address || null,
    ip_address: payload.ip_address || null,
    device_type: payload.device_type || null,
  }
}

function mergeGatewayData(existing, section, value) {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}
  if (!section) {
    return {
      ...base,
      ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
    }
  }

  return {
    ...base,
    [section]: value,
  }
}

async function loadWifiTransaction(db, field, value) {
  const { data, error } = await db
    .from('transactions')
    .select('*, packages(*)')
    .eq(field, value)
    .maybeSingle()

  if (error) throw error
  return data
}

async function loadShopOrder(db, field, value) {
  const { data, error } = await db
    .from('shop_orders')
    .select('*')
    .eq(field, value)
    .maybeSingle()

  if (error) throw error
  return data
}

async function loadWorkspaceOrder(db, field, value) {
  const { data, error } = await db
    .from('workspace_orders')
    .select('*')
    .eq(field, value)
    .maybeSingle()

  if (error) throw error
  return data
}

async function markWifiTransactionFailed(txn, gatewayData = {}) {
  if (!txn || txn.status === 'success') return txn

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('transactions')
    .update({
      status: 'failed',
      gateway_data: mergeGatewayData(txn.gateway_data, 'failure', gatewayData),
    })
    .eq('id', txn.id)
    .select('*, packages(*)')
    .single()

  if (error) throw error
  return data
}

async function markWifiTransactionSuccessful(txn, gatewayData = {}, phone, io) {
  if (!txn) return null

  const db = getSupabaseAdmin()
  let workingTxn = txn

  if (txn.status !== 'success') {
    const { data, error } = await db
      .from('transactions')
      .update({
        status: 'success',
        mpesa_receipt: gatewayData.mpesaReceiptNumber || txn.mpesa_receipt,
        gateway_data: mergeGatewayData(txn.gateway_data, 'success', gatewayData),
        paid_at: txn.paid_at || new Date().toISOString(),
      })
      .eq('id', txn.id)
      .select('*, packages(*)')
      .single()

    if (error) throw error
    workingTxn = data
  }

  await activateAccess(workingTxn, db, phone || txn.phone, io)
  return workingTxn
}

async function markShopOrderFailed(order, provider, providerData = {}) {
  if (!order || order.payment_status === 'paid') return order

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('shop_orders')
    .update({
      payment_status: 'failed',
      payment_provider: provider,
      payment_provider_data: providerData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select()
    .single()

  if (error) throw error
  return data
}

async function markWorkspaceOrderFailed(order, providerData = {}, paymentRef) {
  if (!order || order.payment_status === 'paid') return order

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('workspace_orders')
    .update({
      payment_status: 'failed',
      status: 'failed',
      payment_ref: paymentRef || order.payment_ref,
      gateway_data: providerData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .select()
    .single()

  if (error) throw error
  return data
}

async function resolveMpesaEntity(checkoutRequestId) {
  const db = getSupabaseAdmin()

  const wifiTxn = await loadWifiTransaction(db, 'gateway_ref', checkoutRequestId)
  if (wifiTxn) return { flow: 'wifi', record: wifiTxn }

  const shopOrder = await loadShopOrder(db, 'payment_ref', checkoutRequestId)
  if (shopOrder) return { flow: 'shop', record: shopOrder }

  const workspaceOrder = await loadWorkspaceOrder(db, 'payment_ref', checkoutRequestId)
  if (workspaceOrder) {
    if (workspaceOrder.payload?.is_upgrade) {
      return { flow: 'workspace_upgrade', record: workspaceOrder }
    }
    return { flow: 'workspace', record: workspaceOrder }
  }

  return null
}

async function handleMpesaSuccess(result, io) {
  const resolved = await resolveMpesaEntity(result.checkoutRequestId)
  if (!resolved) {
    logger.warn(`M-Pesa success callback not matched: ${result.checkoutRequestId}`)
    return null
  }

  if (resolved.flow === 'wifi') {
    const transaction = await markWifiTransactionSuccessful(
      resolved.record,
      result,
      result.phoneNumber || resolved.record.phone,
      io
    )
    return { flow: 'wifi', transaction }
  }

  if (resolved.flow === 'shop') {
    const order = await finalizeShopOrderPayment(resolved.record, 'mpesa', result)
    return { flow: 'shop', order }
  }

  if (resolved.flow === 'workspace_upgrade') {
    const activation = await finalizeWorkspaceUpgradePayment(
      resolved.record,
      'mpesa',
      result,
      result.checkoutRequestId
    )
    return { flow: 'workspace_upgrade', order: activation?.order, tenantId: activation?.tenantId }
  }

  const activation = await finalizeWorkspaceOrderPayment(
    resolved.record,
    'mpesa',
    result,
    result.checkoutRequestId
  )
  return { flow: 'workspace', order: activation?.order, tenantId: activation?.tenantId }
}

async function handleMpesaFailure(result) {
  const resolved = await resolveMpesaEntity(result.checkoutRequestId)
  if (!resolved) {
    logger.warn(`M-Pesa failure callback not matched: ${result.checkoutRequestId}`)
    return null
  }

  if (resolved.flow === 'wifi') {
    const transaction = await markWifiTransactionFailed(resolved.record, result)
    return { flow: 'wifi', transaction }
  }

  if (resolved.flow === 'shop') {
    const order = await markShopOrderFailed(resolved.record, 'mpesa', result)
    return { flow: 'shop', order }
  }

  const order = await markWorkspaceOrderFailed(resolved.record, result, result.checkoutRequestId)
  return { flow: 'workspace', order }
}

async function resolvePaystackEntity(reference) {
  const db = getSupabaseAdmin()

  const wifiTxn = await loadWifiTransaction(db, 'reference', reference)
  if (wifiTxn) return { flow: 'wifi', record: wifiTxn }

  const shopOrder = await loadShopOrder(db, 'reference', reference)
  if (shopOrder) return { flow: 'shop', record: shopOrder }

  const workspaceOrder = await loadWorkspaceOrder(db, 'reference', reference)
  if (workspaceOrder) {
    if (workspaceOrder.payload?.is_upgrade) {
      return { flow: 'workspace_upgrade', record: workspaceOrder }
    }
    return { flow: 'workspace', record: workspaceOrder }
  }

  return null
}

async function loadWifiPaymentContext(tenantId) {
  const tenant = await loadTenantPaymentRecord(tenantId)
  if (!tenant) return null
  return buildTenantPaymentContext(tenant)
}

function buildMpesaOptions(paymentContext) {
  return {
    environment: process.env.MPESA_ENV || 'sandbox',
    mpesa: {
      consumer_key: paymentContext?.mpesa?.consumer_key,
      consumer_secret: paymentContext?.mpesa?.consumer_secret,
      shortcode: paymentContext?.mpesa?.shortcode,
      paybill: paymentContext?.mpesa?.paybill,
      passkey: paymentContext?.mpesa?.passkey,
      callback_url: process.env.MPESA_CALLBACK_URL,
    },
  }
}

function buildPaystackOptions(paymentContext) {
  return {
    paystack: {
      public_key: paymentContext?.paystack?.public_key,
      secret_key: paymentContext?.paystack?.secret_key,
    },
    webhookSecret: paymentContext?.paystack?.secret_key,
  }
}

async function resolvePaymentContextForEntity(resolved) {
  if (resolved?.flow === 'wifi') {
    const paymentContext = await loadWifiPaymentContext(resolved.record.tenant_id)
    if (!paymentContext) {
      throw new Error('Tenant payment context not found')
    }

    return {
      source: 'tenant',
      context: paymentContext,
    }
  }

  return {
    source: 'platform',
    context: buildPlatformPaymentContext(),
  }
}

async function handlePaystackSuccess(reference, gatewayData, io) {
  const resolved = await resolvePaystackEntity(reference)
  if (!resolved) {
    logger.warn(`Paystack payment not matched: ${reference}`)
    return null
  }

  if (resolved.flow === 'wifi') {
    const transaction = await markWifiTransactionSuccessful(
      resolved.record,
      gatewayData,
      gatewayData.customer?.phone || resolved.record.phone,
      io
    )
    return { flow: 'wifi', transaction }
  }

  if (resolved.flow === 'shop') {
    const order = await finalizeShopOrderPayment(resolved.record, 'paystack', gatewayData)
    return { flow: 'shop', order }
  }

  if (resolved.flow === 'workspace_upgrade') {
    const activation = await finalizeWorkspaceUpgradePayment(
      resolved.record,
      'paystack',
      gatewayData,
      reference
    )
    return { flow: 'workspace_upgrade', order: activation?.order, tenantId: activation?.tenantId }
  }

  const activation = await finalizeWorkspaceOrderPayment(
    resolved.record,
    'paystack',
    gatewayData,
    reference
  )
  return { flow: 'workspace', order: activation?.order, tenantId: activation?.tenantId }
}

async function handlePaystackFailure(reference, gatewayData) {
  const resolved = await resolvePaystackEntity(reference)
  if (!resolved) {
    logger.warn(`Paystack failed payment not matched: ${reference}`)
    return null
  }

  if (resolved.flow === 'wifi') {
    const transaction = await markWifiTransactionFailed(resolved.record, gatewayData)
    return { flow: 'wifi', transaction }
  }

  if (resolved.flow === 'shop') {
    const order = await markShopOrderFailed(resolved.record, 'paystack', gatewayData)
    return { flow: 'shop', order }
  }

  const order = await markWorkspaceOrderFailed(resolved.record, gatewayData, reference)
  return { flow: 'workspace', order }
}

router.post('/mpesa/initiate', async (req, res) => {
  try {
    const { phone, package_id, tenant_id, customer_email } = req.body
    const clientContext = buildClientContext(req.body)

    if (!phone || !package_id || !tenant_id) {
      return res.status(400).json({ error: 'phone, package_id and tenant_id required' })
    }

    const db = getSupabaseAdmin()

    const { data: pkg } = await db
      .from('packages')
      .select('*')
      .eq('id', package_id)
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .single()

    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    const paymentContext = await loadWifiPaymentContext(tenant_id)
    if (!paymentContext) {
      return res.status(404).json({ error: 'Tenant payment settings not found' })
    }

    if (paymentContext.status === 'suspended') {
      return res.status(403).json({ error: 'Service suspended. Contact your venue provider.' })
    }

    if (!paymentContext.payment_setup?.mpesa?.ready) {
      return res.status(503).json({ error: 'This venue has not enabled M-Pesa payments yet.' })
    }

    const reference = `FF-${shortUUID.generate().slice(0, 8).toUpperCase()}`

    const { data: txn } = await db
      .from('transactions')
      .insert({
        reference,
        tenant_id,
        package_id,
        phone,
        customer_email,
        amount: pkg.price,
        payment_method: 'mpesa',
        status: 'pending',
        gateway_data: { client_context: clientContext },
      })
      .select()
      .single()

    const mpesaRes = await initiateStkPush(
      normalizePhone(phone),
      pkg.price,
      reference,
      `FlowFi WiFi - ${pkg.name}`,
      buildMpesaOptions(paymentContext)
    )

    await db
      .from('transactions')
      .update({
        gateway_ref: mpesaRes.CheckoutRequestID,
        gateway_data: mergeGatewayData(txn.gateway_data, 'initialize', mpesaRes),
      })
      .eq('id', txn.id)

    res.json({
      message: 'STK Push sent to your phone',
      reference,
      checkoutRequestId: mpesaRes.CheckoutRequestID,
    })
  } catch (err) {
    logger.error('M-Pesa initiate error:', err.message)
    res.status(500).json({ error: 'Payment initiation failed' })
  }
})

router.post('/mpesa/callback', async (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: 'Success' })

  try {
    const result = parseMpesaCallback(getJsonBody(req.body))
    if (!result) return

    if (!result.success) {
      await handleMpesaFailure(result)
      return
    }

    await handleMpesaSuccess(result, req.app.get('io'))
  } catch (err) {
    logger.error('M-Pesa callback error:', err.message)
  }
})

router.post('/mpesa/query', async (req, res) => {
  const { checkoutRequestId } = req.body
  if (!checkoutRequestId) return res.status(400).json({ error: 'checkoutRequestId required' })

  try {
    const resolved = await resolveMpesaEntity(checkoutRequestId)
    if (!resolved) {
      return res.status(404).json({ error: 'Payment not found for this checkout request' })
    }

    const paymentContext = await resolvePaymentContextForEntity(resolved)
    const result = await queryStkPush(
      checkoutRequestId,
      paymentContext.source === 'tenant' ? buildMpesaOptions(paymentContext.context) : {}
    )

    if (result.CheckoutRequestID && isSuccessfulResultCode(result.ResultCode)) {
      await handleMpesaSuccess(
        {
          success: true,
          checkoutRequestId: result.CheckoutRequestID,
          merchantRequestId: result.MerchantRequestID,
          amount: result.Amount,
          queryResult: true,
          gatewayResult: result,
        },
        req.app.get('io')
      )
    } else if (result.CheckoutRequestID && result.ResultCode !== undefined) {
      await handleMpesaFailure({
        success: false,
        checkoutRequestId: result.CheckoutRequestID,
        merchantRequestId: result.MerchantRequestID,
        resultCode: result.ResultCode,
        message: result.ResultDesc,
        gatewayResult: result,
      })
    }

    res.json(result)
  } catch (err) {
    logger.error('M-Pesa query error:', err.message)
    res.status(500).json({ error: 'M-Pesa query failed' })
  }
})

router.post('/paystack/initialize', async (req, res) => {
  try {
    const { email, package_id, tenant_id, customer_phone, callback_url } = req.body
    const clientContext = buildClientContext(req.body)
    if (!email || !package_id || !tenant_id) {
      return res.status(400).json({ error: 'email, package_id, tenant_id required' })
    }

    const db = getSupabaseAdmin()
    const { data: pkg } = await db
      .from('packages')
      .select('*')
      .eq('id', package_id)
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .single()

    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    const paymentContext = await loadWifiPaymentContext(tenant_id)
    if (!paymentContext) {
      return res.status(404).json({ error: 'Tenant payment settings not found' })
    }

    if (paymentContext.status === 'suspended') {
      return res.status(403).json({ error: 'Service suspended. Contact your venue provider.' })
    }

    if (!paymentContext.payment_setup?.paystack?.ready) {
      return res.status(503).json({ error: 'This venue has not enabled Paystack payments yet.' })
    }

    const reference = `FF-PS-${shortUUID.generate().slice(0, 8).toUpperCase()}`
    const callbackUrl =
      callback_url || `${process.env.FRONTEND_URL}/payment/callback?flow=wifi&tenantId=${tenant_id}`

    await db.from('transactions').insert({
      reference,
      tenant_id,
      package_id,
      phone: customer_phone,
      customer_email: email,
      amount: pkg.price,
      payment_method: 'paystack',
      status: 'pending',
      gateway_ref: reference,
      gateway_data: { client_context: clientContext },
    })

    const result = await initializePaystack(
      email,
      pkg.price,
      reference,
      {
        flow: 'wifi',
        package_id,
        tenant_id,
        package_name: pkg.name,
        customer_phone,
      },
      callbackUrl,
      buildPaystackOptions(paymentContext)
    )

    await db
      .from('transactions')
      .update({ gateway_data: mergeGatewayData({ client_context: clientContext }, 'initialize', result.data || result) })
      .eq('reference', reference)

    res.json({ authorization_url: result.data.authorization_url, reference })
  } catch (err) {
    logger.error('Paystack init error:', err.message)
    res.status(500).json({ error: 'Payment init failed' })
  }
})

router.post('/paystack/webhook', async (req, res) => {
  try {
    const event = getJsonBody(req.body)
    const reference = event.data?.reference
    const resolved = reference ? await resolvePaystackEntity(reference) : null
    const paymentContext = await resolvePaymentContextForEntity(resolved)
    const signature = req.headers['x-paystack-signature']

    if (
      !verifyPaystackWebhook(
        req.body,
        signature,
        paymentContext.source === 'tenant' ? buildPaystackOptions(paymentContext.context) : {}
      )
    ) {
      return res.status(400).json({ error: 'Invalid signature' })
    }

    res.sendStatus(200)
    if (!reference) return

    if (event.event === 'charge.success') {
      await handlePaystackSuccess(reference, event.data, req.app.get('io'))
      return
    }

    if (['charge.failed', 'charge.abandoned'].includes(event.event)) {
      await handlePaystackFailure(reference, event.data)
    }
  } catch (err) {
    logger.error('Paystack webhook error:', err.message)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Webhook handling failed' })
    }
  }
})

router.get('/paystack/verify/:reference', async (req, res) => {
  try {
    const resolved = await resolvePaystackEntity(req.params.reference)
    if (!resolved) {
      return res.status(404).json({ error: 'Payment reference not found' })
    }

    const paymentContext = await resolvePaymentContextForEntity(resolved)
    const result = await verifyPaystack(
      req.params.reference,
      paymentContext.source === 'tenant' ? buildPaystackOptions(paymentContext.context) : {}
    )
    if (result.data?.status === 'success') {
      const resolved = await handlePaystackSuccess(req.params.reference, result.data, req.app.get('io'))
      return res.json({ verified: true, ...resolved })
    }

    if (result.data?.status) {
      await handlePaystackFailure(req.params.reference, result.data)
    }

    return res.json({ verified: false, status: result.data?.status || 'pending' })
  } catch (err) {
    logger.error('Paystack verify error: ' + (err && err.message ? err.message : util.inspect(err, { depth: null })))
    logger.error(err && err.stack ? err.stack : util.inspect(err, { depth: null }))
    if (err.response) {
      return res.status(err.response.status || 500).json({ error: err.response.data || err.message })
    }
    res.status(500).json({ error: err.message })
  }
})

async function activateAccess(txn, db, phone, io) {
  const pkg = txn.packages
  if (!pkg) {
    logger.warn(`Skipping session activation, package missing for transaction ${txn.reference}`)
    return null
  }

  const { data: existingSession, error: sessionLookupError } = await db
    .from('sessions')
    .select('*')
    .eq('transaction_id', txn.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sessionLookupError) throw sessionLookupError
  if (existingSession) return existingSession

  const username = `ff_${txn.reference.toLowerCase()}`
  const password = Math.random().toString(36).slice(2, 10)
  const expiresAt = new Date(Date.now() + pkg.duration_minutes * 60 * 1000).toISOString()
  const clientContext = txn.gateway_data?.client_context || {}

  const { data: createdSession } = await db
    .from('sessions')
    .insert({
      transaction_id: txn.id,
      tenant_id: txn.tenant_id,
      package_id: txn.package_id,
      username,
      password,
      phone: phone || txn.phone,
      mac_address: clientContext.mac_address || null,
      ip_address: clientContext.ip_address || null,
      status: 'active',
      expires_at: expiresAt,
    })
    .select()
    .single()

  let session = {
    ...createdSession,
    packages: pkg,
  }

  const { data: router } = await db
    .from('routers')
    .select('id')
    .eq('tenant_id', txn.tenant_id)
    .eq('status', 'online')
    .limit(1)
    .single()

  if (router) {
    try {
      await addHotspotUser(router.id, {
        username,
        password,
        profile: pkg.mikrotik_profile || 'default',
        comment: `FlowFi session ${txn.reference}`,
      })
      await db.from('sessions').update({ router_id: router.id }).eq('id', session.id)
      session = { ...session, router_id: router.id }
    } catch (err) {
      logger.error(`MikroTik activation failed: ${err.message}`)
    }
  }

  try {
    await ensureGuestSessionTracking(session)
  } catch (err) {
    logger.warn(`Guest session tracking setup failed for ${session.id}: ${err.message}`)
  }

  await awardLoyaltyPoints(txn.tenant_id, phone || txn.phone, txn.amount, txn.id)

  await sendActivationNotification({
    phone: phone || txn.phone,
    email: txn.customer_email,
    packageName: pkg.name,
    duration: pkg.duration_minutes,
    username,
    password,
    expiresAt,
  })

  if (io) {
    io.to('admin-room').emit('new:session', { session, txn })
    io.to(`tenant-${txn.tenant_id}`).emit('new:session', { session, txn })
  }

  logger.info(`Session activated: ${username} for tenant ${txn.tenant_id}`)
  return session
}

module.exports = router
