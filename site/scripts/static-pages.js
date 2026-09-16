import fs from 'fs';
import path from 'path';
import { DEFAULT_SITE_URL } from './ai-artifacts.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeSiteUrl(value) {
  return String(value || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

function plainDescription(hip) {
  const text = String(hip.content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#>*_`\[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (text || `${hip.title} — Hiero Improvement Proposal.`).slice(0, 240);
}

function metadataRows(hip) {
  const fields = [
    ['HIP', hip.hip],
    ['Status', hip.status],
    ['Type', hip.type],
    ['Category', hip.category],
    ['Author', hip.author],
    ['Created', hip.created],
    ['Updated', hip.updated],
  ];
  return fields
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('');
}

export function renderStaticHipPage(template, hip, markdown, { siteUrl = DEFAULT_SITE_URL } = {}) {
  const canonicalSite = normalizeSiteUrl(siteUrl);
  const canonical = `${canonicalSite}/hip/hip-${hip.hip}`;
  const markdownUrl = `${canonical}.md`;
  const jsonUrl = `${canonicalSite}/api/hips/${hip.hip}.json`;
  const sourceUrl = hip.source?.url || hip.urls?.repository || '';
  const discussionUrl = hip.urls?.discussion || sourceUrl || canonicalSite;
  const title = `HIP-${hip.hip}: ${hip.title}`;
  const description = plainDescription(hip);
  const sourceLabel = hip.isDraft
    ? 'Open pull request draft — not an adopted specification.'
    : `Merged proposal${hip.status ? ` · ${hip.status}` : ''}.`;
  const sourceLink = sourceUrl
    ? ` <a href="${escapeHtml(sourceUrl)}">View canonical source.</a>`
    : '';
  const articleJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url: canonical,
    dateCreated: hip.created || undefined,
    dateModified: hip.updated || undefined,
    author: hip.author ? { '@type': 'Person', name: hip.author } : undefined,
    creativeWorkStatus: hip.isDraft ? 'Draft' : hip.status || undefined,
    isPartOf: {
      '@type': 'CollectionPage',
      name: 'Hiero Improvement Proposals',
      url: `${canonicalSite}/`,
    },
    sameAs: sourceUrl || undefined,
  }).replace(/</g, '\\u003c');

  const html = template
    .replace('<title>Hiero Improvement Proposals</title>', `<title>${escapeHtml(title)}</title>`)
    .replace(
      '<meta name="description" content="Browse, search, and filter all Hiero Improvement Proposals.">',
      `<meta name="description" content="${escapeHtml(description)}">`,
    )
    .replace(
      '<meta property="og:title" content="Hiero Improvement Proposals">',
      `<meta property="og:title" content="${escapeHtml(title)}">`,
    )
    .replace(
      '<meta property="og:description" content="Browse, search, and filter all Hiero Improvement Proposals.">',
      `<meta property="og:description" content="${escapeHtml(description)}">`,
    )
    .replace('</head>', [
      `  <link rel="canonical" href="${escapeHtml(canonical)}">`,
      `  <link rel="alternate" type="text/markdown" href="${escapeHtml(markdownUrl)}" title="${escapeHtml(title)} as Markdown">`,
      `  <link rel="alternate" type="application/json" href="${escapeHtml(jsonUrl)}" title="${escapeHtml(title)} as JSON">`,
      `  <script type="application/ld+json">${articleJsonLd}</script>`,
      '</head>',
    ].join('\n'))
    .replace('<div id="list-view">', '<div id="list-view" class="hidden">')
    .replace('<div id="detail-view" class="hidden">', '<div id="detail-view">')
    .replace('<h1 id="hip-title"></h1>', `<h1 id="hip-title">${escapeHtml(title)}</h1>`)
    .replace(
      '<table class="meta-table" id="hip-meta-table"><tbody></tbody></table>',
      `<table class="meta-table" id="hip-meta-table"><tbody>${metadataRows(hip)}</tbody></table>`,
    )
    .replace(
      '<article id="hip-content"></article>',
      `<article id="hip-content"><p class="static-source-notice"><strong>${escapeHtml(sourceLabel)}</strong>${sourceLink}</p><pre class="static-hip-markdown">${escapeHtml(markdown)}</pre></article>`,
    )
    .replace('id="suggest-edit" href="#"', `id="suggest-edit" href="${escapeHtml(sourceUrl || canonicalSite)}"`)
    .replace('id="discuss-link" href="#"', `id="discuss-link" href="${escapeHtml(discussionUrl)}"`);

  return html;
}

export function writeStaticHipPages({ distDir, siteUrl = DEFAULT_SITE_URL }) {
  const templatePath = path.join(distDir, 'index.html');
  const catalogPath = path.join(distDir, 'api', 'hips.json');
  if (!fs.existsSync(templatePath) || !fs.existsSync(catalogPath)) return 0;

  const template = fs.readFileSync(templatePath, 'utf8');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  let written = 0;

  for (const hip of catalog.hips || []) {
    const markdownPath = path.join(distDir, 'hip', `hip-${hip.hip}.md`);
    if (!fs.existsSync(markdownPath)) continue;

    const outputDir = path.join(distDir, 'hip', `hip-${hip.hip}`);
    const markdown = fs.readFileSync(markdownPath, 'utf8');
    const html = renderStaticHipPage(template, hip, markdown, { siteUrl });
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'hip', `hip-${hip.hip}.html`), html, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf8');
    written++;
  }

  return written;
}
