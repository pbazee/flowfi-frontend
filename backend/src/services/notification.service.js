const nodemailer = require('nodemailer');
const axios = require('axios');
const { Resend } = require('resend');
const { logger } = require('../lib/logger');

// ═══════════════════════════════════════════════════
// EMAIL
// ═══════════════════════════════════════════════════

let transporter;
let resendClient;

function getEmailFromAddress() {
  return process.env.EMAIL_FROM || 'FlowFi <noreply@flowfi.co.ke>';
}

function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
}

async function sendEmail(to, subject, html) {
  if (!to) return;

  // ── Dev-mode override ─────────────────────────────────────────────
  // In development, Resend restricts delivery to unverified addresses.
  // Re-route all emails to SUPERADMIN_EMAIL so every email is testable
  // without needing a verified sending domain.
  let effectiveTo = to;
  let effectiveSubject = subject;
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev && process.env.SUPERADMIN_EMAIL && to !== process.env.SUPERADMIN_EMAIL) {
    effectiveTo = process.env.SUPERADMIN_EMAIL;
    effectiveSubject = `[DEV - intended for: ${to}] ${subject}`;
  }

  try {
    const resend = getResendClient();

    if (resend) {
      const result = await resend.emails.send({
        from: getEmailFromAddress(),
        to: effectiveTo,
        subject: effectiveSubject,
        html,
      });
      // Resend returns { data, error } — surface the error if present
      if (result.error) {
        logger.error(`Resend error for ${effectiveTo} (${effectiveSubject}): ${JSON.stringify(result.error)}`);
        return { ok: false, error: result.error };
      }
    } else if (process.env.EMAIL_USER) {
      await getTransporter().sendMail({
        from: getEmailFromAddress(),
        to: effectiveTo,
        subject: effectiveSubject,
        html,
      });
    } else {
      logger.warn(`Email skipped for ${effectiveTo}: no Resend or SMTP credentials configured`);
      return { ok: false, skipped: true, reason: 'not_configured' };
    }

    logger.info(`Email sent to ${effectiveTo}: ${effectiveSubject}`);
    return { ok: true };
  } catch (err) {
    logger.error(`Email failed to ${effectiveTo}: ${err.message}`);
    if (err.response?.data) logger.error('Resend response: ' + JSON.stringify(err.response.data));
    return { ok: false, error: err };
  }
}

// ═══════════════════════════════════════════════════
// SMS (Africa's Talking)
// ═══════════════════════════════════════════════════

