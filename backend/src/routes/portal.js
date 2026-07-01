const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../lib/supabase');
const { buildTenantPaymentSetup } = require('../services/tenant-payment.service');

async function loadActiveSessionByFilters(db, tenantId, filters = {}) {
  const nowIso = new Date().toISOString();
  const candidates = [
    { key: 'mac_address', value: filters.mac_address },
    { key: 'reference', value: filters.reference },
    { key: 'username', value: filters.username },
    { key: 'phone', value: filters.phone },
  ].filter((entry) => String(entry.value || '').trim());

  for (const candidate of candidates) {
    if (candidate.key === 'reference') {
      const { data: transaction, error: transactionError } = await db
        .from('transactions')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('reference', candidate.value)
        .maybeSingle();

      if (transactionError) throw transactionError;
      if (!transaction?.id) continue;

      const { data: session, error: sessionError } = await db
        .from('sessions')
        .select('id, username, password, phone, mac_address, ip_address, created_at, expires_at, status, packages(name, speed_limit, points_reward), transactions(reference), routers(dns_name, ip_address)')
        .eq('tenant_id', tenantId)
        .eq('transaction_id', transaction.id)
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (session) return session;
      continue;
    }

    const { data: session, error } = await db
      .from('sessions')
      .select('id, username, password, phone, mac_address, ip_address, created_at, expires_at, status, packages(name, speed_limit, points_reward), transactions(reference), routers(dns_name, ip_address)')
      .eq('tenant_id', tenantId)
      .eq(candidate.key, candidate.value)
      .eq('status', 'active')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (session) return session;
  }

  return null;
}

function serializeSessionStatus(session) {
  if (!session) {
    return { active: false };
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000)
  );

  return {
    active: true,
    session_id: session.id,
    username: session.username,
    phone: session.phone,
    mac_address: session.mac_address,
    ip_address: session.ip_address,
    session_start: session.created_at,
    session_end: session.expires_at,
    expires_at: session.expires_at,
    remaining_seconds: remainingSeconds,
    remaining_minutes: Math.ceil(remainingSeconds / 60),
    package_name: session.packages?.name || 'WiFi package',
    package_speed: session.packages?.speed_limit || 'Unlimited',
    loyalty_points_earned: Number(session.packages?.points_reward || 0),
    reference: session.transactions?.reference || null,
    password: session.password || null,
    router_dns_name: session.routers?.dns_name || null,
    router_ip: session.routers?.ip_address || null,
  };
}

router.get('/:tenantId/config', async (req, res) => {
  try {
    const db = getSupabaseAdmin();

    const { data: tenant } = await db
      .from('tenants')
      .select(`
        id,
        name,
        status,
        logo_url,
        portal_primary_color,
        portal_secondary_color,
        portal_welcome_message,
        loyalty_enabled,
        contact_phone,
        contact_email,
        paystack_public_key,
        paystack_secret_key,
        mpesa_shortcode,
        mpesa_paybill,
        mpesa_consumer_key,
        mpesa_consumer_secret,
        mpesa_passkey
      `)
      .eq('id', req.params.tenantId)
      .maybeSingle();

    if (!tenant) return res.status(404).json({ error: 'Portal not found' });

    const paymentSetup = buildTenantPaymentSetup(tenant);
    const isOperational = ['active', 'trialing'].includes(String(tenant.status || 'active'));
    const isSuspended = !isOperational;
    const acceptingNewPayments = isOperational && paymentSetup.portal_accepting_payments;

    let packages = [];
    if (isOperational) {
      const result = await db
        .from('packages')
        .select('id, name, price, duration_minutes, data_limit_mb, description, speed_limit, points_reward, happy_hour_start, happy_hour_end, happy_hour_discount')
        .eq('tenant_id', req.params.tenantId)
        .eq('status', 'active')
        .order('price', { ascending: true });

      if (result.error) throw result.error;
      packages = result.data || [];
    }

    let portalMessage = null;
    if (isSuspended) {
      portalMessage = 'New connections are temporarily disabled by the provider. Existing active sessions will continue to work until they expire.';
    } else if (!paymentSetup.portal_accepting_payments) {
      portalMessage = 'This venue is not yet accepting online payments. Contact the venue for assistance.';
    }

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        logo_url: tenant.logo_url,
        portal_primary_color: tenant.portal_primary_color,
        portal_secondary_color: tenant.portal_secondary_color,
        portal_welcome_message: tenant.portal_welcome_message,
        loyalty_enabled: tenant.loyalty_enabled,
        contact_phone: tenant.contact_phone,
        contact_email: tenant.contact_email,
      },
      packages,
      payment_methods: {
        mpesa: acceptingNewPayments && paymentSetup.mpesa.ready,
        paystack: acceptingNewPayments && paymentSetup.paystack.ready,
        defaultMethod: acceptingNewPayments
          ? (paymentSetup.paystack.ready ? 'paystack' : paymentSetup.mpesa.ready ? 'mpesa' : null)
          : null,
      },
      payment_setup: paymentSetup,
      portal_state: {
        suspended: isSuspended,
        accepting_new_payments: acceptingNewPayments,
        accepts_payments: acceptingNewPayments,
        message: portalMessage,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:tenantId/session-status', async (req, res) => {
  const { phone, username, mac_address, reference } = req.query;
  if (!phone && !username && !mac_address && !reference) {
    return res.status(400).json({ error: 'phone, username, mac_address, or reference required' });
  }

  try {
    const db = getSupabaseAdmin();
    const session = await loadActiveSessionByFilters(db, req.params.tenantId, {
      phone,
      username,
      mac_address,
      reference,
    });

    res.json(serializeSessionStatus(session));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:tenantId/check-in', async (req, res) => {
  const { mac_address, ip_address, device_type } = req.body;
  const db = getSupabaseAdmin();

  try {
    const result = await db.from('portal_visits').insert({
      tenant_id: req.params.tenantId,
      mac_address,
      ip_address,
      device_type,
    });

    if (result.error) {
      throw result.error;
    }
  } catch {
    // Portal visit logging is best-effort only.
  }

  res.json({ ok: true });
});

router.get('/resolve-domain/:domain', async (req, res) => {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('tenants')
    .select('id, name')
    .eq('custom_domain', req.params.domain)
    .single();

  if (!data) return res.status(404).json({ error: 'Domain not configured' });
  res.json(data);
});

module.exports = router;
