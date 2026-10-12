const crypto = require('crypto');

const COOKIE_NAME = 'karvo_admin_session';
const DAY = 24 * 60 * 60;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.OTP_SECRET || 'karvo-admin-session-secret';
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || '';
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function makeToken() {
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    exp: Date.now() + 7 * DAY * 1000,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers?.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf('=');
      if (index === -1) return [part, ''];
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }));
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.role === 'admin' && Number(data.exp || 0) > Date.now();
  } catch {
    return false;
  }
}

function isAdmin(req) {
  return verifyToken(parseCookies(req)[COOKIE_NAME]);
}

function setAdminCookie(res, token) {
  res.setHeader('set-cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * DAY}`);
}

function clearAdminCookie(res) {
  res.setHeader('set-cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  json(res, 401, { error: 'Admin login required' });
  return false;
}

module.exports = {
  adminPassword,
  clearAdminCookie,
  isAdmin,
  json,
  makeToken,
  requireAdmin,
  setAdminCookie,
};
