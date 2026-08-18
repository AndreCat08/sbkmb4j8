import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortByNewest, summarize } from '../src/summary.js';
import { escapeHtml } from '../src/escape.js';

const make = (id, extra = {}) => ({ id, status: 'unlit', rating: 0, createdAt: 0, ...extra });

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
  assert.equal(summarize([make('a', { rating: 4 }), make('b', { rating: 5 }),
    make('c', { rating: 5 })]).averageRating, 4.7, 'rounded to one decimal');
});

test('sortByNewest orders by createdAt descending without mutating', () => {
  const candles = [make('a', { createdAt: 100 }), make('b', { createdAt: 300 }), make('c', { createdAt: 200 })];
  assert.deepEqual(sortByNewest(candles).map((c) => c.id), ['b', 'c', 'a']);
  assert.deepEqual(candles.map((c) => c.id), ['a', 'b', 'c'], 'input must not be reordered');
});

test('escapeHtml neutralizes markup, attribute breakouts, and non-strings', () => {
  const cases = [
    ['<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;'],
    ['" onerror="alert(1)', '&quot; onerror=&quot;alert(1)'],
    ["' onload='x", '&#39; onload=&#39;x'],
    ['a & b', 'a &amp; b'],
    // & is escaped first, so "&lt;" must not become "&amp;lt;" (double-escaping bug)
    ['&lt;', '&amp;lt;'],
    ['cedarwood, vanilla', 'cedarwood, vanilla'],
    [null, ''], [undefined, ''], [42, '42'], [['<a>'], '&lt;a&gt;'],
  ];
  for (const [input, expected] of cases) assert.equal(escapeHtml(input), expected, String(input));
});