async function sendSms(to, message) {
  if (!to || !process.env.AT_API_KEY) return { ok: false, skipped: true, reason: 'not_configured' };
  try {
    const phone = to.startsWith('0') ? `+254${to.slice(1)}` : to.startsWith('254') ? `+${to}` : to;

    const params = new URLSearchParams({
      username: process.env.AT_USERNAME,
      to: phone,
      message,
      ...(process.env.AT_SENDER_ID ? { from: process.env.AT_SENDER_ID } : {}),
    });

    await axios.post('https://api.africastalking.com/version1/messaging', params.toString(), {
      headers: {
        apiKey: process.env.AT_API_KEY,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    logger.info(`SMS sent to ${phone}`);
    return { ok: true };
  } catch (err) {
    logger.error(`SMS failed to ${to}: ${err.message}`);
    return { ok: false, error: err };
  }
}

// ═══════════════════════════════════════════════════
// NOTIFICATION TEMPLATES
// ═══════════════════════════════════════════════════

async function sendActivationNotification({ phone, email, packageName, duration, username, password, expiresAt }) {
  const durationText = duration >= 1440
    ? `${Math.floor(duration / 1440)} day(s)`
    : duration >= 60
    ? `${Math.floor(duration / 60)} hour(s)`
    : `${duration} minute(s)`;

  const expiry = new Date(expiresAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

  // SMS
  const smsMsg = `FlowFi WiFi activated!\nPackage: ${packageName}\nUser: ${username}\nPass: ${password}\nExpires: ${expiry}\nEnjoy browsing!`;
  await sendSms(phone, smsMsg);

  // Email
  if (email) {
    await sendEmail(
      email,
      'Your FlowFi WiFi is Active!',
      `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
        <div style="background:#0F6E56;padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">FlowFi</h1>
        </div>
        <div style="padding:24px;background:#f9f9f9;">
          <h2 style="color:#0F6E56;">You're connected!</h2>
          <p>Your <strong>${packageName}</strong> (${durationText}) is now active.</p>
          <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Username:</strong> ${username}</p>
            <p style="margin:4px 0;"><strong>Password:</strong> ${password}</p>
            <p style="margin:4px 0;"><strong>Expires:</strong> ${expiry}</p>
          </div>
          <p style="color:#888;font-size:13px;">You will receive a reminder when your session is about to expire.</p>
        </div>
      </div>
      `
    );
  }
}

async function sendSessionExpiryNotification(session, timeLeft) {
  const phone = session.phone;
  if (!phone) return;
  await sendSms(phone, `FlowFi: Your WiFi session expires in ${timeLeft}. Top up now to stay connected!`);
}

async function sendTenantApprovalNotification(tenantEmail, tenantName) {
  await sendEmail(
    tenantEmail,
    'Your FlowFi account is approved!',
    `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
      <div style="background:#0F6E56;padding:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;">FlowFi</h1>
      </div>
      <div style="padding:24px;">
        <h2>Welcome, ${tenantName}!</h2>
        <p>Your FlowFi account has been approved. You can now log in and set up your WiFi portal.</p>
        <a href="${process.env.FRONTEND_URL}/tenant/dashboard" style="display:inline-block;background:#0F6E56;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">Go to Dashboard</a>
      </div>
    </div>
    `
  );
}

async function sendOrderConfirmation({ customerEmail, customerPhone, reference, total, items }) {
  const trackUrl = `${process.env.FRONTEND_URL}/shop/track?ref=${encodeURIComponent(reference)}`;
  const itemsList = items.map((i) => `${i.name} x${i.quantity} — KES ${i.total}`).join('\n');
  await sendSms(customerPhone, `FlowFi Shop: Order ${reference} received! Total: KES ${total}. We'll contact you for delivery. Track: ${trackUrl}`);

  if (customerEmail) {
    await sendEmail(customerEmail, `Order ${reference} Confirmed`, `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
        <h2>Order Confirmed!</h2>
        <p><strong>Reference:</strong> ${reference}</p>
        <p><strong>Items:</strong><br/><pre>${itemsList}</pre></p>
        <p><strong>Total:</strong> KES ${total}</p>
        <p>Our team will contact you at ${customerPhone} to arrange delivery.</p>
        <p><a href="${trackUrl}" style="display:inline-block;background:#0F6E56;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;">Track your order</a></p>
      </div>
    `);
  }
}

async function sendWorkspaceActivationNotification({ email, name, businessName, planName }) {
  if (!email) return

  await sendEmail(
    email,
    'Your FlowFi workspace is ready',
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#0F6E56;padding:24px;text-align:center;border-radius:16px 16px 0 0;">
        <h1 style="color:#fff;margin:0;">FlowFi</h1>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
        <h2 style="margin-top:0;color:#111827;">Workspace activated</h2>
        <p>Hello ${name || 'there'}, your <strong>${businessName}</strong> workspace is now active on the <strong>${planName}</strong> plan.</p>
        <p>You can sign in and finish setup right away.</p>
        <a href="${process.env.FRONTEND_URL}/login" style="display:inline-block;background:#0F6E56;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;margin-top:12px;">Sign in</a>
      </div>
    </div>
    `
  )
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function nl2br(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br/>')
}

function formatKenyaDateTime(value) {
  if (!value) return 'Not scheduled'

  return new Date(value).toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function buildFlowFiEmailShell({ eyebrow, title, intro, bodyHtml, ctaLabel, ctaUrl, footerHtml }) {
  return `
    <div style="margin:0;padding:24px 16px;background:#f4f7f6;font-family:Arial,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #dbe6e3;">
        <div style="padding:28px;background:linear-gradient(135deg,#0f6e56,#16a34a);color:#ffffff;">
          <div style="display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.12);font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">
            ${escapeHtml(eyebrow || 'FlowFi')}
          </div>
          <h1 style="margin:18px 0 0;font-size:28px;line-height:1.2;">${escapeHtml(title)}</h1>
          ${intro ? `<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.92);">${escapeHtml(intro)}</p>` : ''}
        </div>
        <div style="padding:28px 24px;">
          ${bodyHtml}
          ${
            ctaLabel && ctaUrl
              ? `
                <div style="margin-top:28px;text-align:center;">
                  <a href="${ctaUrl}" style="display:inline-block;background:#0f6e56;color:#ffffff;padding:14px 24px;border-radius:14px;text-decoration:none;font-weight:700;">
                    ${escapeHtml(ctaLabel)}
                  </a>
                </div>
              `
              : ''
          }
        </div>
        <div style="padding:20px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#4b5563;font-size:13px;line-height:1.6;">
          ${footerHtml || 'FlowFi keeps guest WiFi, billing, and storefront operations moving together.'}
        </div>
      </div>
    </div>
  `
}

async function sendWorkspaceTrialNotification({ email, name, businessName, planName, trialDays, trialEndsAt }) {
  if (!email) return

  await sendEmail(
    email,
    `Your FlowFi trial has started`,
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#0F6E56;padding:24px;text-align:center;border-radius:16px 16px 0 0;">
        <h1 style="color:#fff;margin:0;">FlowFi</h1>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
        <h2 style="margin-top:0;color:#111827;">Trial workspace ready</h2>
        <p>Hello ${name || 'there'}, your workspace for <strong>${businessName}</strong> is live on the <strong>${planName}</strong> plan.</p>
        <p>You have <strong>${trialDays}</strong> free trial day(s). Billing starts on <strong>${formatKenyaDateTime(trialEndsAt)}</strong>.</p>
        <a href="${process.env.FRONTEND_URL}/login" style="display:inline-block;background:#0F6E56;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;margin-top:12px;">Sign in to your workspace</a>
      </div>
    </div>
    `
  )
}

async function sendTenantGraceGrantedNotification({ email, phone, tenantName, daysGranted, reason, newBillingDate }) {
  const smsMessage = `FlowFi: ${daysGranted} free grace day(s) have been added to ${tenantName || 'your workspace'}. Next billing date: ${formatKenyaDateTime(newBillingDate)}.${reason ? ` Reason: ${reason}.` : ''}`
  await sendSms(phone, smsMessage)

  if (!email) return

  await sendEmail(
    email,
    'FlowFi grace days added',
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#0F6E56;padding:24px;text-align:center;border-radius:16px 16px 0 0;">
        <h1 style="color:#fff;margin:0;">FlowFi</h1>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
        <h2 style="margin-top:0;color:#111827;">Grace days confirmed</h2>
        <p>Your workspace <strong>${tenantName || 'FlowFi'}</strong> has received <strong>${daysGranted}</strong> extra day(s) of access.</p>
        <p><strong>Next billing date:</strong> ${formatKenyaDateTime(newBillingDate)}</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>Your service stays uninterrupted during this grace extension.</p>
      </div>
    </div>
    `
  )
}

async function sendSubscriptionInvoiceNotification({
  email,
  tenantName,
  planName,
  amount,
  invoiceType,
  dueAt,
  periodStart,
  periodEnd,
}) {
  if (!email) return

  await sendEmail(
    email,
    `FlowFi invoice for ${planName}`,
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#0F6E56;padding:24px;text-align:center;border-radius:16px 16px 0 0;">
        <h1 style="color:#fff;margin:0;">FlowFi</h1>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
        <h2 style="margin-top:0;color:#111827;">${invoiceType === 'initial' ? 'First invoice generated' : 'Renewal invoice generated'}</h2>
        <p><strong>${tenantName || 'Your workspace'}</strong> is now billed on the <strong>${planName}</strong> plan.</p>
        <p><strong>Amount:</strong> KES ${Number(amount || 0).toLocaleString('en-KE')}</p>
        <p><strong>Billing period:</strong> ${formatKenyaDateTime(periodStart)} to ${formatKenyaDateTime(periodEnd)}</p>
        <p><strong>Issued on:</strong> ${formatKenyaDateTime(dueAt)}</p>
      </div>
    </div>
    `
  )
}

async function sendPasswordResetEmail({ email, name, resetUrl }) {
  if (!email || !resetUrl) return

  return sendEmail(
    email,
    'Reset your FlowFi password',
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Security',
      title: 'Reset your password',
      intro: `Use the secure link below to reset your password for ${name || 'your FlowFi account'}.`,
      bodyHtml: `
        <div style="border:1px solid #e5e7eb;border-radius:22px;padding:18px;background:#f9fafb;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#111827;">
            This reset link stays active for <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>
        <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#4b5563;">
          If the button does not open, use this link:<br/>
          <a href="${resetUrl}" style="color:#0f6e56;text-decoration:none;">${resetUrl}</a>
        </p>
      `,
      ctaLabel: 'Reset password',
      ctaUrl: resetUrl,
      footerHtml: 'Password reset links are generated securely by FlowFi and expire automatically after 1 hour.',
    })
  )
}

async function sendTrialEndingTomorrowNotification({ email, phone, tenantName, trialEndsAt }) {
  const trialEndLabel = formatKenyaDateTime(trialEndsAt)
  const smsMessage = `FlowFi: Your trial for ${tenantName || 'your workspace'} ends tomorrow on ${trialEndLabel}. Add payment details to continue without interruption.`

  await sendSms(phone, smsMessage)
  if (!email) return

  return sendEmail(
    email,
    'Your FlowFi trial ends tomorrow',
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Billing',
      title: 'Your trial ends tomorrow',
      intro: 'Add your payment setup now so your venue can keep accepting online payments without disruption.',
      bodyHtml: `
        <div style="border:1px solid #e5e7eb;border-radius:22px;padding:18px;background:#f9fafb;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#111827;">
            <strong>${escapeHtml(tenantName || 'Your workspace')}</strong> stays on trial until <strong>${escapeHtml(trialEndLabel)}</strong>.
          </p>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#4b5563;">
            Add your payment method and tenant payment credentials now to avoid moving into past due status.
          </p>
        </div>
      `,
      ctaLabel: 'Open FlowFi',
      ctaUrl: `${process.env.FRONTEND_URL}/tenant/settings`,
      footerHtml: 'Need help? Reply to this email and the FlowFi team will help you finish setup.',
    })
  )
}

