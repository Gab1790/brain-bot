/**
 * Provides local P2P values and a global average used for P2P trades.
 *
 * REPLACES previous Google Sheets dependency:
 * - Values are now stored locally in data/values.json (managed via /addvalue).
 * - A per-guild global average can be stored in guild config as `globalAverage`.
 *   If not present, an average of values.json entries will be computed as fallback.
 *
 * Cache is kept to avoid repeated disk reads.
 */

const { getGuildConfig } = require('./guildConfig');
const { readData } = require('./db');

const cache = new Map(); // guildId -> { values, fetchedAt }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns parsed trade values from local data/values.json.
 * Backwards-compatible name: getSheetValues
 * @param {string} guildId
 * @returns {Promise<object>} { itemName: { value, trend, updatedAt } }
 */
async function getSheetValues(guildId) {
  const cached = cache.get(guildId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.values;
  }

  try {
    const allValues = readData('values.json', {});
    // Support two shapes:
    // 1) global flat: { "item": {value,...}, ... }
    // 2) per-guild: { "guildId": { "item": {...} }, "_global": { ... } }
    let values = {};
    if (allValues[guildId]) values = allValues[guildId];
    else if (allValues['_global']) values = allValues['_global'];
    else values = allValues; // fallback to flat shape

    cache.set(guildId, { values, fetchedAt: Date.now() });
    return values;
  } catch (err) {
    return {};
  }
}

/**
 * Returns a numeric global average value for P2P trades for the guild.
 * Order of preference:
 * 1) getGuildConfig(guildId).globalAverage
 * 2) Average of all entries in data/values.json (guild-scoped then global)
 * 3) Fallback constant 1000
 */
function getGlobalAverage(guildId) {
  const cfg = getGuildConfig(guildId) || {};
  if (typeof cfg.globalAverage === 'number' && !isNaN(cfg.globalAverage)) return cfg.globalAverage;

  // If cached values exist for the guild, use them, otherwise read file
  const cached = cache.get(guildId);
  let values = cached && cached.values ? cached.values : null;
  if (!values) {
    const allValues = readData('values.json', {});
    if (allValues[guildId]) values = allValues[guildId];
    else if (allValues['_global']) values = allValues['_global'];
    else values = allValues;
  }

  const nums = Object.values(values).map(v => (v && typeof v.value === 'number') ? v.value : NaN).filter(n => !isNaN(n));
  if (nums.length === 0) return 1000;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round(sum / nums.length);
}

/**
 * Invalidates the cache for a guild (call after /addvalue or other writes).
 * @param {string} guildId
 */
function invalidateCache(guildId) {
  cache.delete(guildId);
}

module.exports = { getSheetValues, invalidateCache, getGlobalAverage };
