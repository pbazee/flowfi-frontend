// customer.js
const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../lib/supabase');

// Public: customer self-service portal
router.get('/session', async (req, res) => {
  const { phone, tenant_id } = req.query;
  if (!phone || !tenant_id) return res.status(400).json({ error: 'phone and tenant_id required' });

  const db = getSupabaseAdmin();
  const { data } = await db
    .from('sessions')
    .select('status, expires_at, created_at, packages(name, duration_minutes, price)')
    .eq('phone', phone)
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: loyalty } = await db
    .from('loyalty_accounts')
    .select('total_points, lifetime_points')
    .eq('phone', phone)
    .eq('tenant_id', tenant_id)
    .single();

  res.json({ sessions: data || [], loyalty: loyalty || { total_points: 0, lifetime_points: 0 } });
});

module.exports = router;