async function sendTrialPastDueNotification({ email, phone, tenantName, graceEndsAt }) {
  const graceEndLabel = formatKenyaDateTime(graceEndsAt)
  const smsMessage = `FlowFi: ${tenantName || 'Your workspace'} is now past due. Add payment details before ${graceEndLabel} to avoid suspension.`

  await sendSms(phone, smsMessage)
  if (!email) return

  return sendEmail(
    email,
    'Your FlowFi workspace is now past due',
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Billing',
      title: 'Your trial has ended',
      intro: 'You are now in a short grace period while we wait for your payment setup or invoice payment.',
      bodyHtml: `
        <div style="border:1px solid #fde68a;border-radius:22px;padding:18px;background:#fffbeb;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#92400e;">
            <strong>${escapeHtml(tenantName || 'Your workspace')}</strong> will be suspended if payment is not completed by <strong>${escapeHtml(graceEndLabel)}</strong>.
          </p>
        </div>
        <p style="margin:18px 0 0;font-size:15px;line-height:1.7;color:#4b5563;">
          During the grace period your portal can keep running, but the dashboard will stay marked as past due until payment is completed.
        </p>
      `,
      ctaLabel: 'Open billing settings',
      ctaUrl: `${process.env.FRONTEND_URL}/tenant/settings`,
      footerHtml: 'Settle the workspace invoice or add payment details before the grace period ends to avoid suspension.',
    })
  )
}

