const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../lib/supabase');
const { authenticate, requireRole, requireTenantOwnership, blockDemoMutations } = require('../middleware/auth');
const { logger } = require('../lib/logger');
const { loadTenantSubscription } = require('../services/subscription.service');
const { isRelationMissingError } = require('../lib/db-compat');
const { loadTenantForClient } = require('../services/tenant-profile.service');
const { buildTenantPaymentUpdates } = require('../services/tenant-payment.service');
const {
  grantGuestSessionCredit,
  listSessionCreditHistory,
  retrySessionCreditSync,
  searchCreditableSessions,
} = require('../services/session-credit.service');

router.use(authenticate, requireRole('tenant_admin', 'super_admin'), blockDemoMutations);

function tenantId(req) {
  return req.user.role === 'super_admin' ? req.params.tenantId || req.query.tenant_id : req.user.tenant_id;
}

async function attachGuestTracking(db, sessions = []) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const sessionIds = sessions.map((session) => session.id).filter(Boolean);
  if (sessionIds.length === 0) return sessions;

  const { data: trackingRows, error } = await db
    .from('guest_sessions')
    .select('*')
    .in('session_id', sessionIds);

  if (error) {
    if (isRelationMissingError(error, 'guest_sessions')) {
      return sessions.map((session) => ({
        ...session,
        guest_tracking: null,
      }));
    }

    throw error;
  }

  const trackingBySessionId = new Map((trackingRows || []).map((row) => [row.session_id, row]));
  return sessions.map((session) => ({
    ...session,
    guest_tracking: trackingBySessionId.get(session.id) || null,
  }));
}

// ── GET /api/tenant/dashboard ─────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const tid = req.user.tenant_id;
    const today = new Date().toISOString().split('T')[0];

    const [sessions, todayTxns, totalTxns, routers, customers] = await Promise.all([
      db.from('sessions').select('id').eq('tenant_id', tid).eq('status', 'active'),
      db.from('transactions').select('amount').eq('tenant_id', tid).eq('status', 'success').gte('created_at', `${today}T00:00:00`),
      db.from('transactions').select('amount').eq('tenant_id', tid).eq('status', 'success'),
      db.from('routers').select('id, status').eq('tenant_id', tid),
      db.from('sessions').select('phone').eq('tenant_id', tid).neq('phone', null),
    ]);

    const uniqueCustomers = new Set((customers.data || []).map((s) => s.phone)).size;

    const subscription = await loadTenantSubscription(tid);
    const tenant = await loadTenantForClient(tid);

    res.json({
      activeSessions: sessions.data?.length || 0,
      todayRevenue: (todayTxns.data || []).reduce((s, t) => s + t.amount, 0),
      totalRevenue: (totalTxns.data || []).reduce((s, t) => s + t.amount, 0),
      routers: {
        total: routers.data?.length || 0,
        online: routers.data?.filter((r) => r.status === 'online').length || 0,
      },
      totalCustomers: uniqueCustomers,
      subscription,
      tenant_status: tenant?.status || null,
      payment_setup: tenant?.payment_setup || null,
      tenant,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET/PUT /api/tenant/profile ───────────────────────────────
router.get('/profile', async (req, res) => {
  const profile = await loadTenantForClient(req.user.tenant_id);
  res.json(profile);
});

router.put('/profile', async (req, res) => {
  const allowed = [
    'name',
    'business_type',
    'logo_url',
    'portal_primary_color',
    'portal_secondary_color',
    'portal_welcome_message',
    'mpesa_shortcode',
    'mpesa_paybill',
    'paystack_public_key',
    'paystack_secret_key',
    'mpesa_consumer_key',
    'mpesa_consumer_secret',
    'mpesa_passkey',
    'contact_phone',
    'contact_email',
    'address',
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const db = getSupabaseAdmin();
  const { data: existingTenant, error: existingTenantError } = await db
    .from('tenants')
    .select('*')
    .eq('id', req.user.tenant_id)
    .single();

  if (existingTenantError) return res.status(500).json({ error: existingTenantError.message });

  Object.assign(updates, buildTenantPaymentUpdates(req.body, existingTenant));
  const { data, error } = await db
    .from('tenants')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', req.user.tenant_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  const profile = await loadTenantForClient(req.user.tenant_id);
  res.json(profile || data);
});

// ── Sessions ──────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  const db = getSupabaseAdmin();
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = db
    .from('sessions')
    .select('*, packages(name, duration_minutes, price)', { count: 'exact' })
    .eq('tenant_id', req.user.tenant_id)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const sessionsWithTracking = await attachGuestTracking(db, data || []);
  res.json({ sessions: sessionsWithTracking, total: count });
});

router.get('/sessions/search', async (req, res) => {
  try {
    const parsedLimit = Number(req.query.limit || 10);
    const sessions = await searchCreditableSessions({
      tenantId: req.user.tenant_id,
      query: req.query.query,
      limit: Number.isFinite(parsedLimit) ? Math.min(20, parsedLimit) : 10,
    });

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/session-credits/search', async (req, res) => {
  try {
    const parsedLimit = Number(req.query.limit || 10);
    const sessions = await searchCreditableSessions({
      tenantId: req.user.tenant_id,
      query: req.query.query,
      limit: Number.isFinite(parsedLimit) ? Math.min(20, parsedLimit) : 10,
    });

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sessions/:sessionId/credit', async (req, res) => {
  const { minutes, reason } = req.body;

  if (!Number.isFinite(Number(minutes)) || Number(minutes) <= 0) {
    return res.status(400).json({ error: 'minutes must be greater than 0' });
  }

  if (!String(reason || '').trim()) {
    return res.status(400).json({ error: 'reason is required' });
  }

  try {
    const result = await grantGuestSessionCredit({
      tenantId: req.user.tenant_id,
      sessionId: req.params.sessionId,
      minutes: Number(minutes),
      reason: String(reason).trim(),
      creditedBy: req.user.id,
    });

    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: err.publicMessage || err.message,
      creditLogId: err.creditLogId || null,
      retryable: Boolean(err.creditLogId),
      creditLog: err.creditLog || null,
    });
  }
});

router.get('/session-credits/history', async (req, res) => {
  try {
    const parsedLimit = Number(req.query.limit || 50);
    const history = await listSessionCreditHistory({
      tenantId: req.user.tenant_id,
      limit: Number.isFinite(parsedLimit) ? Math.min(100, parsedLimit) : 50,
    });

    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/session-credits/:creditLogId/retry', async (req, res) => {
  try {
    const result = await retrySessionCreditSync({
      tenantId: req.user.tenant_id,
      creditLogId: req.params.creditLogId,
    });

    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: err.publicMessage || err.message,
      creditLogId: err.creditLogId || null,
      retryable: Boolean(err.creditLogId),
      creditLog: err.creditLog || null,
    });
  }
});

