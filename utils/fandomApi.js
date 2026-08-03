/**
 * Fetches brainrot info from the stealabrainrot Fandom wiki API.
 * Returns rarity, cost, income from the infobox wikitext.
 *
 * NOTE: Fandom data is fetched in near real-time by default (no caching).
 *       This provides freshly updated game stats from the wiki but may
 *       increase the number of requests to the Fandom API. If rate
 *       limiting becomes an issue, change CACHE_TTL_MS to a non-zero
 *       value (milliseconds) to enable caching (e.g. 30_000 for 30s).
 */

const cache = new Map(); // key -> { data, fetchedAt }
// 0 = no caching (always fetch fresh). Adjust if you encounter rate limits.
const CACHE_TTL_MS = 0; // realtime

const BASE = 'https://stealabrainrot.fandom.com/api.php';

/**
 * Search for brainrot page titles matching a query (for autocomplete).
 * @param {string} query
 * @returns {Promise<string[]>} list of page titles
 */
async function searchBrainrots(query) {
  if (!query || query.length < 1) return [];
  const url = `${BASE}?action=opensearch&search=${encodeURIComponent(query)}&limit=10&namespace=0&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    // opensearch returns [query, [titles], [descriptions], [urls]]
    return Array.isArray(data[1]) ? data[1] : [];
  } catch {
    return [];
  }
}

/**
 * Resolves a user-typed name to the exact Fandom page title.
 * e.g. "rocco disco" -> "Rocco Disco"
 * @param {string} query
 * @returns {Promise<string|null>}
 */
async function resolveBrainrotName(query) {
  const results = await searchBrainrots(query);
  if (!results.length) return null;
  // Find the best match (exact case-insensitive or first result)
  const lower = query.toLowerCase();
  const exact = results.find(r => r.toLowerCase() === lower);
  return exact || results[0];
}

/**
 * Fetches detailed info for a single brainrot page.
 * Accepts both exact page titles and lowercase user input.
 * @param {string} input  e.g. "rocco disco" or "Rocco Disco"
 * @returns {Promise<object|null>} { name, rarity, cost, income, status, obtained } or null
 */
async function getBrainrotInfo(input) {
  const cacheKey = input.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // Resolve to exact page title via search
  const pageName = await resolveBrainrotName(input);
  if (!pageName) return null;

  const url = `${BASE}?action=parse&page=${encodeURIComponent(pageName)}&prop=wikitext&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error || !json.parse) return null;

    const wikitext = json.parse.wikitext['*'] || '';
    const data = parseInfobox(wikitext, pageName);

    cache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  } catch {
    return null;
  }
}

/**
 * Extracts fields from the {{Brainrot Infobox|...}} template.
 */
function parseInfobox(wikitext, pageName) {
  const get = (key) => {
    const match = wikitext.match(new RegExp(`\\|${key}=([^|{}\\n]+)`));
    return match ? match[1].trim() : null;
  };

  return {
    name:     pageName,
    rarity:   get('rarity'),
    cost:     get('cost'),
    income:   get('income'),
    status:   get('status'),
    obtained: get('obtained'),
  };
}

module.exports = { searchBrainrots, getBrainrotInfo };
