import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { marked } from 'marked';
import { renderMermaidCode } from '../src/markdown.js';
import {
  splitFrontmatter,
  editPreviewHtml,
  githubEditorUrl,
  githubConnectMode,
} from '../src/edit-flow.js';

// Mirror the renderer main.js installs so Mermaid fences preview the same way
// they render on the HIP detail page.
marked.use({
  renderer: {
    code: renderMermaidCode,
  },
});

const PR_SOURCE = {
  kind: 'pull_request',
  owner: 'hiero-ledger',
  repo: 'hiero-improvement-proposals',
  branch: 'main',
  path: 'HIP/hip-1495.md',
  prNumber: 1495,
  prUrl: 'https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1495',
  headOwner: 'hiero-ledger',
  headRepo: 'hiero-improvement-proposals',
  headBranch: 'LM-network-deployment',
};

test('splitFrontmatter separates YAML frontmatter from the markdown body', () => {
  const raw = '---\nhip: 1\ntitle: Test\n---\n\n# Heading\n\nBody text.\n';
  const { frontmatter, body } = splitFrontmatter(raw);

  assert.equal(frontmatter, 'hip: 1\ntitle: Test');
  assert.equal(body, '# Heading\n\nBody text.\n');
});

test('splitFrontmatter handles CRLF line endings and documents without frontmatter', () => {
  const crlf = splitFrontmatter('---\r\nhip: 2\r\n---\r\n\r\n# CRLF\r\n');
  assert.equal(crlf.frontmatter, 'hip: 2');
  assert.equal(crlf.body, '# CRLF\r\n');

  const plain = splitFrontmatter('# No frontmatter\n\nJust body.');
  assert.equal(plain.frontmatter, '');
  assert.equal(plain.body, '# No frontmatter\n\nJust body.');
});

test('editPreviewHtml renders only the body and never the frontmatter', () => {
  const html = editPreviewHtml('---\nhip: 1\ntitle: Secret\n---\n\n# Visible\n');

  assert.match(html, /<h1[^>]*>Visible<\/h1>/);
  assert.doesNotMatch(html, /title: Secret/);
});

test('editPreviewHtml renders the full HIP-1 source, including its Mermaid diagrams', () => {
  const hip1 = fs.readFileSync(new URL('../../HIP/hip-1.md', import.meta.url), 'utf8');
  const html = editPreviewHtml(hip1);

  assert.match(html, /<h2[^>]*>What is a HIP\?<\/h2>/);
  assert.equal((html.match(/<div class="mermaid">/g) || []).length, 2);
  assert.doesNotMatch(html, /<!--DIAGRAM:/);
});

test('editPreviewHtml returns an empty string for empty input', () => {
  assert.equal(editPreviewHtml(''), '');
  assert.equal(editPreviewHtml('---\nhip: 1\n---\n'), '');
});

test('githubEditorUrl targets main for merged HIPs', () => {
  const url = githubEditorUrl({
    kind: 'main',
    owner: 'hiero-ledger',
    repo: 'hiero-improvement-proposals',
    branch: 'main',
    path: 'HIP/hip-1.md',
  });

  assert.equal(url, 'https://github.com/hiero-ledger/hiero-improvement-proposals/edit/main/HIP/hip-1.md');
});

test('githubEditorUrl targets the PR head branch for draft HIPs', () => {
  assert.equal(
    githubEditorUrl(PR_SOURCE),
    'https://github.com/hiero-ledger/hiero-improvement-proposals/edit/LM-network-deployment/HIP/hip-1495.md',
  );
});

test('githubEditorUrl prefers live PR details over build-time data', () => {
  const url = githubEditorUrl(PR_SOURCE, {
    headOwner: 'leninmehedy',
    headRepo: 'hiero-improvement-proposals',
    headBranch: 'feature/k8s-nodes',
  });

  assert.equal(
    url,
    'https://github.com/leninmehedy/hiero-improvement-proposals/edit/feature/k8s-nodes/HIP/hip-1495.md',
  );
});

test('githubEditorUrl falls back to the PR page when the head branch is unknown', () => {
  const url = githubEditorUrl({ ...PR_SOURCE, headOwner: '', headRepo: '', headBranch: '' });
  assert.equal(url, PR_SOURCE.prUrl);

  const noPrUrl = githubEditorUrl({ ...PR_SOURCE, headOwner: '', headRepo: '', headBranch: '', prUrl: '' });
  assert.equal(noPrUrl, 'https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1495/files');
});

test('githubEditorUrl encodes path and branch segments without encoding separators', () => {
  const url = githubEditorUrl({
    kind: 'main',
    owner: 'hiero-ledger',
    repo: 'hiero-improvement-proposals',
    branch: 'release/v1 draft',
    path: 'HIP/hip-9999 draft.md',
  });

  assert.equal(
    url,
    'https://github.com/hiero-ledger/hiero-improvement-proposals/edit/release/v1%20draft/HIP/hip-9999%20draft.md',
  );
});

test('githubConnectMode reports how one-click submission can authenticate', () => {
  assert.equal(githubConnectMode({}), 'none');
  assert.equal(githubConnectMode({ authStartUrl: '' }), 'none');
  assert.equal(githubConnectMode({ authStartUrl: 'https://auth.example.com/start' }), 'popup');
  assert.equal(githubConnectMode({ tokenProvider: () => 'token' }), 'provider');
  assert.equal(
    githubConnectMode({ tokenProvider: () => 'token', authStartUrl: 'https://auth.example.com/start' }),
    'provider',
  );
  assert.equal(githubConnectMode({ tokenProvider: 'not a function' }), 'none');
});