async function sendWorkspaceSuspendedNotification({ email, phone, tenantName }) {
  const smsMessage = `FlowFi: ${tenantName || 'Your workspace'} has been suspended because payment was not completed in time. Pay your invoice to reactivate.`

  await sendSms(phone, smsMessage)
  if (!email) return

  return sendEmail(
    email,
    'Your FlowFi workspace has been suspended',
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Billing',
      title: 'Workspace suspended',
      intro: 'Your workspace has been suspended because the billing grace period ended without payment.',
      bodyHtml: `
        <div style="border:1px solid #fecaca;border-radius:22px;padding:18px;background:#fef2f2;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#991b1b;">
            <strong>${escapeHtml(tenantName || 'Your workspace')}</strong> is suspended. Pay your invoice to reactivate service immediately.
          </p>
        </div>
      `,
      ctaLabel: 'Open FlowFi',
      ctaUrl: `${process.env.FRONTEND_URL}/login`,
      footerHtml: 'Once payment is confirmed, FlowFi can reactivate your workspace immediately.',
    })
  )
}

async function sendTenantCommunicationEmail({ to, subject, message, recipientName }) {
  if (!to || !subject || !message) return { ok: false, skipped: true, reason: 'missing_required_fields' }

  return sendEmail(
    to,
    subject,
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Update',
      title: subject,
      intro: recipientName ? `Hello ${recipientName},` : 'Hello,',
      bodyHtml: `
        <div style="border:1px solid #e5e7eb;border-radius:22px;padding:18px;background:#f9fafb;">
          <div style="font-size:15px;line-height:1.8;color:#111827;">${nl2br(message)}</div>
        </div>
      `,
      ctaLabel: 'Open FlowFi',
      ctaUrl: `${process.env.FRONTEND_URL}/login`,
      footerHtml: 'This update was sent from FlowFi platform administration.',
    })
  )
}

