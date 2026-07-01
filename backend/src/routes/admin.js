const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { logger } = require('../lib/logger');
const {
  serializeContactMessage,
  serializeReview,
  syncProductReviewStats,
} = require('../services/feedback.service');
const {
  grantGraceDays,
  loadWorkspacePlanById,
  loadWorkspacePlans,
  reactivateTenantSubscription,
  replacePlans,
} = require('../services/subscription.service');
const {
  loadShippingZones,
  replaceShippingZones,
} = require('../services/shipping.service');
const { isRelationMissingError } = require('../lib/db-compat');
const {
  loadRevenueSnapshot,
  loadTodayRevenueSnapshot,
} = require('../services/platform-revenue.service');
const { buildTenantPaymentSetup, SECRET_MASK } = require('../services/tenant-payment.service');
const {
  sendSms,
  sendTenantCommunicationEmail,
  sendAccountSuspendedEmail,
  sendAccountSuspendedSMS,
  sendAccountReactivatedEmail,
} = require('../services/notification.service');

// All admin routes require super_admin role
router.use(authenticate, requireRole('super_admin'));

// ── GET /api/admin/dashboard ──────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const [tenants, sessions, todayRevenue, rollingRevenue] = await Promise.all([
      db.from('tenants').select('id, status'),
      db.from('sessions').select('id, status').eq('status', 'active'),
      loadTodayRevenueSnapshot(),
      loadRevenueSnapshot({ days: 30 }),
    ]);

    res.json({
      tenants: {
        total: tenants.data?.length || 0,
        active: tenants.data?.filter((t) => t.status === 'active').length || 0,
        pending: tenants.data?.filter((t) => t.status === 'pending').length || 0,
      },
      activeSessions: sessions.data?.length || 0,
      todayRevenue: todayRevenue.totalRevenue,
      todayBreakdown: todayRevenue.breakdown,
      revenue30d: rollingRevenue.totalRevenue,
      revenue30dBreakdown: rollingRevenue.breakdown,
      revenueTrend: rollingRevenue.timeline,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/badges ─────────────────────────────────────
router.get('/badges', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const sinceTenants = req.query.since_tenants;
    const cutoff = sinceTenants || new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const [messagesResult, ordersResult, tenantsResult] = await Promise.all([
      db.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      db.from('shop_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('tenants').select('id', { count: 'exact', head: true }).gt('created_at', cutoff),
    ]);

    res.json({
      new_messages: messagesResult.count || 0,
      pending_orders: ordersResult.count || 0,
      new_tenants: tenantsResult.count || 0,
    });
  } catch (err) {
    logger.error('GET /admin/badges error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/legal ──────────────────────────────────────
router.get('/legal', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('legal_pages').select('*').order('slug');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    logger.error('GET /admin/legal error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/legal/:slug ────────────────────────────────
router.put('/legal/:slug', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { slug } = req.params;
    const { title, content } = req.body;
    const { data, error } = await db
      .from('legal_pages')
      .upsert({ slug, title, content, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
      .select()
      .maybeSingle();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('PUT /admin/legal error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/faqs ───────────────────────────────────────
router.get('/faqs', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('faqs').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    logger.error('GET /admin/faqs error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/faqs ──────────────────────────────────────
router.post('/faqs', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { question, answer, display_order, is_active } = req.body;
    const { data, error } = await db
      .from('faqs')
      .insert({ question, answer, display_order, is_active })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('POST /admin/faqs error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/faqs/:id ───────────────────────────────────
router.put('/faqs/:id', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { id } = req.params;
    const { question, answer, display_order, is_active } = req.body;
    const { data, error } = await db
      .from('faqs')
      .update({ question, answer, display_order, is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('PUT /admin/faqs error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/faqs/:id ────────────────────────────────
router.delete('/faqs/:id', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { id } = req.params;
    const { error } = await db.from('faqs').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error('DELETE /admin/faqs error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data, error, count } = await db
      .from('users')
      .select('id, name, email, phone, role, status, created_at, updated_at, tenant_id, tenants(name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ users: data || [], total: count || 0 });
  } catch (err) {
    logger.error('GET /admin/users error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});


function getEffectiveTenantStatus(tenant) {
  return tenant?.tenant_subscriptions?.[0]?.status || tenant?.status || 'active';
}

function normalizeTenantRecord(tenant) {
  const paymentSetup = buildTenantPaymentSetup(tenant);
  return {
    ...tenant,
    paystack_secret_key: tenant?.paystack_secret_key ? SECRET_MASK : '',
    mpesa_consumer_key: tenant?.mpesa_consumer_key ? SECRET_MASK : '',
    mpesa_consumer_secret: tenant?.mpesa_consumer_secret ? SECRET_MASK : '',
    mpesa_passkey: tenant?.mpesa_passkey ? SECRET_MASK : '',
    tenant_subscriptions: tenant.tenant_subscriptions || [],
    payment_setup: paymentSetup,
    effective_status: getEffectiveTenantStatus(tenant),
  };
}

function isWithinDateRange(value, from, to) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;

  if (from) {
    const fromTime = new Date(from).getTime();
    if (!Number.isNaN(fromTime) && time < fromTime) return false;
  }

  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      if (time > end.getTime()) return false;
    }
  }

  return true;
}

function applyTenantFilters(records = [], filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();
  const plan = String(filters.plan || '').trim().toLowerCase();
  const status = String(filters.status || '').trim().toLowerCase();
  const trialEndingWithin = Number(filters.trial_ending_within || 0);
  const hasPaymentSetup = String(filters.has_payment_setup || '').trim().toLowerCase();
  const registeredFrom = filters.registered_from || '';
  const registeredTo = filters.registered_to || '';
  const targetId = filters.id || '';
  const now = Date.now();
  const upcomingTrialLimit = trialEndingWithin > 0 ? now + trialEndingWithin * 24 * 60 * 60 * 1000 : null;

  return records.filter((tenant) => {
    if (targetId && tenant.id !== targetId) return false;

    const owner = tenant.users?.[0];
    const subscription = tenant.tenant_subscriptions?.[0];
    const searchable = [
      tenant.name,
      tenant.business_type,
      tenant.contact_email,
      tenant.contact_phone,
      owner?.name,
      owner?.email,
      subscription?.plan_name,
      subscription?.plan_id,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (search && !searchable.includes(search)) return false;
    if (status && getEffectiveTenantStatus(tenant).toLowerCase() !== status) return false;

    if (plan) {
      const planLabel = String(
        subscription?.plan_id ||
          subscription?.plan_name ||
          tenant.workspace_plan_id ||
          tenant.workspace_plan_name ||
          ''
      ).toLowerCase();
      if (!planLabel.includes(plan)) return false;
    }

    if (trialEndingWithin > 0) {
      const trialEndsAt = new Date(subscription?.trial_ends_at || 0).getTime();
      if (
        subscription?.status !== 'trialing' ||
        Number.isNaN(trialEndsAt) ||
        trialEndsAt < now ||
        trialEndsAt > upcomingTrialLimit
      ) {
        return false;
      }
    }

    if (hasPaymentSetup === 'yes' && !tenant.payment_setup?.portal_accepting_payments) return false;
    if (hasPaymentSetup === 'no' && tenant.payment_setup?.portal_accepting_payments) return false;

    if ((registeredFrom || registeredTo) && !isWithinDateRange(tenant.created_at, registeredFrom, registeredTo)) {
      return false;
    }

    return true;
  });
}

async function attachTenantSubscriptions(db, tenants = []) {
  const tenantIds = tenants.map((tenant) => tenant.id).filter(Boolean);
  if (tenantIds.length === 0) {
    return tenants.map((tenant) => ({ ...tenant, tenant_subscriptions: [] }));
  }

  try {
    const subscriptionResult = await db
      .from('tenant_subscriptions')
      .select('*')
      .in('tenant_id', tenantIds)
      .order('created_at', { ascending: false });

    if (subscriptionResult.error) throw subscriptionResult.error;

    const byTenantId = new Map();
    for (const subscription of subscriptionResult.data || []) {
      const current = byTenantId.get(subscription.tenant_id) || [];
      current.push(subscription);
      byTenantId.set(subscription.tenant_id, current);
    }

    return tenants.map((tenant) => ({
      ...tenant,
      tenant_subscriptions: byTenantId.get(tenant.id) || [],
    }));
  } catch (subscriptionError) {
    if (!isRelationMissingError(subscriptionError, 'tenant_subscriptions')) {
      throw subscriptionError;
    }

    return tenants.map((tenant) => ({
      ...tenant,
      tenant_subscriptions: [],
    }));
  }
}

async function listTenantsForAdmin(db, filters = {}) {
  let { data, error } = await db
    .from('tenants')
    .select('*, users(id, name, email, phone, created_at)')
    .order('created_at', { ascending: false });

  if (error) {
    // Fallback if users relation is missing or ambiguous in production
    const fallback = await db.from('tenants').select('*').order('created_at', { ascending: false });
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  }

  const withSubscriptions = await attachTenantSubscriptions(db, data || []);
  const normalized = withSubscriptions.map(normalizeTenantRecord);
  return applyTenantFilters(normalized, filters);
}

function isChannelConfigured(channel) {
  if (channel === 'sms') {
    return Boolean(process.env.AT_API_KEY && process.env.AT_USERNAME);
  }

  return Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_USER);
}

// ── GET /api/admin/tenants ────────────────────────────────────
router.get('/tenants', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const parsedPage = Math.max(1, Number(req.query.page || 1));
    const parsedLimit = Math.min(200, Math.max(1, Number(req.query.limit || 20)));
    const filtered = await listTenantsForAdmin(db, req.query);
    const offset = (parsedPage - 1) * parsedLimit;

    res.json({
      tenants: filtered.slice(offset, offset + parsedLimit),
      total: filtered.length,
      page: parsedPage,
      limit: parsedLimit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tenants/:id', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    let { data: tenantRecord, error } = await db
      .from('tenants')
      .select('*, users(id, name, email, phone, created_at)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) {
      const fallback = await db.from('tenants').select('*').eq('id', req.params.id).maybeSingle();
      if (fallback.error) throw fallback.error;
      tenantRecord = fallback.data;
    }
    if (!tenantRecord) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const [tenant] = await attachTenantSubscriptions(db, [tenantRecord]);
    const normalizedTenant = normalizeTenantRecord(tenant);

    const [
      routersResult,
      packagesResult,
      revenueResult,
      recentTransactionsResult,
      graceResult,
      activeSessionsResult,
    ] = await Promise.all([
      db.from('routers').select('id, name, status, last_seen, location').eq('tenant_id', req.params.id),
      db.from('packages').select('id, name, status, price, duration_minutes').eq('tenant_id', req.params.id),
      db.from('transactions').select('amount').eq('tenant_id', req.params.id).eq('status', 'success'),
      db
        .from('transactions')
        .select('id, reference, amount, payment_method, status, phone, customer_email, paid_at, created_at')
        .eq('tenant_id', req.params.id)
        .order('created_at', { ascending: false })
        .limit(10),
      db
        .from('grace_grants')
        .select('*')
        .eq('tenant_id', req.params.id)
        .order('granted_at', { ascending: false })
        .limit(20),
      db
        .from('sessions')
        .select('id, username, phone, mac_address, ip_address, expires_at, created_at, packages(name)')
        .eq('tenant_id', req.params.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const totalRevenue = (revenueResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);

    res.json({
      tenant: normalizedTenant,
      stats: {
        routers_total: routersResult.data?.length || 0,
        routers_online: routersResult.data?.filter((router) => router.status === 'online').length || 0,
        packages_total: packagesResult.data?.length || 0,
        total_revenue: totalRevenue,
        active_sessions: activeSessionsResult.data?.length || 0,
      },
      routers: routersResult.data || [],
      packages: packagesResult.data || [],
      recent_transactions: recentTransactionsResult.data || [],
      grace_grants: graceResult.data || [],
      active_sessions: activeSessionsResult.data || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tenants/:id/grace-grants', async (req, res) => {
  const { days_granted, reason } = req.body;

  if (!Number.isFinite(Number(days_granted)) || Number(days_granted) <= 0) {
    return res.status(400).json({ error: 'days_granted must be greater than 0' });
  }

  if (!String(reason || '').trim()) {
    return res.status(400).json({ error: 'reason is required' });
  }

  try {
    const result = await grantGraceDays({
      tenantId: req.params.id,
      daysGranted: Number(days_granted),
      reason: String(reason).trim(),
      grantedBy: req.user.id,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/admin/tenants/:id/status ──────────────────────
router.patch('/tenants/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const db = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    if (status === 'active') {
      try {
        await reactivateTenantSubscription({
          tenantId: req.params.id,
          referenceDate: nowIso,
        });
      } catch (reactivationError) {
        if (!String(reactivationError.message || '').includes('Tenant subscription not found')) {
          throw reactivationError;
        }
      }
    } else if (status === 'suspended') {
      try {
        await db
          .from('tenant_subscriptions')
          .update({ status: 'suspended', updated_at: nowIso })
          .eq('tenant_id', req.params.id);
      } catch (subscriptionError) {
        if (!isRelationMissingError(subscriptionError, 'tenant_subscriptions')) {
          throw subscriptionError;
        }
      }
    }

    const { data, error } = await db
      .from('tenants')
      .update({ status, updated_at: nowIso })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Admin updated tenant ${req.params.id} status to ${status}`);

    // Fire status-change notifications (non-blocking)
    if (status === 'suspended') {
      sendAccountSuspendedEmail(data).catch((err) =>
        logger.error('Account suspended email failed: ' + err.message)
      );
      sendAccountSuspendedSMS(data?.contact_phone).catch((err) =>
        logger.error('Account suspended SMS failed: ' + err.message)
      );
    } else if (status === 'active') {
      sendAccountReactivatedEmail(data).catch((err) =>
        logger.error('Account reactivated email failed: ' + err.message)
      );
    }

    res.json(normalizeTenantRecord(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/tenants/:id/plan', async (req, res) => {
  const { plan_id } = req.body;
  if (!plan_id) {
    return res.status(400).json({ error: 'plan_id is required' });
  }

  try {
    const db = getSupabaseAdmin();
    const plan = await loadWorkspacePlanById(plan_id);
    if (!plan) {
      return res.status(404).json({ error: 'Workspace plan not found' });
    }

    const updatePayload = {
      workspace_plan_id: plan.id,
      workspace_plan_name: plan.name,
      workspace_billing_period: plan.period,
      updated_at: new Date().toISOString(),
    };

    await db.from('tenants').update(updatePayload).eq('id', req.params.id);

    try {
      await db
        .from('tenant_subscriptions')
        .update({
          plan_id: plan.id,
          plan_name: plan.name,
          billing_period: plan.period,
          amount: Number(plan.price || 0),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', req.params.id);
    } catch (subscriptionError) {
      if (!isRelationMissingError(subscriptionError, 'tenant_subscriptions')) {
        throw subscriptionError;
      }
    }

    res.json({ ok: true, plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tenants/:id/message', async (req, res) => {
  const { subject, message, channel } = req.body;
  if (!subject || !message || !['email', 'sms'].includes(channel)) {
    return res.status(400).json({ error: 'subject, message, and channel are required' });
  }

  if (!isChannelConfigured(channel)) {
    return res.status(503).json({ error: `${channel.toUpperCase()} delivery is not configured on this environment` });
  }

  try {
    const db = getSupabaseAdmin();
    const { data: tenant, error } = await db
      .from('tenants')
      .select('id, name, contact_email, contact_phone')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (channel === 'email') {
      if (!tenant.contact_email) {
        return res.status(400).json({ error: 'Tenant does not have an email address on file' });
      }

      const result = await sendTenantCommunicationEmail({
        to: tenant.contact_email,
        subject,
        message,
        recipientName: tenant.name,
      });
      if (!result?.ok) {
        throw new Error(result?.error?.message || 'Email delivery failed');
      }
    } else {
      if (!tenant.contact_phone) {
        return res.status(400).json({ error: 'Tenant does not have a phone number on file' });
      }

      const result = await sendSms(tenant.contact_phone, `FlowFi: ${message}`);
      if (!result?.ok) {
        throw new Error(result?.error?.message || 'SMS delivery failed');
      }
    }

    await db.from('tenant_communications').insert({
      sent_by: req.user.id,
      subject,
      message,
      channel,
      recipient_count: 1,
      filter_criteria: { tenant_id: req.params.id },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/communications', async (req, res) => {
  const { subject, message, channel, filters = {}, recipient_type } = req.body || {};
  if (!subject || !message || !['email', 'sms', 'both'].includes(channel)) {
    return res.status(400).json({ error: 'subject, message, and channel (email/sms/both) are required' });
  }

  const channelsToCheck = channel === 'both' ? ['email', 'sms'] : [channel];
  for (const ch of channelsToCheck) {
    if (!isChannelConfigured(ch)) {
      return res.status(503).json({ error: `${ch.toUpperCase()} delivery is not configured on this environment` });
    }
  }

  try {
    const db = getSupabaseAdmin();
    let rawRecipients = [];

    if (recipient_type === 'users' && Array.isArray(filters.ids)) {
      const { data, error } = await db.from('users').select('id, name, email, phone').in('id', filters.ids);
      if (error) throw error;
      rawRecipients = data || [];
    } else {
      rawRecipients = await listTenantsForAdmin(db, filters);
    }

    const recipients = rawRecipients.filter((recipient) => {
      const email = recipient.email || recipient.contact_email;
      const phone = recipient.phone || recipient.contact_phone;
      return channel === 'both' ? (email || phone) :
             channel === 'email' ? Boolean(email) : Boolean(phone);
    });

    logger.info(`[Communications] Sending "${subject}" via ${channel} to ${recipients.length} recipients`);

    let successCount = 0;
    let failCount    = 0;

    for (const recipient of recipients) {
      const emailAddress = recipient.email || recipient.contact_email;
      const phone = recipient.phone || recipient.contact_phone;
      const name = recipient.name || 'User';

      if (channel === 'email' || channel === 'both') {
        if (emailAddress) {
          logger.info(`[Communications] Sending email to: ${emailAddress} (${name})`);
          try {
            const result = await sendTenantCommunicationEmail({
              to: emailAddress,
              subject,
              message,
              recipientName: name,
            });
            if (result?.ok) {
              successCount++;
              logger.info(`[Communications] Email OK → ${emailAddress}`);
            } else {
              failCount++;
              logger.error(`[Communications] Email FAILED → ${emailAddress}: ${JSON.stringify(result?.error)}`);
            }
          } catch (emailErr) {
            failCount++;
            logger.error(`[Communications] Email exception → ${emailAddress}: ${emailErr.message}`);
          }
        } else {
          logger.warn(`[Communications] Skipping email for ${name} — no email address`);
        }
      }

      if (channel === 'sms' || channel === 'both') {
        if (phone) {
          logger.info(`[Communications] Sending SMS to: ${phone} (${name})`);
          try {
            const result = await sendSms(phone, `FlowFi: ${message}`);
            if (result?.ok) {
              logger.info(`[Communications] SMS OK → ${phone}`);
            } else {
              logger.error(`[Communications] SMS FAILED → ${phone}: ${JSON.stringify(result?.error)}`);
            }
          } catch (smsErr) {
            logger.error(`[Communications] SMS exception → ${phone}: ${smsErr.message}`);
          }
        } else {
          logger.warn(`[Communications] Skipping SMS for ${name} — no phone number`);
        }
      }
    }

    logger.info(`[Communications] Done. ${successCount} sent, ${failCount} failed`);

    if (recipient_type !== 'users') {
      await db.from('tenant_communications').insert({
        sent_by: req.user.id,
        subject,
        message,
        channel,
        recipient_count: recipients.length,
        filter_criteria: filters,
      });
    }

    // Also log to communication_logs table
    try {
      await db.from('communication_logs').insert({
        sent_by: req.user.email || req.user.id,
        channel,
        recipient_type: recipient_type || JSON.stringify(filters) || 'custom',
        subject,
        message,
        recipient_count: recipients.length,
      });
    } catch (_) {}

    res.json({ ok: true, recipient_count: recipients.length });
  } catch (err) {
    logger.error('[Communications] Fatal error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/communication-logs ────────────────────────
router.get('/communication-logs', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('communication_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    logger.error('GET /admin/communication-logs error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// Commission management removed

// ── GET /api/admin/analytics ──────────────────────────────────
router.get('/analytics', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const snapshot = await loadRevenueSnapshot({ days: Number(days || 30) });

    res.json({
      dailyRevenue: snapshot.timeline.map(({ date, revenue }) => ({ date, revenue })),
      timeline: snapshot.timeline,
      byTenant: snapshot.byTenant,
      totalRevenue: snapshot.totalRevenue,
      sourceBreakdown: snapshot.breakdown,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── GET /api/admin/routers ────────────────────────────────────
router.get('/routers', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data } = await db
      .from('routers')
      .select('*, tenants(name)')
      .order('created_at', { ascending: false });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Platform settings ─────────────────────────────────────────
router.get('/messages', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { status } = req.query;

    let query = db
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query.limit(200);
    if (error) throw error;

    res.json((data || []).map(serializeContactMessage));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/messages/:id', async (req, res) => {
  const { status } = req.body;
  if (!['new', 'read', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('contact_messages')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(serializeContactMessage(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/review-submissions', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { status, scope } = req.query;

    let query = db
      .from('review_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (scope) query = query.eq('scope', scope);

    const { data, error } = await query.limit(200);
    if (error) throw error;

    res.json((data || []).map(serializeReview));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/review-submissions/:id', async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'published', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const db = getSupabaseAdmin();
    const updates = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'published') {
      updates.published_at = new Date().toISOString();
    }

    const { data, error } = await db
      .from('review_submissions')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    if (data.scope === 'product') {
      await syncProductReviewStats(data.target_id);
    }

    res.json(serializeReview(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/plans', async (req, res) => {
  try {
    const plans = await loadWorkspacePlans({ includeInactive: true });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/plans', async (req, res) => {
  try {
    const plans = Array.isArray(req.body?.plans) ? req.body.plans : req.body;
    const saved = await replacePlans(plans);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/shipping-zones', async (req, res) => {
  try {
    const zones = await loadShippingZones({ includeInactive: true });
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/shipping-zones', async (req, res) => {
  try {
    const zones = Array.isArray(req.body?.zones) ? req.body.zones : req.body;
    const saved = await replaceShippingZones(zones);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data } = await db.from('platform_settings').select('*');
    const settings = (data || []).reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await db
        .from('platform_settings')
        .upsert({ key, value: String(value) }, { onConflict: 'key' });
    }
    res.json({ message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/demo ──────────────────────────────────────
// Returns demo account info and last reset timestamp from demo_meta.
router.get('/demo', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data: meta } = await db
      .from('demo_meta')
      .select('id, last_reset_at, reset_by, is_enabled, views_count, banner_message')
      .limit(1)
      .maybeSingle();

    res.json({
      email: 'demo@flowfi.app',
      last_reset_at: meta?.last_reset_at || null,
      reset_by: meta?.reset_by || null,
      is_enabled: meta?.is_enabled ?? true,
      views_count: meta?.views_count || 0,
      banner_message: meta?.banner_message || "You're viewing the FlowFi demo—feel free to explore the platform.",
    });
  } catch (err) {
    logger.error('GET /admin/demo error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/demo/settings ─────────────────────────────
router.put('/demo/settings', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { is_enabled, banner_message } = req.body;

    const { data: meta } = await db.from('demo_meta').select('id').limit(1).maybeSingle();

    if (meta) {
      await db.from('demo_meta').update({
        is_enabled: is_enabled,
        banner_message: banner_message,
      }).eq('id', meta.id);
    } else {
      await db.from('demo_meta').insert({
        is_enabled: is_enabled,
        banner_message: banner_message,
        reset_by: req.user?.email || 'superadmin'
      });
    }
    res.json({ message: 'Demo settings updated' });
  } catch (err) {
    logger.error('PUT /admin/demo/settings error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/demo/reset ───────────────────────────────
// Wipes all demo tenant data and reseeds fresh records.
// Also rehashes the demo password so it always matches the backend users table.
router.post('/demo/reset', async (req, res) => {
  const DEMO_EMAIL = 'demo@flowfi.app';
  const DEMO_PASSWORD = 'flowfi_demo_2024';
  const DEMO_TENANT_NAME = 'FlowFi Demo ISP';

  try {
    const db = getSupabaseAdmin();
    const bcrypt = require('bcryptjs');

    // 1. Find or create the demo tenant
    let { data: tenant } = await db
      .from('tenants')
      .select('id')
      .eq('name', DEMO_TENANT_NAME)
      .maybeSingle();

    if (!tenant) {
      const { data: newTenant, error: tenantErr } = await db
        .from('tenants')
        .insert({
          name: DEMO_TENANT_NAME,
          business_type: 'isp',
          status: 'active',
          contact_email: DEMO_EMAIL,
          contact_phone: '+254700000000',
        })
        .select('id')
        .single();
      if (tenantErr) throw tenantErr;
      tenant = newTenant;
    }
    const tenantId = tenant.id;

    // 2. Upsert users table row (fixes backend login auth)
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const { data: existingUser } = await db
      .from('users')
      .select('id')
      .ilike('email', DEMO_EMAIL)
      .maybeSingle();

    if (existingUser) {
      await db
        .from('users')
        .update({ password_hash: passwordHash, status: 'active', tenant_id: tenantId })
        .eq('id', existingUser.id);
    } else {
      await db.from('users').insert({
        email: DEMO_EMAIL,
        password_hash: passwordHash,
        name: 'Demo User',
        role: 'tenant_admin',
        status: 'active',
        tenant_id: tenantId,
      });
    }

    // 3. Wipe existing demo data
    await db.from('demo_customers').delete().eq('tenant_id', tenantId);
    await db.from('transactions').delete().eq('tenant_id', tenantId);
    await db.from('packages').delete().eq('tenant_id', tenantId);
    await db.from('routers').delete().eq('tenant_id', tenantId);

    // 4. Seed packages
    const { data: pkgs, error: pkgErr } = await db
      .from('packages')
      .insert([
        { tenant_id: tenantId, name: 'Basic Hotspot', description: 'Entry-level hotspot access', price: 500, duration_minutes: 43200, speed_limit: '5M/5M', status: 'active', sort_order: 1 },
        { tenant_id: tenantId, name: 'Standard Home', description: 'Home broadband with reliable speeds', price: 1200, duration_minutes: 43200, speed_limit: '15M/15M', status: 'active', sort_order: 2 },
        { tenant_id: tenantId, name: 'Business PPPoE', description: 'High-speed business connection with SLA', price: 3500, duration_minutes: 43200, speed_limit: '50M/50M', status: 'active', sort_order: 3 },
        { tenant_id: tenantId, name: 'Premium Fiber', description: 'Ultra-fast fiber for power users', price: 6000, duration_minutes: 43200, speed_limit: '100M/100M', status: 'active', sort_order: 4 },
      ])
      .select('id, name, price');
    if (pkgErr) throw pkgErr;

    const [pkgBasic, pkgStandard, pkgBusiness, pkgPremium] = pkgs;

    // 5. Seed routers
    await db.from('routers').insert([
      { tenant_id: tenantId, name: 'Mikrotik RB750Gr3', ip_address: '192.168.1.1', port: 8728, api_username: 'admin', api_password: 'demo_password', location: 'Westlands', status: 'online', last_seen: new Date().toISOString() },
      { tenant_id: tenantId, name: 'Mikrotik hAP ac²', ip_address: '192.168.2.1', port: 8728, api_username: 'admin', api_password: 'demo_password', location: 'Kasarani', status: 'online', last_seen: new Date().toISOString() },
      { tenant_id: tenantId, name: 'Mikrotik CCR1009', ip_address: '192.168.3.1', port: 8728, api_username: 'admin', api_password: 'demo_password', location: 'Thika Road', status: 'offline', last_seen: new Date(Date.now() - 3 * 86400000).toISOString() },
    ]);

    // 6. Seed customers
    const customerDefs = [
      { name: 'Alice Wanjiru', phone: '+254711000001', email: 'alice@demo.com', pkg: pkgStandard, status: 'active', joinDaysAgo: 90 },
      { name: 'Brian Omondi', phone: '+254711000002', email: 'brian@demo.com', pkg: pkgBasic, status: 'active', joinDaysAgo: 75 },
      { name: 'Carol Njeri', phone: '+254711000003', email: 'carol@demo.com', pkg: pkgPremium, status: 'active', joinDaysAgo: 60 },
      { name: 'David Mwangi', phone: '+254711000004', email: 'david@demo.com', pkg: pkgBusiness, status: 'active', joinDaysAgo: 55 },
      { name: 'Esther Akinyi', phone: '+254711000005', email: 'esther@demo.com', pkg: pkgStandard, status: 'suspended', joinDaysAgo: 50 },
      { name: 'Felix Kamau', phone: '+254711000006', email: 'felix@demo.com', pkg: pkgBasic, status: 'active', joinDaysAgo: 45 },
      { name: 'Grace Otieno', phone: '+254711000007', email: 'grace@demo.com', pkg: pkgPremium, status: 'active', joinDaysAgo: 40 },
      { name: 'Hassan Mwenda', phone: '+254711000008', email: 'hassan@demo.com', pkg: pkgBusiness, status: 'expired', joinDaysAgo: 35 },
      { name: 'Irene Wambui', phone: '+254711000009', email: 'irene@demo.com', pkg: pkgStandard, status: 'active', joinDaysAgo: 20 },
      { name: 'James Kariuki', phone: '+254711000010', email: 'james@demo.com', pkg: pkgBasic, status: 'active', joinDaysAgo: 10 },
    ];

    const customerRows = customerDefs.map((c) => {
      const joinDate = new Date(Date.now() - c.joinDaysAgo * 86400000);
      const nextBilling = new Date(joinDate);
      nextBilling.setDate(nextBilling.getDate() + 30);
      return {
        tenant_id: tenantId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        package_id: c.pkg.id,
        status: c.status,
        join_date: joinDate.toISOString().split('T')[0],
        next_billing_date: nextBilling.toISOString().split('T')[0],
      };
    });

    const { data: insertedCustomers } = await db.from('demo_customers').insert(customerRows).select('id, phone, email');
    const customers = insertedCustomers ?? customerRows.map((c, i) => ({ ...c, id: `demo-${i}` }));

    // 7. Seed transactions
    const allPkgs = [pkgBasic, pkgStandard, pkgBusiness, pkgPremium];
    const methods = ['mpesa', 'mpesa', 'mpesa', 'bank', 'bank'];
    const statuses = ['success', 'success', 'success', 'pending', 'failed'];
    const paymentRows = [];
    for (let i = 0; i < 20; i++) {
      const customer = customers[i % customers.length];
      const pkg = allPkgs[i % allPkgs.length];
      const daysAgo = Math.floor(Math.random() * 90);
      const createdAt = new Date(Date.now() - daysAgo * 86400000);
      const method = methods[i % methods.length];
      const status = statuses[i % statuses.length];
      paymentRows.push({
        reference: `DEMO-${Date.now()}-${i}`,
        tenant_id: tenantId,
        package_id: pkg.id,
        phone: customer.phone ?? '+254711000000',
        customer_email: customer.email ?? DEMO_EMAIL,
        amount: pkg.price,
        payment_method: method,
        status,
        mpesa_receipt: method === 'mpesa' && status === 'success' ? `QKA${Math.random().toString(36).substring(2, 9).toUpperCase()}` : null,
        paid_at: status === 'success' ? createdAt.toISOString() : null,
        created_at: createdAt.toISOString(),
      });
    }
    await db.from('transactions').insert(paymentRows);

    // 8. Update demo_meta
    const now = new Date().toISOString();
    const resetBy = req.user?.email || 'superadmin';
    const { data: existingMeta } = await db.from('demo_meta').select('id').limit(1).maybeSingle();
    if (existingMeta) {
      await db.from('demo_meta').update({ last_reset_at: now, reset_by: resetBy }).eq('id', existingMeta.id);
    } else {
      await db.from('demo_meta').insert({ last_reset_at: now, reset_by: resetBy });
    }

    logger.info(`Demo data reset by ${resetBy}`);
    res.json({ message: 'Demo data reset successfully', last_reset_at: now, reset_by: resetBy });
  } catch (err) {
    logger.error('POST /admin/demo/reset error: ' + err.message);
    res.status(500).json({ error: err.message || 'Failed to reset demo data' });
  }
});

module.exports = router;

