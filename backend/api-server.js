// Minimal backend API to serve booksData and users from frontend's db.json
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
let Database = null;
try { Database = require('better-sqlite3'); } catch (e) { /* not installed yet */ }

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Keep the JSON fallback DB inside the backend to avoid touching frontend/src during writes
const DB_PATH = path.resolve(__dirname, 'data', 'db.json');
// ensure directory exists
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
// initialize file if missing
if (!fs.existsSync(DB_PATH)) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify({ booksData: [], users: [], categories: [], carts: [] }, null, 2), 'utf8');
    console.log('[api-server] created fallback json DB at', DB_PATH);
  } catch (e) { console.error('[api-server] failed to create fallback DB', e); }
}
const SQLITE_PATH = path.resolve(__dirname, 'data', 'db.sqlite');

let useSqlite = false;
if (fs.existsSync(SQLITE_PATH) && Database) useSqlite = true;

let sqliteDb = null;
if (useSqlite) {
  sqliteDb = new Database(SQLITE_PATH, { readonly: false });
  console.log('[api-server] using sqlite at', SQLITE_PATH);
} else {
  console.log('[api-server] using json DB at', DB_PATH);
}

// Ensure users table has a settings column for storing JSON settings
if (useSqlite) {
  try {
    // Try to add settings column if it doesn't exist (will fail harmlessly if exists)
    sqliteDb.prepare('ALTER TABLE users ADD COLUMN settings TEXT').run();
  } catch (e) {
    // ignore error (column probably exists)
  }
  try {
    // Ensure meta table exists (key/value store), for things like books versioning
    sqliteDb.prepare('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)').run();
    // Initialize books_version if missing
    const has = sqliteDb.prepare('SELECT value FROM meta WHERE key = ?').get('books_version');
    if (!has) {
      sqliteDb.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('books_version', String(Date.now()));
    }
  } catch (e) {
    console.error('[api-server] failed to ensure meta table', e);
  }
  try {
    // Ensure orders table exists
    sqliteDb.prepare(
      'CREATE TABLE IF NOT EXISTS orders (' +
      'id TEXT PRIMARY KEY, ' +
      'ack TEXT, ' +
      'user_id TEXT, ' +
      'phone TEXT, ' +
      'address TEXT, ' +
      'total REAL, ' +
      'items TEXT, ' +
      'created_at TEXT' +
      ')'
    ).run();
  } catch (e) {
    console.error('[api-server] failed to ensure orders table', e);
  }
  try {
    // Ensure book_categories join table exists (book_id, category_id)
    sqliteDb.prepare('CREATE TABLE IF NOT EXISTS book_categories (book_id TEXT, category_id TEXT)').run();
    // Backfill if empty from JSON fallback (if available)
    const row = sqliteDb.prepare('SELECT COUNT(1) as c FROM book_categories').get();
    const count = Number((row && row.c) || 0);
    if (count === 0 && fs.existsSync(DB_PATH)) {
      try {
        const j = readDB();
        const books = Array.isArray(j.booksData) ? j.booksData : [];
        const insert = sqliteDb.prepare('INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)');
        sqliteDb.transaction(() => {
          for (const b of books) {
            const bid = String(b.id || '');
            const cats = Array.isArray(b.categories) ? b.categories : [];
            for (const c of cats) insert.run(bid, String(c));
          }
        })();
        console.log('[api-server] backfilled book_categories from JSON fallback');
      } catch (e) {
        console.warn('[api-server] failed to backfill book_categories', e && e.message);
      }
    }
  } catch (e) {
    console.error('[api-server] failed to ensure book_categories table', e);
  }
}

function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('[api-server] failed to read DB', e);
    return { booksData: [], users: [], categories: [] };
  }
}

function writeDB(obj) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(obj, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[api-server] failed to write DB', e);
    return false;
  }
}

