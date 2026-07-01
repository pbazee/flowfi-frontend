const cron = require('node-cron');
const { logger } = require('./logger');
const { getSupabaseAdmin } = require('./supabase');
const { sendSessionExpiryNotification, sendSetupReminderEmail, sendTrialEndingEmail } = require('../services/notification.service');
const { runDailySubscriptionBilling } = require('../services/subscription.service');
const { syncGuestSessionTracking } = require('../services/session-credit.service');

function setupCronJobs() {
  cron.schedule('* * * * *', async () => {
    try {
      const db = getSupabaseAdmin();
      const now = new Date().toISOString();

      const { data: expiringSoon } = await db
        .from('sessions')
        .select('*, packages(name), tenant:tenants(name)')
        .eq('status', 'active')
        .lte('expires_at', new Date(Date.now() + 10 * 60 * 1000).toISOString())
        .gt('expires_at', now)
        .eq('expiry_warned', false);

      for (const session of expiringSoon || []) {
        await sendSessionExpiryNotification(session, '10 minutes');
        await db.from('sessions').update({ expiry_warned: true }).eq('id', session.id);
      }

      const { data: expired } = await db
        .from('sessions')
        .update({ status: 'expired' })
        .eq('status', 'active')
        .lte('expires_at', now)
        .select('id, router_id, mac_address, tenant_id');

      if (expired?.length) {
        logger.info(`Expired ${expired.length} sessions`);
        const { disconnectUser } = require('../services/mikrotik.service');

        for (const session of expired) {
          syncGuestSessionTracking(session.id, session.tenant_id).catch(() => {});
          if (session.router_id && session.mac_address) {
            disconnectUser(session.router_id, session.mac_address).catch(() => {});
          }
        }
      }
    } catch (err) {
      logger.error('Cron [session-expiry] error:', err.message);
    }
  });

  cron.schedule('15 0 * * *', async () => {
    try {
      const result = await runDailySubscriptionBilling(new Date());
      logger.info(
        `Subscription billing job complete: ${result.warningsSent || 0} warning(s), ${result.processedTrials} trial(s) moved to past_due, ${result.suspendedTrials || 0} suspension(s), ${result.processedRenewals} renewal(s) processed`
      );
    } catch (err) {
      logger.error('Cron [subscription-billing] error:', err.message);
    }
  });

  cron.schedule('*/5 * * * *', async () => {
    try {
      const { checkAllRouters } = require('../services/mikrotik.service');
      await checkAllRouters();
    } catch (err) {
      logger.error('Cron [router-health] error:', err.message);
    }
  });

  // Daily: setup reminder (tenants registered 20-28h ago with 0 routers) + 3-day trial ending
  cron.schedule('0 8 * * *', async () => {
    try {
      const db = getSupabaseAdmin();
      const now = new Date();

      // Setup reminder: registered 20-28 hours ago with no routers
      const lowerBound = new Date(now.getTime() - 28 * 60 * 60 * 1000).toISOString();
      const upperBound = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();

      const { data: newTenants } = await db
        .from('tenants')
        .select('id, name, contact_email')
        .gte('created_at', lowerBound)
        .lte('created_at', upperBound)
        .in('status', ['active', 'trialing']);

      let setupReminderCount = 0;
      for (const tenant of newTenants || []) {
        const { count: routerCount } = await db
          .from('routers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id);
        if ((routerCount || 0) === 0) {
          await sendSetupReminderEmail(tenant).catch(() => {});
          setupReminderCount++;
        }
      }

      // Trial ending in ~3 days
      const trialWindowStart = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000).toISOString();
      const trialWindowEnd = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000).toISOString();

      const { data: trialTenants } = await db
        .from('tenant_subscriptions')
        .select('tenant_id, trial_ends_at, tenants(name, contact_email)')
        .eq('status', 'trialing')
        .gte('trial_ends_at', trialWindowStart)
        .lte('trial_ends_at', trialWindowEnd);

      let trialReminderCount = 0;
      for (const sub of trialTenants || []) {
        const tenant = sub.tenants || { name: null, contact_email: null };
        tenant.id = sub.tenant_id;
        await sendTrialEndingEmail(tenant, 3).catch(() => {});
        trialReminderCount++;
      }

      logger.info(`Cron [daily-notifications]: ${setupReminderCount} setup reminder(s), ${trialReminderCount} trial ending reminder(s)`);
    } catch (err) {
      logger.error('Cron [daily-notifications] error:', err.message);
    }
  });

  logger.info('Cron jobs initialized');
}

module.exports = { setupCronJobs };
