const {
  adminPassword,
  clearAdminCookie,
  isAdmin,
  json,
  makeToken,
  setAdminCookie,
} = require('./admin-auth-lib');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      loggedIn: isAdmin(req),
      configured: Boolean(adminPassword()),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  if (body.action === 'logout') {
    clearAdminCookie(res);
    return json(res, 200, { ok: true });
  }

  const expected = adminPassword();
  if (!expected) {
    return json(res, 503, {
      error: 'Admin password is not configured',
      setup: 'Set ADMIN_PASSWORD in Vercel environment variables.',
    });
  }

  if (String(body.password || '') !== expected) {
    return json(res, 401, { error: 'Invalid admin password' });
  }

  setAdminCookie(res, makeToken());
  return json(res, 200, { ok: true });
};
