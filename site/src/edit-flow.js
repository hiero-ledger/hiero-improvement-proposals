import { marked } from 'marked';

// Shared, DOM-free pieces of the HIP edit flow. Keeping them here lets the
// Node test suite exercise them directly; main.js wires them to the modal.

const DEFAULT_OWNER = 'hiero-ledger';
const DEFAULT_REPO = 'hiero-improvement-proposals';

// `---` frontmatter fence, an optional YAML block, the closing fence, then an
// optional blank line before the markdown body. Tolerates CRLF line endings.
const FRONTMATTER_RE = /^---\r?\n(?:([\s\S]*?)\r?\n)?---\r?\n(?:\r?\n)?([\s\S]*)$/;

export function splitFrontmatter(raw) {
  const text = String(raw ?? '');
  const match = text.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: '', body: text };
  return { frontmatter: match[1] || '', body: match[2] };
}

/**
 * Render the markdown body of a HIP source file (frontmatter excluded) with
 * the same `marked` instance the detail page uses. Returns an HTML string.
 */
export function editPreviewHtml(raw, { parse = markdown => marked.parse(markdown) } = {}) {
  const { body } = splitFrontmatter(raw);
  if (!body.trim()) return '';
  const rendered = parse(body);
  return typeof rendered === 'string' ? rendered : '';
}

function encodeSegments(value) {
  return String(value).split('/').map(encodeURIComponent).join('/');
}

/**
 * GitHub's web editor URL for the file a HIP is displayed from: the PR head
 * branch for draft HIPs, otherwise the merged file on main. GitHub handles
 * forking and the "Propose changes" pull request from there.
 */
export function githubEditorUrl(source, details = null, { owner = DEFAULT_OWNER, repo = DEFAULT_REPO } = {}) {
  const path = encodeSegments(source?.path || '');

  if (source?.kind === 'pull_request') {
    const headOwner = details?.headOwner || source.headOwner || '';
    const headRepo = details?.headRepo || source.headRepo || '';
    const headBranch = details?.headBranch || source.headBranch || '';
    if (headOwner && headRepo && headBranch) {
      return `https://github.com/${encodeURIComponent(headOwner)}/${encodeURIComponent(headRepo)}/edit/${encodeSegments(headBranch)}/${path}`;
    }
    return source.prUrl || `https://github.com/${owner}/${repo}/pull/${source.prNumber || ''}/files`;
  }

  const sourceOwner = source?.owner || owner;
  const sourceRepo = source?.repo || repo;
  return `https://github.com/${sourceOwner}/${sourceRepo}/edit/${encodeSegments(source?.branch || 'main')}/${path}`;
}

/**
 * How one-click "Submit PR" can obtain a GitHub token on this deployment:
 * a runtime token provider, the OAuth broker popup, or nothing at all.
 */
export function githubConnectMode({ tokenProvider, authStartUrl } = {}) {
  if (typeof tokenProvider === 'function') return 'provider';
  if (typeof authStartUrl === 'string' && authStartUrl.trim()) return 'popup';
  return 'none';
}
