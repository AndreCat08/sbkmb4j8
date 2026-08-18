# Candle Collection Log

A cozy single-page app for cataloguing every candle you own or have burned through —
name, brand, scent notes, status, rating, and personal notes. Everything lives in
`localStorage`, so your collection survives a refresh.

## Running it

ES modules need an HTTP origin (opening `index.html` over `file://` blocks module loading),
so serve the folder:

```bash
npx serve .
# or
python -m http.server
```

Then open the printed URL.

## Running the tests

```bash
npm test
```

No install step. There are **zero dependencies** — the suite runs on Node's built-in
test runner (`node --test`, Node 18+).

## Architecture

The business logic is completely separated from the DOM, which is what makes it testable
in Node without a browser or any mocking library:

| File | Responsibility |
|---|---|
| `src/escape.js` | HTML escaping (defense in depth) |
| `src/model.js` | The candle entity: parse, validate, create, update, normalize |
| `src/store.js` | Pure reducers over `Candle[]` |
| `src/summary.js` | Derivations: status counts, sorting, filtering |
| `src/storage.js` | Versioned persistence with defensive parsing |
| `src/render.js` | DOM rendering — the only module that touches `document` |
| `src/main.js` | Wiring: events → store → storage → render |

`escape.js`, `model.js`, `store.js`, `summary.js`, and `storage.js` never reference
`document`, `window`, or `localStorage`. Storage takes an adapter as a parameter, and
entity creation takes an injected clock and ID generator — so every one of them is
directly unit-tested.

Data flows one direction:

```
DOM event → main.js → store.js reducer → new state array
                            ↓
                    storage.saveCandles(adapter, state)
                            ↓
                    render(root, state, summary)
```

## Notes on robustness

- **Corrupt `localStorage` never wipes the collection.** Parsing is per-entry: one bad
  row is dropped and the rest survive. Malformed JSON, a legacy bare array, an unknown
  schema version, and a throwing storage adapter are all handled without throwing.
- **XSS-safe by construction.** Cards are built from a `<template>` and every
  user-supplied string is set via `textContent`, never `innerHTML`. `localStorage` is
  treated as untrusted input, exactly like a fresh form submission.
- **Quota exhaustion never loses data silently** — the entry stays in memory and the UI
  says so.