// ═══════════════════════════════════════════════════
// TENANT LIFECYCLE NOTIFICATIONS
// ═══════════════════════════════════════════════════

async function sendWelcomeEmail(tenant, user) {
  const email = user?.email || tenant?.contact_email;
  const name = user?.name || tenant?.name || 'there';
  const businessName = tenant?.name || 'your workspace';
  const frontendUrl = process.env.FRONTEND_URL || 'https://flowfi.co.ke';
  if (!email) return;

  return sendEmail(
    email,
    `Welcome to FlowFi, ${name}!`,
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi',
      title: `Welcome, ${escapeHtml(name)}!`,
      intro: `Your ${escapeHtml(businessName)} workspace is live. Here are your 3 next steps to get fully set up.`,
      bodyHtml: `
        <div style="border:1px solid #e5e7eb;border-radius:22px;padding:20px;background:#f9fafb;">
          <div style="display:flex;align-items:flex-start;gap:14px;padding:12px 0;border-bottom:1px solid #e5e7eb;">
            <div style="flex-shrink:0;width:32px;height:32px;background:#0f6e56;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;">1</div>
            <div><p style="margin:0;font-weight:600;color:#111827;font-size:15px;">Connect your MikroTik router</p><p style="margin:4px 0 0;font-size:13px;color:#4b5563;">Go to Routers &rarr; Add Router, enter your IP and API credentials.</p></div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:14px;padding:12px 0;border-bottom:1px solid #e5e7eb;">
            <div style="flex-shrink:0;width:32px;height:32px;background:#0f6e56;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;">2</div>
            <div><p style="margin:0;font-weight:600;color:#111827;font-size:15px;">Add your payment method</p><p style="margin:4px 0 0;font-size:13px;color:#4b5563;">Go to Settings and add your Paystack and/or M-Pesa credentials.</p></div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:14px;padding:12px 0;">
            <div style="flex-shrink:0;width:32px;height:32px;background:#0f6e56;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;">3</div>
            <div><p style="margin:0;font-weight:600;color:#111827;font-size:15px;">Create your packages</p><p style="margin:4px 0 0;font-size:13px;color:#4b5563;">Set pricing tiers with speed and data limits from the Packages section.</p></div>
          </div>
        </div>
      `,
      ctaLabel: 'Go to your workspace \u2192',
      ctaUrl: `${frontendUrl}/tenant`,
      footerHtml: 'Need help? Reply to this email or visit our contact page.',
    })
  );
}

async function sendSetupReminderEmail(tenant) {
  const email = tenant?.contact_email;
  const name = tenant?.name || 'there';
  const frontendUrl = process.env.FRONTEND_URL || 'https://flowfi.co.ke';
  if (!email) return;

  return sendEmail(
    email,
    'Your FlowFi workspace is waiting',
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Setup',
      title: 'Your workspace is ready \u2014 just needs a router',
      intro: "You signed up yesterday but haven't connected a router yet. Here's how to do it in 5 minutes.",
      bodyHtml: `
        <div style="border:1px solid #e5e7eb;border-radius:22px;padding:18px;background:#f9fafb;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#111827;">Open the Routers section, click <strong>Add Router</strong>, and enter your MikroTik IP address, port, and API credentials. FlowFi will test the connection and confirm when it's live.</p>
        </div>
      `,
      ctaLabel: 'Connect your router \u2192',
      ctaUrl: `${frontendUrl}/tenant/routers`,
      footerHtml: 'Once your router is live, customers can connect and pay through your captive portal.',
    })
  );
}

