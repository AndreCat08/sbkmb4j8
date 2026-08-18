// Wiring: DOM events -> store -> storage -> render.

import { LIMITS, createCandle, validateCandle } from './model.js';
import {
  addCandle, findCandle, removeCandle, sortByNewest, summarize, updateCandleInList,
} from './store.js';
import { STORAGE_KEY, isStorageAvailable, loadCandles, saveCandles } from './storage.js';
import { announce, renderBanner, renderCards, renderRating, renderSummary } from './render.js';

const $ = (id) => document.getElementById(id);
const ui = {
  summary: $('summary'), list: $('collection'), empty: $('empty'), banners: $('banners'),
  live: $('live'), dialog: $('editor'), form: $('form'), title: $('form-title'),
  rating: $('rating'), card: $('card'),
};

const adapter = window.localStorage;
let candles = [];
let editingId = null;
let draftRating = 0;
let pendingDelete = null;

function view() {
  renderSummary(ui.summary, summarize(candles));
  renderCards(ui.list, sortByNewest(candles), ui.card);
  ui.empty.hidden = candles.length > 0;
}

// Reports a failed save rather than losing the entry. In-memory state is never
// rolled back: the user keeps what they just typed.
function persist() {
  const { ok, reason } = saveCandles(adapter, candles);
  if (!ok) {
    renderBanner(ui.banners, reason === 'quota'
      ? 'Storage is full. Your changes are here for now but were not saved.'
      : 'Your changes could not be saved to this browser, but the app still works for this visit.');
  }
}

function commit(next, message) {
  candles = next;
  persist();
  view();
  announce(ui.live, message);
}

function showErrors(errors) {
  for (const field of ['name', 'brand', 'notes']) {
    const input = ui.form[field];
    const message = errors[field] ?? '';
    $(`err-${field}`).textContent = message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) input.setAttribute('aria-describedby', `err-${field}`);
    else input.removeAttribute('aria-describedby');
  }
}

function openEditor(candle) {
  editingId = candle?.id ?? null;
  draftRating = candle?.rating ?? 0;
  ui.title.textContent = candle ? 'Edit candle' : 'Add a candle';
  for (const f of ['name', 'brand', 'status', 'notes']) ui.form[f].value = candle?.[f] ?? '';
  ui.form.scents.value = candle?.scents.join(', ') ?? '';
  if (!candle) ui.form.status.value = 'unlit';
  showErrors({});
  renderRating(ui.rating, draftRating);
  ui.dialog.showModal();
  ui.form.name.focus();
}

function submit(event) {
  event.preventDefault();
  const input = {
    name: ui.form.name.value, brand: ui.form.brand.value, scents: ui.form.scents.value,
    status: ui.form.status.value, notes: ui.form.notes.value, rating: draftRating,
  };
  const { valid, errors } = validateCandle(input);
  showErrors(errors);
  if (!valid) return void ui.form[Object.keys(errors)[0]]?.focus();

  if (editingId) commit(updateCandleInList(candles, editingId, input), 'Candle updated.');
  else commit(addCandle(candles, createCandle(input)), 'Candle added.');
  ui.dialog.close();
}

// Inline confirmation on the card instead of a blocking window.confirm.
function toggleConfirm(card, open) {
  if (pendingDelete && pendingDelete !== card) toggleConfirm(pendingDelete, false);
  pendingDelete = open ? card : null;
  card.querySelector('[data-slot="confirm"]').hidden = !open;
  card.querySelector('.card-actions').hidden = open;
  if (open) card.querySelector('[data-act="confirm-delete"]').focus();
}

// One delegated listener for the whole grid, rather than one per card.
function onGridClick(event) {
  const button = event.target.closest('button[data-act]');
  if (!button) return;
  const card = button.closest('.card');
  const id = card?.dataset.id;
  ({
    edit: () => openEditor(findCandle(candles, id)),
    delete: () => toggleConfirm(card, true),
    'cancel-delete': () => toggleConfirm(card, false),
    'confirm-delete': () => commit(removeCandle(candles, id), 'Candle deleted.'),
  })[button.dataset.act]?.();
}

// Clicking the current rating again clears it back to unrated.
function setRating(value) {
  draftRating = value === draftRating ? 0 : value;
  renderRating(ui.rating, draftRating);
}

// Arrow-key operable radiogroup, per the WAI-ARIA rating pattern.
function onRatingKey(event) {
  const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  draftRating = Math.min(Math.max(draftRating + step, 0), LIMITS.MAX_RATING);
  renderRating(ui.rating, draftRating);
  ui.rating.querySelector(`[data-value="${Math.max(draftRating, 1)}"]`)?.focus();
}

function start() {
  if (!isStorageAvailable(adapter)) {
    renderBanner(ui.banners, 'This browser is blocking storage, so your collection will not be saved between visits.');
  } else {
    const raw = adapter.getItem(STORAGE_KEY);
    candles = loadCandles(adapter);
    // Something was stored but nothing survived parsing: say so rather than
    // showing an empty collection as though it had always been empty.
    if (raw && candles.length === 0) {
      renderBanner(ui.banners, 'Your saved collection could not be read, so the log is starting empty.');
    }
  }

  ui.form.addEventListener('submit', submit);
  ui.rating.addEventListener('keydown', onRatingKey);

  // One delegated click listener for the whole page.
  document.addEventListener('click', (e) => {
    const flame = e.target.closest('.flame');
    if (flame) return setRating(Number(flame.dataset.value));
    if (e.target.classList.contains('banner')) return renderBanner(ui.banners, '');
    if (e.target.closest('[data-act="add"]')) return openEditor(null);
    if (e.target.closest('.card')) onGridClick(e);
  });

  view();
}

start();
