import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeAiArtifacts } from './ai-artifacts.js';

function document({ hip, title, body, source, status = 'Final' }) {
  const metadata = {
    hip,
    title,
    author: 'A. Author (@author)',
    type: 'Standards Track',
    category: 'Core',
    status,
    created: new Date('2026-01-02T00:00:00.000Z'),
  };
  return { hip: metadata, metadata, body, source };
}

test('writeAiArtifacts emits discoverable full-content resources and draft provenance', () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hips-ai-artifacts-'));
  fs.mkdirSync(path.join(publicDir, 'hip'), { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'hip', 'hip-999.md'), 'stale');

  const result = writeAiArtifacts({
    publicDir,
    siteUrl: 'https://hips.hedera.com/',
    generatedAt: '2026-07-20T12:00:00.000Z',
    sourceRevision: 'abc123',
    documents: [
      document({
        hip: 1,
        title: 'HIP process',
        body: '## Abstract\n\nMerged body.\n\n![diagram](/assets/hip-1/flow.png)',
        source: {
          kind: 'merged',
          path: 'HIP/hip-1.md',
          ref: 'abc123',
          url: 'https://github.com/hiero-ledger/hiero-improvement-proposals/blob/abc123/HIP/hip-1.md',
        },
      }),
      document({
        hip: 1500,
        title: 'Periodic Holding Fee',
        body: '## Abstract\n\nDraft body only present in a PR.',
        status: 'Draft',
        source: {
          kind: 'pull_request',
          pullRequest: 1500,
          commit: 'def456',
          path: 'HIP/hip-0000-periodic-holding-fee.md',
          author: 'AdrianKBL',
          url: 'https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1500',
        },
      }),
    ],
  });

  assert.deepEqual(result, { total: 2, merged: 1, drafts: 1 });
  assert.equal(fs.existsSync(path.join(publicDir, 'hip', 'hip-999.md')), false);

  const llms = fs.readFileSync(path.join(publicDir, 'llms.txt'), 'utf8');
  assert.match(llms, /## Merged HIPs/);
  assert.match(llms, /## Open pull request drafts/);
  assert.match(llms, /HIP-1500: Periodic Holding Fee/);
  assert.equal(fs.readFileSync(path.join(publicDir, 'llm.txt'), 'utf8'), llms);

  const mergedMarkdown = fs.readFileSync(path.join(publicDir, 'hip', 'hip-1.md'), 'utf8');
  assert.match(mergedMarkdown, /source-kind: merged/);
  assert.match(mergedMarkdown, /https:\/\/hips\.hedera\.com\/assets\/hip-1\/flow\.png/);
  assert.match(mergedMarkdown, /Merged body\./);

  const draftMarkdown = fs.readFileSync(path.join(publicDir, 'hip', 'hip-1500.md'), 'utf8');
  assert.match(draftMarkdown, /source-kind: open-pull-request/);
  assert.match(draftMarkdown, /source-revision: def456/);
  assert.match(draftMarkdown, /source-path: HIP\/hip-0000-periodic-holding-fee\.md/);
  assert.match(draftMarkdown, /Draft body only present in a PR\./);

  const index = JSON.parse(fs.readFileSync(path.join(publicDir, 'api', 'hips', 'index.json'), 'utf8'));
  assert.deepEqual(index.counts, { total: 2, merged: 1, openPullRequestDrafts: 1 });
  assert.equal(index.hips[1].isDraft, true);
  assert.equal(index.hips[1].source.pullRequest, 1500);
  assert.equal('content' in index.hips[0], false);

  const full = JSON.parse(fs.readFileSync(path.join(publicDir, 'api', 'hips.json'), 'utf8'));
  assert.equal(full.hips[1].content, '## Abstract\n\nDraft body only present in a PR.');

  const oneHip = JSON.parse(fs.readFileSync(path.join(publicDir, 'api', 'hips', '1500.json'), 'utf8'));
  assert.equal(oneHip.hip.urls.markdown, 'https://hips.hedera.com/hip/hip-1500.md');

  const completeMarkdown = fs.readFileSync(path.join(publicDir, 'llms-full.txt'), 'utf8');
  assert.match(completeMarkdown, /<!-- BEGIN HIP-1 -->/);
  assert.match(completeMarkdown, /<!-- BEGIN HIP-1500 -->/);
  assert.match(completeMarkdown, /Draft body only present in a PR\./);

  const sitemap = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /https:\/\/hips\.hedera\.com\/hip\/hip-1500\.md/);
  assert.match(sitemap, /<lastmod>2026-01-02<\/lastmod>/);

  const robots = fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf8');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/hips\.hedera\.com\/sitemap\.xml/);
});

test('writeAiArtifacts rejects duplicate HIP numbers', () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hips-ai-duplicates-'));
  const first = document({ hip: 1, title: 'One', body: '', source: { kind: 'merged' } });
  const second = document({ hip: 1, title: 'Duplicate', body: '', source: { kind: 'pull_request' } });

  assert.throws(
    () => writeAiArtifacts({ publicDir, documents: [first, second] }),
    /duplicate HIP-1/,
  );
});
