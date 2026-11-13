import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { renderStaticHipPage, writeStaticHipPages } from './static-pages.js';

const template = `<!doctype html>
<html><head>
<title>Hiero Improvement Proposals</title>
<meta name="description" content="Browse, search, and filter all Hiero Improvement Proposals.">
<meta property="og:title" content="Hiero Improvement Proposals">
<meta property="og:description" content="Browse, search, and filter all Hiero Improvement Proposals.">
</head><body>
<div id="list-view"></div>
<div id="detail-view" class="hidden">
<h1 id="hip-title"></h1>
<a id="suggest-edit" href="#">Edit</a>
<a id="discuss-link" href="#">Discuss</a>
<table class="meta-table" id="hip-meta-table"><tbody></tbody></table>
<article id="hip-content"></article>
</div>
</body></html>`;

const draft = {
  hip: 1500,
  title: 'A draft <proposal>',
  status: 'Draft',
  type: 'Standards Track',
  category: 'Service',
  author: 'A. Author',
  created: '2026-04-29',
  updated: '2026-06-22',
  isDraft: true,
  content: '## Abstract\nUseful summary.',
  source: { url: 'https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1500' },
  urls: { discussion: 'https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1500' },
};

test('renderStaticHipPage embeds escaped full content and machine-readable alternates', () => {
  const html = renderStaticHipPage(template, draft, '---\nhip: 1500\n---\n<script>alert(1)</script>');

  assert.match(html, /<title>HIP-1500: A draft &lt;proposal&gt;<\/title>/);
  assert.match(html, /<div id="list-view" class="hidden">/);
  assert.match(html, /<div id="detail-view">/);
  assert.match(html, /Open pull request draft — not an adopted specification/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /rel="canonical" href="https:\/\/hips\.hedera\.com\/hip\/hip-1500"/);
  assert.match(html, /type="text\/markdown" href="https:\/\/hips\.hedera\.com\/hip\/hip-1500\.md"/);
  assert.match(html, /id="discuss-link" href="https:\/\/github\.com\/hiero-ledger\/hiero-improvement-proposals\/pull\/1500"/);
});

test('writeStaticHipPages creates a progressive HTML page for every catalog entry', () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hips-static-pages-'));
  fs.mkdirSync(path.join(distDir, 'api'), { recursive: true });
  fs.mkdirSync(path.join(distDir, 'hip'), { recursive: true });
  fs.writeFileSync(path.join(distDir, 'index.html'), template);
  fs.writeFileSync(path.join(distDir, 'api', 'hips.json'), JSON.stringify({ hips: [draft] }));
  fs.writeFileSync(path.join(distDir, 'hip', 'hip-1500.md'), 'Full draft content');

  const count = writeStaticHipPages({ distDir });

  assert.equal(count, 1);
  const output = fs.readFileSync(path.join(distDir, 'hip', 'hip-1500', 'index.html'), 'utf8');
  const cleanUrlTarget = fs.readFileSync(path.join(distDir, 'hip', 'hip-1500.html'), 'utf8');
  assert.match(output, /Full draft content/);
  assert.match(output, /HIP-1500/);
  assert.equal(cleanUrlTarget, output);
});
