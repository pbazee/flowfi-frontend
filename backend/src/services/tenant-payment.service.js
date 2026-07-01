const { getSupabaseAdmin } = require('../lib/supabase')
const {
  SECRET_MASK,
  decryptSecretValue,
  encryptSecretValue,
  isMaskedSecretValue,
  maskSecretValue,
} = require('../lib/secure-fields')

const PAYMENT_FIELD_DEFINITIONS = [
  { key: 'paystack_public_key', label: 'Paystack Public Key', secret: false, method: 'paystack' },
  { key: 'paystack_secret_key', label: 'Paystack Secret Key', secret: true, method: 'paystack' },
  { key: 'mpesa_shortcode', label: 'M-Pesa Shortcode', secret: false, method: 'mpesa' },
  { key: 'mpesa_paybill', label: 'M-Pesa Paybill', secret: false, method: 'mpesa' },
  { key: 'mpesa_consumer_key', label: 'M-Pesa Consumer Key', secret: true, method: 'mpesa' },
  { key: 'mpesa_consumer_secret', label: 'M-Pesa Consumer Secret', secret: true, method: 'mpesa' },
  { key: 'mpesa_passkey', label: 'M-Pesa Passkey', secret: true, method: 'mpesa' },
]

const SECRET_FIELDS = PAYMENT_FIELD_DEFINITIONS.filter((field) => field.secret).map((field) => field.key)
const PAYMENT_FIELDS = PAYMENT_FIELD_DEFINITIONS.map((field) => field.key)

function cleanValue(value) {
  const normalized = String(value ?? '').trim()
  return normalized || ''
}

function getDecryptedTenantPaymentFields(tenant = {}) {
  return {
    paystack_public_key: cleanValue(tenant.paystack_public_key),
    paystack_secret_key: cleanValue(decryptSecretValue(tenant.paystack_secret_key)),
    mpesa_shortcode: cleanValue(tenant.mpesa_shortcode),
    mpesa_paybill: cleanValue(tenant.mpesa_paybill),
    mpesa_consumer_key: cleanValue(decryptSecretValue(tenant.mpesa_consumer_key)),
    mpesa_consumer_secret: cleanValue(decryptSecretValue(tenant.mpesa_consumer_secret)),
    mpesa_passkey: cleanValue(decryptSecretValue(tenant.mpesa_passkey)),
  }
}

function buildTenantPaymentSetup(tenant = {}) {
  const fields = getDecryptedTenantPaymentFields(tenant)
  const definitionsByKey = Object.fromEntries(PAYMENT_FIELD_DEFINITIONS.map((field) => [field.key, field]))

  const missingFields = PAYMENT_FIELD_DEFINITIONS.filter((field) => !fields[field.key]).map((field) => field.key)
  const paystackMissing = PAYMENT_FIELD_DEFINITIONS
    .filter((field) => field.method === 'paystack' && !fields[field.key])
    .map((field) => field.key)
  const mpesaMissing = PAYMENT_FIELD_DEFINITIONS
    .filter((field) => field.method === 'mpesa' && !fields[field.key])
    .map((field) => field.key)

  return {
    fields: Object.fromEntries(
      PAYMENT_FIELD_DEFINITIONS.map((field) => [
        field.key,
        {
          key: field.key,
          label: field.label,
          method: field.method,
          secret: field.secret,
          configured: Boolean(fields[field.key]),
          value: field.secret ? maskSecretValue(fields[field.key]) : fields[field.key],
        },
      ])
    ),
    missing_fields: missingFields,
    missing_labels: missingFields.map((key) => definitionsByKey[key]?.label || key),
    paystack: {
      ready: paystackMissing.length === 0,
      missing_fields: paystackMissing,
    },
    mpesa: {
      ready: mpesaMissing.length === 0,
      missing_fields: mpesaMissing,
    },
    portal_accepting_payments: paystackMissing.length === 0 || mpesaMissing.length === 0,
    warning_message:
      paystackMissing.length > 0 && mpesaMissing.length > 0
        ? 'Complete your payment setup in Settings to start accepting guest WiFi payments.'
        : null,
  }
}

function serializeTenantForClient(tenant = {}, options = {}) {
  const subscription = options.subscription || tenant.subscription || null
  const paymentSetup = buildTenantPaymentSetup(tenant)

  return {
    ...tenant,
    paystack_secret_key: paymentSetup.fields.paystack_secret_key.value,
    mpesa_consumer_key: paymentSetup.fields.mpesa_consumer_key.value,
    mpesa_consumer_secret: paymentSetup.fields.mpesa_consumer_secret.value,
    mpesa_passkey: paymentSetup.fields.mpesa_passkey.value,
    paystack_secret_key_configured: paymentSetup.fields.paystack_secret_key.configured,
    mpesa_consumer_key_configured: paymentSetup.fields.mpesa_consumer_key.configured,
    mpesa_consumer_secret_configured: paymentSetup.fields.mpesa_consumer_secret.configured,
    mpesa_passkey_configured: paymentSetup.fields.mpesa_passkey.configured,
    payment_setup: paymentSetup,
    subscription,
  }
}

function buildTenantPaymentContext(tenant = {}) {
  const fields = getDecryptedTenantPaymentFields(tenant)
  const paymentSetup = buildTenantPaymentSetup(tenant)

  return {
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    status: tenant.status,
    paystack: {
      public_key: fields.paystack_public_key,
      secret_key: fields.paystack_secret_key,
    },
    mpesa: {
      shortcode: fields.mpesa_shortcode,
      paybill: fields.mpesa_paybill,
      consumer_key: fields.mpesa_consumer_key,
      consumer_secret: fields.mpesa_consumer_secret,
      passkey: fields.mpesa_passkey,
    },
    payment_setup: paymentSetup,
  }
}

async function loadTenantPaymentRecord(tenantId) {
  if (!tenantId) return null

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('tenants')
    .select(`id, name, status, ${PAYMENT_FIELDS.join(', ')}, contact_phone, contact_email`)
    .eq('id', tenantId)
    .maybeSingle()

  if (error) throw error
  return data
}

function buildTenantPaymentUpdates(payload = {}, existingTenant = {}) {
  const updates = {}

  for (const field of PAYMENT_FIELD_DEFINITIONS) {
    if (payload[field.key] === undefined) continue

    if (field.secret) {
      if (isMaskedSecretValue(payload[field.key])) {
        continue
      }

      const normalized = cleanValue(payload[field.key])
      if (!normalized) {
        updates[field.key] = null
      } else {
        updates[field.key] = encryptSecretValue(normalized)
      }
      continue
    }

    const normalized = cleanValue(payload[field.key])
    const previousValue = cleanValue(existingTenant[field.key])
    updates[field.key] = normalized || (previousValue && payload[field.key] === existingTenant[field.key] ? previousValue : null)
  }

  return updates
}

module.exports = {
  PAYMENT_FIELD_DEFINITIONS,
  PAYMENT_FIELDS,
  SECRET_FIELDS,
  SECRET_MASK,
  buildTenantPaymentContext,
  buildTenantPaymentSetup,
  buildTenantPaymentUpdates,
  getDecryptedTenantPaymentFields,
  loadTenantPaymentRecord,
  serializeTenantForClient,
}
