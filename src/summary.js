// Derivations over Candle[]: status counts, sorting, filtering. All pure.

// Single pass. averageRating counts only rated candles (rating 0 = unrated), and
// is 0 rather than NaN for an empty or wholly unrated collection.
export function summarize(list) {
  const s = { total: list.length, unlit: 0, burning: 0, finished: 0, rated: 0, averageRating: 0 };
  let sum = 0;
  for (const candle of list) {
    if (candle.status in s) s[candle.status] += 1;
    if (candle.rating > 0) {
      s.rated += 1;
      sum += candle.rating;
    }
  }
  if (s.rated > 0) s.averageRating = Math.round((sum / s.rated) * 10) / 10;
  return s;
}

const COMPARATORS = {
  newest: (a, b) => b.createdAt - a.createdAt,
  updated: (a, b) => b.updatedAt - a.updatedAt,
  name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  rating: (a, b) => b.rating - a.rating, // unrated (0) sinks to the bottom
};

export const SORT_KEYS = Object.keys(COMPARATORS);

// Copies before sorting so the caller's array is never reordered. Array#sort is
// stable in modern engines, so ties keep their insertion order.
export function sortCandles(list, key) {
  return [...list].sort(COMPARATORS[key] ?? COMPARATORS.newest);
}

// Substring matching on a lowercased haystack — no RegExp, so a query containing
// regex metacharacters is matched literally instead of throwing.
export function filterCandles(list, { query = '', status = 'all' } = {}) {
  const needle = (query ?? '').trim().toLowerCase();
  if (!needle && status === 'all') return list;

  return list.filter((candle) => {
    if (status !== 'all' && candle.status !== status) return false;
    if (!needle) return true;
    const haystack = [candle.name, candle.brand, candle.notes, ...candle.scents]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}
