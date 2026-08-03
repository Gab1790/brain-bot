const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.BRAINBOT_DATA_DIR
  ? path.resolve(process.env.BRAINBOT_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'brainbot.sqlite');

let dbInstance = null;

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getDb() {
  if (dbInstance) return dbInstance;
  ensureDataDir();
  dbInstance = new DatabaseSync(DB_PATH);
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS key_value_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  return dbInstance;
}

function cloneDefault(defaultData) {
  if (typeof defaultData === 'undefined') return {};
  return JSON.parse(JSON.stringify(defaultData));
}

function serializeValue(value) {
  return JSON.stringify(value, null, 2);
}

function parseValue(raw, fallback) {
  if (raw === null || typeof raw === 'undefined') return cloneDefault(fallback);
  try {
    return JSON.parse(raw);
  } catch (err) {
    return cloneDefault(fallback);
  }
}

function migrateLegacyJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;

  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    return null;
  }

  const existing = getDb().prepare('SELECT value FROM key_value_store WHERE key = ?').get(fileName);
  if (!existing) {
    const now = new Date().toISOString();
    getDb().prepare('INSERT INTO key_value_store (key, value, updated_at) VALUES (?, ?, ?)').run(fileName, serializeValue(parsed), now);
  }
  return parsed;
}

function readData(fileName, defaultData = {}) {
  ensureDataDir();
  const row = getDb().prepare('SELECT value FROM key_value_store WHERE key = ?').get(fileName);
  if (row) return parseValue(row.value, defaultData);

  const migrated = migrateLegacyJson(fileName);
  if (migrated !== null) return migrated;

  return cloneDefault(defaultData);
}

function writeData(fileName, data) {
  ensureDataDir();
  const payload = serializeValue(data);
  const now = new Date().toISOString();
  const db = getDb();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO key_value_store (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(fileName, payload, now);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  fs.writeFileSync(path.join(DATA_DIR, fileName), payload, 'utf-8');
  return data;
}

module.exports = { readData, writeData, getDbPath: () => DB_PATH };
