import Database from 'better-sqlite3';

const db = new Database('memory.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS user_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export function remember(key: string, value: string) {
  db.prepare('INSERT INTO user_memory(key, value) VALUES(?, ?)').run(key, value);
}

export function forget(key: string) {
  if (!key) throw new Error('forget() requires a key');
  db.prepare('DELETE FROM user_memory WHERE key = ?').run(key);
}

export function recallAll() {
  return db.prepare('SELECT key, value FROM user_memory ORDER BY id DESC LIMIT 100').all();
}

