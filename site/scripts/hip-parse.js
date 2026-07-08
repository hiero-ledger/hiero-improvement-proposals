// Pure HIP parsing/formatting helpers, extracted from build-data.js so they can
// be unit- and property-tested in isolation (see hip-parse.test.js) without
// running the full build. Kept dependency-light (gray-matter only) and free of
// filesystem/network side effects.
import matter from 'gray-matter';

export function parseMarkdown(raw) {
  try {
    return matter(raw);
  } catch (e) {
    // Fallback: manual frontmatter parse for files with YAML issues
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;
    const dataMap = new Map();
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      dataMap.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
    }
    return { data: Object.fromEntries(dataMap), content: match[2] };
  }
}

export function extractHip(data, content, extra = {}) {
  return {
    hip: data.hip,
    title: data.title || '',
    author: data.author || '',
    type: data.type || '',
    category: data.category || '',
    status: data.status || '',
    created: data.created || '',
    updated: data.updated || '',
    'discussions-to': data['discussions-to'] || '',
    'needs-hiero-approval': data['needs-hiero-approval'] || '',
    'needs-hedera-review': data['needs-hedera-review'] || data['needs-council-approval'] || '',
    'last-call-date-time': data['last-call-date-time'] || '',
    'requested-by': data['requested-by'] || '',
    'working-group': data['working-group'] || '',
    requires: data.requires || '',
    'superseded-by': data['superseded-by'] || '',
    replaces: data.replaces || '',
    release: data.release || '',
    ...extra,
  };
}

export function parsePositiveInteger(value) {
  if (value === null || value === undefined) return null;

  // String(value) can throw for exotic objects (e.g. a non-callable toString
  // arriving from malformed YAML frontmatter); treat those as "not a number".
  let normalized;
  try {
    normalized = String(value).trim().replace(/^['"]|['"]$/g, '');
  } catch {
    return null;
  }
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function draftHipNumber(frontmatterHip, prNumber, filePath) {
  const frontmatterNumber = parsePositiveInteger(frontmatterHip);
  if (frontmatterNumber) return frontmatterNumber;

  const fileNumber = parsePositiveInteger(filePath.match(/^HIP\/hip-(\d+)(?:-[^/]*)?\.md$/i)?.[1]);
  return fileNumber || prNumber;
}

// For merged HIPs, assets are copied into public/assets/ so we rewrite ../assets/ → /assets/.
// For draft HIPs, the assets live only on the PR branch, so we rewrite to raw.githubusercontent.com
// pinned to the PR's commit SHA. GitHub serves commits from open PR forks via the upstream repo URL.
export function replaceHipImages(content, { rawBase, availableAssets } = {}) {
  // Replace image references with placeholders (actual mermaid divs injected post-markdown in main.js)
  content = content.replace(/!\[HIP States\]\([^)]*hip-states-standards-track\.[^)]*\)/g, '<!--DIAGRAM:STANDARDS_TRACK-->');
  content = content.replace(/!\[HIP States\]\([^)]*hip-states-ipa\.[^)]*\)/g, '<!--DIAGRAM:IPA-->');

  // For draft HIPs we know exactly which asset files exist in the PR. Replace
  // markdown image references to assets that are NOT in the PR with a friendly
  // placeholder so the page doesn't show a broken-image icon. (Common cause:
  // author wrote ![alt](../assets/hipN/foo.png) but forgot to commit foo.png.)
  if (availableAssets) {
    content = content.replace(
      /!\[([^\]]*)\]\(\s*\.\.\/(assets\/[^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g,
      (match, alt, assetPath) => {
        // Untrusted PR content can contain malformed percent-encoding (e.g. a
        // literal "%" in an asset path); decodeURIComponent throws URIError on
        // those, which would abort the whole build. Fall back to the raw path.
        let decoded;
        try {
          decoded = decodeURIComponent(assetPath);
        } catch {
          decoded = assetPath;
        }
        if (availableAssets.has(decoded)) return match;
        const label = alt || decoded.split('/').pop();
        return `<div class="missing-diagram"><strong>Diagram missing from PR:</strong> <code>${decoded}</code><br><span>(${label})</span></div>`;
      }
    );
  }

  // Rewrite remaining relative asset paths. Draft HIPs use the PR-pinned raw URL; merged HIPs use /assets/.
  const replacement = rawBase ? `${rawBase}/assets/` : '/assets/';
  content = content.replace(/\.\.\/assets\//g, replacement);
  return content;
}
