const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.BRAINBOT_DATA_DIR
  ? path.resolve(process.env.BRAINBOT_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'brainbot.sqlite');

const BOOST_DURATION_HOURS = 24;

let dbInstance = null;

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureCooldownsSchema() {
  const cols = dbInstance.prepare('PRAGMA table_info(cooldowns)').all();
  const hasGuildId = cols.some(c => c.name === 'guild_id');
  if (!hasGuildId) {
    // Les cooldowns sont des données transitoires (non critiques) :
    // on peut recréer la table sans risque pour passer au schéma multi-serveur.
    dbInstance.exec('DROP TABLE IF EXISTS cooldowns');
    dbInstance.exec(`
      CREATE TABLE cooldowns (
        guild_id TEXT,
        user_id TEXT,
        command_type TEXT,
        expires_at INTEGER,
        PRIMARY KEY (guild_id, user_id, command_type)
      );
    `);
  }
}

function getDb() {
  if (dbInstance) return dbInstance;
  ensureDataDir();
  dbInstance = new DatabaseSync(DB_PATH);

  // Create tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS config (
      guild_id TEXT PRIMARY KEY,
      sell_channel TEXT,
      buy_channel TEXT,
      sell_cooldown INTEGER DEFAULT 5,
      buy_cooldown INTEGER DEFAULT 5,
      bypass_roles TEXT DEFAULT '[]',
      mm_roles TEXT DEFAULT '[]',
      staff_roles TEXT DEFAULT '[]',
      embed_color TEXT DEFAULT '#3498db'
    );

    CREATE TABLE IF NOT EXISTS ads (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      guild_id TEXT,
      message_id TEXT,
      channel_id TEXT,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      min_price TEXT NOT NULL,
      max_price TEXT NOT NULL,
      payment TEXT NOT NULL,
      middleman TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      boosted_until INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cooldowns (
      guild_id TEXT,
      user_id TEXT,
      command_type TEXT,
      expires_at INTEGER,
      PRIMARY KEY (guild_id, user_id, command_type)
    );

    CREATE TABLE IF NOT EXISTS json_store (
      file_name TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations douces pour les bases existantes créées avant ces ajouts
  const softMigrations = [
    `ALTER TABLE ads ADD COLUMN guild_id TEXT`,
    `ALTER TABLE ads ADD COLUMN boosted_until INTEGER`,
    `ALTER TABLE config ADD COLUMN staff_roles TEXT DEFAULT '[]'`
  ];
  for (const sql of softMigrations) {
    try {
      dbInstance.exec(sql);
    } catch {
      // La colonne existe déjà : on ignore l'erreur "duplicate column name"
    }
  }

  ensureCooldownsSchema();

  return dbInstance;
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function cloneDefault(defaultValue) {
  if (defaultValue === null || typeof defaultValue !== 'object') return defaultValue;
  try {
    return JSON.parse(JSON.stringify(defaultValue));
  } catch {
    return defaultValue;
  }
}

// Config functions
function getConfig(guildId) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM config WHERE guild_id = ?');
  const row = stmt.get(guildId);
  if (!row) {
    return {
      guild_id: guildId,
      sell_channel: null,
      buy_channel: null,
      sell_cooldown: 5,
      buy_cooldown: 5,
      bypass_roles: [],
      mm_roles: [],
      staff_roles: [],
      embed_color: '#3498db'
    };
  }
  return {
    ...row,
    bypass_roles: safeJsonParse(row.bypass_roles, []),
    mm_roles: safeJsonParse(row.mm_roles, []),
    staff_roles: safeJsonParse(row.staff_roles || '[]', [])
  };
}

function saveConfig(guildId, config) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO config (guild_id, sell_channel, buy_channel, sell_cooldown, buy_cooldown, bypass_roles, mm_roles, staff_roles, embed_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      sell_channel = excluded.sell_channel,
      buy_channel = excluded.buy_channel,
      sell_cooldown = excluded.sell_cooldown,
      buy_cooldown = excluded.buy_cooldown,
      bypass_roles = excluded.bypass_roles,
      mm_roles = excluded.mm_roles,
      staff_roles = excluded.staff_roles,
      embed_color = excluded.embed_color
  `);
  stmt.run(
    guildId,
    config.sell_channel || null,
    config.buy_channel || null,
    config.sell_cooldown,
    config.buy_cooldown,
    JSON.stringify(config.bypass_roles || []),
    JSON.stringify(config.mm_roles || []),
    JSON.stringify(config.staff_roles || []),
    config.embed_color || '#3498db'
  );
}

// Ads functions
// L'ID est désormais numéroté PAR SERVEUR (chaque serveur a son propre SELL-0001, SELL-0002...)
function generateAdId(type, guildId) {
  const db = getDb();
  const prefix = type === 'SELL' ? 'SELL-' : 'BUY-';
  const stmt = db.prepare('SELECT COUNT(*) as count FROM ads WHERE type = ? AND guild_id = ?');
  const count = stmt.get(type, guildId).count;
  const num = (count + 1).toString().padStart(4, '0');
  return prefix + num;
}

function createAd(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO ads (id, type, user_id, guild_id, message_id, channel_id, item_name, quantity, min_price, max_price, payment, middleman, description, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.id,
    data.type,
    data.user_id,
    data.guild_id || null,
    data.message_id || null,
    data.channel_id || null,
    data.item_name,
    data.quantity,
    data.min_price,
    data.max_price,
    data.payment,
    data.middleman,
    data.description || null,
    data.image_url || null
  );
}

function updateAdMessage(id, messageId, channelId) {
  const db = getDb();
  const stmt = db.prepare('UPDATE ads SET message_id = ?, channel_id = ? WHERE id = ?');
  stmt.run(messageId, channelId, id);
}

function getAd(id) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM ads WHERE id = ?');
  return stmt.get(id);
}

function isAdBoosted(ad) {
  return Boolean(ad && ad.boosted_until && ad.boosted_until > Date.now());
}

function setAdBoost(adId) {
  const db = getDb();
  const now = Date.now();
  const expiresAt = now + BOOST_DURATION_HOURS * 60 * 60 * 1000;
  const stmt = db.prepare('UPDATE ads SET boosted_until = ? WHERE id = ?');
  stmt.run(expiresAt, adId);
  return { expiresAt };
}

// Récupère les offres les plus récentes d'un serveur, boostées en premier
function getRecentAds(guildId, type = 'ALL', limit = 10) {
  const db = getDb();
  const fetchLimit = Math.max(limit * 5, 50);

  let rows;
  if (type === 'ALL') {
    rows = db.prepare('SELECT * FROM ads WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?').all(guildId, fetchLimit);
  } else {
    rows = db.prepare('SELECT * FROM ads WHERE guild_id = ? AND type = ? ORDER BY created_at DESC LIMIT ?').all(guildId, type, fetchLimit);
  }

  const sorted = rows.sort((a, b) => {
    const aBoosted = isAdBoosted(a) ? 1 : 0;
    const bBoosted = isAdBoosted(b) ? 1 : 0;
    if (aBoosted !== bBoosted) return bBoosted - aBoosted;

    const aTime = new Date(a.created_at).getTime() || 0;
    const bTime = new Date(b.created_at).getTime() || 0;
    return bTime - aTime;
  });

  return sorted.slice(0, limit);
}

function checkCooldown(guildId, userId, commandType, cooldownMinutes = 5, memberRoles = [], bypassRoles = []) {
  if (Array.isArray(memberRoles) && Array.isArray(bypassRoles)) {
    const bypass = memberRoles.some(roleId => bypassRoles.includes(roleId));
    if (bypass) {
      return { onCooldown: false, remaining: 0 };
    }
  }

  const minutes = Number(cooldownMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { onCooldown: false, remaining: 0 };
  }

  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare('SELECT expires_at FROM cooldowns WHERE guild_id = ? AND user_id = ? AND command_type = ?');
  const existing = stmt.get(guildId, userId, commandType);

  if (existing && existing.expires_at > now) {
    return { onCooldown: true, remaining: existing.expires_at - now };
  }

  const expiresAt = now + minutes * 60 * 1000;
  db.prepare(`
    INSERT INTO cooldowns (guild_id, user_id, command_type, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id, command_type) DO UPDATE SET
      expires_at = excluded.expires_at
  `).run(guildId, userId, commandType, expiresAt);

  return { onCooldown: false, remaining: 0, expiresAt };
}

// JSON storage compatibility layer
function readData(fileName, defaultValue = {}) {
  const db = getDb();
  const row = db.prepare('SELECT payload FROM json_store WHERE file_name = ?').get(fileName);
  if (row) {
    return safeJsonParse(row.payload, cloneDefault(defaultValue));
  }

  // Migration automatique d'un ancien fichier JSON local si présent
  const legacyPath = path.join(DATA_DIR, fileName);
  if (fs.existsSync(legacyPath)) {
    try {
      const legacyData = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
      writeData(fileName, legacyData);
      return legacyData;
    } catch {
      return cloneDefault(defaultValue);
    }
  }

  return cloneDefault(defaultValue);
}

function writeData(fileName, data) {
  const db = getDb();
  const payload = JSON.stringify(data ?? {});
  db.prepare(`
    INSERT INTO json_store (file_name, payload, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(file_name) DO UPDATE SET
      payload = excluded.payload,
      updated_at = CURRENT_TIMESTAMP
  `).run(fileName, payload);
}

module.exports = {
  getDb,
  getConfig,
  saveConfig,
  generateAdId,
  createAd,
  updateAdMessage,
  getAd,
  getRecentAds,
  isAdBoosted,
  setAdBoost,
  checkCooldown,
  readData,
  writeData,
};
