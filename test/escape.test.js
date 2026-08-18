import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/escape.js';

test('escapeHtml neutralizes markup, attribute breakouts, and non-strings', () => {
  const cases = [
    ['<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;'],
    ['" onerror="alert(1)', '&quot; onerror=&quot;alert(1)'],
    ["' onload='x", '&#39; onload=&#39;x'],
    ['a & b', 'a &amp; b'],
    ['5 < 6 > 4', '5 &lt; 6 &gt; 4'],
    // & is escaped first, so "&lt;" must not become "&amp;lt;" (double-escaping bug)
    ['&lt;', '&amp;lt;'],
    ['', ''], ['cedarwood, vanilla', 'cedarwood, vanilla'],
    [null, ''], [undefined, ''], [42, '42'], [false, 'false'], [['<a>'], '&lt;a&gt;'],
  ];
  for (const [input, expected] of cases) assert.equal(escapeHtml(input), expected, String(input));
});
