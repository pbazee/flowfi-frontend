const axios = require('axios')
const crypto = require('crypto')
const { logger } = require('../lib/logger')

const PAYSTACK_BASE = 'https://api.paystack.co'

function hasConfiguredValue(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return false

  return !['YOUR_', 'REPLACE_WITH', 'CHANGE_THIS'].some((marker) =>
    normalized.toUpperCase().includes(marker)
  )
}

function resolveMpesaBaseUrl(environment) {
  return environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'
}

function resolveMpesaContext(options = {}) {
  const mpesa = options.mpesa || {}
  return {
    environment: String(options.environment || mpesa.environment || process.env.MPESA_ENV || 'sandbox').trim().toLowerCase(),
    consumerKey: mpesa.consumer_key || mpesa.consumerKey || process.env.MPESA_CONSUMER_KEY,
    consumerSecret: mpesa.consumer_secret || mpesa.consumerSecret || process.env.MPESA_CONSUMER_SECRET,
    shortcode: mpesa.shortcode || process.env.MPESA_SHORTCODE,
    paybill: mpesa.paybill || process.env.MPESA_PAYBILL,
    passkey: mpesa.passkey || process.env.MPESA_PASSKEY,
    callbackUrl: options.callbackUrl || mpesa.callback_url || mpesa.callbackUrl || process.env.MPESA_CALLBACK_URL,
    transactionType: options.transactionType || mpesa.transaction_type || mpesa.transactionType || 'CustomerPayBillOnline',
  }
}

function resolvePaystackContext(options = {}) {
  const paystack = options.paystack || {}
  return {
    publicKey: paystack.public_key || paystack.publicKey || process.env.PAYSTACK_PUBLIC_KEY,
    secretKey: paystack.secret_key || paystack.secretKey || options.secretKey || process.env.PAYSTACK_SECRET_KEY,
    webhookSecret:
      options.webhookSecret ||
      paystack.webhook_secret ||
      paystack.webhookSecret ||
      process.env.PAYSTACK_WEBHOOK_SECRET ||
      paystack.secret_key ||
      paystack.secretKey ||
      options.secretKey ||
      process.env.PAYSTACK_SECRET_KEY,
  }
}

function isMpesaConfigured(options = {}) {
  const context = resolveMpesaContext(options)

  return [
    context.consumerKey,
    context.consumerSecret,
    context.shortcode,
    context.passkey,
    context.callbackUrl,
  ].every(hasConfiguredValue)
}

function isPaystackConfigured(options = {}) {
  const context = resolvePaystackContext(options)
  return hasConfiguredValue(context.secretKey)
}

function buildPlatformPaymentContext() {
  return {
    mpesa: resolveMpesaContext(),
    paystack: resolvePaystackContext(),
  }
}

function getPaymentAvailability(context = buildPlatformPaymentContext()) {
  const availability = {
    mpesa: isMpesaConfigured({ mpesa: context.mpesa, environment: context.mpesa?.environment }),
    paystack: isPaystackConfigured({ paystack: context.paystack }),
  }

  return {
    ...availability,
    defaultMethod: availability.paystack ? 'paystack' : availability.mpesa ? 'mpesa' : null,
  }
}

async function getMpesaToken(options = {}) {
  const context = resolveMpesaContext(options)
  if (!isMpesaConfigured({ mpesa: context, environment: context.environment })) {
    throw new Error('M-Pesa checkout is not configured for this payment flow.')
  }

  const credentials = Buffer.from(`${context.consumerKey}:${context.consumerSecret}`).toString('base64')
  const res = await axios.get(
    `${resolveMpesaBaseUrl(context.environment)}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${credentials}` },
    }
  )

  return res.data.access_token
}

function getMpesaPassword(options = {}) {
  const context = resolveMpesaContext(options)
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
  const password = Buffer.from(`${context.shortcode}${context.passkey}${timestamp}`).toString('base64')
  return { password, timestamp }
}

