import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const HIP_DIR = path.resolve('../HIP');
const DATA_DIR = path.resolve('../_data');
const OUT_DIR = path.resolve('public/data');
const REPO_OWNER = 'hiero-ledger';
const REPO_NAME = 'hiero-improvement-proposals';

fs.mkdirSync(OUT_DIR, { recursive: true });

function parseMarkdown(raw) {
  try {
    return matter(raw);
  } catch (e) {
    // Fallback: manual frontmatter parse for files with YAML issues
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;
    const data = {};
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return { data, content: match[2] };
  }
}

function extractHip(data, content, extra = {}) {
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
    'needs-hedera-review': data['needs-hedera-review'] || '',
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

// ---- Parse merged HIPs from the HIP/ directory ----
const files = fs.readdirSync(HIP_DIR).filter(f => f.endsWith('.md'));
const hips = [];
const hipBodies = {};
const mergedHipNumbers = new Set();

for (const file of files) {
  const raw = fs.readFileSync(path.join(HIP_DIR, file), 'utf-8');
  const parsed = parseMarkdown(raw);
  if (!parsed || !parsed.data.hip) continue;

  if (parsed !== null && !parsed.data.hip) continue;
  mergedHipNumbers.add(Number(parsed.data.hip));
  hips.push(extractHip(parsed.data, parsed.content));
  hipBodies[parsed.data.hip] = parsed.content;
}

console.log(`Parsed ${hips.length} merged HIPs`);

// ---- Fetch draft HIPs from open PRs ----
const draftHipsPath = path.join(DATA_DIR, 'draft_hips.json');

async function fetchDraftHips() {
  if (!fs.existsSync(draftHipsPath)) return;

  const draftPRs = JSON.parse(fs.readFileSync(draftHipsPath, 'utf-8'));
  let fetched = 0;
  let skipped = 0;

  for (const pr of draftPRs) {
    if (mergedHipNumbers.has(pr.number)) {
      skipped++;
      continue;
    }

    // Find the HIP markdown file in this PR's changed files
    const hipFile = pr.files?.edges?.find(f =>
      f.node.path.startsWith('HIP/') &&
      f.node.path.endsWith('.md') &&
      !f.node.path.includes('template')
    );

    if (!hipFile || !pr.headRefOid) {
      console.warn(`  PR-${pr.number}: no HIP markdown file found, skipping`);
      continue;
    }

    const filePath = hipFile.node.path;
    const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${pr.headRefOid}/${filePath}`;

    try {
      const res = await fetch(rawUrl);
      if (!res.ok) {
        console.warn(`  PR-${pr.number}: fetch failed (${res.status}) for ${filePath}`);
        continue;
      }

      const raw = await res.text();
      const parsed = parseMarkdown(raw);
      if (!parsed || !parsed.data.hip && !parsed.data.title) {
        console.warn(`  PR-${pr.number}: could not parse frontmatter from ${filePath}`);
        continue;
      }

      // Use the PR number as the HIP number if frontmatter doesn't have one
      const hipNum = parsed.data.hip || pr.number;

      // Force status to Draft if not already set or if it differs
      const data = {
        ...parsed.data,
        hip: hipNum,
        status: parsed.data.status || 'Draft',
        'discussions-to': parsed.data['discussions-to'] || pr.url || '',
      };

      hips.push(extractHip(data, parsed.content));
      hipBodies[hipNum] = parsed.content;
      fetched++;
      console.log(`  PR-${pr.number}: fetched HIP-${hipNum} "${data.title}"`);
    } catch (e) {
      console.warn(`  PR-${pr.number}: error fetching ${filePath}: ${e.message}`);
    }
  }

  console.log(`Fetched ${fetched} draft HIPs from open PRs (${skipped} already merged)`);
}

async function main() {
  await fetchDraftHips();

  hips.sort((a, b) => Number(a.hip) - Number(b.hip));

  fs.writeFileSync(path.join(OUT_DIR, 'hips.json'), JSON.stringify(hips, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'hip-bodies.json'), JSON.stringify(hipBodies));

  console.log(`Built data for ${hips.length} total HIPs`);
}

main();