// ── Transactions ──────────────────────────────────────────────
router.get('/transactions', async (req, res) => {
  const db = getSupabaseAdmin();
  const { page = 1, limit = 50, method } = req.query;
  const offset = (page - 1) * limit;

  let query = db
    .from('transactions')
    .select('*, packages(name)', { count: 'exact' })
    .eq('tenant_id', req.user.tenant_id)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (method) query = query.eq('payment_method', method);

  const { data, count } = await query;
  res.json({ transactions: data, total: count });
});

// ── Revenue analytics ─────────────────────────────────────────
router.get('/analytics', async (req, res) => {
  const db = getSupabaseAdmin();
  const { days = 30 } = req.query;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [txns, sessions] = await Promise.all([
    db.from('transactions').select('amount, created_at, payment_method').eq('tenant_id', req.user.tenant_id).eq('status', 'success').gte('created_at', from),
    db.from('sessions').select('created_at, package_id, packages(name)').eq('tenant_id', req.user.tenant_id).gte('created_at', from),
  ]);

  const timeline = {};
  for (const t of txns.data || []) {
    const day = t.created_at.split('T')[0];
    if (!timeline[day]) timeline[day] = { date: day, revenue: 0, sessions: 0 };
    timeline[day].revenue += t.amount;
  }

  const byPackage = {};
  for (const s of sessions.data || []) {
    const day = s.created_at.split('T')[0];
    if (!timeline[day]) timeline[day] = { date: day, revenue: 0, sessions: 0 };
    timeline[day].sessions += 1;
    const name = s.packages?.name || 'Unknown';
    byPackage[name] = (byPackage[name] || 0) + 1;
  }

  res.json({
    dailyRevenue: Object.values(timeline).map(({ date, revenue }) => ({ date, revenue })),
    timeline: Object.values(timeline).sort((a, b) => a.date.localeCompare(b.date)),
    byPackage: Object.entries(byPackage).map(([name, count]) => ({ name, count })),
    totalRevenue: (txns.data || []).reduce((s, t) => s + t.amount, 0),
    totalSessions: sessions.data?.length || 0,
    paymentSplit: (txns.data || []).reduce((acc, t) => {
      acc[t.payment_method] = (acc[t.payment_method] || 0) + t.amount;
      return acc;
    }, {}),
  });
});

// ── Customers ─────────────────────────────────────────────────
router.get('/customers', async (req, res) => {
  const db = getSupabaseAdmin();

  const { data } = await db
    .from('sessions')
    .select('phone, created_at, packages(name, price)')
    .eq('tenant_id', req.user.tenant_id)
    .order('created_at', { ascending: false });

  // Aggregate by phone
  const customers = {};
  for (const s of data || []) {
    if (!s.phone) continue;
    if (!customers[s.phone]) {
      customers[s.phone] = { phone: s.phone, sessions: 0, totalSpent: 0, lastSeen: s.created_at };
    }
    customers[s.phone].sessions++;
    customers[s.phone].totalSpent += s.packages?.price || 0;
    if (s.created_at > customers[s.phone].lastSeen) customers[s.phone].lastSeen = s.created_at;
  }

  res.json(Object.values(customers).sort((a, b) => b.totalSpent - a.totalSpent));
});

module.exports = router;
