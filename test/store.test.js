import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCandle, findCandle, removeCandle, updateCandleInList } from '../src/store.js';

const make = (id, extra = {}) => ({ id, name: `Candle ${id}`, rating: 0, ...extra });
const list = () => [make('a'), make('b'), make('c')];
const ids = (l) => l.map((c) => c.id);

test('addCandle appends without mutating the original', () => {
  const before = list();
  const after = addCandle(before, make('d'));
  assert.deepEqual(ids(after), ['a', 'b', 'c', 'd']);
  assert.equal(before.length, 3, 'original must not be mutated');
  assert.deepEqual(addCandle([], make('a')), [make('a')]);
});

test('updateCandleInList replaces only the match, siblings keep identity', () => {
  const before = list();
  const after = updateCandleInList(before, 'b', { rating: 5 }, { now: () => 99 });
  assert.equal(after[1].rating, 5);
  assert.equal(after[0], before[0], 'untouched entries keep their identity');
  assert.equal(after[2], before[2]);
  assert.equal(before[1].rating, 0, 'original must not be mutated');
  assert.equal(updateCandleInList(before, 'zzz', { rating: 5 }), before, 'unknown id: same list');
});

test('removeCandle removes matches only, leaving the original intact', () => {
  const before = list();
  assert.deepEqual(ids(removeCandle(before, 'b')), ['a', 'c']);
  assert.equal(before.length, 3, 'original must not be mutated');
  assert.equal(removeCandle(before, 'zzz'), before, 'unknown id: same list');
  assert.deepEqual(removeCandle([make('only')], 'only'), []);

  const dupes = [make('a'), make('dupe'), make('dupe'), make('b')];
  assert.deepEqual(ids(removeCandle(dupes, 'dupe')), ['a', 'b']);
});

test('findCandle returns the match or undefined', () => {
  const candles = list();
  assert.equal(findCandle(candles, 'b'), candles[1]);
  assert.equal(findCandle(candles, 'zzz'), undefined);
  assert.equal(findCandle([], 'a'), undefined);
});