async function sendRouterLiveEmail(tenant, router) {
  const email = tenant?.contact_email;
  const businessName = tenant?.name || 'Your venue';
  const routerName = router?.name || 'your router';
  const frontendUrl = process.env.FRONTEND_URL || 'https://flowfi.co.ke';
  if (!email) return;

  return sendEmail(
    email,
    '\uD83D\uDFE2 Your router is live on FlowFi!',
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi',
      title: '\uD83D\uDFE2 Your router is live!',
      intro: `${escapeHtml(routerName)} connected successfully. ${escapeHtml(businessName)} is now ready to accept payments.`,
      bodyHtml: `
        <div style="border:1px solid #bbf7d0;border-radius:22px;padding:18px;background:#f0fdf4;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#14532d;">Your captive portal is live. Customers who join your WiFi network will now see your branded payment page automatically.</p>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#166534;">Make sure your packages are set up and your payment credentials are configured to start collecting revenue.</p>
        </div>
      `,
      ctaLabel: 'Open your dashboard \u2192',
      ctaUrl: `${frontendUrl}/tenant`,
      footerHtml: 'Congratulations \u2014 your FlowFi venue is live.',
    })
  );
}

async function sendTrialEndingEmail(tenant, daysLeft) {
  const email = tenant?.contact_email;
  const tenantName = tenant?.name || 'Your workspace';
  const frontendUrl = process.env.FRONTEND_URL || 'https://flowfi.co.ke';
  const days = daysLeft || 3;
  if (!email) return;

  return sendEmail(
    email,
    `Your FlowFi trial ends in ${days} days`,
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Billing',
      title: `Your trial ends in ${days} day${days !== 1 ? 's' : ''}`,
      intro: 'Upgrade now to keep your venue running without any interruption.',
      bodyHtml: `
        <div style="border:1px solid #fde68a;border-radius:22px;padding:18px;background:#fffbeb;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#92400e;">
            <strong>${escapeHtml(tenantName)}</strong> is currently on a free trial. In ${days} day${days !== 1 ? 's' : ''}, your workspace will require a paid plan to continue accepting customer payments.
          </p>
        </div>
        <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#4b5563;">Choose a plan on the billing page and your portal stays live without any downtime.</p>
      `,
      ctaLabel: 'Upgrade now \u2192',
      ctaUrl: `${frontendUrl}/tenant/billing`,
      footerHtml: 'Need help choosing a plan? Reply to this email and the FlowFi team will help.',
    })
  );
}

async function sendPaymentConfirmedEmail(tenant, subscription) {
  const email = tenant?.contact_email;
  const tenantName = tenant?.name || 'Your workspace';
  const planName = subscription?.plan_name || 'your plan';
  const amount = Number(subscription?.amount || 0);
  const nextDate = subscription?.current_period_ends_at;
  const frontendUrl = process.env.FRONTEND_URL || 'https://flowfi.co.ke';
  if (!email) return;

  return sendEmail(
    email,
    'Payment confirmed \u2014 FlowFi subscription active',
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Billing',
      title: 'Payment confirmed',
      intro: `Your ${escapeHtml(planName)} subscription is active.`,
      bodyHtml: `
        <div style="border:1px solid #e5e7eb;border-radius:22px;padding:18px;background:#f9fafb;">
          <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;">Receipt</p>
          <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Workspace:</strong> ${escapeHtml(tenantName)}</p>
          <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Plan:</strong> ${escapeHtml(planName)}</p>
          <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Amount:</strong> KES ${amount.toLocaleString('en-KE')}</p>
          ${nextDate ? `<p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Next billing date:</strong> ${formatKenyaDateTime(nextDate)}</p>` : ''}
        </div>
      `,
      ctaLabel: 'Open your dashboard \u2192',
      ctaUrl: `${frontendUrl}/tenant`,
      footerHtml: 'This is an automated payment receipt from FlowFi.',
    })
  );
}

