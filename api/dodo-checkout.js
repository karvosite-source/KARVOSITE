const LIVE_BASE = 'https://live.dodopayments.com';
const TEST_BASE = 'https://test.dodopayments.com';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function originFrom(req, fallback) {
  const raw = fallback || req.headers.origin || `https://${req.headers.host}`;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return `https://${req.headers.host}`;
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const productId = process.env.DODO_PAYMENTS_PRODUCT_ID;
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT || 'live_mode';
  if (!apiKey || !productId) {
    return json(res, 500, {
      error: 'Dodo Payments is not configured',
      setup: 'Set DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_PRODUCT_ID in Vercel environment variables.',
    });
  }

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }
  const amount = Math.round(Number(body.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000000) {
    return json(res, 400, { error: 'Invalid payment amount' });
  }

  const orderId = String(body.orderId || `KV-${Date.now()}`).slice(0, 80);
  const phone = String(body.phone || '').slice(0, 32);
  const name = String(body.name || 'KARVO Customer').slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 160);
  const address = String(body.address || '').slice(0, 500);
  const items = Array.isArray(body.items) ? body.items.slice(0, 25) : [];
  const origin = originFrom(req, body.origin);
  const base = environment === 'test_mode' ? TEST_BASE : LIVE_BASE;

  const payload = {
    product_cart: [
      {
        product_id: productId,
        quantity: 1,
        amount,
      },
    ],
    return_url: `${origin}/?payment=return&order_id=${encodeURIComponent(orderId)}`,
    cancel_url: `${origin}/?payment=cancel&order_id=${encodeURIComponent(orderId)}`,
    metadata: {
      order_id: orderId,
      phone,
      address,
      item_count: String(items.length),
      amount_paise: String(amount),
    },
    custom_fields: [
      {
        key: 'phone',
        label: 'Mobile number',
        field_type: 'text',
        required: true,
      },
      {
        key: 'delivery_area',
        label: 'Delivery area',
        field_type: 'text',
        required: false,
      },
    ],
    feature_flags: {
      allow_phone_number_collection: true,
      require_phone_number: true,
      allow_customer_editing_email: true,
      allow_customer_editing_name: true,
    },
    customization: {
      theme: 'light',
      show_order_details: true,
    },
  };
  if (email) payload.customer = { email, name };

  const upstream = await fetch(`${base}/checkouts`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !data.checkout_url) {
    return json(res, upstream.status || 502, {
      error: 'Unable to start Dodo checkout',
      details: data.error || data.message || data,
    });
  }

  return json(res, 200, {
    checkout_url: data.checkout_url,
    session_id: data.session_id,
    order_id: orderId,
  });
};