async function initiateStkPush(phone, amount, reference, description, options = {}) {
  const context = resolveMpesaContext(options)
  const token = await getMpesaToken({ mpesa: context, environment: context.environment })
  const { password, timestamp } = getMpesaPassword({ mpesa: context, environment: context.environment })

  const payload = {
    BusinessShortCode: context.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: context.transactionType,
    Amount: Math.ceil(amount),
    PartyA: phone,
    PartyB: context.shortcode,
    PhoneNumber: phone,
    CallBackURL: context.callbackUrl,
    AccountReference: reference,
    TransactionDesc: description,
  }

  const res = await axios.post(
    `${resolveMpesaBaseUrl(context.environment)}/mpesa/stkpush/v1/processrequest`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  logger.info(`STK Push initiated: ${reference} -> ${phone}`)
  return res.data
}

async function queryStkPush(checkoutRequestId, options = {}) {
  const context = resolveMpesaContext(options)
  const token = await getMpesaToken({ mpesa: context, environment: context.environment })
  const { password, timestamp } = getMpesaPassword({ mpesa: context, environment: context.environment })

  const res = await axios.post(
    `${resolveMpesaBaseUrl(context.environment)}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: context.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  )

  return res.data
}

function parseMpesaCallback(body) {
  const stkCallback = body?.Body?.stkCallback
  if (!stkCallback) return null

  const resultCode = stkCallback.ResultCode
  const merchantRequestId = stkCallback.MerchantRequestID
  const checkoutRequestId = stkCallback.CheckoutRequestID

  if (resultCode !== 0) {
    return {
      success: false,
      merchantRequestId,
      checkoutRequestId,
      resultCode,
      message: stkCallback.ResultDesc,
    }
  }

  const items = stkCallback.CallbackMetadata?.Item || []
  const get = (name) => items.find((item) => item.Name === name)?.Value

  return {
    success: true,
    merchantRequestId,
    checkoutRequestId,
    mpesaReceiptNumber: get('MpesaReceiptNumber'),
    transactionDate: get('TransactionDate'),
    phoneNumber: get('PhoneNumber'),
    amount: get('Amount'),
  }
}

function paystackHeaders(options = {}) {
  const context = resolvePaystackContext(options)
  return {
    Authorization: `Bearer ${context.secretKey}`,
    'Content-Type': 'application/json',
  }
}

async function initializePaystack(email, amount, reference, metadata = {}, callbackUrl, options = {}) {
  const context = resolvePaystackContext(options)
  if (!isPaystackConfigured({ paystack: context })) {
    throw new Error('Paystack checkout is not configured for this payment flow.')
  }

  const res = await axios.post(
    `${PAYSTACK_BASE}/transaction/initialize`,
    {
      email,
      amount: Math.ceil(amount * 100),
      currency: 'KES',
      reference,
      metadata,
      callback_url: callbackUrl || `${process.env.FRONTEND_URL}/payment/callback`,
    },
    { headers: paystackHeaders({ paystack: context }) }
  )

  return res.data
}

async function verifyPaystack(reference, options = {}) {
  const context = resolvePaystackContext(options)
  if (!isPaystackConfigured({ paystack: context })) {
    throw new Error('Paystack checkout is not configured for this payment flow.')
  }

  const res = await axios.get(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
    headers: paystackHeaders({ paystack: context }),
  })

  return res.data
}

function verifyPaystackWebhook(rawBody, signature, options = {}) {
  const context = resolvePaystackContext(options)
  const secret = context.webhookSecret
  if (!secret || !signature) return false

  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  return hash === signature
}

module.exports = {
  buildPlatformPaymentContext,
  getPaymentAvailability,
  hasConfiguredValue,
  initiateStkPush,
  initializePaystack,
  isMpesaConfigured,
  isPaystackConfigured,
  parseMpesaCallback,
  queryStkPush,
  resolveMpesaContext,
  resolvePaystackContext,
  verifyPaystack,
  verifyPaystackWebhook,
}
