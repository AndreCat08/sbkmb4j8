// Versioned persistence. Takes a localStorage-shaped adapter as a parameter
// rather than touching the global, which keeps it pure and testable in Node.

import { normalizeCandle } from './model.js';

export const STORAGE_KEY = 'candle-log/v1';
export const SCHEMA_VERSION = 1;

// Never throws. Returns a result so the UI can say an entry is held in memory
// but unsaved, instead of losing it silently.
export function saveCandles(adapter, list) {
  try {
    adapter.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, candles: list }));
    return { ok: true };
  } catch (error) {
    const quota = error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED';
    return { ok: false, reason: quota ? 'quota' : 'unavailable' };
  }
}

// Unwraps the stored payload into a plain array of raw entries. A bare array is
// the pre-envelope (v0) format and is migrated; a version we do not know is
// refused outright rather than guessed at and corrupted.
function migrate(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  if (parsed.version > SCHEMA_VERSION) return [];
  return Array.isArray(parsed.candles) ? parsed.candles : [];
}

// Never throws and always returns a valid Candle[]. Storage is untrusted input:
// entries are repaired one at a time and only the unsalvageable ones are dropped,
// so a single corrupt row cannot wipe the whole collection.
export function loadCandles(adapter) {
  let raw;
  try {
    raw = adapter.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  return migrate(parsed)
    .map((entry) => normalizeCandle(entry))
    .filter(Boolean);
}

// Private-mode browsers expose localStorage but throw on write.
export function isStorageAvailable(adapter) {
  const probe = `${STORAGE_KEY}/probe`;
  try {
    adapter.setItem(probe, '1');
    adapter.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
