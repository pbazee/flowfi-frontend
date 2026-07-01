const express = require('express');
const shortUUID = require('short-uuid');
const { getSupabaseAdmin } = require('../lib/supabase');
const { authenticate, requireRole, blockDemoMutations } = require('../middleware/auth');
const { logger } = require('../lib/logger');
const { loadTenantSubscription, loadWorkspacePlans, loadWorkspacePlanById } = require('../services/subscription.service');
const { loadTenantPaymentRecord, buildTenantPaymentContext } = require('../services/tenant-payment.service');
const { getPaymentAvailability, initiateStkPush, initializePaystack } = require('../services/payment.service');

const router = express.Router();
router.use(authenticate, requireRole('tenant_admin', 'super_admin'), blockDemoMutations);

function normalizePhone(phone) {
  if (!phone) return phone
  const trimmed = String(phone).replace(/\s+/g, '')
  if (trimmed.startsWith('0')) return `254${trimmed.slice(1)}`
  if (trimmed.startsWith('+')) return trimmed.slice(1)
  return trimmed
}

// Helper to calculate upgrade math
function calculateUpgradeMath(subscription, newPlan) {
  const currentAmount = Number(subscription?.amount || 0);
  const now = new Date();
  const endsAt = new Date(subscription?.current_period_ends_at || now.toISOString()); // Use now if no end date
  
  // Prevent negative days
  const millisecondsRemaining = Math.max(0, endsAt - now);
  const daysRemaining = Math.max(0, Math.ceil(millisecondsRemaining / (1000 * 60 * 60 * 24)));
  
  // Standardize 30 days for calculations to prevent long/short month inconsistencies
  const daysInPeriod = 30;
  const dailyRate = currentAmount / daysInPeriod;
  
  // The amount of unused money from the current plan
  const unusedCredit = Math.max(0, dailyRate * daysRemaining);
  
  const newAmount = Number(newPlan?.price || 0);
  let amountToPay = newAmount - unusedCredit;
  
  // Safely floor it to integers and prevent negative
  amountToPay = Math.max(0, Math.round(amountToPay));
  const roundedUnusedCredit = Math.ceil(unusedCredit);
  
  return {
    amountToPay,
    unusedCredit: roundedUnusedCredit,
    newAmount,
    daysRemaining,
    dailyRate: Math.round(dailyRate)
  };
}

// ── GET /api/tenant/billing/current ──────────────────────────────────────────────
router.get('/current', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const subscription = await loadTenantSubscription(tenantId);
    const plans = await loadWorkspacePlans({ includeInactive: false });
    
    res.json({
      subscription,
      availablePlans: plans
    });
  } catch (err) {
    logger.error(`Get billing error: ${err.message}`);
    res.status(500).json({ error: 'Could not load billing details' });
  }
});

// ── POST /api/tenant/billing/calculate-upgrade ──────────────────────────────
router.post('/calculate-upgrade', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { newPlanId } = req.body;
    
    if (!newPlanId) {
      return res.status(400).json({ error: 'newPlanId is required' });
    }
    
    const subscription = await loadTenantSubscription(tenantId);
    if (!subscription) {
      return res.status(404).json({ error: 'Active subscription not found' });
    }
    
    const newPlan = await loadWorkspacePlanById(newPlanId);
    if (!newPlan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const math = calculateUpgradeMath(subscription, newPlan);
    res.json(math);
    
  } catch (err) {
    logger.error(`Calculate upgrade error: ${err.message}`);
    res.status(500).json({ error: 'Calculation failed' });
  }
});

// ── POST /api/tenant/billing/upgrade-checkout ───────────────────────────────
router.post('/upgrade-checkout', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { newPlanId, paymentMethod } = req.body;
    const db = getSupabaseAdmin();
    
    if (!newPlanId || !paymentMethod) {
      return res.status(400).json({ error: 'newPlanId and paymentMethod are required' });
    }
    
    const paymentAvailability = getPaymentAvailability();
    if (!paymentAvailability[paymentMethod]) {
      return res.status(503).json({ error: `${paymentMethod} is not configured yet. Please contact support.` });
    }
    
    const subscription = await loadTenantSubscription(tenantId);
    const newPlan = await loadWorkspacePlanById(newPlanId);
    if (!subscription || !newPlan) {
      return res.status(404).json({ error: 'Subscription or Plan not found' });
    }
    
    // We fetch user details for paystack / mpesa payload
    const { data: tenant } = await db.from('tenants').select('name, contact_phone, contact_email').eq('id', tenantId).single();
    const { data: user } = await db.from('users').select('email, phone').eq('id', req.user.id).single();
    
    const math = calculateUpgradeMath(subscription, newPlan);
    const amount = math.amountToPay;
    
    // Create the order logic mimicking workspace-checkout, but injected for upgrading
    const reference = `UP-${shortUUID.generate().slice(0, 8).toUpperCase()}`;
    const { data: order, error: insertError } = await db
      .from('workspace_orders')
      .insert({
        reference,
        tenant_id: tenantId,
        user_id: req.user.id,
        plan_id: newPlan.id,
        plan_name: newPlan.name,
        billing_period: newPlan.period || 'monthly',
        amount,
        payment_method: paymentMethod,
        payment_status: 'pending',
        status: 'pending',
        signup_email: user?.email || tenant?.contact_email || 'admin@flowfi.io',
        signup_name: tenant?.name || 'Workspace Upgrade',
        signup_phone: user?.phone || tenant?.contact_phone || '',
        business_name: tenant?.name,
        payload: {
          is_upgrade: true,
          old_plan_id: subscription.plan_id,
          math_breakdown: math
        }
      })
      .select()
      .single();
      
    if (insertError) throw insertError;
    
    const phoneToUse = user?.phone || tenant?.contact_phone;
    const emailToUse = user?.email || tenant?.contact_email || 'admin@flowfi.io';
    
    if (paymentMethod === 'mpesa') {
      if (!phoneToUse) {
         return res.status(400).json({ error: 'A valid phone number is required on your profile for M-Pesa' });
      }
      
      const mpesaResponse = await initiateStkPush(
        normalizePhone(phoneToUse),
        amount,
        reference,
        `FlowFi Upgrade - ${newPlan.name}`
      );
      
      await db.from('workspace_orders')
        .update({
          payment_ref: mpesaResponse.CheckoutRequestID,
          gateway_data: mpesaResponse,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
        
      return res.status(201).json({
        reference,
        checkoutRequestId: mpesaResponse.CheckoutRequestID,
        amount,
        plan: newPlan,
        paymentMethod,
        message: 'Complete the M-Pesa prompt on your phone to activate your upgrade.'
      });
    }
    
    // Paystack
    const callbackUrl = `${process.env.FRONTEND_URL}/payment/callback?flow=workspace_upgrade`;
    const paystackResponse = await initializePaystack(
      emailToUse,
      amount,
      reference,
      {
        flow: 'workspace_upgrade',
        plan_id: newPlan.id,
        workspace_order_id: order.id,
        tenant_id: tenantId
      },
      callbackUrl
    );
    
    await db.from('workspace_orders')
      .update({
        payment_ref: reference,
        gateway_data: paystackResponse.data || paystackResponse,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);
      
    return res.status(201).json({
      reference,
      amount,
      plan: newPlan,
      paymentMethod,
      authorization_url: paystackResponse.data.authorization_url
    });

  } catch (err) {
    logger.error(`Upgrade checkout error: ${err.message}`);
    res.status(500).json({ error: 'Could not process upgrade checkout' });
  }
});

module.exports = router;
