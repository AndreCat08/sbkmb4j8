// The candle entity: parsing, validation, construction, and repair.
// Pure module — no document/window/localStorage. Clock and id are injected so
// creation is deterministic under test.

export const STATUSES = ['unlit', 'burning', 'finished'];

// Slugs are what we store; labels are only ever for display.
export const STATUS_LABELS = { unlit: 'Unlit', burning: 'Burning', finished: 'Finished' };

// Enforced here rather than only via HTML maxlength (trivially bypassed).
// Also the primary defence against filling the localStorage quota.
export const LIMITS = {
  MAX_NAME: 80, MAX_BRAND: 80, MAX_NOTES: 500,
  MAX_SCENTS: 12, MAX_SCENT: 40, MAX_RATING: 5,
};

const DEFAULT_DEPS = { now: () => Date.now(), id: () => crypto.randomUUID() };

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Accepts a raw string (form) or an already-parsed array (storage), so it is
// idempotent and both entry points share one path.
export function parseScents(input) {
  let parts;
  if (Array.isArray(input)) parts = input;
  else if (typeof input === 'string') parts = input.split(',');
  else return [];

  const seen = new Set();
  const scents = [];
  for (const part of parts) {
    const scent = text(part).replace(/\s+/g, ' ').slice(0, LIMITS.MAX_SCENT);
    if (!scent) continue;
    const key = scent.toLowerCase();
    if (seen.has(key)) continue; // first casing seen wins
    seen.add(key);
    scents.push(scent);
    if (scents.length === LIMITS.MAX_SCENTS) break;
  }
  return scents;
}

// Checks every field, so the form can show all problems at once instead of
// making the user fix them one submit at a time.
export function validateCandle(input = {}) {
  const errors = {};
  const name = text(input.name);
  const brand = text(input.brand);
  const notes = text(input.notes);

  if (!name) errors.name = 'Give your candle a name.';
  else if (name.length > LIMITS.MAX_NAME) errors.name = `Keep the name under ${LIMITS.MAX_NAME} characters.`;

  if (brand.length > LIMITS.MAX_BRAND) errors.brand = `Keep the brand under ${LIMITS.MAX_BRAND} characters.`;
  if (notes.length > LIMITS.MAX_NOTES) errors.notes = `Keep notes under ${LIMITS.MAX_NOTES} characters.`;

  if (input.status !== undefined && !STATUSES.includes(input.status)) {
    errors.status = 'Pick Unlit, Burning, or Finished.';
  }
  if (input.rating !== undefined) {
    const r = input.rating;
    if (!(Number.isInteger(r) && r >= 0 && r <= LIMITS.MAX_RATING)) {
      errors.rating = `Rate from 1 to ${LIMITS.MAX_RATING} flames, or leave it unrated.`;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

// Clamp first, then floor: 3.7 lands on 3, 9 lands on 5.
function coerceRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return 0;
  return Math.floor(Math.min(Math.max(rating, 0), LIMITS.MAX_RATING));
}

// The single normalization path shared by creation, update, and hydration.
// Fields are assigned explicitly, so unknown keys — including __proto__ from
// parsed JSON — are dropped rather than carried into the entity.
function shape(input, id, createdAt, updatedAt) {
  return {
    id,
    name: text(input.name).slice(0, LIMITS.MAX_NAME),
    brand: text(input.brand).slice(0, LIMITS.MAX_BRAND),
    scents: parseScents(input.scents),
    status: STATUSES.includes(input.status) ? input.status : 'unlit',
    rating: coerceRating(input.rating),
    notes: text(input.notes).slice(0, LIMITS.MAX_NOTES),
    createdAt,
    updatedAt,
  };
}

// Assumes input has already passed validateCandle.
export function createCandle(input, deps = {}) {
  const { now, id } = { ...DEFAULT_DEPS, ...deps };
  const at = now();
  return shape(input, id(), at, at);
}

// id and createdAt are identity, and survive any patch that tries to change them.
export function updateCandle(candle, patch, deps = {}) {
  const { now } = { ...DEFAULT_DEPS, ...deps };
  return shape({ ...candle, ...patch }, candle.id, candle.createdAt, now());
}

// Repairs one entry read back from storage, which is untrusted input. Returns
// null when the entry cannot be salvaged, so the caller drops that row and keeps
// the rest of the collection.
export function normalizeCandle(raw, deps = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!text(raw.name)) return null; // the name is the candle's identity

  const { now, id } = { ...DEFAULT_DEPS, ...deps };
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : now();
  const updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt;
  return shape(raw, typeof raw.id === 'string' && raw.id ? raw.id : id(), createdAt, updatedAt);
}
