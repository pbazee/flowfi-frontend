// ─── packages.js ─────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../lib/supabase');
const { authenticate, requireRole, blockDemoMutations } = require('../middleware/auth');

// Public: get packages for a tenant (for captive portal)
router.get('/public/:tenantId', async (req, res) => {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('packages')
    .select('id, name, price, duration_minutes, data_limit_mb, description, speed_limit, points_reward')
    .eq('tenant_id', req.params.tenantId)
    .eq('status', 'active')
    .order('price', { ascending: true });
  res.json(data || []);
});

// Authenticated: manage packages
router.use(authenticate, requireRole('tenant_admin', 'super_admin'), blockDemoMutations);

router.get('/', async (req, res) => {
  const db = getSupabaseAdmin();
  const tid = req.user.tenant_id;
  const { data } = await db.from('packages').select('*').eq('tenant_id', tid).order('price');
  res.json(data);
});

router.post('/', async (req, res) => {
  const db = getSupabaseAdmin();
  const { name, price, duration_minutes, data_limit_mb, description, speed_limit, mikrotik_profile, points_reward, happy_hour_start, happy_hour_end, happy_hour_discount } = req.body;

  if (!name || !price || !duration_minutes) {
    return res.status(400).json({ error: 'name, price, duration_minutes required' });
  }

  const { data, error } = await db.from('packages').insert({
    tenant_id: req.user.tenant_id,
    name, price, duration_minutes, data_limit_mb, description,
    speed_limit, mikrotik_profile: mikrotik_profile || 'default',
    points_reward: points_reward || 0,
    happy_hour_start, happy_hour_end,
    happy_hour_discount: happy_hour_discount || 0,
    status: 'active',
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/:id', async (req, res) => {
  const db = getSupabaseAdmin();
  const allowed = ['name', 'price', 'duration_minutes', 'data_limit_mb', 'description', 'speed_limit', 'mikrotik_profile', 'points_reward', 'status', 'happy_hour_start', 'happy_hour_end', 'happy_hour_discount'];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

  const { data, error } = await db.from('packages').update(updates).eq('id', req.params.id).eq('tenant_id', req.user.tenant_id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const db = getSupabaseAdmin();
  await db.from('packages').update({ status: 'inactive' }).eq('id', req.params.id).eq('tenant_id', req.user.tenant_id);
  res.json({ message: 'Package deactivated' });
});

module.exports = router;
