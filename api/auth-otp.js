const crypto = require('crypto');

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
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function indianMobile(phone) {
  return String(phone || '').replace(/\D/g, '').replace(/^91/, '');
}

function isOkParKenResponse(text) {
  const value = String(text || '').trim();
  const errorCodes = new Set(['101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113']);
  return /^\d+$/.test(value) && !errorCodes.has(value);
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(payload) {
  const secret = process.env.OTP_SECRET || 'karvo-local-otp-secret';
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function makeToken(phone, otp, expiresAt) {
  const otpHash = sign(`${phone}:${otp}:${expiresAt}`);
  const payload = JSON.stringify({ phone, expiresAt, otpHash });
  const encoded = base64url(payload);
  return `${encoded}.${sign(encoded)}`;
}

function readToken(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature || sign(encoded) !== signature) return null;
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function sendViaCustomOtpApi(phone, otp, message) {
  const url = process.env.OTP_API_URL || process.env.SMS_API_URL;
  if (!url) return null;
  const headers = { 'content-type': 'application/json' };
  const key = process.env.OTP_API_KEY || process.env.SMS_API_KEY;
  if (key) headers.authorization = `Bearer ${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ to: phone, otp, message }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function sendViaFast2Sms(phone, message) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) return null;
  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      route: process.env.FAST2SMS_ROUTE || 'q',
      message,
      numbers: indianMobile(phone),
      sms_details: '1',
    }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function sendViaParKen(phone, message) {
  const apiKey = process.env.OTP_PARKEN_API_KEY || process.env.PARKEN_API_KEY;
  if (!apiKey) return null;
  const params = new URLSearchParams({
    key: apiKey,
    route: process.env.OTP_PARKEN_ROUTE || process.env.PARKEN_OTP_ROUTE || process.env.PARKEN_ROUTE || '4',
    type: process.env.PARKEN_TYPE || '1',
    sender: process.env.OTP_PARKEN_SENDER || process.env.PARKEN_SENDER || 'IMSTRG',
    number: indianMobile(phone),
    sms: String(message || '').replace(/[^\x20-\x7E]/g, '').slice(0, 155),
  });
  const templateId = process.env.OTP_PARKEN_TEMPLATE_ID || process.env.PARKEN_OTP_TEMPLATE_ID || process.env.PARKEN_TEMPLATE_ID;
  if (templateId) params.set('templateid', templateId);

  const response = await fetch(`https://sms.par-ken.com/api/smsapi?${params.toString()}`);
  const text = await response.text();
  const ok = response.ok && isOkParKenResponse(text);
  return {
    response: { ok, status: ok ? response.status : 502 },
    data: { provider: 'parken', result: text.trim() },
  };
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

  const action = clean(body.action, 20);
  const phone = normalizePhone(body.phone);
  if (!/^91[6-9]\d{9}$/.test(phone)) return json(res, 400, { error: 'Enter a valid Indian mobile number' });

  if (action === 'send') {
    const otp = String(crypto.randomInt(100000, 1000000));
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const token = makeToken(phone, otp, expiresAt);
    const message = `Your KARVO verification OTP is ${otp}. It is valid for 5 minutes. Do not share this code.`;
    const result = (await sendViaCustomOtpApi(phone, otp, message)) || (await sendViaParKen(phone, message)) || (await sendViaFast2Sms(phone, message));
    if (!result) {
      return json(res, 500, {
        error: 'OTP sender is not configured',
        setup: 'Set PARKEN_API_KEY, FAST2SMS_API_KEY, OTP_API_URL, or SMS_API_URL in Vercel.',
      });
    }
    if (!result.response.ok) return json(res, result.response.status || 502, { error: 'Unable to send OTP', details: result.data });
    return json(res, 200, { ok: true, otpToken: token, expiresInSeconds: 300 });
  }

  if (action === 'verify') {
    const otp = clean(body.otp, 10).replace(/\D/g, '');
    const token = readToken(body.otpToken);
    if (!token || token.phone !== phone || Date.now() > Number(token.expiresAt || 0)) {
      return json(res, 400, { error: 'OTP expired. Please request a new OTP.' });
    }
    if (token.otpHash !== sign(`${phone}:${otp}:${token.expiresAt}`)) {
      return json(res, 400, { error: 'Incorrect OTP' });
    }
    return json(res, 200, { ok: true, verifiedPhone: phone });
  }

  return json(res, 400, { error: 'Invalid OTP action' });
};
