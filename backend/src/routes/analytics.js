// analytics.js
const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');
const { loadRevenueSnapshot } = require('../services/platform-revenue.service');

router.use(authenticate);

router.get('/platform', requireRole('super_admin'), async (req, res) => {
  const db = getSupabaseAdmin();
  const { days = 30 } = req.query;
  const revenue = await loadRevenueSnapshot({ days: Number(days || 30) });

  const [newTenants, sessions, tenantTransactions] = await Promise.all([
    db.from('tenants').select('id, created_at, name').gte('created_at', revenue.from),
    db.from('sessions').select('id, created_at, tenant_id').gte('created_at', revenue.from),
    db.from('transactions').select('amount, created_at, paid_at').eq('status', 'success').not('tenant_id', 'is', null).gte('created_at', revenue.from),
  ]);

  const timeline = new Map(
    revenue.timeline.map((entry) => [
      entry.date,
      { ...entry, sessions: 0, tenantRevenue: 0 },
    ])
  );

  for (const s of sessions.data || []) {
    const day = s.created_at.split('T')[0];
    if (!timeline.has(day)) {
      timeline.set(day, {
        date: day,
        revenue: 0,
        subscriptions: 0,
        shop: 0,
        services: 0,
        sessions: 0,
        tenantRevenue: 0,
      });
    }
    timeline.get(day).sessions += 1;
  }

  let totalTenantRevenue = 0;
  for (const t of tenantTransactions.data || []) {
    const amount = Number(t.amount || 0);
    totalTenantRevenue += amount;
    const day = (t.paid_at || t.created_at).split('T')[0];
    if (!timeline.has(day)) {
      timeline.set(day, {
        date: day,
        revenue: 0,
        subscriptions: 0,
        shop: 0,
        services: 0,
        sessions: 0,
        tenantRevenue: 0,
      });
    }
    timeline.get(day).tenantRevenue += amount;
  }

  res.json({
    timeline: [...timeline.values()].sort((a, b) => a.date.localeCompare(b.date)),
    topTenants: revenue.byTenant.slice(0, 10),
    totalRevenue: revenue.totalRevenue,
    totalTenantRevenue,
    newTenants: newTenants.data?.length || 0,
    totalSessions: sessions.data?.length || 0,
    sourceBreakdown: revenue.breakdown,
  });
});

module.exports = router;
