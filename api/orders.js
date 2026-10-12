const { hasBlob, readOrders } = require('./order-store');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const orders = await readOrders();
    return json(res, 200, {
      ok: true,
      storage: hasBlob() ? 'vercel-blob' : 'temporary',
      setupRequired: !hasBlob(),
      orders,
    });
  } catch (err) {
    return json(res, 500, {
      error: 'Unable to read orders',
      details: err.message,
      setup: 'Set BLOB_READ_WRITE_TOKEN in Vercel for persistent admin order storage.',
    });
  }
};
