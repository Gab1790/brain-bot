function levenshtein(a = '', b = '') {
  const left = String(a);
  const right = String(b);

  const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i++) dp[i][0] = i;
  for (let j = 0; j <= right.length; j++) dp[0][j] = j;

  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[left.length][right.length];
}

function bestMatch(query, candidates = [], maxDistance = 2) {
  if (!Array.isArray(candidates) || !candidates.length) return null;

  const normalizedQuery = String(query || '').toLowerCase().trim();
  if (!normalizedQuery) return null;

  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const value = String(candidate || '');
    const normalizedCandidate = value.toLowerCase().trim();
    const distance = levenshtein(normalizedQuery, normalizedCandidate);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return bestDistance <= maxDistance ? best : null;
}

module.exports = {
  levenshtein,
  bestMatch,
};
