/**
 * Fetches and parses trade values from a publicly published Google Sheets CSV.
 *
 * HOW TO SET UP YOUR GOOGLE SHEET:
 *  1. Create a sheet with columns: name | value | trend | updatedAt
 *     - name:      item name (lowercase recommended, e.g. "1x1x1x1")
 *     - value:     numeric trade value (e.g. 5000)
 *     - trend:     up | down | stable
 *     - updatedAt: date string (e.g. 2025-08-03)
 *
 *  2. File → Share → Publish to web → Select your sheet → CSV format → Publish
 *     Copy the URL that looks like:
 *     https://docs.google.com/spreadsheets/d/SHEET_ID/pub?output=csv
 *
 *  3. On your Discord server, run: /setup sheet_url <that URL>
 *
 * Values are cached for 5 minutes per guild.
 */

const { getGuildConfig } = require('./guildConfig');

const cache = new Map(); // guildId -> { values, fetchedAt }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns parsed trade values for a guild from their configured Google Sheet.
 * @param {string} guildId
 * @returns {Promise<object>} { itemName: { value, trend, updatedAt } }
 */
async function getSheetValues(guildId) {
  const cached = cache.get(guildId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.values;
  }

  const config = getGuildConfig(guildId);
  const sheetUrl = config.sheetUrl;

  if (!sheetUrl) return {};

  try {
    const res = await fetch(sheetUrl);
    if (!res.ok) return {};
    const csv = await res.text();

    const values = parseCSV(csv);
    cache.set(guildId, { values, fetchedAt: Date.now() });
    return values;
  } catch {
    return {};
  }
}

/**
 * Invalidates the cache for a guild (call after /setup sheet_url is updated).
 * @param {string} guildId
 */
function invalidateCache(guildId) {
  cache.delete(guildId);
}

/**
 * Parses CSV text into a values object.
 * Expected header row: name,value,trend,updatedAt
 */
function parseCSV(csv) {
  const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return {};

  // Detect header row and find column indices
  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const col = {
    name:      header.indexOf('name'),
    value:     header.indexOf('value'),
    trend:     header.indexOf('trend'),
    updatedAt: header.indexOf('updatedat') !== -1 ? header.indexOf('updatedat') : header.indexOf('updated'),
  };

  if (col.name === -1 || col.value === -1) return {};

  const result = {};
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const name = (cells[col.name] || '').replace(/"/g, '').trim().toLowerCase();
    const rawVal = (cells[col.value] || '').replace(/"/g, '').trim();
    const numVal = parseFloat(rawVal.replace(/[^0-9.]/g, ''));

    if (!name || isNaN(numVal)) continue;

    result[name] = {
      value:     numVal,
      trend:     col.trend !== -1 ? (cells[col.trend] || 'stable').replace(/"/g, '').trim() : 'stable',
      updatedAt: col.updatedAt !== -1 ? (cells[col.updatedAt] || '').replace(/"/g, '').trim() : '',
    };
  }

  return result;
}

/**
 * Splits a CSV line respecting quoted fields.
 */
function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

module.exports = { getSheetValues, invalidateCache };
