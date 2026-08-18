// HTML escaping — defence in depth.
// The primary XSS mitigation is structural: cards are built from a <template>
// and user strings are assigned via textContent, which cannot execute markup.
// This helper covers the rare value that must reach an attribute.

// The ampersand MUST come first — escaping it last would turn an already-escaped
// "&lt;" into "&amp;lt;", the classic double-escaping bug.
const REPLACEMENTS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Never throws: non-strings are coerced, null/undefined become ''.
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => REPLACEMENTS[char]);
}
