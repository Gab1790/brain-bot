// Small fuzzy matching utilities (Levenshtein distance) to suggest best matching item names

function levenshtein(a, b) {
  if (a === b) return 0;
  const alen = a.length; const blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  const v0 = new Array(blen + 1);
  const v1 = new Array(blen + 1);
  for (let j = 0; j <= blen; j++) v0[j] = j;
  for (let i = 0; i < alen; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < blen; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= blen; j++) v0[j] = v1[j];
  }
  return v1[blen];
}

function bestMatch(target, candidates, maxDistance = 3) {
  const t = target.toLowerCase();
  let best = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const name = c.toLowerCase();
    if (name === t) return c;
    const dist = levenshtein(t, name);
    if (dist < bestScore) {
      bestScore = dist;
      best = c;
    }
  }
  if (bestScore <= maxDistance) return best;
  return null;
}

module.exports = { levenshtein, bestMatch };