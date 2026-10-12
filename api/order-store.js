const fs = require('fs/promises');
const path = require('path');

const BLOB_NAME = 'karvo-orders.json';
const LOCAL_FILE = path.join('/tmp', BLOB_NAME);

function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function blobRequest(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      ...(options.headers || {}),
    },
  });
}

async function readBlobOrders() {
  const listUrl = `https://blob.vercel-storage.com/?prefix=${encodeURIComponent(BLOB_NAME)}&limit=1`;
  const list = await blobRequest(listUrl);
  if (!list.ok) throw new Error(`Blob list failed (${list.status})`);
  const data = await list.json();
  const item = Array.isArray(data.blobs) ? data.blobs.find((x) => x.pathname === BLOB_NAME) : null;
  if (!item?.url) return [];
  const file = await fetch(item.url, { cache: 'no-store' });
  if (!file.ok) throw new Error(`Blob read failed (${file.status})`);
  return file.json();
}

async function writeBlobOrders(orders) {
  const putUrl = `https://blob.vercel-storage.com/${encodeURIComponent(BLOB_NAME)}?addRandomSuffix=false&allowOverwrite=true&access=private`;
  const response = await blobRequest(putUrl, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(orders, null, 2),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Blob write failed (${response.status}) ${text}`.trim());
  }
}

async function readLocalOrders() {
  try {
    return JSON.parse(await fs.readFile(LOCAL_FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function writeLocalOrders(orders) {
  await fs.writeFile(LOCAL_FILE, JSON.stringify(orders, null, 2));
}

async function readOrders() {
  const orders = hasBlob() ? await readBlobOrders() : await readLocalOrders();
  return Array.isArray(orders) ? orders : [];
}

async function writeOrders(orders) {
  if (hasBlob()) return writeBlobOrders(orders);
  return writeLocalOrders(orders);
}

function cleanOrder(order) {
  const src = order || {};
  return {
    id: String(src.id || `KV-${Date.now()}`),
    createdAt: src.createdAt || new Date().toISOString(),
    created: src.created || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    type: src.message || 'Order',
    name: String(src.name || 'Customer').slice(0, 120),
    phone: String(src.phone || '').slice(0, 20),
    email: String(src.email || '').slice(0, 160),
    city: String(src.city || '').slice(0, 180),
    address: String(src.address || '').slice(0, 500),
    paymentMethod: String(src.paymentMethod || '').slice(0, 120),
    paymentStatus: String(src.paymentStatus || '').slice(0, 160),
    subtotal: Number(src.subtotal || 0),
    deliveryFee: Number(src.deliveryFee || 0),
    orderTotal: Number(src.orderTotal || 0),
    items: Array.isArray(src.items) ? src.items.slice(0, 60).map((x) => String(x).slice(0, 220)) : [],
    details: Array.isArray(src.details) ? src.details.slice(0, 60).map((x) => String(x).slice(0, 260)) : [],
    cartItems: Array.isArray(src.cartItems)
      ? src.cartItems.slice(0, 60).map((x) => ({
          name: String(x.name || '').slice(0, 160),
          brand: String(x.brand || '').slice(0, 80),
          variant: String(x.variant || '').slice(0, 120),
          qty: Number(x.qty || 1),
          price: Number(x.price || 0),
          spec: String(x.spec || '').slice(0, 240),
        }))
      : [],
  };
}

async function saveOrder(order, notificationResults = {}) {
  const safe = {
    ...cleanOrder(order),
    notificationResults,
    updatedAt: new Date().toISOString(),
  };
  const orders = await readOrders();
  const next = [safe, ...orders.filter((x) => x.id !== safe.id)].slice(0, 500);
  await writeOrders(next);
  return safe;
}

module.exports = {
  hasBlob,
  readOrders,
  saveOrder,
};
