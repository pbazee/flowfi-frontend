const { getSupabaseAdmin } = require('../lib/supabase');
const { sendEmail } = require('./notification.service');

const STATUS_COPY = {
  confirmed: {
    heading: 'Order confirmed',
    subject: 'is confirmed',
    summary: 'We have received your payment and your order is now queued for fulfilment.',
  },
  processing: {
    heading: 'We are processing your order',
    subject: 'is being processed',
    summary: 'Our team is preparing your items and checking dispatch details.',
  },
  shipped: {
    heading: 'Your order is on the way',
    subject: 'has shipped',
    summary: 'Your order is with the courier or scheduled for dispatch.',
  },
  delivered: {
    heading: 'Order delivered',
    subject: 'has been delivered',
    summary: 'Your delivery has been marked as completed. Thank you for choosing FlowFi.',
  },
  cancelled: {
    heading: 'Order cancelled',
    subject: 'has been cancelled',
    summary: 'This order has been cancelled. If you need help, please contact the FlowFi team.',
  },
};

function formatCurrency(value) {
  return `KES ${Number(value || 0).toLocaleString('en-KE', {
    minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateLabel(value, options = {}) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    dateStyle: options.dateStyle || 'medium',
    ...(options.timeStyle ? { timeStyle: options.timeStyle } : {}),
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeWhatsappNumber(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits || '';
}

function renderItemRows(items = []) {
  return items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;">
            <div style="font-weight:600;">${escapeHtml(item.name)}</div>
            <div style="font-size:12px;color:#6b7280;">Qty ${Number(item.quantity || 0)}</div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#111827;">
            ${formatCurrency(item.total)}
          </td>
        </tr>
      `
    )
    .join('');
}

async function loadBranding() {
  const fallback = {
    platformName: 'FlowFi',
    whatsapp: '',
  };

  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('platform_settings')
      .select('key, value')
      .in('key', ['platform_name', 'support_whatsapp']);

    if (error) throw error;

    const settings = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
    return {
      platformName: settings.platform_name || fallback.platformName,
      whatsapp: normalizeWhatsappNumber(settings.support_whatsapp),
    };
  } catch {
    return fallback;
  }
}