async function sendPaymentFailedEmail(tenant) {
  const email = tenant?.contact_email;
  const tenantName = tenant?.name || 'Your workspace';
  const frontendUrl = process.env.FRONTEND_URL || 'https://flowfi.co.ke';
  if (!email) return;

  return sendEmail(
    email,
    'Action needed: Your FlowFi payment failed',
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Billing',
      title: 'Payment failed',
      intro: 'We could not process your subscription payment. Please update your billing details.',
      bodyHtml: `
        <div style="border:1px solid #fecaca;border-radius:22px;padding:18px;background:#fef2f2;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#991b1b;">
            The payment for <strong>${escapeHtml(tenantName)}</strong> did not go through. Your account may be suspended if payment is not updated within 3 days.
          </p>
        </div>
        <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#4b5563;">Update your M-Pesa or Paystack credentials on the billing settings page to retry payment.</p>
      `,
      ctaLabel: 'Update billing details \u2192',
      ctaUrl: `${frontendUrl}/tenant/billing`,
      footerHtml: 'If you believe this is an error, reply to this email and our team will investigate.',
    })
  );
}

async function sendPaymentFailedSMS(phone) {
  if (!phone) return;
  return sendSms(phone, 'FlowFi: Your subscription payment failed. Please update your billing details at flowfi.co.ke/tenant/billing to avoid suspension.');
}

async function sendAccountSuspendedEmail(tenant) {
  const email = tenant?.contact_email;
  const tenantName = tenant?.name || 'Your workspace';
  const frontendUrl = process.env.FRONTEND_URL || 'https://flowfi.co.ke';
  if (!email) return;

  return sendEmail(
    email,
    'Your FlowFi account has been suspended',
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Account',
      title: 'Account suspended',
      intro: 'Your FlowFi workspace has been suspended.',
      bodyHtml: `
        <div style="border:1px solid #fecaca;border-radius:22px;padding:18px;background:#fef2f2;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#991b1b;">
            <strong>${escapeHtml(tenantName)}</strong> has been suspended. Your captive portal is currently offline and customers cannot connect.
          </p>
        </div>
        <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#4b5563;">To reactivate your workspace, please settle any outstanding payments or contact support.</p>
      `,
      ctaLabel: 'Contact support \u2192',
      ctaUrl: `${frontendUrl}/contact`,
      footerHtml: 'Once payment is confirmed, your workspace can be reactivated immediately.',
    })
  );
}

async function sendAccountSuspendedSMS(phone) {
  if (!phone) return;
  return sendSms(phone, 'FlowFi: Your workspace has been suspended. Please contact support at flowfi.co.ke/contact to reactivate.');
}

async function sendAccountReactivatedEmail(tenant) {
  const email = tenant?.contact_email;
  const tenantName = tenant?.name || 'Your workspace';
  const frontendUrl = process.env.FRONTEND_URL || 'https://flowfi.co.ke';
  if (!email) return;

  return sendEmail(
    email,
    'Your FlowFi account is back online',
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Account',
      title: 'Account reactivated! \uD83C\uDF89',
      intro: `${escapeHtml(tenantName)} is back online and ready to accept payments.`,
      bodyHtml: `
        <div style="border:1px solid #bbf7d0;border-radius:22px;padding:18px;background:#f0fdf4;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#14532d;">
            Your captive portal is live again. Customers can now connect to your WiFi and make payments as normal.
          </p>
        </div>
      `,
      ctaLabel: 'Open your dashboard \u2192',
      ctaUrl: `${frontendUrl}/tenant`,
      footerHtml: 'Thank you for using FlowFi.',
    })
  );
}

async function sendRouterOfflineEmail(tenant, router) {
  const email = tenant?.contact_email;
  const routerName = router?.name || 'A router';
  const routerLocation = router?.location || '';
  const frontendUrl = process.env.FRONTEND_URL || 'https://flowfi.co.ke';
  if (!email) return;

  return sendEmail(
    email,
    `\u26A0\uFE0F Router offline: ${routerName}`,
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Alert',
      title: `\u26A0\uFE0F Router offline: ${escapeHtml(routerName)}`,
      intro: 'One of your routers has gone offline. Customers at this location may not be able to connect.',
      bodyHtml: `
        <div style="border:1px solid #fed7aa;border-radius:22px;padding:18px;background:#fff7ed;">
          <p style="margin:0;font-size:15px;line-height:1.7;color:#7c2d12;">
            <strong>Router:</strong> ${escapeHtml(routerName)}<br/>
            ${routerLocation ? `<strong>Location:</strong> ${escapeHtml(routerLocation)}<br/>` : ''}
            <strong>Status:</strong> Offline
          </p>
        </div>
        <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#4b5563;">Check the router's power and internet connection. Use the Test Connection feature on the Routers page to reconnect.</p>
      `,
      ctaLabel: 'Go to Routers \u2192',
      ctaUrl: `${frontendUrl}/tenant/routers`,
      footerHtml: 'FlowFi monitors your routers and alerts you when they go offline.',
    })
  );
}

