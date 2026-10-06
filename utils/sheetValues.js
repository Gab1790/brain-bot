const { readData } = require('./db');

const cache = new Map();

function resolveValues(guildId) {
  const allValues = readData('values.json', {});

  if (guildId && allValues[guildId] && typeof allValues[guildId] === 'object') {
    return allValues[guildId];
  }

  if (allValues._global && typeof allValues._global === 'object') {
    return allValues._global;
  }

  return {};
}

async function getSheetValues(guildId = null) {
  const key = guildId || '_global';
  if (!cache.has(key)) {
    cache.set(key, resolveValues(guildId));
  }
  return cache.get(key);
}

function getGlobalAverage(guildId = null) {
  const values = resolveValues(guildId);
  const nums = Object.values(values)
    .map(entry => Number(entry && entry.value))
    .filter(Number.isFinite);

  if (!nums.length) return 0;
  const total = nums.reduce((sum, value) => sum + value, 0);
  return Math.round(total / nums.length);
}

function invalidateCache(guildId = null) {
  if (guildId === null || guildId === undefined) {
    cache.clear();
    return;
  }

  cache.delete(guildId);
}

module.exports = {
  getSheetValues,
  getGlobalAverage,
  invalidateCache,
};
