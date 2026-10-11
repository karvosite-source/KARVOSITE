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
  try {
    const result = (await sendViaCustomApi(message, order)) || (await sendViaCloudApi(message));
    if (!result) {
      return json(res, 500, {
        error: 'WhatsApp API is not configured',
        setup: 'Set WHATSAPP_API_URL and optional WHATSAPP_API_KEY, or set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TO in Vercel environment variables.',
      });
    }
    if (!result.response.ok) {
      return json(res, result.response.status || 502, {
        error: 'Unable to send WhatsApp message',
        details: result.data,
      });
    }
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 502, { error: 'WhatsApp send failed', details: err.message });
  }
};
