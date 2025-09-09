const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, 'src', 'assets', 'database', 'db.json');
const mappingPath = path.join(projectRoot, 'src', 'assets', 'db_with_book_covers_url.json');

function safeRead(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const db = safeRead(dbPath);
const mapping = safeRead(mappingPath);

const map = new Map();
(mapping.booksData || []).forEach(item => {
  if (item && item.name && item.image_url) map.set(item.name.trim(), item.image_url.trim());
});

let updated = 0;
let totalMatched = 0;
(db.booksData || []).forEach(book => {
  const name = (book.name || '').trim();
  if (!name) return;
  if (map.has(name)) {
    totalMatched++;
    const mapped = map.get(name);
    const newPath = 'assets/' + mapped.replace(/\\\\/g, '/');
    if (!book.image_url || book.image_url.trim() === '' || book.image_url !== newPath) {
      book.image_url = newPath;
      updated++;
    }
  }
});

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log(`merge_image_urls: total mapping entries=${map.size}, total db books=${(db.booksData||[]).length}, matched=${totalMatched}, updated=${updated}`);
console.log(`Backup is at db.json.backup.* (if present).`);
