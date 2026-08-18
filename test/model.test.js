import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS, createCandle, normalizeCandle, parseScents, updateCandle, validateCandle,
} from '../src/model.js';

let seq = 0;
const deps = { now: () => 1_700_000_000_000, id: () => `id-${++seq}` };
const valid = { name: 'Baies', brand: 'Diptyque', status: 'burning', rating: 4 };
const eq = assert.deepEqual;

test('parseScents splits, trims, dedupes case-insensitively, and caps', () => {
  const cases = [
    ['cedarwood, vanilla, sea salt', ['cedarwood', 'vanilla', 'sea salt']],
    ['  cedarwood  ,   vanilla  ', ['cedarwood', 'vanilla']],
    ['a,,b,', ['a', 'b']],
    ['Vanilla, vanilla, VANILLA', ['Vanilla']], // first casing wins
    ['   ', []], [null, []], [42, []],
  ];
  for (const [input, expected] of cases) eq(parseScents(input), expected, String(input));

  eq(parseScents(Array.from({ length: 20 }, (_, i) => `s${i}`).join(',')).length, LIMITS.MAX_SCENTS);
  eq(parseScents('x'.repeat(80))[0].length, LIMITS.MAX_SCENT);

  // Idempotent, so the form and stored data share one path.
  const once = parseScents('cedarwood, vanilla');
  eq(parseScents(once), once);
});

test('validateCandle flags each broken rule and accepts valid values', () => {
  eq(validateCandle(valid), { valid: true, errors: {} });

  const bad = [
    ['name', { name: '' }], ['name', { name: '   ' }],
    ['name', { name: 'x'.repeat(LIMITS.MAX_NAME + 1) }],
    ['brand', { brand: 'x'.repeat(LIMITS.MAX_BRAND + 1) }],
    ['notes', { notes: 'x'.repeat(LIMITS.MAX_NOTES + 1) }],
    ['status', { status: 'melted' }],
    ...[6, -1, 2.5, 'abc'].map((rating) => ['rating', { rating }]),
  ];
  for (const [field, patch] of bad) {
    const r = validateCandle({ ...valid, ...patch });
    assert.equal(r.valid, false, JSON.stringify(patch));
    assert.ok(r.errors[field], `expected error on ${field}`);
  }

  for (const patch of [{ name: 'x'.repeat(LIMITS.MAX_NAME) }, { rating: 0 }, { rating: 5 }]) {
    assert.equal(validateCandle({ ...valid, ...patch }).valid, true, JSON.stringify(patch));
  }

  const { errors } = validateCandle({ name: '', status: 'melted', rating: 9 });
  eq(Object.keys(errors).sort(), ['name', 'rating', 'status'], 'every failure at once');
});

test('createCandle builds a complete entity, trimmed, with defaults', () => {
  const c = createCandle({ ...valid, scents: 'cedar, vanilla', notes: ' tunneled ' }, deps);
  eq(Object.keys(c).sort(),
    ['brand', 'createdAt', 'id', 'name', 'notes', 'rating', 'scents', 'status', 'updatedAt']);
  eq(c.scents, ['cedar', 'vanilla']);
  assert.equal(c.notes, 'tunneled', 'free text is trimmed');
  assert.equal(c.createdAt, c.updatedAt, 'timestamps match on creation');

  const plain = createCandle({ name: 'Plain' }, deps);
  eq([plain.status, plain.rating, plain.brand, plain.scents], ['unlit', 0, '', []],
    'rating 0 means unrated');

  // Unknown keys are dropped rather than carried into the entity.
  const hostile = createCandle({ name: 'P', isAdmin: true, __proto__: { polluted: 1 } }, deps);
  assert.equal(hostile.isAdmin, undefined);
  assert.equal({}.polluted, undefined, 'Object.prototype must stay clean');
});

test('updateCandle returns a new object and never mutates the original', () => {
  const original = createCandle(valid, { ...deps, now: () => 1000 });
  const updated = updateCandle(original, { name: 'Feu de Bois' }, deps);
  assert.notEqual(updated, original, 'must not be the same reference');
  assert.equal(original.name, 'Baies', 'original must not be mutated');

  const hijack = updateCandle(original, { id: 'hijacked', createdAt: 0 }, deps);
  eq([hijack.id, hijack.createdAt], [original.id, original.createdAt], 'identity is immutable');

  const patched = updateCandle(original, { rating: 5 }, { ...deps, now: () => 2000 });
  eq([patched.updatedAt, patched.rating, patched.brand], [2000, 5, 'Diptyque'],
    'unpatched fields survive');
  eq(updateCandle(original, { scents: 'oak, oak, smoke' }, deps).scents, ['oak', 'smoke']);
});

test('normalizeCandle repairs, preserves, or rejects stored entries', () => {
  for (const [rating, expected] of [['4', 4], [9, 5], [-2, 0], [3.7, 3], ['abc', 0], [NaN, 0]]) {
    assert.equal(normalizeCandle({ name: 'X', rating }, deps).rating, expected, String(rating));
  }
  const c = normalizeCandle({ name: 'X', status: 'melted', scents: 'cedar, vanilla' }, deps);
  assert.equal(c.status, 'unlit');
  assert.ok(c.id, 'a missing id is generated');
  eq([c.createdAt, c.updatedAt], [1_700_000_000_000, 1_700_000_000_000]);
  eq(c.scents, ['cedar', 'vanilla']);

  const stored = {
    id: 'keep-me', name: 'Baies', brand: 'Diptyque', scents: ['cedar'],
    status: 'finished', rating: 5, notes: 'lovely', createdAt: 10, updatedAt: 20,
  };
  eq(normalizeCandle(stored, deps), stored, 'valid entries pass through untouched');

  for (const raw of [null, 42, 'candle', [], {}, { name: '   ' }]) {
    assert.equal(normalizeCandle(raw, deps), null, JSON.stringify(raw));
  }
});
