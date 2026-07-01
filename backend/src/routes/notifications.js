const express = require('express');
const router = express.Router();
const { authenticate, requireRole, blockDemoMutations } = require('../middleware/auth');
const { sendSms, sendEmail } = require('../services/notification.service');

router.use(authenticate, requireRole('tenant_admin', 'super_admin'), blockDemoMutations);

// Broadcast SMS/email to all customers of a tenant
router.post('/broadcast', async (req, res) => {
  const { message, channel } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const { getSupabaseAdmin } = require('../lib/supabase');
  const db = getSupabaseAdmin();

  const { data: sessions } = await db
    .from('sessions')
    .select('phone')
    .eq('tenant_id', req.user.tenant_id)
    .not('phone', 'is', null);

  const phones = [...new Set((sessions || []).map((s) => s.phone))];

  // Send in batches of 10 to avoid rate limits
  let sent = 0;
  for (let i = 0; i < phones.length; i += 10) {
    const batch = phones.slice(i, i + 10);
    await Promise.allSettled(batch.map((p) => sendSms(p, message)));
    sent += batch.length;
    await new Promise((r) => setTimeout(r, 500));
  }

  res.json({ message: `Broadcast sent to ${sent} customers` });
});

module.exports = router;
