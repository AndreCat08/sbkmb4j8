import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS, STATUSES, createCandle, normalizeCandle, parseScents, updateCandle, validateCandle,
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
    ['cedar, Oak, oak, CEDAR', ['cedar', 'Oak']],
    ['   ', []], ['', []], ['single', ['single']],
    [null, []], [undefined, []], [42, []], [{}, []], [true, []],
  ];
  for (const [input, expected] of cases) eq(parseScents(input), expected, String(input));

  eq(parseScents(Array.from({ length: 20 }, (_, i) => `s${i}`).join(',')).length, LIMITS.MAX_SCENTS);
  eq(parseScents('x'.repeat(80))[0].length, LIMITS.MAX_SCENT);
});

test('parseScents is idempotent, so form and storage share one path', () => {
  const once = parseScents('cedarwood, vanilla');
  eq(parseScents(once), once);
  eq(parseScents(parseScents(once)), once);
});

test('validateCandle flags each broken rule and accepts each boundary', () => {
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

  const ok = [
    { name: 'x'.repeat(LIMITS.MAX_NAME) }, { brand: 'x'.repeat(LIMITS.MAX_BRAND) },
    { notes: 'x'.repeat(LIMITS.MAX_NOTES) },
    ...[0, 1, 5].map((rating) => ({ rating })), ...STATUSES.map((status) => ({ status })),
  ];
  for (const patch of ok) {
    assert.equal(validateCandle({ ...valid, ...patch }).valid, true, JSON.stringify(patch));
  }
});

test('validateCandle reports every failure at once, not just the first', () => {
  const { errors } = validateCandle({ name: '', status: 'melted', rating: 9 });
  eq(Object.keys(errors).sort(), ['name', 'rating', 'status']);
});

test('createCandle builds a complete entity, trimmed, with defaults', () => {
  const c = createCandle({ ...valid, scents: 'cedar, vanilla' }, deps);
  eq(Object.keys(c).sort(),
    ['brand', 'createdAt', 'id', 'name', 'notes', 'rating', 'scents', 'status', 'updatedAt']);
  eq(c.scents, ['cedar', 'vanilla']);
  assert.equal(c.createdAt, 1_700_000_000_000);
  assert.equal(c.createdAt, c.updatedAt, 'timestamps match on creation');

  const trimmed = createCandle({ name: '  Baies  ', brand: ' Diptyque ', notes: ' tunneled ' }, deps);
  eq([trimmed.name, trimmed.brand, trimmed.notes], ['Baies', 'Diptyque', 'tunneled']);

  const plain = createCandle({ name: 'Plain' }, deps);
  eq([plain.status, plain.rating, plain.brand, plain.notes, plain.scents],
    ['unlit', 0, '', '', []], 'rating 0 means unrated');
});

test('createCandle ignores unknown keys, nothing is smuggled in', () => {
  const c = createCandle({ name: 'Plain', isAdmin: true, __proto__: { polluted: 1 } }, deps);
  assert.equal(c.isAdmin, undefined);
  assert.equal({}.polluted, undefined, 'Object.prototype must stay clean');
});

test('updateCandle returns a new object and never mutates the original', () => {
  const original = createCandle(valid, deps);
  const updated = updateCandle(original, { name: 'Feu de Bois' }, deps);
  assert.notEqual(updated, original, 'must not be the same reference');
  assert.equal(original.name, 'Baies', 'original must not be mutated');
  assert.equal(updated.name, 'Feu de Bois');
});

test('updateCandle keeps id and createdAt immutable, advances updatedAt', () => {
  const original = createCandle(valid, { ...deps, now: () => 1000 });
  const hijack = updateCandle(original, { id: 'hijacked', createdAt: 0 }, deps);
  eq([hijack.id, hijack.createdAt], [original.id, original.createdAt]);

  const patched = updateCandle(original, { rating: 5 }, { ...deps, now: () => 2000 });
  eq([patched.updatedAt, patched.rating, patched.brand], [2000, 5, 'Diptyque'],
    'unpatched fields survive');
  eq(updateCandle(original, { scents: 'oak, oak, smoke' }, deps).scents, ['oak', 'smoke']);
});

test('normalizeCandle repairs hostile stored values', () => {
  for (const [rating, expected] of [['4', 4], [9, 5], [-2, 0], [3.7, 3], ['abc', 0], [null, 0], [NaN, 0]]) {
    assert.equal(normalizeCandle({ name: 'X', rating }, deps).rating, expected, String(rating));
  }
  const c = normalizeCandle({ name: 'X', status: 'melted', scents: 'cedar, vanilla' }, deps);
  assert.equal(c.status, 'unlit');
  assert.ok(c.id, 'a missing id is generated');
  eq([c.createdAt, c.updatedAt], [1_700_000_000_000, 1_700_000_000_000]);
  eq(c.scents, ['cedar', 'vanilla']);
});

test('normalizeCandle preserves valid entries and rejects unsalvageable ones', () => {
  const stored = {
    id: 'keep-me', name: 'Baies', brand: 'Diptyque', scents: ['cedar'],
    status: 'finished', rating: 5, notes: 'lovely', createdAt: 10, updatedAt: 20,
  };
  eq(normalizeCandle(stored, deps), stored);

  for (const raw of [null, undefined, 42, 'candle', [], {}, { name: '   ' }, { brand: 'no name' }]) {
    assert.equal(normalizeCandle(raw, deps), null, JSON.stringify(raw));
  }
});
