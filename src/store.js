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
