// Migration to SQLite using system sqlite3 CLI where possible to avoid native
// module builds. This script will generate backend/data/db.sqlite from the
// frontend db.json file.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SRC = path.resolve(__dirname, '../frontend/src/assets/database/db.json');
const OUTDIR = path.resolve(__dirname, 'data');
const OUT = path.join(OUTDIR, 'db.sqlite');

if (!fs.existsSync(SRC)) {
  console.error('[migrate] source db.json not found at', SRC);
  process.exit(1);
}

if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });

const raw = fs.readFileSync(SRC, 'utf8');
const parsed = JSON.parse(raw);

// Always seed the backend JSON fallback so api-server has data even without better-sqlite3
try {
  const fallback = {
    booksData: parsed.booksData || [],
    users: parsed.users || [],
    categories: parsed.categories || [],
    carts: parsed.carts || [],
    booksVersion: Date.now()
  };
  const jsonOut = path.join(OUTDIR, 'db.json');
  fs.writeFileSync(jsonOut, JSON.stringify(fallback, null, 2), 'utf8');
  console.log('[migrate] wrote JSON fallback to', jsonOut);
} catch (e) {
  console.warn('[migrate] warning: failed to write JSON fallback:', e && e.message);
}

// Try to find sqlite3 CLI
const which = spawnSync('which', ['sqlite3']);
if (which.status === 0) {
  console.log('[migrate] sqlite3 CLI found, using it to create DB');
  // create DB file and run SQL commands
  const initSql = [];
  initSql.push('PRAGMA journal_mode = WAL;');
  // meta key/value table for app-wide metadata (e.g., books_version)
  initSql.push('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);');
  initSql.push('CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, name TEXT, author TEXT, price REAL, image_url TEXT, pdf_url TEXT, out_of_stock INTEGER DEFAULT 0);');
  initSql.push('CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT);');
  initSql.push('CREATE TABLE IF NOT EXISTS book_categories (book_id TEXT, category_id TEXT);');
  initSql.push('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, password TEXT, address TEXT);');
  initSql.push('CREATE TABLE IF NOT EXISTS cart_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, book_id TEXT, quantity INTEGER DEFAULT 1, added_at TEXT);');
  initSql.push('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, ack TEXT, user_id TEXT, phone TEXT, address TEXT, total REAL, items TEXT, created_at TEXT);');
  for (const b of parsed.booksData || []) {
    const id = String(b.id || b.name).replace(/'/g, "''");
    const name = (b.name || '').replace(/'/g, "''");
    const author = (b.author || '').replace(/'/g, "''");
    const price = b.price || 0;
    const image_url = (b.image_url || '').replace(/'/g, "''");
    const pdf_url = (b.pdf_url || '').replace(/'/g, "''");
    const out = b.out_of_stock ? 1 : 0;
    initSql.push(`INSERT OR REPLACE INTO books (id,name,author,price,image_url,pdf_url,out_of_stock) VALUES ('${id}','${name}','${author}',${price},'${image_url}','${pdf_url}',${out});`);
    // seed book-category mappings if source has categories array
    const cats = Array.isArray(b.categories) ? b.categories : [];
    for (const c of cats) {
      const cid = String(c).replace(/'/g, "''");
      initSql.push(`INSERT INTO book_categories (book_id, category_id) VALUES ('${id}', '${cid}');`);
    }
  }
  for (const c of parsed.categories || []) {
    const id = String(c.id || c.name).replace(/'/g, "''");
    const name = (c.name || '').replace(/'/g, "''");
    initSql.push(`INSERT OR REPLACE INTO categories (id,name) VALUES ('${id}','${name}');`);
  }
  for (const u of parsed.users || []) {
    const id = String(u.id || ('u-' + Date.now())).replace(/'/g, "''");
    const name = (u.name || '').replace(/'/g, "''");
    const email = (u.email || '').replace(/'/g, "''");
    const phone = (u.phone || '').replace(/'/g, "''");
    const password = (u.password || '').replace(/'/g, "''");
    const address = (u.address || '').replace(/'/g, "''");
    initSql.push(`INSERT OR REPLACE INTO users (id,name,email,phone,password,address) VALUES ('${id}','${name}','${email}','${phone}','${password}','${address}');`);
  }
  // migrate any existing carts in the JSON (expected shape: { carts: [ { userId, items: [{bookId,quantity,added_at}] } ] })
  for (const cart of parsed.carts || []) {
    const userId = String(cart.userId || '').replace(/'/g, "''");
    for (const it of cart.items || []) {
      const bookId = String(it.bookId || '').replace(/'/g, "''");
      const qty = Number(it.quantity || 1);
      const added = (it.added_at || new Date().toISOString()).replace(/'/g, "''");
      initSql.push(`INSERT INTO cart_items (user_id,book_id,quantity,added_at) VALUES ('${userId}','${bookId}',${qty},'${added}');`);
    }
  }
  const sql = initSql.join('\n');
  // Write to temp SQL file and feed to sqlite3
  const tmpSql = path.join(OUTDIR, 'init.sql');
  // Seed an initial books_version value as current timestamp
  const seeded = sql + "\n" + `INSERT OR REPLACE INTO meta (key, value) VALUES ('books_version', '${Date.now()}');` + "\n";
  fs.writeFileSync(tmpSql, seeded, 'utf8');
  const res = spawnSync('sqlite3', [OUT, '.read ' + tmpSql], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error('[migrate] sqlite3 CLI failed');
    process.exit(1);
  }
  fs.unlinkSync(tmpSql);
  console.log('[migrate] migration complete. SQLite DB written to', OUT);
  process.exit(0);
} else {
  console.warn('[migrate] sqlite3 CLI not found; creating minimal sqlite file fallback');
  // Fallback: write a small JSON-backed sqlite using a minimal approach
  try {
    const outObj = { migrated_at: new Date().toISOString(), books: parsed.booksData || [], users: parsed.users || [] };
    fs.writeFileSync(OUT + '.json', JSON.stringify(outObj, null, 2), 'utf8');
    console.log('[migrate] wrote fallback JSON to', OUT + '.json');
    process.exit(0);
  } catch (e) {
    console.error('[migrate] failed to write fallback', e);
    process.exit(1);
  }
}