async function sendRouterOfflineSMS(phone, routerName) {
  if (!phone) return;
  return sendSms(phone, `FlowFi Alert: Router "${routerName}" has gone offline. Check its connection and test from your FlowFi dashboard.`);
}

async function sendAdminNewTenantEmail(tenant, user) {
  const adminEmail = process.env.SUPERADMIN_EMAIL;
  if (!adminEmail) return;
  const businessName = tenant?.name || 'Unknown';
  const ownerEmail = user?.email || tenant?.contact_email || 'Unknown';
  const planName = tenant?.workspace_plan_name || 'Unknown';
  const frontendUrl = process.env.FRONTEND_URL || 'https://flowfi.co.ke';
  const timestamp = formatKenyaDateTime(tenant?.created_at || new Date().toISOString());

  return sendEmail(
    adminEmail,
    `New tenant signup: ${businessName}`,
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Admin',
      title: 'New tenant registered',
      intro: `A new workspace has been created on FlowFi.`,
      bodyHtml: `
        <div style="border:1px solid #e5e7eb;border-radius:22px;padding:18px;background:#f9fafb;">
          <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Business:</strong> ${escapeHtml(businessName)}</p>
          <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Owner email:</strong> ${escapeHtml(ownerEmail)}</p>
          <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Plan:</strong> ${escapeHtml(planName)}</p>
          <p style="margin:4px 0;font-size:15px;color:#111827;"><strong>Registered:</strong> ${timestamp}</p>
        </div>
      `,
      ctaLabel: 'View in admin panel \u2192',
      ctaUrl: `${frontendUrl}/admin/tenants`,
      footerHtml: 'This alert is sent to the FlowFi superadmin for every new tenant registration.',
    })
  );
}

async function sendAdminNewMessageEmail(message) {
  const adminEmail = process.env.SUPERADMIN_EMAIL;
  if (!adminEmail) return;
  const senderName = message?.name || 'Unknown';
  const senderEmail = message?.email || '';
  const preview = String(message?.message || '').slice(0, 200);
  const frontendUrl = process.env.FRONTEND_URL || 'https://flowfi.co.ke';

  return sendEmail(
    adminEmail,
    `New message from ${senderName}`,
    buildFlowFiEmailShell({
      eyebrow: 'FlowFi Admin',
      title: `New message from ${escapeHtml(senderName)}`,
      intro: senderEmail ? `Sent by ${escapeHtml(senderEmail)}` : undefined,
      bodyHtml: `
        <div style="border:1px solid #e5e7eb;border-radius:22px;padding:18px;background:#f9fafb;">
          <p style="margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;">Message preview</p>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#111827;">${escapeHtml(preview)}${preview.length >= 200 ? '\u2026' : ''}</p>
        </div>
      `,
      ctaLabel: 'View in admin panel \u2192',
      ctaUrl: `${frontendUrl}/admin/messages`,
      footerHtml: 'This alert is sent for every new contact message received through the FlowFi public form.',
    })
  );
}

module.exports = {
  sendEmail,
  sendSms,
  sendActivationNotification,
  sendSessionExpiryNotification,
  sendTenantApprovalNotification,
  sendOrderConfirmation,
  sendWorkspaceActivationNotification,
  sendWorkspaceTrialNotification,
  sendTenantGraceGrantedNotification,
  sendSubscriptionInvoiceNotification,
  sendPasswordResetEmail,
  sendTenantCommunicationEmail,
  sendTrialEndingTomorrowNotification,
  sendTrialPastDueNotification,
  sendWorkspaceSuspendedNotification,
  // New transactional notifications
  sendWelcomeEmail,
  sendSetupReminderEmail,
  sendRouterLiveEmail,
  sendTrialEndingEmail,
  sendPaymentConfirmedEmail,
  sendPaymentFailedEmail,
  sendPaymentFailedSMS,
  sendAccountSuspendedEmail,
  sendAccountSuspendedSMS,
  sendAccountReactivatedEmail,
  sendRouterOfflineEmail,
  sendRouterOfflineSMS,
  sendAdminNewTenantEmail,
  sendAdminNewMessageEmail,
};
