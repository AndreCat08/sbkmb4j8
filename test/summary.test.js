import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterCandles, sortCandles, summarize } from '../src/summary.js';

const make = (id, extra = {}) => ({
  id, name: `Candle ${id}`, brand: '', scents: [], notes: '',
  status: 'unlit', rating: 0, createdAt: 0, updatedAt: 0, ...extra,
});
const ids = (l) => l.map((c) => c.id);

test('summarize counts statuses and averages only rated candles', () => {
  const empty = summarize([]);
  assert.deepEqual(empty,
    { total: 0, unlit: 0, burning: 0, finished: 0, rated: 0, averageRating: 0 });
  assert.ok(!Number.isNaN(empty.averageRating), 'averageRating must never be NaN');

  const s = summarize([
    make('a', { status: 'unlit' }), make('b', { status: 'burning' }),
    make('c', { status: 'burning' }), make('d', { status: 'finished' }),
  ]);
  assert.deepEqual([s.total, s.unlit, s.burning, s.finished], [4, 1, 2, 1]);
  assert.equal(s.total, s.unlit + s.burning + s.finished);

  const rated = summarize([make('a', { rating: 4 }), make('b', { rating: 5 }), make('c', { rating: 0 })]);
  assert.deepEqual([rated.rated, rated.averageRating], [2, 4.5], 'unrated must not drag the average');

  const rounded = summarize([make('a', { rating: 4 }), make('b', { rating: 5 }), make('c', { rating: 5 })]);
  assert.equal(rounded.averageRating, 4.7, 'rounded to one decimal');

  const none = summarize([make('a'), make('b')]);
  assert.deepEqual([none.rated, none.averageRating], [0, 0]);
});

test('sortCandles orders by each key, is stable, and never mutates', () => {
  const candles = [
    make('a', { name: 'zebra', rating: 2, createdAt: 100, updatedAt: 300 }),
    make('b', { name: 'Apple', rating: 0, createdAt: 300, updatedAt: 100 }),
    make('c', { name: 'mango', rating: 5, createdAt: 200, updatedAt: 200 }),
  ];
  const cases = [
    ['newest', ['b', 'c', 'a']], ['name', ['b', 'c', 'a']],
    ['rating', ['c', 'a', 'b']], // descending, unrated sinks last
    ['updated', ['a', 'c', 'b']], ['nonsense', ['b', 'c', 'a']], // unknown key falls back
  ];
  for (const [key, expected] of cases) assert.deepEqual(ids(sortCandles(candles, key)), expected, key);
  assert.deepEqual(ids(candles), ['a', 'b', 'c'], 'input must not be reordered');

  const tied = [make('a', { createdAt: 5 }), make('b', { createdAt: 5 }), make('c', { createdAt: 5 })];
  assert.deepEqual(ids(sortCandles(tied, 'newest')), ['a', 'b', 'c'], 'stable for ties');
});

test('filterCandles matches the query across every text field', () => {
  const candles = [
    make('a', { name: 'Baies' }), make('b', { brand: 'Diptyque' }),
    make('c', { scents: ['cedarwood', 'vanilla'] }), make('d', { notes: 'tunneled badly' }),
  ];
  const cases = [['baies', ['a']], ['DIPT', ['b']], ['vanilla', ['c']], ['tunneled', ['d']],
    ['nothing-matches', []]];
  for (const [query, expected] of cases) {
    assert.deepEqual(ids(filterCandles(candles, { query })), expected, query);
  }
  for (const query of ['', '   ', undefined]) {
    assert.equal(filterCandles(candles, { query }).length, 4, `blank query: ${String(query)}`);
  }
});

test('filterCandles composes status with query and treats regex chars literally', () => {
  const candles = [
    make('a', { status: 'burning', name: 'cedar jar' }),
    make('b', { status: 'burning', name: 'vanilla tin' }),
    make('c', { status: 'finished', name: 'cedar pillar' }),
  ];
  assert.deepEqual(ids(filterCandles(candles, { status: 'burning' })), ['a', 'b']);
  assert.equal(filterCandles(candles, { status: 'all' }).length, 3);
  assert.equal(filterCandles(candles, {}).length, 3);
  assert.deepEqual(ids(filterCandles(candles, { query: 'cedar', status: 'burning' })), ['a'],
    'query AND status');

  const meta = [make('x', { name: 'plain' }), make('y', { name: 'a.*b' })];
  assert.deepEqual(ids(filterCandles(meta, { query: '.*' })), ['y'], 'metacharacters are literal');
  assert.doesNotThrow(() => filterCandles(meta, { query: '([' }));
  assert.deepEqual(filterCandles(meta, { query: '([' }), []);
});
