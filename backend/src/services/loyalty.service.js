const { getSupabaseAdmin } = require('../lib/supabase');
const { logger } = require('../lib/logger');

async function awardLoyaltyPoints(tenantId, phone, amount, transactionId) {
  if (!phone) return;

  try {
    const db = getSupabaseAdmin();

    const { data: tenant } = await db
      .from('tenants')
      .select('loyalty_points_per_kes, loyalty_enabled')
      .eq('id', tenantId)
      .single();

    if (!tenant?.loyalty_enabled) return;

    const pointsPerKes = tenant.loyalty_points_per_kes || 1;
    const points = Math.floor(amount * pointsPerKes);
    if (points <= 0) return;

    const { data: existing } = await db
      .from('loyalty_accounts')
      .select('id, total_points, lifetime_points')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .single();

    if (existing) {
      await db
        .from('loyalty_accounts')
        .update({
          total_points: existing.total_points + points,
          lifetime_points: existing.lifetime_points + points,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await db.from('loyalty_accounts').insert({
        tenant_id: tenantId,
        phone,
        total_points: points,
        lifetime_points: points,
      });
    }

    await db.from('loyalty_transactions').insert({
      tenant_id: tenantId,
      phone,
      points,
      type: 'earned',
      transaction_id: transactionId,
      note: `Earned ${points} pts on KES ${amount} purchase`,
    });

    logger.info(`Awarded ${points} loyalty points to ${phone} for tenant ${tenantId}`);
  } catch (err) {
    logger.error('awardLoyaltyPoints error:', err.message);
  }
}

async function redeemLoyaltyPoints(tenantId, phone, rewardId) {
  const db = getSupabaseAdmin();

  const { data: account } = await db
    .from('loyalty_accounts')
    .select('id, total_points')
    .eq('tenant_id', tenantId)
    .eq('phone', phone)
    .single();

  if (!account) throw new Error('No loyalty account found');

  const { data: reward } = await db
    .from('loyalty_rewards')
    .select('*')
    .eq('id', rewardId)
    .eq('tenant_id', tenantId)
    .single();

  if (!reward) throw new Error('Reward not found');
  if (reward.points_required > account.total_points) throw new Error('Not enough points for this reward');
  if (!reward.is_active) throw new Error('Reward no longer available');

  await db
    .from('loyalty_accounts')
    .update({ total_points: account.total_points - reward.points_required })
    .eq('id', account.id);

  await db.from('loyalty_transactions').insert({
    tenant_id: tenantId,
    phone,
    points: -reward.points_required,
    type: 'redeemed',
    note: `Redeemed: ${reward.name}`,
  });

  return reward;
}

module.exports = {
  awardLoyaltyPoints,
  redeemLoyaltyPoints,
};
