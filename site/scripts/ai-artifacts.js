import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export const DEFAULT_SITE_URL = 'https://hips.hedera.com';

function normalizeSiteUrl(value) {
  const url = new URL(value || DEFAULT_SITE_URL);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function markdownLabel(value) {
  return cleanText(value).replace(/[\\[\]]/g, '\\$&');
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function absoluteContentUrls(content, siteUrl) {
  return String(content || '')
    .replace(/\]\(\/(?!\/)/g, `](${siteUrl}/`)
    .replace(/\b(src|href)=(['"])\/(?!\/)/g, `$1=$2${siteUrl}/`);
}

function emptyGeneratedFiles(directory, extension) {
  fs.mkdirSync(directory, { recursive: true });
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(extension)) {
      fs.unlinkSync(path.join(directory, entry.name));
    }
  }
}

function writeUtf8(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function prepareDocuments(documents, siteUrl) {
  const seen = new Set();

  return documents
    .map((document) => {
      const metadata = jsonSafe(document.metadata || document.hip || {});
      const number = Number(metadata.hip ?? document.hip?.hip);
      if (!Number.isSafeInteger(number) || number <= 0) {
        throw new Error(`Cannot generate AI artifact for invalid HIP number: ${metadata.hip}`);
      }
      if (seen.has(number)) throw new Error(`Cannot generate duplicate HIP-${number} artifact`);
      seen.add(number);

      const source = jsonSafe(document.source || {});
      const urls = {
        html: `${siteUrl}/hip/hip-${number}`,
        markdown: `${siteUrl}/hip/hip-${number}.md`,
        json: `${siteUrl}/api/hips/${number}.json`,
        repository: source.url || '',
        discussion: metadata['discussions-to'] || '',
      };
      const content = absoluteContentUrls(document.body, siteUrl).trim();
      const title = cleanText(metadata.title || document.hip?.title);
      const isDraft = source.kind === 'pull_request';

      const markdown = matter.stringify(`${content}\n`, {
        ...metadata,
        canonical: urls.html,
        'machine-readable': urls.markdown,
        'source-kind': isDraft ? 'open-pull-request' : 'merged',
        'source-url': source.url || '',
        'source-revision': source.commit || source.ref || '',
        'source-path': source.path || '',
      });

      return {
        hip: number,
        title,
        status: cleanText(metadata.status),
        type: cleanText(metadata.type),
        category: cleanText(metadata.category),
        author: cleanText(metadata.author),
        created: isoDate(metadata.created),
        updated: isoDate(metadata.updated),
        isDraft,
        metadata,
        source,
        urls,
        content,
        markdown,
      };
    })
    .sort((a, b) => a.hip - b.hip);
}

function indexRecord(document) {
  const { content, markdown, ...record } = document;
  return record;
}

function fullRecord(document) {
  const { markdown, ...record } = document;
  return record;
}

function llmsIndex(documents, siteUrl, generatedAt, sourceRevision) {
  const merged = documents.filter((document) => !document.isDraft);
  const drafts = documents.filter((document) => document.isDraft);
  const lines = [
    '# Hiero Improvement Proposals (HIPs)',
    '',
    '> Canonical index of Hiero Improvement Proposals, including merged HIPs and unmerged HIP drafts from open pull requests.',
    '',
    'Use the stable, non-JavaScript resources below. Open-pull-request drafts are proposals under review and must not be treated as adopted or final specifications.',
    '',
    '## Machine-readable resources',
    '',
    `- [Metadata index (JSON)](${siteUrl}/api/hips/index.json): Compact metadata, provenance, and content URLs for every HIP.`,
    `- [Complete catalog (JSON)](${siteUrl}/api/hips.json): Metadata and full Markdown content for every HIP in one response.`,
    `- [Complete catalog (Markdown)](${siteUrl}/llms-full.txt): Every HIP, including frontmatter and full proposal text, in one document.`,
    `- [XML sitemap](${siteUrl}/sitemap.xml): Human and Markdown URLs for crawler discovery.`,
    `- [Source repository](https://github.com/hiero-ledger/hiero-improvement-proposals): Canonical source and open pull requests.`,
    '',
    `Generated: ${generatedAt}`,
  ];

  if (sourceRevision) lines.push(`Source revision: ${sourceRevision}`);

  const appendDocuments = (heading, description, items) => {
    lines.push('', `## ${heading}`, '', description, '');
    for (const document of items) {
      const qualifiers = [document.status, document.type, document.category].filter(Boolean).join(' · ');
      const suffix = qualifiers ? `: ${qualifiers}` : '';
      lines.push(`- [HIP-${document.hip}: ${markdownLabel(document.title)}](${document.urls.markdown})${suffix}`);
    }
  };

  appendDocuments(
    'Merged HIPs',
    'These documents are present on the repository default branch. Their lifecycle status is recorded in each document.',
    merged,
  );

  appendDocuments(
    'Open pull request drafts',
    'These documents exist only in open pull requests. Follow each document’s source URL for the current review state.',
    drafts,
  );

  return `${lines.join('\n')}\n`;
}

function llmsFull(documents, generatedAt, sourceRevision) {
  const lines = [
    '# Hiero Improvement Proposals: complete machine-readable corpus',
    '',
    `Generated: ${generatedAt}`,
  ];
  if (sourceRevision) lines.push(`Source revision: ${sourceRevision}`);
  lines.push(
    '',
    '> Documents marked `source-kind: open-pull-request` are unmerged drafts under review, not adopted specifications.',
    '',
  );

  for (const document of documents) {
    lines.push(
      `<!-- BEGIN HIP-${document.hip} -->`,
      document.markdown.trim(),
      `<!-- END HIP-${document.hip} -->`,
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}

function sitemap(documents, siteUrl) {
  const urls = [
    { loc: `${siteUrl}/` },
    { loc: `${siteUrl}/llms.txt` },
    { loc: `${siteUrl}/llms-full.txt` },
    { loc: `${siteUrl}/api/hips/index.json` },
    { loc: `${siteUrl}/api/hips.json` },
  ];

  for (const document of documents) {
    const lastmod = document.updated || document.created;
    urls.push({ loc: document.urls.html, lastmod });
    urls.push({ loc: document.urls.markdown, lastmod });
  }

  const body = urls.map(({ loc, lastmod }) => [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    '  </url>',
  ].filter(Boolean).join('\n')).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    '',
  ].join('\n');
}

export function writeAiArtifacts({
  documents,
  publicDir,
  siteUrl = DEFAULT_SITE_URL,
  generatedAt = new Date().toISOString(),
  sourceRevision = '',
}) {
  const canonicalSiteUrl = normalizeSiteUrl(siteUrl);
  const prepared = prepareDocuments(documents, canonicalSiteUrl);
  const mergedCount = prepared.filter((document) => !document.isDraft).length;
  const draftCount = prepared.length - mergedCount;
  const index = prepared.map(indexRecord);
  const full = prepared.map(fullRecord);
  const envelope = {
    schemaVersion: 1,
    generatedAt,
    sourceRevision: sourceRevision || null,
    canonicalSite: canonicalSiteUrl,
    repository: 'https://github.com/hiero-ledger/hiero-improvement-proposals',
    notice: 'Entries with isDraft=true come from open pull requests and are not adopted specifications.',
    counts: { total: prepared.length, merged: mergedCount, openPullRequestDrafts: draftCount },
  };

  const hipMarkdownDir = path.join(publicDir, 'hip');
  const hipJsonDir = path.join(publicDir, 'api', 'hips');
  emptyGeneratedFiles(hipMarkdownDir, '.md');
  emptyGeneratedFiles(hipJsonDir, '.json');

  for (const document of prepared) {
    writeUtf8(path.join(hipMarkdownDir, `hip-${document.hip}.md`), document.markdown);
    writeUtf8(
      path.join(hipJsonDir, `${document.hip}.json`),
      JSON.stringify({ ...envelope, hip: fullRecord(document) }, null, 2),
    );
  }

  const llms = llmsIndex(prepared, canonicalSiteUrl, generatedAt, sourceRevision);
  writeUtf8(path.join(publicDir, 'llms.txt'), llms);
  writeUtf8(path.join(publicDir, 'llm.txt'), llms);
  writeUtf8(path.join(publicDir, 'llms-full.txt'), llmsFull(prepared, generatedAt, sourceRevision));
  writeUtf8(path.join(publicDir, 'api', 'hips', 'index.json'), JSON.stringify({ ...envelope, hips: index }, null, 2));
  writeUtf8(path.join(publicDir, 'api', 'hips.json'), JSON.stringify({ ...envelope, hips: full }, null, 2));
  writeUtf8(path.join(publicDir, 'sitemap.xml'), sitemap(prepared, canonicalSiteUrl));
  writeUtf8(path.join(publicDir, 'robots.txt'), [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${canonicalSiteUrl}/sitemap.xml`,
    '',
  ].join('\n'));

  return { total: prepared.length, merged: mergedCount, drafts: draftCount };
}
