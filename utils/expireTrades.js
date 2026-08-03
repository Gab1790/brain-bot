const { readData, writeData } = require('./db');
const { getGuildConfig } = require('./guildConfig');

// Marks trades older than ttlDays as 'expired' and optionally notifies authors.
async function expireTrades(client, ttlDays = 7) {
  const trades = readData('trades.json', {});
  const now = Date.now();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  let changed = false;
  for (const id of Object.keys(trades)) {
    const t = trades[id];
    if (!t || t.status === 'expired' || t.status === 'completed' || t.status === 'cancelled') continue;
    const created = new Date(t.createdAt).getTime();
    if (now - created > ttlMs) {
      t.status = 'expired';
      t.expiredAt = new Date().toISOString();
      changed = true;
      // notify author if possible
      try {
        if (client && t.authorId) {
          const user = await client.users.fetch(t.authorId).catch(() => null);
          if (user) {
            user.send(`⏳ Ton trade ${t.id} a expiré (inactivité).`).catch(() => {});
          }
        }
      } catch (e) {}
      // notify guild log channel if configured
      try {
        if (t.guildId) {
          const cfg = getGuildConfig(t.guildId);
          if (cfg && cfg.logChannelId && client) {
            const ch = await client.channels.fetch(cfg.logChannelId).catch(() => null);
            if (ch) ch.send(`⏳ Trade ${t.id} (par ${t.authorTag}) a expiré automatiquement.`).catch(() => {});
          }
        }
      } catch (e) {}
    }
  }
  if (changed) writeData('trades.json', trades);
  return changed;
}

module.exports = { expireTrades };