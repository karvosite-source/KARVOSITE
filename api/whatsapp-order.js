function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function clean(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function money(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 'Quote after review';
  return `Rs ${Math.round(n).toLocaleString('en-IN')}`;
}

function orderKind(order) {
  const cartItems = Array.isArray(order.cartItems) ? order.cartItems : [];
  if (!cartItems.length) return 'Booking';
  return cartItems.some((item) => Number(item.price || 0) <= 0) ? 'Service booking / quote request' : 'Product order';
}

function formatMessage(order, eventType) {
  const cartItems = Array.isArray(order.cartItems) ? order.cartItems.slice(0, 20) : [];
  const lines = [
    `New KARVO ${orderKind(order)}`,
    `Event: ${clean(eventType || order.paymentStatus || 'Order placed', 80)}`,
    `Booking ID: ${clean(order.id, 80)}`,
    `Name: ${clean(order.name || 'Customer', 120)}`,
    `Phone: ${clean(order.phone, 40) || 'Not provided'}`,
    `Location: ${clean(order.city || order.address, 240) || 'Not provided'}`,
    `Address: ${clean(order.address, 400) || 'Not provided'}`,
    `Payment: ${clean(order.paymentMethod, 120)} | ${clean(order.paymentStatus, 120)}`,
    `Item total: ${money(order.subtotal || order.orderTotal)}`,
    `Delivery fee: ${money(order.deliveryFee || 0)}`,
    `Total: ${money(order.orderTotal)}`,
    '',
    'Items:',
  ];

  if (cartItems.length) {
    cartItems.forEach((item, index) => {
      const qty = Number(item.qty || 1);
      const variant = item.variant ? ` (${clean(item.variant, 80)})` : '';
      const spec = item.spec ? ` - ${clean(item.spec, 220)}` : '';
      lines.push(`${index + 1}. ${clean(item.name, 120)}${variant} x ${qty}${spec}`);
    });
  } else if (Array.isArray(order.items)) {
    order.items.slice(0, 20).forEach((item, index) => lines.push(`${index + 1}. ${clean(item, 180)}`));
  } else {
    lines.push('No items found');
  }

  if (order.dodoPaymentId) lines.push(`Dodo payment ID: ${clean(order.dodoPaymentId, 120)}`);
  return lines.join('\n').slice(0, 3900);
}

async function sendViaCustomApi(message, order) {
  const url = process.env.WHATSAPP_API_URL;
  if (!url) return null;
  const headers = { 'content-type': 'application/json' };
  if (process.env.WHATSAPP_API_KEY) headers.authorization = `Bearer ${process.env.WHATSAPP_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: normalizePhone(process.env.WHATSAPP_TO || process.env.WHATSAPP_ADMIN_PHONE || '919166691274'),
      message,
      order,
    }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function sendViaCloudApi(message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = normalizePhone(process.env.WHATSAPP_TO || process.env.WHATSAPP_ADMIN_PHONE || '919166691274');
  if (!token || !phoneNumberId || !to) return null;
  const graphVersion = clean(process.env.WHATSAPP_GRAPH_VERSION || 'v25.0', 20);

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: message },
    }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function sendViaCustomEmailApi(subject, message, order) {
  const url = process.env.EMAIL_API_URL;
  if (!url) return null;
  const headers = { 'content-type': 'application/json' };
  if (process.env.EMAIL_API_KEY) headers.authorization = `Bearer ${process.env.EMAIL_API_KEY}`;
  const to = (process.env.ORDER_EMAIL_TO || process.env.SUPPORT_EMAIL || 'karvosite@gmail.com').split(',').map((x) => x.trim()).filter(Boolean);
  if (order.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(order.email))) to.push(String(order.email).trim());
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: [...new Set(to)],
      subject,
      text: message,
      order,
    }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function sendViaResend(subject, message, order) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const to = (process.env.ORDER_EMAIL_TO || process.env.SUPPORT_EMAIL || 'karvosite@gmail.com').split(',').map((x) => x.trim()).filter(Boolean);
  if (order.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(order.email))) to.push(String(order.email).trim());
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.ORDER_EMAIL_FROM || 'KARVO <orders@karvo.site>',
      to: [...new Set(to)],
      subject,
      text: message,
    }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function sendEmail(message, order) {
  const subject = `KARVO ${orderKind(order)} ${clean(order.id, 80)}`;
  return (await sendViaCustomEmailApi(subject, message, order)) || (await sendViaResend(subject, message, order));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  const order = body.order || {};
  if (!order.id) return json(res, 400, { error: 'Missing order details' });

  const message = formatMessage(order, body.eventType);
  const results = {};
  try {
    const whatsapp = (await sendViaCustomApi(message, order)) || (await sendViaCloudApi(message));
    if (whatsapp) {
      results.whatsapp = whatsapp.response.ok;
      if (!whatsapp.response.ok) results.whatsappDetails = whatsapp.data;
    }
    const email = await sendEmail(message, order);
    if (email) {
      results.email = email.response.ok;
      if (!email.response.ok) results.emailDetails = email.data;
    }
    if (!whatsapp && !email) {
      return json(res, 500, {
        error: 'Order notification APIs are not configured',
        setup: 'Set WhatsApp env vars and RESEND_API_KEY/ORDER_EMAIL_TO, or custom WHATSAPP_API_URL/EMAIL_API_URL.',
      });
    }
    if ((whatsapp && !whatsapp.response.ok) || (email && !email.response.ok)) return json(res, 502, { error: 'One or more notifications failed', results });
    return json(res, 200, { ok: true, results });
  } catch (err) {
    return json(res, 502, { error: 'Order notification failed', details: err.message });
  }
};
