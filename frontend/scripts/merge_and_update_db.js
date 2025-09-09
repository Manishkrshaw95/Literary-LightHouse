const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const mappingPath = path.join(repoRoot, 'src', 'assets', 'db_with_book_covers_url.json');
const dbPath = path.join(repoRoot, 'src', 'assets', 'database', 'db.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

function isoTimestamp() {
  return new Date().toISOString().replace(/:/g, '-');
}

try {
  const mapping = readJson(mappingPath);
  const db = readJson(dbPath);

  const map = new Map();
  (mapping.booksData || []).forEach(b => {
    if (b && b.name && b.image_url) map.set(b.name.trim(), b.image_url.trim());
  });

  const totalMapping = map.size;
  const totalBooks = (db.booksData || []).length;

  // create backup
  const backupPath = dbPath + '.backup.' + isoTimestamp();
  fs.copyFileSync(dbPath, backupPath);
  console.log(`merge_and_update_db: created backup ${backupPath}`);

  let matched = 0;
  let updated = 0;

  (db.booksData || []).forEach(book => {
    const name = (book.name || '').trim();
    if (map.has(name)) {
      matched++;
      const mapped = map.get(name);
      // only update when empty to avoid overwriting manual edits
      if (!book.image_url || String(book.image_url).trim() === '') {
        book.image_url = path.posix.join('assets', mapped);
        updated++;
      }
    }
  });

  writeJson(dbPath, db);
  console.log(`merge_and_update_db: totalMapping=${totalMapping}, totalDbBooks=${totalBooks}, matched=${matched}, updated=${updated}`);

  if (matched > updated) {
    console.log('Some matches existed but were not updated because db.json already had image_url values for them.');
  }

} catch (err) {
  console.error('merge_and_update_db: error', err && err.stack ? err.stack : err);
  process.exit(2);
}
