// DOM rendering — the only module that touches `document`.
// INVARIANT: user text is assigned via textContent only. No innerHTML anywhere.
// Stored data is treated as hostile, exactly like a fresh form submission.

import { STATUS_LABELS } from './model.js';

const FLAME = '\u{1F525}';
const el = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });

export function renderSummary(root, summary) {
  for (const [key, value] of Object.entries(summary)) {
    const cell = root.querySelector(`[data-stat="${key}"]`);
    if (cell) cell.textContent = key === 'averageRating' && value ? value.toFixed(1) : String(value);
  }
}

function fillCard(template, candle) {
  const node = template.content.firstElementChild.cloneNode(true);
  const slot = (name) => node.querySelector(`[data-slot="${name}"]`);
  node.dataset.id = candle.id;
  node.dataset.status = candle.status;

  slot('name').textContent = candle.name;
  const brand = slot('brand');
  brand.textContent = candle.brand;
  brand.hidden = !candle.brand;
  slot('status').textContent = STATUS_LABELS[candle.status];

  const rating = slot('rating');
  rating.textContent = candle.rating ? FLAME.repeat(candle.rating) : 'Unrated';
  if (candle.rating) rating.setAttribute('aria-label', `Rated ${candle.rating} of 5 flames`);
  else rating.classList.add('unrated');

  const scents = slot('scents');
  scents.append(...candle.scents.map((s) => el('li', s)));
  scents.hidden = candle.scents.length === 0;

  const notes = slot('notes');
  notes.textContent = candle.notes;
  notes.hidden = !candle.notes;
  return node;
}

// Full re-render: the collection is small enough that correctness beats diffing.
export function renderCards(list, candles, template) {
  const next = document.createDocumentFragment();
  for (const candle of candles) next.append(fillCard(template, candle));
  list.replaceChildren(next);
}

export function renderRating(container, value) {
  const flames = [1, 2, 3, 4, 5].map((i) => {
    const flame = el('button', FLAME);
    flame.type = 'button';
    flame.className = i <= value ? 'flame on' : 'flame';
    flame.dataset.value = String(i);
    flame.setAttribute('role', 'radio');
    flame.setAttribute('aria-checked', String(i === value));
    flame.setAttribute('aria-label', `${i} flame${i > 1 ? 's' : ''}`);
    flame.tabIndex = i === value || (value === 0 && i === 1) ? 0 : -1;
    return flame;
  });
  container.replaceChildren(...flames);
}

// Non-blocking and dismissible: storage problems must never block the app.
export function renderBanner(node, message) {
  if (!message) return void node.replaceChildren();
  const banner = el('p', message);
  banner.className = 'banner';
  node.replaceChildren(banner);
}

export function announce(node, message) {
  node.textContent = message;
}
