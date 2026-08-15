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
      embed_color TEXT DEFAULT '#3498db'
    );
    
    CREATE TABLE IF NOT EXISTS ads (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      user_id TEXT NOT NULL,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS cooldowns (
      user_id TEXT,
      command_type TEXT,
      expires_at INTEGER,
      PRIMARY KEY (user_id, command_type)
    );
  `);
  
  return dbInstance;
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
      embed_color: '#3498db'
    };
  }
  return {
    ...row,
    bypass_roles: JSON.parse(row.bypass_roles),
    mm_roles: JSON.parse(row.mm_roles)
  };
}

function saveConfig(guildId, config) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO config (guild_id, sell_channel, buy_channel, sell_cooldown, buy_cooldown, bypass_roles, mm_roles, embed_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      sell_channel = excluded.sell_channel,
      buy_channel = excluded.buy_channel,
      sell_cooldown = excluded.sell_cooldown,
      buy_cooldown = excluded.buy_cooldown,
      bypass_roles = excluded.bypass_roles,
      mm_roles = excluded.mm_roles,
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
    config.embed_color || '#3498db'
  );
}

// Ads functions
function generateAdId(type) {
  const db = getDb();
  const prefix = type === 'SELL' ? 'SELL-' : 'BUY-';
  const stmt = db.prepare('SELECT COUNT(*) as count FROM ads WHERE type = ?');
  const count = stmt.get(type).count;
  const num = (count + 1).toString().padStart(4, '0');
  return prefix + num;
}

function createAd(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO ads (id, type, user_id, message_id, channel_id, item_name, quantity, min_price, max_price, payment, middleman, description, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.id,
    data.type,
    data.user_id,
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

// Cooldown functions
function checkCooldown(userId, commandType, durationMinutes, memberRoles, bypassRoles) {
  // Check bypass
  if (memberRoles && bypassRoles) {
    if (memberRoles.some(role => bypassRoles.includes(role))) {
      return { onCooldown: false };
    }
  }

  const db = getDb();
  const stmt = db.prepare('SELECT expires_at FROM cooldowns WHERE user_id = ? AND command_type = ?');
  const row = stmt.get(userId, commandType);
  
  const now = Date.now();
  
  if (row && row.expires_at > now) {
    const remainingMs = row.expires_at - now;
    return { onCooldown: true, remaining: remainingMs };
  }
  
  // Set new cooldown
  const expiresAt = now + (durationMinutes * 60 * 1000);
  const insertStmt = db.prepare(`
    INSERT INTO cooldowns (user_id, command_type, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, command_type) DO UPDATE SET expires_at = excluded.expires_at
  `);
  insertStmt.run(userId, commandType, expiresAt);
  
  return { onCooldown: false };
}

module.exports = {
  getDb,
  getConfig,
  saveConfig,
  generateAdId,
  createAd,
  updateAdMessage,
  getAd,
  checkCooldown
};
