// Pure reducers over Candle[]. Every one returns a new array and never mutates,
// so each state transition is directly assertable.

import { updateCandle } from './model.js';

export function addCandle(list, candle) {
  return [...list, candle];
}

// Returns the original list when nothing matched, so callers can skip a redundant
// render. Untouched entries keep their identity for the same reason.
export function updateCandleInList(list, id, patch, deps) {
  const index = list.findIndex((candle) => candle.id === id);
  if (index === -1) return list;
  const next = [...list];
  next[index] = updateCandle(list[index], patch, deps);
  return next;
}

export function removeCandle(list, id) {
  const next = list.filter((candle) => candle.id !== id);
  return next.length === list.length ? list : next;
}

export function findCandle(list, id) {
  return list.find((candle) => candle.id === id);
}

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