// ---------------- Version helpers (booksVersion) ----------------
function getBooksVersion() {
  if (useSqlite) {
    try {
      const row = sqliteDb.prepare('SELECT value FROM meta WHERE key = ?').get('books_version');
      const v = row && row.value ? Number(row.value) : 0;
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch {
      return 0;
    }
  }
  const db = readDB();
  const v = Number((db && db.booksVersion) || 0);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function setBooksVersion(v) {
  if (useSqlite) {
    try {
      sqliteDb.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('books_version', String(v));
    } catch (e) {
      try { sqliteDb.prepare('UPDATE meta SET value = ? WHERE key = ?').run(String(v), 'books_version'); } catch (e2) {}
    }
    return;
  }
  const db = readDB();
  db.booksVersion = v;
  writeDB(db);
}

function bumpBooksVersion() {
  const now = Date.now();
  // Use timestamp for monotonic versioning
  setBooksVersion(now);
  return now;
}

// Helper to get books with categories in SQLite, optionally filtered by category ids
function getBooksWithCategoriesSQLite(filterCategoryIds = []) {
  // If join table is missing, fall back to returning books with empty categories (older DBs)
  try { sqliteDb.prepare('SELECT 1 FROM book_categories LIMIT 1').get(); } catch { 
    const rows = sqliteDb.prepare('SELECT * FROM books').all();
    return rows.map(r => ({ ...r, out_of_stock: !!r.out_of_stock, categories: [] }));
  }

  const hasFilter = Array.isArray(filterCategoryIds) && filterCategoryIds.length > 0;
  let rows;
  if (hasFilter) {
    const ids = filterCategoryIds.map(String);
    const placeholders = ids.map(() => '?').join(',');
    const sql = `
      SELECT b.*, GROUP_CONCAT(bc.category_id) AS cats
      FROM books b
      JOIN book_categories bc ON bc.book_id = b.id
      WHERE bc.category_id IN (${placeholders})
      GROUP BY b.id
    `;
    rows = sqliteDb.prepare(sql).all(...ids);
  } else {
    const sql = `
      SELECT b.*, GROUP_CONCAT(bc.category_id) AS cats
      FROM books b
      LEFT JOIN book_categories bc ON bc.book_id = b.id
      GROUP BY b.id
    `;
    rows = sqliteDb.prepare(sql).all();
  }

  return rows.map(r => {
    const catsStr = r.cats || '';
    const cats = typeof catsStr === 'string' && catsStr.length
      ? Array.from(new Set(catsStr.split(',').map(n => Number(n)).filter(n => Number.isFinite(n))))
      : [];
    const { cats: _omit, ...rest } = r;
    return { ...rest, out_of_stock: !!rest.out_of_stock, categories: cats };
  });
}

// Books endpoints
app.get('/booksData', (req, res) => {
  const q = String(req.query.category || '').trim();
  const hasFilter = q.length > 0;
  const ids = hasFilter ? q.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (useSqlite) {
    try {
      const books = getBooksWithCategoriesSQLite(ids);
      return res.json(books);
    } catch (e) {
      console.error('[api-server] failed to get books with categories', e);
      return res.status(500).json({ error: 'failed to fetch books' });
    }
  }
  const db = readDB();
  let arr = db.booksData || [];
  if (hasFilter) {
    const idSet = new Set(ids.map(String));
    arr = arr.filter(b => Array.isArray(b.categories) && b.categories.some((c) => idSet.has(String(c))));
  }
  return res.json(arr);
});

app.get('/booksData/:id', (req, res) => {
  if (useSqlite) {
    const b = sqliteDb.prepare('SELECT * FROM books WHERE id = ?').get(String(req.params.id));
    if (!b) return res.status(404).json({ error: 'not found' });
    // attach categories for this book
    let cats = [];
    try {
      const rows = sqliteDb.prepare('SELECT category_id FROM book_categories WHERE book_id = ?').all(String(req.params.id));
      cats = rows.map(r => Number(r.category_id)).filter(n => Number.isFinite(n));
    } catch {}
    return res.json({ ...b, out_of_stock: !!b.out_of_stock, categories: cats });
  }
  const db = readDB();
  const b = (db.booksData || []).find(x => String(x.id) === String(req.params.id));
  if (!b) return res.status(404).json({ error: 'not found' });
  res.json(b);
});

app.patch('/booksData/:id', (req, res) => {
  if (useSqlite) {
    // update allowed fields
    const fields = [];
    const params = [];
    for (const k of ['name','author','price','image_url','pdf_url','out_of_stock']) {
      if (typeof req.body[k] !== 'undefined') {
        fields.push(`${k} = ?`);
        params.push(k === 'out_of_stock' ? (req.body[k] ? 1 : 0) : req.body[k]);
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'no valid fields' });
    params.push(String(req.params.id));
    const sql = `UPDATE books SET ${fields.join(', ')} WHERE id = ?`;
    const info = sqliteDb.prepare(sql).run(params);
    if (info.changes === 0) return res.status(404).json({ error: 'not found' });
    // bump version after a successful update
    bumpBooksVersion();
    const b = sqliteDb.prepare('SELECT * FROM books WHERE id = ?').get(String(req.params.id));
    // attach categories
    let cats = [];
    try { const rows = sqliteDb.prepare('SELECT category_id FROM book_categories WHERE book_id = ?').all(String(req.params.id)); cats = rows.map(r => Number(r.category_id)).filter(n => Number.isFinite(n)); } catch {}
    return res.json({ ...b, out_of_stock: !!b.out_of_stock, categories: cats });
  }
  const db = readDB();
  const idx = (db.booksData || []).findIndex(x => String(x.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const item = db.booksData[idx];
  const changed = Object.assign({}, item, req.body);
  db.booksData[idx] = changed;
  // bump version for JSON fallback
  db.booksVersion = Date.now();
  const ok = writeDB(db);
  if (!ok) return res.status(500).json({ error: 'failed to persist' });
  res.json(changed);
});

// Lightweight endpoint for clients to verify if their cached books are up-to-date
app.get('/booksVersion', (req, res) => {
  return res.json({ booksVersion: getBooksVersion() });
});

// Categories endpoints
app.get('/categories', (req, res) => {
  if (useSqlite) {
    const rows = sqliteDb.prepare('SELECT * FROM categories').all();
    return res.json(rows);
  }
  const db = readDB();
  res.json(db.categories || []);
});

app.get('/categories/:id', (req, res) => {
  if (useSqlite) {
    const row = sqliteDb.prepare('SELECT * FROM categories WHERE id = ?').get(String(req.params.id));
    if (!row) return res.status(404).json({ error: 'not found' });
    return res.json(row);
  }
  const db = readDB();
  const c = (db.categories || []).find(x => String(x.id) === String(req.params.id));
  if (!c) return res.status(404).json({ error: 'not found' });
  res.json(c);
});

// Users endpoints (basic compatibility with frontend expectations)
app.get('/users', (req, res) => {
  if (useSqlite) {
    let arr = sqliteDb.prepare('SELECT * FROM users').all();
    const qKeys = Object.keys(req.query || {});
    if (qKeys.length) {
      arr = arr.filter(u => qKeys.every(k => String(u[k] || '') === String(req.query[k] || '')));
    }
    return res.json(arr);
  }
  const db = readDB();
  let arr = db.users || [];
  // support simple query params like ?phone=xxxx or ?email=yyy
  const qKeys = Object.keys(req.query || {});
  if (qKeys.length) {
    arr = arr.filter(u => {
      return qKeys.every(k => {
        const v = req.query[k];
        if (typeof u[k] === 'undefined') return false;
        return String(u[k]) === String(v);
      });
    });
  }
  res.json(arr);
});

app.post('/users', (req, res) => {
  const payload = req.body || {};
  if (useSqlite) {
    if (!payload.id) payload.id = 'u-' + Date.now();
    sqliteDb.prepare('INSERT INTO users (id, name, email, phone, password, address) VALUES (?, ?, ?, ?, ?, ?)').run(payload.id, payload.name || '', payload.email || '', payload.phone || '', payload.password || '', payload.address || '');
    const u = sqliteDb.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    return res.status(201).json(u);
  }
  const db = readDB();
  const users = db.users || [];
  // assign local id if not present
  if (!payload.id) payload.id = 'u-' + Date.now();
  users.push(payload);
  db.users = users;
  const ok = writeDB(db);
  if (!ok) return res.status(500).json({ error: 'failed to persist' });
  res.status(201).json(payload);
});

app.patch('/users/:id', (req, res) => {
  if (useSqlite) {
    const id = String(req.params.id);
    const keys = Object.keys(req.body || {});
    if (!keys.length) return res.status(400).json({ error: 'no fields' });
    const fields = keys.map(k => `${k} = ?`).join(', ');
    const params = keys.map(k => req.body[k]);
    params.push(id);
    const sql = `UPDATE users SET ${fields} WHERE id = ?`;
    const info = sqliteDb.prepare(sql).run(params);
    if (info.changes === 0) return res.status(404).json({ error: 'not found' });
    const u = sqliteDb.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return res.json(u);
  }
  const db = readDB();
  const idx = (db.users || []).findIndex(u => String(u.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const user = Object.assign({}, db.users[idx], req.body);
  db.users[idx] = user;
  const ok = writeDB(db);
  if (!ok) return res.status(500).json({ error: 'failed to persist' });
  res.json(user);
});

// User settings endpoints: GET/POST -> store arbitrary JSON per user
app.get('/users/:id/settings', (req, res) => {
  const id = String(req.params.id);
  if (useSqlite) {
    const row = sqliteDb.prepare('SELECT settings FROM users WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'not found' });
    try { return res.json(JSON.parse(row.settings || '{}')); } catch (e) { return res.json({}); }
  }
  const db = readDB();
  const u = (db.users || []).find(x => String(x.id) === id);
  if (!u) return res.status(404).json({ error: 'not found' });
  return res.json(u.settings || {});
});

app.post('/users/:id/settings', (req, res) => {
  const id = String(req.params.id);
  const payload = req.body || {};
  if (useSqlite) {
    // read existing settings
    const row = sqliteDb.prepare('SELECT settings FROM users WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'not found' });
    let settings = {};
    try { settings = JSON.parse(row.settings || '{}'); } catch (e) { settings = {}; }
    // merge
    settings = Object.assign({}, settings, payload);
    sqliteDb.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(settings), id);
    return res.json(settings);
  }
  const db = readDB();
  const idx = (db.users || []).findIndex(x => String(x.id) === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const user = db.users[idx];
  user.settings = Object.assign({}, user.settings || {}, payload);
  db.users[idx] = user;
  const ok = writeDB(db);
  if (!ok) return res.status(500).json({ error: 'failed to persist' });
  res.json(user.settings);
});

// Cart endpoints: persist per-user cart items
// GET /cart/:userId -> list items
app.get('/cart/:userId', (req, res) => {
  const userId = String(req.params.userId);
  if (useSqlite) {
    const rows = sqliteDb.prepare('SELECT id, user_id as userId, book_id as bookId, quantity, added_at as addedAt FROM cart_items WHERE user_id = ?').all(userId);
    return res.json(rows);
  }
  const db = readDB();
  const carts = db.carts || [];
  const cart = carts.find(c => String(c.userId) === userId);
  res.json((cart && cart.items) || []);
});

// POST /cart/:userId  body: { bookId, quantity }
app.post('/cart/:userId', (req, res) => {
  const userId = String(req.params.userId);
  const { bookId, quantity } = req.body || {};
  if (!bookId) return res.status(400).json({ error: 'bookId required' });
  const qty = Number(quantity || 1);
  const now = new Date().toISOString();
  if (useSqlite) {
    // enforce out-of-stock server-side
    try {
      const row = sqliteDb.prepare('SELECT out_of_stock FROM books WHERE id = ?').get(String(bookId));
      if (row && Number(row.out_of_stock) === 1) {
        return res.status(409).json({ error: 'out_of_stock' });
      }
    } catch (e) { /* ignore lookup error and proceed */ }
    // if exists, update quantity; else insert
    const existing = sqliteDb.prepare('SELECT id,quantity FROM cart_items WHERE user_id = ? AND book_id = ?').get(userId, String(bookId));
    if (existing) {
      const newQty = existing.quantity + qty;
      sqliteDb.prepare('UPDATE cart_items SET quantity = ?, added_at = ? WHERE id = ?').run(newQty, now, existing.id);
      const row = sqliteDb.prepare('SELECT id, user_id as userId, book_id as bookId, quantity, added_at as addedAt FROM cart_items WHERE id = ?').get(existing.id);
      return res.json(row);
    }
    const info = sqliteDb.prepare('INSERT INTO cart_items (user_id,book_id,quantity,added_at) VALUES (?, ?, ?, ?)').run(userId, String(bookId), qty, now);
    const row = sqliteDb.prepare('SELECT id, user_id as userId, book_id as bookId, quantity, added_at as addedAt FROM cart_items WHERE id = ?').get(info.lastInsertRowid);
    return res.status(201).json(row);
  }
  const db = readDB();
  // JSON fallback enforcement: check booksData
  try {
    const b = (db.booksData || []).find(x => String(x.id) === String(bookId));
    if (b && (b.out_of_stock === true || b.out_of_stock === 1 || String(b.out_of_stock) === 'true')) {
      return res.status(409).json({ error: 'out_of_stock' });
    }
  } catch (e) {}
  const carts = db.carts || [];
  let cart = carts.find(c => String(c.userId) === userId);
  if (!cart) {
    cart = { userId, items: [] };
    carts.push(cart);
  }
  const item = cart.items.find(i => String(i.bookId) === String(bookId));
  if (item) item.quantity = (item.quantity || 0) + qty;
  else cart.items.push({ id: 'ci-' + Date.now(), bookId: String(bookId), quantity: qty, added_at: now });
  db.carts = carts;
  const ok = writeDB(db);
  if (!ok) return res.status(500).json({ error: 'failed to persist' });
  res.status(201).json(cart.items);
});

// DELETE /cart/:userId/:itemId  to remove a cart item by row id (sqlite) or item id (json)
app.delete('/cart/:userId/:itemId', (req, res) => {
  const userId = String(req.params.userId);
  const itemId = String(req.params.itemId);
  if (useSqlite) {
    const info = sqliteDb.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(itemId, userId);
    if (info.changes === 0) return res.status(404).json({ error: 'not found' });
    return res.json({ deleted: true });
  }
  const db = readDB();
  const carts = db.carts || [];
  const cart = carts.find(c => String(c.userId) === userId);
  if (!cart) return res.status(404).json({ error: 'not found' });
  const idx = (cart.items || []).findIndex(i => String(i.id) === itemId || String(i.bookId) === itemId);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  cart.items.splice(idx, 1);
  db.carts = carts;
  const ok = writeDB(db);
  if (!ok) return res.status(500).json({ error: 'failed to persist' });
  res.json({ deleted: true });
});

// ---------------- Orders endpoints ----------------
// POST /orders -> create a new order and clear user's cart
app.post('/orders', (req, res) => {
  const payload = req.body || {};
  const userId = String(payload.userId || '').trim();
  const items = Array.isArray(payload.items) ? payload.items : [];
  const address = String(payload.address || '');
  const phone = String(payload.phone || '');
  const total = Number(payload.total || 0);
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (!items.length) return res.status(400).json({ error: 'items required' });
  const now = new Date().toISOString();
  const id = 'ORD' + Date.now();
  const ack = 'ACK' + Math.floor(Math.random() * 900000 + 100000);
  if (useSqlite) {
    try {
      sqliteDb.prepare('INSERT INTO orders (id, ack, user_id, phone, address, total, items, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, ack, userId, phone, address, total, JSON.stringify(items), now);
      // Clear cart for this user
      sqliteDb.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
      return res.status(201).json({ orderId: id, ack, phone, address, items, total, created_at: now });
    } catch (e) {
      console.error('[api-server] failed to create order', e);
      return res.status(500).json({ error: 'failed to create order' });
    }
  }
  const db = readDB();
  if (!db.orders) db.orders = [];
  const order = { id, ack, userId, phone, address, total, items, created_at: now };
  db.orders.push(order);
  // clear cart in json fallback
  const carts = db.carts || [];
  const cart = carts.find(c => String(c.userId) === userId);
  if (cart) cart.items = [];
  db.carts = carts;
  const ok = writeDB(db);
  if (!ok) return res.status(500).json({ error: 'failed to persist' });
  return res.status(201).json({ orderId: id, ack, phone, address, items, total, created_at: now });
});

// GET /orders/user/:userId -> list orders for a user
app.get('/orders/user/:userId', (req, res) => {
  const userId = String(req.params.userId);
  if (useSqlite) {
    const rows = sqliteDb.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    const out = rows.map(r => ({ orderId: r.id, ack: r.ack, phone: r.phone, address: r.address, items: safeParseJson(r.items) || [], total: r.total, created_at: r.created_at }));
    return res.json(out);
  }
  const db = readDB();
  const arr = (db.orders || []).filter(o => String(o.userId) === userId).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const out = arr.map(o => ({ orderId: o.id, ack: o.ack, phone: o.phone, address: o.address, items: o.items || [], total: o.total, created_at: o.created_at }));
  res.json(out);
});

// GET /orders/:orderId -> fetch a single order
app.get('/orders/:orderId', (req, res) => {
  const orderId = String(req.params.orderId);
  if (useSqlite) {
    const r = sqliteDb.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!r) return res.status(404).json({ error: 'not found' });
    return res.json({ orderId: r.id, ack: r.ack, phone: r.phone, address: r.address, items: safeParseJson(r.items) || [], total: r.total, created_at: r.created_at });
  }
  const db = readDB();
  const o = (db.orders || []).find(x => String(x.id) === orderId);
  if (!o) return res.status(404).json({ error: 'not found' });
  return res.json({ orderId: o.id, ack: o.ack, phone: o.phone, address: o.address, items: o.items || [], total: o.total, created_at: o.created_at });
});

function safeParseJson(input) {
  try { return JSON.parse(input || '[]'); } catch { return []; }
}

const port = process.env.PORT || 8080;

// Print all known API endpoints so they appear in the console before the server starts listening
(() => {
  console.log('\n[api-server] Available API endpoints:');
  const list = [
    'GET  /booksData',
    'GET  /booksData/:id',
    'PATCH /booksData/:id',
    'GET  /booksVersion',
    'GET  /categories',
    'GET  /categories/:id',
    'GET  /users',
    'POST /users',
    'PATCH /users/:id',
    'GET  /cart/:userId',
    'POST /cart/:userId',
    'DELETE /cart/:userId/:itemId',
    'POST /orders',
    'GET  /orders/user/:userId',
    'GET  /orders/:orderId'
  ];
  for (const e of list) console.log('  ' + e);
  console.log('');
})();

app.listen(port, () => console.log(`[api-server] listening on http://localhost:${port}`));
