import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION, STORAGE_KEY, isStorageAvailable, loadCandles, saveCandles,
} from '../src/storage.js';

// A localStorage-shaped adapter. Storage takes this as a parameter precisely so
// persistence is testable in Node, where localStorage does not exist.
const memory = (seed) => {
  const map = new Map(seed === undefined ? [] : [[STORAGE_KEY, seed]]);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
};
const throwing = (error = new Error('denied')) => ({
  getItem() { throw error; }, setItem() { throw error; }, removeItem() { throw error; },
});

const candle = (extra = {}) => ({
  id: 'a', name: 'Baies', brand: 'Diptyque', scents: ['cedar'], notes: '',
  status: 'burning', rating: 4, createdAt: 10, updatedAt: 20, ...extra,
});
const wrap = (candles, version = SCHEMA_VERSION) => JSON.stringify({ version, candles });

test('saveCandles round-trips, and reports failure instead of throwing', () => {
  const adapter = memory();
  assert.deepEqual(saveCandles(adapter, [candle()]), { ok: true });
  assert.equal(JSON.parse(adapter.getItem(STORAGE_KEY)).version, SCHEMA_VERSION,
    'the version travels with the data');
  assert.deepEqual(loadCandles(adapter), [candle()]);

  const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
  assert.deepEqual(saveCandles(throwing(quota), [candle()]), { ok: false, reason: 'quota' });
  assert.deepEqual(saveCandles(throwing(), [candle()]), { ok: false, reason: 'unavailable' });
});

test('loadCandles returns [] for anything it cannot trust', () => {
  const cases = [undefined, '', '{oops', '42', 'null', '{}', '{"candles":"nope"}'];
  for (const seed of cases) assert.deepEqual(loadCandles(memory(seed)), [], String(seed));
  assert.deepEqual(loadCandles(memory(wrap([candle()], 99))), [], 'refuses a newer schema');
  assert.deepEqual(loadCandles(throwing()), [], 'adapter itself throws');
});

test('loadCandles migrates a legacy bare array', () => {
  const loaded = loadCandles(memory(JSON.stringify([candle()])));
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, 'Baies');
});

test('loadCandles salvages good entries and drops only the corrupt ones', () => {
  const seed = wrap([candle({ id: 'a' }), null, 'garbage', { noName: true }, candle({ id: 'b' })]);
  assert.deepEqual(loadCandles(memory(seed)).map((c) => c.id), ['a', 'b'],
    'one bad row must not wipe the collection');
});

test('loadCandles repairs fields and resists prototype pollution', () => {
  const seed = wrap([{ name: 'Odd', status: 'melted', rating: '9', scents: 'cedar, cedar' }]);
  const [loaded] = loadCandles(memory(seed));
  assert.equal(loaded.status, 'unlit');
  assert.equal(loaded.rating, 5);
  assert.deepEqual(loaded.scents, ['cedar']);
  assert.ok(loaded.id, 'a missing id is generated');

  const hostile = `{"version":${SCHEMA_VERSION},"candles":[{"name":"X","isAdmin":true,"__proto__":{"polluted":1}}]}`;
  assert.equal(loadCandles(memory(hostile))[0].isAdmin, undefined);
  assert.equal({}.polluted, undefined, 'Object.prototype must stay clean');
});

test('isStorageAvailable distinguishes a working adapter from a blocked one', () => {
  assert.equal(isStorageAvailable(memory()), true);
  assert.equal(isStorageAvailable(throwing()), false);
});
