// Derivations over Candle[]. Pure.

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

// Newest first, so a freshly logged candle lands at the top of the collection.
export function sortByNewest(list) {
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}
