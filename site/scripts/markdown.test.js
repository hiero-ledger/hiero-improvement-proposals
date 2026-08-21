import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { marked } from 'marked';
import { renderMermaidCode } from '../src/markdown.js';

marked.use({
  renderer: {
    code: renderMermaidCode,
  },
});

test('renders Mermaid code fences as diagram containers', () => {
  const source = ['```mermaid', 'graph TD', '    Idea --> Draft', '```'].join('\n');
  const rendered = marked.parse(source);

  assert.match(rendered, /^<div class="mermaid">graph TD/);
  assert.match(rendered, /Idea --&gt; Draft<\/div>/);
});

test('escapes Mermaid source before inserting it into HTML', () => {
  const rendered = renderMermaidCode({
    lang: 'mermaid',
    text: 'graph TD\n    A["<script>alert(1)</script>"] --> B',
  });

  assert.equal(
    rendered,
    '<div class="mermaid">graph TD\n    A[&quot;&lt;script&gt;alert(1)&lt;/script&gt;&quot;] --&gt; B</div>\n',
  );
});

test('falls back to the default renderer for other code fences', () => {
  assert.equal(renderMermaidCode({ lang: 'javascript', text: 'const x = 1;' }), false);
});

test('HIP-1 embeds both workflows and keeps Hedera review independent', () => {
  const hip1 = fs.readFileSync(new URL('../../HIP/hip-1.md', import.meta.url), 'utf8');
  const diagrams = [...hip1.matchAll(/```mermaid\n([\s\S]*?)```/g)].map(match => match[1]);

  assert.equal(diagrams.length, 2);
  assert.match(diagrams[0], /Idea -. May occur at any time .-> Hedera/);
  assert.doesNotMatch(diagrams[0], /LastCall --> Hedera/);
});
