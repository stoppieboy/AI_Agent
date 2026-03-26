import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const db = new Database(path.join(PROJECT_ROOT, 'memory.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS user_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export function remember(key: string, value: string) {
  db.prepare('INSERT OR REPLACE INTO user_memory(key, value) VALUES(?, ?)').run(key, value);
}

export function forget(key: string) {
  if (!key) throw new Error('forget() requires a key');
  db.prepare('DELETE FROM user_memory WHERE key = ?').run(key);
}

export function recallAll() {
  const MEMORY_LIMIT = 100;
  return db.prepare('SELECT key, value FROM user_memory ORDER BY id DESC LIMIT ?').all(MEMORY_LIMIT);
}

export function closeDb() {
  db.close();
}