async function sendShopOrderStatusEmail(order) {
  if (!order?.customer_email) {
    return { skipped: true, reason: 'missing_customer_email' };
  }

  const content = STATUS_COPY[order.status];
  if (!content) {
    return { skipped: true, reason: 'unsupported_status' };
  }

  const branding = await loadBranding();
  const trackUrl = `${process.env.FRONTEND_URL}/shop/track?ref=${encodeURIComponent(order.reference)}`;
  const whatsappHref = branding.whatsapp
    ? `https://wa.me/${branding.whatsapp}?text=${encodeURIComponent(`Hello ${branding.platformName}, I need help with order ${order.reference}.`)}`
    : '';
  const estimatedDelivery = formatDateLabel(order.estimated_delivery_date || order.estimated_delivery);
  const placedAt = formatDateLabel(order.created_at, { timeStyle: 'short' });
  const deliveredAt = formatDateLabel(order.delivered_at, { timeStyle: 'short' });
  const cancelledAt = formatDateLabel(order.cancelled_at, { timeStyle: 'short' });

  const html = `
    <div style="margin:0;padding:24px 16px;background:#f4f7f6;font-family:Arial,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #dbe6e3;">
        <div style="padding:28px;background:linear-gradient(135deg,#0f6e56,#16a34a);color:#ffffff;">
          <div style="display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.12);font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">
            ${escapeHtml(branding.platformName)}
          </div>
          <h1 style="margin:18px 0 0;font-size:28px;line-height:1.2;">${escapeHtml(content.heading)}</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.92);">${escapeHtml(content.summary)}</p>
        </div>

        <div style="padding:28px 24px;">
          <div style="border:1px solid #e5e7eb;border-radius:22px;padding:18px;background:#f9fafb;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">Order reference</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;color:#111827;">${escapeHtml(order.reference)}</div>
            ${placedAt ? `<div style="margin-top:8px;font-size:14px;color:#4b5563;">Placed ${escapeHtml(placedAt)}</div>` : ''}
          </div>

          <div style="margin-top:24px;">
            <h2 style="margin:0 0 14px;font-size:18px;color:#111827;">Order summary</h2>
            <table style="width:100%;border-collapse:collapse;">
              ${renderItemRows(order.items || [])}
            </table>
            <table style="width:100%;margin-top:16px;border-collapse:collapse;">
              <tr>
                <td style="padding:4px 0;color:#4b5563;">Subtotal</td>
                <td style="padding:4px 0;text-align:right;color:#111827;font-weight:600;">${formatCurrency(order.subtotal || order.total)}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;color:#4b5563;">Shipping</td>
                <td style="padding:4px 0;text-align:right;color:#111827;font-weight:600;">${formatCurrency(order.delivery_fee || 0)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0 0;color:#111827;font-weight:700;">Total</td>
                <td style="padding:8px 0 0;text-align:right;color:#111827;font-weight:700;">${formatCurrency(order.total)}</td>
              </tr>
            </table>
          </div>

          <div style="margin-top:24px;display:grid;gap:14px;">
            ${estimatedDelivery ? `
              <div style="border:1px solid #e5e7eb;border-radius:18px;padding:16px;">
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">Estimated delivery</div>
                <div style="margin-top:8px;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(estimatedDelivery)}</div>
              </div>
            ` : ''}
            ${order.courier_note ? `
              <div style="border:1px solid #e5e7eb;border-radius:18px;padding:16px;">
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">Courier note</div>
                <div style="margin-top:8px;font-size:15px;line-height:1.6;color:#111827;">${escapeHtml(order.courier_note)}</div>
              </div>
            ` : ''}
            ${order.tracking_number ? `
              <div style="border:1px solid #e5e7eb;border-radius:18px;padding:16px;">
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">Tracking number</div>
                <div style="margin-top:8px;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(order.tracking_number)}</div>
              </div>
            ` : ''}
            ${order.status === 'cancelled' && order.cancellation_reason ? `
              <div style="border:1px solid #fecaca;background:#fef2f2;border-radius:18px;padding:16px;">
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#b91c1c;">Cancellation reason</div>
                <div style="margin-top:8px;font-size:15px;line-height:1.6;color:#7f1d1d;">${escapeHtml(order.cancellation_reason)}</div>
              </div>
            ` : ''}
            ${order.status === 'delivered' && deliveredAt ? `
              <div style="border:1px solid #dcfce7;background:#f0fdf4;border-radius:18px;padding:16px;">
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#15803d;">Delivered at</div>
                <div style="margin-top:8px;font-size:15px;line-height:1.6;color:#166534;">${escapeHtml(deliveredAt)}</div>
              </div>
            ` : ''}
            ${order.status === 'cancelled' && cancelledAt ? `
              <div style="border:1px solid #fecaca;background:#fff1f2;border-radius:18px;padding:16px;">
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#b91c1c;">Cancelled at</div>
                <div style="margin-top:8px;font-size:15px;line-height:1.6;color:#7f1d1d;">${escapeHtml(cancelledAt)}</div>
              </div>
            ` : ''}
          </div>

          <div style="margin-top:28px;text-align:center;">
            <a href="${trackUrl}" style="display:inline-block;background:#0f6e56;color:#ffffff;padding:14px 24px;border-radius:14px;text-decoration:none;font-weight:700;">
              Track Your Order
            </a>
          </div>
        </div>

        <div style="padding:20px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#4b5563;font-size:13px;line-height:1.6;">
          <div style="margin-bottom:8px;">Need help with this order? Reply to this email or reach the FlowFi team on WhatsApp.</div>
          ${whatsappHref ? `<a href="${whatsappHref}" style="color:#0f6e56;font-weight:700;text-decoration:none;">Chat on WhatsApp</a>` : ''}
        </div>
      </div>
    </div>
  `;

  const emailResult = await sendEmail(
    order.customer_email,
    `${branding.platformName} order update: ${order.reference} ${content.subject}`,
    html
  );

  if (!emailResult?.ok) {
    throw new Error(emailResult?.error?.message || emailResult?.reason || 'Email not sent')
  }

  return { skipped: false };
}

module.exports = {
  sendShopOrderStatusEmail,
};
