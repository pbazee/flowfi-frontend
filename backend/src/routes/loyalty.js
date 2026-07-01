const express = require('express');
const router = express.Router();
const { getSupabaseAdmin } = require('../lib/supabase');
const { authenticate, requireRole, blockDemoMutations } = require('../middleware/auth');
const { redeemLoyaltyPoints } = require('../services/loyalty.service');

// Public: check points balance
router.get('/balance/:tenantId/:phone', async (req, res) => {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('loyalty_accounts')
    .select('total_points, lifetime_points')
    .eq('tenant_id', req.params.tenantId)
    .eq('phone', req.params.phone)
    .single();

  if (!data) return res.json({ total_points: 0, lifetime_points: 0 });
  res.json(data);
});

// Public: get rewards catalogue for a tenant
router.get('/rewards/:tenantId', async (req, res) => {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('loyalty_rewards')
    .select('*')
    .eq('tenant_id', req.params.tenantId)
    .eq('is_active', true)
    .order('points_required', { ascending: true });

  res.json(data || []);
});

// Public: redeem reward
router.post('/redeem', async (req, res) => {
  const { tenant_id, phone, reward_id } = req.body;
  if (!tenant_id || !phone || !reward_id) {
    return res.status(400).json({ error: 'tenant_id, phone, reward_id required' });
  }

  try {
    const reward = await redeemLoyaltyPoints(tenant_id, phone, reward_id);

    if (reward.reward_type === 'free_package' && reward.package_id) {
      const db = getSupabaseAdmin();
      const { data: pkg } = await db
        .from('packages')
        .select('*')
        .eq('id', reward.package_id)
        .single();

      if (pkg) {
        const expiresAt = new Date(Date.now() + pkg.duration_minutes * 60 * 1000).toISOString();

        await db.from('sessions').insert({
          tenant_id,
          package_id: reward.package_id,
          phone,
          username: `rw_${Date.now()}`,
          password: Math.random().toString(36).slice(2, 10),
          status: 'active',
          expires_at: expiresAt,
          note: `Loyalty reward: ${reward.name}`,
        });

        return res.json({
          message: `Reward redeemed! Enjoy ${pkg.name}`,
          reward,
          expires_at: expiresAt,
        });
      }
    }

    res.json({ message: 'Reward redeemed!', reward });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Tenant: manage loyalty settings
router.use(authenticate, requireRole('tenant_admin', 'super_admin'), blockDemoMutations);

router.get('/settings', async (req, res) => {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('tenants')
    .select('loyalty_enabled, loyalty_points_per_kes')
    .eq('id', req.user.tenant_id)
    .single();

  res.json(data);
});

router.put('/settings', async (req, res) => {
  const { loyalty_enabled, loyalty_points_per_kes } = req.body;
  const db = getSupabaseAdmin();

  await db
    .from('tenants')
    .update({ loyalty_enabled, loyalty_points_per_kes })
    .eq('id', req.user.tenant_id);

  res.json({ message: 'Loyalty settings updated' });
});

// Tenant: manage rewards catalogue
router.get('/rewards', async (req, res) => {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('loyalty_rewards')
    .select('*, packages(name)')
    .eq('tenant_id', req.user.tenant_id)
    .order('points_required');

  res.json(data);
});

router.post('/rewards', async (req, res) => {
  const { name, description, points_required, reward_type, package_id, discount_percent } = req.body;
  if (!name || !points_required || !reward_type) {
    return res.status(400).json({ error: 'name, points_required, reward_type required' });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('loyalty_rewards')
    .insert({
      tenant_id: req.user.tenant_id,
      name,
      description,
      points_required,
      reward_type,
      package_id,
      discount_percent,
      is_active: true,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/rewards/:id', async (req, res) => {
  const db = getSupabaseAdmin();
  const allowed = ['name', 'description', 'points_required', 'reward_type', 'package_id', 'discount_percent', 'is_active'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const { data } = await db
    .from('loyalty_rewards')
    .update(updates)
    .eq('id', req.params.id)
    .eq('tenant_id', req.user.tenant_id)
    .select()
    .single();

  res.json(data);
});

router.delete('/rewards/:id', async (req, res) => {
  const db = getSupabaseAdmin();

  await db
    .from('loyalty_rewards')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .eq('tenant_id', req.user.tenant_id);

  res.json({ message: 'Reward deactivated' });
});

// Tenant: view loyalty leaderboard
router.get('/leaderboard', async (req, res) => {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('loyalty_accounts')
    .select('phone, total_points, lifetime_points')
    .eq('tenant_id', req.user.tenant_id)
    .order('lifetime_points', { ascending: false })
    .limit(50);

  res.json(data);
});

module.exports = router;
