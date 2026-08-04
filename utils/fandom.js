async function fetchJson(url, opts = {}) {
  // use global fetch when available
  let fetchFn = null;
  if (typeof fetch === 'function') fetchFn = fetch;
  else {
    try {
      fetchFn = require('node-fetch');
    } catch (e) {
      throw new Error('No fetch available (node <18) and node-fetch is not installed');
    }
  }

  const res = await fetchFn(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

// domain is like 'game.fandom.com' (without protocol)
async function getFandomImage(domain, query) {
  if (!domain) return null;
  try {
    // 1) Search for page title
    const searchUrl = `https://${domain}/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1`;
    const searchJson = await fetchJson(searchUrl);
    const sr = searchJson && searchJson.query && searchJson.query.search;
    if (!sr || sr.length === 0) return null;
    const title = sr[0].title;

    // 2) Query pageimages for that title
    const pageUrl = `https://${domain}/api.php?action=query&format=json&prop=pageimages&piprop=original&pithumbsize=800&titles=${encodeURIComponent(title)}`;
    const pageJson = await fetchJson(pageUrl);
    if (!pageJson || !pageJson.query || !pageJson.query.pages) return null;
    const pages = pageJson.query.pages;
    for (const pid of Object.keys(pages)) {
      const p = pages[pid];
      // try original
      if (p.original && p.original.source) return p.original.source;
      // try thumbnail
      if (p.thumbnail && p.thumbnail.source) return p.thumbnail.source;
    }

    // fallback: try to extract OpenGraph image from page HTML (last resort)
    const pageHtmlUrl = `https://${domain}/wiki/${encodeURIComponent(title)}`;
    try {
      const htmlRes = await fetchJson(pageHtmlUrl, { method: 'GET' });
      // fetchJson above expects JSON, so this will fail; instead use raw fetch
    } catch (e) {
      // can't fetch HTML via fetchJson; perform a raw fetch if global fetch available
      let fetchFn = null;
      if (typeof fetch === 'function') fetchFn = fetch;
      else {
        try { fetchFn = require('node-fetch'); } catch (err) { fetchFn = null; }
      }
      if (fetchFn) {
        try {
          const r = await fetchFn(pageHtmlUrl);
          if (r && r.ok) {
            const html = await r.text();
            const ogMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
            if (ogMatch) return ogMatch[1];
          }
        } catch (err) {}
      }
    }

    return null;
  } catch (err) {
    // swallow and return null
    return null;
  }
}

module.exports = { getFandomImage };
