const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../lib/supabase');
const { authenticate, requireRole, blockDemoMutations } = require('../middleware/auth');
const { testRouterConnection, getActiveSessions, createProfile } = require('../services/mikrotik.service');
const { getRouterLimitLabel } = require('../lib/workspacePlans');
const { loadWorkspacePlans } = require('../services/subscription.service');
const { sendRouterLiveEmail, sendRouterOfflineEmail, sendRouterOfflineSMS } = require('../services/notification.service');
const { logger } = require('../lib/logger');

async function getTenantPlanContext(db, tenantId) {
  if (!tenantId) return null;

  const { data: tenant, error: tenantError } = await db
    .from('tenants')
    .select('workspace_plan_id, workspace_plan_name')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError) throw tenantError;
  if (!tenant) return null;

  const plans = await loadWorkspacePlans({ includeInactive: true });
  const plan =
    plans.find((entry) => entry.id === tenant.workspace_plan_id) ||
    plans.find((entry) => entry.name === tenant.workspace_plan_name) ||
    null;

  return plan ? { plan, routerLimit: plan.router_limit } : null;
}

router.use(authenticate, requireRole('tenant_admin', 'super_admin'), blockDemoMutations);

router.get('/', async (req, res) => {
  const db = getSupabaseAdmin();
  const tid = req.user.tenant_id;
  const { data } = await db.from('routers').select('id, name, ip_address, port, dns_name, location, status, last_seen, created_at').eq('tenant_id', tid).order('created_at');
  res.json(data);
});

router.post('/', async (req, res) => {
  const { name, ip_address, port, api_username, api_password, location, dns_name } = req.body;
  if (!name || !ip_address || !api_username || !api_password) {
    return res.status(400).json({ error: 'name, ip_address, api_username, api_password required' });
  }

  const db = getSupabaseAdmin();

  if (req.user.role !== 'super_admin') {
    const planContext = await getTenantPlanContext(db, req.user.tenant_id);
    if (planContext && Number.isFinite(planContext.routerLimit)) {
      const { count, error: countError } = await db
        .from('routers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', req.user.tenant_id);

      if (countError) return res.status(500).json({ error: countError.message });

      if ((count || 0) >= planContext.routerLimit) {
        return res.status(403).json({
          error: `${planContext.plan.name} allows ${getRouterLimitLabel(planContext.routerLimit).toLowerCase()}. Upgrade your workspace plan to add another router.`,
          code: 'ROUTER_LIMIT_REACHED',
          limit: planContext.routerLimit,
          plan_name: planContext.plan.name,
        });
      }
    }
  }

  // Test connection first
  const test = await testRouterConnection(ip_address, port || 8728, api_username, api_password);
  if (!test.success) {
    return res.status(400).json({ error: `Cannot connect to router: ${test.error}` });
  }

  const { data, error } = await db.from('routers').insert({
    tenant_id: req.user.tenant_id,
    name, ip_address, port: port || 8728,
    api_username, api_password,
    location, dns_name, status: 'online',
    last_seen: new Date().toISOString(),
    identity: test.identity,
  }).select('id, name, ip_address, port, dns_name, location, status, last_seen').single();

  if (error) return res.status(500).json({ error: error.message });

  // Check if this is the tenant's first ever online router; if so send celebration email
  try {
    const { count: totalOnline } = await db
      .from('routers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', req.user.tenant_id)
      .eq('status', 'online');

    if ((totalOnline || 0) === 1) {
      const { data: tenant } = await db
        .from('tenants')
        .select('name, contact_email')
        .eq('id', req.user.tenant_id)
        .maybeSingle();
      if (tenant) {
        sendRouterLiveEmail(tenant, data).catch((err) =>
          logger.error('Router live email failed: ' + err.message)
        );
      }
    }
  } catch (_) {}

  res.status(201).json(data);
});

router.post('/:id/test', async (req, res) => {
  const db = getSupabaseAdmin();
  const { data: routerRow } = await db.from('routers').select('*').eq('id', req.params.id).eq('tenant_id', req.user.tenant_id).single();
  if (!routerRow) return res.status(404).json({ error: 'Router not found' });

  const previousStatus = routerRow.status;
  const result = await testRouterConnection(routerRow.ip_address, routerRow.port, routerRow.api_username, routerRow.api_password);
  if (result.success) {
    await db.from('routers').update({ status: 'online', last_seen: new Date().toISOString() }).eq('id', routerRow.id);
  } else {
    await db.from('routers').update({ status: 'offline' }).eq('id', routerRow.id);
    // Only alert if router was previously online (new offline event)
    if (previousStatus === 'online') {
      try {
        const { data: tenant } = await db
          .from('tenants')
          .select('name, contact_email, contact_phone')
          .eq('id', req.user.tenant_id)
          .maybeSingle();
        if (tenant) {
          sendRouterOfflineEmail(tenant, routerRow).catch((err) =>
            logger.error('Router offline email failed: ' + err.message)
          );
          sendRouterOfflineSMS(tenant.contact_phone, routerRow.name).catch((err) =>
            logger.error('Router offline SMS failed: ' + err.message)
          );
        }
      } catch (_) {}
    }
  }
  res.json(result);
});

router.get('/:id/sessions', async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data: router } = await db.from('routers').select('*').eq('id', req.params.id).eq('tenant_id', req.user.tenant_id).single();
    if (!router) return res.status(404).json({ error: 'Router not found' });

    const sessions = await getActiveSessions(req.params.id);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const db = getSupabaseAdmin();
  const { name, ip_address, port, api_username, api_password, location, dns_name } = req.body;

  const updateData = {
    name, ip_address, port: port ? Number(port) : undefined,
    api_username, api_password, location, dns_name,
    last_seen: new Date().toISOString()
  };

  // Remove undefined fields
  Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

  const { data, error } = await db
    .from('routers')
    .update(updateData)
    .eq('id', req.params.id)
    .eq('tenant_id', req.user.tenant_id)
    .select('id, name, ip_address, port, dns_name, location, status, last_seen')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const db = getSupabaseAdmin();
  await db.from('routers').delete().eq('id', req.params.id).eq('tenant_id', req.user.tenant_id);
  res.json({ message: 'Router removed' });
});

module.exports = router;
