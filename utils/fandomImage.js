const fetch = require('node-fetch');

const WIKI_API_URL = 'https://stealabrainrot.fandom.com/api.php';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

// Cache mémoire simple : nom (lowercase) -> { url, at }
const cache = new Map();

async function getBrainrotImageUrl(itemName) {
    if (!itemName || !itemName.trim()) return null;
    const key = itemName.trim().toLowerCase();

    const cached = cache.get(key);
    if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
        return cached.url;
    }

    try {
        const params = new URLSearchParams({
            action: 'query',
            generator: 'search',
            gsrsearch: itemName,
            gsrlimit: '1',
            prop: 'pageimages',
            piprop: 'thumbnail',
            pithumbsize: '400',
            format: 'json'
        });

        const res = await fetch(`${WIKI_API_URL}?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        let url = null;
        const pages = data?.query?.pages;
        if (pages) {
            const firstPage = Object.values(pages)[0];
            if (firstPage && firstPage.thumbnail && firstPage.thumbnail.source) {
                url = firstPage.thumbnail.source;
            }
        }

        cache.set(key, { url, at: Date.now() });
        return url;
    } catch (err) {
        console.error(`Erreur récupération image Fandom pour "${itemName}":`, err.message);
        cache.set(key, { url: null, at: Date.now() });
        return null;
    }
}

module.exports = { getBrainrotImageUrl };