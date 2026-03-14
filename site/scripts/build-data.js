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
    const dataMap = new Map();
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      dataMap.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
    }
    return { data: Object.fromEntries(dataMap), content: match[2] };
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

// ---- Parse merged HIPs from the HIP/ directory ----
const files = fs.readdirSync(HIP_DIR).filter(f => f.endsWith('.md'));
const hips = [];
const hipBodies = {};
const mergedHipNumbers = new Set();

for (const file of files) {
  const raw = fs.readFileSync(path.join(HIP_DIR, file), 'utf-8');
  const parsed = parseMarkdown(raw);
  if (!parsed || !parsed.data.hip) continue;
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
      if (!parsed || (!parsed.data.hip && !parsed.data.title)) {
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

      hips.push(extractHip(data, parsed.content, { prNumber: pr.number }));
      hipBodies[hipNum] = parsed.content;
      fetched++;
      console.log(`  PR-${pr.number}: fetched HIP-${hipNum} "${data.title}"`);
    } catch (e) {
      console.warn(`  PR-${pr.number}: error fetching ${filePath}: ${e.message}`);
    }
  }

  console.log(`Fetched ${fetched} draft HIPs from open PRs (${skipped} already merged)`);
}

// ---- Fetch discussion comments via GraphQL (requires GITHUB_TOKEN) ----
async function fetchDiscussions() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('No GITHUB_TOKEN set — skipping discussion comment fetch');
    return {};
  }

  // Collect all discussion URLs from HIPs
  const discussionUrls = [];
  for (const hip of hips) {
    const url = hip['discussions-to'] || '';
    const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/discussions\/(\d+)/);
    if (m) {
      // Redirect old repo references to current repo
      const owner = (m[1] === 'hashgraph' && m[2] === 'hedera-improvement-proposal') ? REPO_OWNER : m[1];
      const repo = (m[1] === 'hashgraph' && m[2] === 'hedera-improvement-proposal') ? REPO_NAME : m[2];
      discussionUrls.push({ hip: hip.hip, owner, repo, num: Number(m[3]) });
    }
  }

  if (!discussionUrls.length) return {};

  console.log(`Fetching comments for ${discussionUrls.length} discussions...`);
  const discussions = {};

  for (const d of discussionUrls) {
    const query = `query {
      repository(owner: "${d.owner}", name: "${d.repo}") {
        discussion(number: ${d.num}) {
          body
          author { login avatarUrl url }
          createdAt
          comments(first: 50) {
            nodes {
              body
              author { login avatarUrl url }
              createdAt
              isMinimized
              replies(first: 20) {
                nodes {
                  body
                  author { login avatarUrl url }
                  createdAt
                  isMinimized
                }
              }
            }
          }
        }
      }
    }`;

    try {
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'hips-build',
        },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (json.errors) {
        const msg = json.errors[0].message || '';
        console.warn(`  Discussion ${d.num} (${d.owner}/${d.repo}): ${msg}`);
        if (msg.toLowerCase().includes('rate limit')) break;
        continue;
      }
      const disc = json.data?.repository?.discussion;
      if (!disc) {
        console.warn(`  Discussion ${d.num} (${d.owner}/${d.repo}): not found`);
        continue;
      }

      discussions[d.hip] = {
        body: disc.body,
        author: disc.author,
        createdAt: disc.createdAt,
        comments: (disc.comments?.nodes || []).map(c => ({
          body: c.body,
          author: c.author,
          createdAt: c.createdAt,
          isMinimized: c.isMinimized,
          replies: (c.replies?.nodes || []).map(r => ({
            body: r.body,
            author: r.author,
            createdAt: r.createdAt,
            isMinimized: r.isMinimized,
          })),
        })),
      };
      const total = discussions[d.hip].comments.reduce((n, c) => n + 1 + c.replies.length, 0);
      console.log(`  HIP-${d.hip}: fetched discussion #${d.num} (${total} comments)`);
    } catch (e) {
      console.warn(`  HIP-${d.hip}: error fetching discussion #${d.num}: ${e.message}`);
    }
  }

  return discussions;
}

// ---- Fetch PR review comments (including resolved threads) ----
async function fetchPRReviewComments() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('No GITHUB_TOKEN set — skipping PR review comment fetch');
    return {};
  }

  // Collect all PR URLs from HIPs
  const prUrls = [];
  for (const hip of hips) {
    const url = hip['discussions-to'] || '';
    const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (m) {
      prUrls.push({ hip: hip.hip, owner: m[1], repo: m[2], num: Number(m[3]) });
    }
  }

  // Also add draft HIPs that use their PR number
  for (const hip of hips) {
    if (hip.status === 'Draft' && !prUrls.find(p => p.hip === hip.hip)) {
      prUrls.push({ hip: hip.hip, owner: REPO_OWNER, repo: REPO_NAME, num: Number(hip.hip) });
    }
  }

  if (!prUrls.length) return {};

  console.log(`Fetching PR review threads for ${prUrls.length} PRs...`);
  const prReviews = {};

  for (const pr of prUrls) {
    const query = `query {
      repository(owner: "${pr.owner}", name: "${pr.repo}") {
        pullRequest(number: ${pr.num}) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
              isOutdated
              comments(first: 50) {
                nodes {
                  body
                  author { login avatarUrl url }
                  createdAt
                  reactions(first: 10) { nodes { content } }
                }
              }
            }
          }
        }
      }
    }`;

    try {
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'hips-build',
        },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      const prData = json.data?.repository?.pullRequest;
      if (!prData) continue;

      const threads = (prData.reviewThreads?.nodes || []).map(t => ({
        isResolved: t.isResolved,
        isOutdated: t.isOutdated,
        comments: (t.comments?.nodes || []).map(c => ({
          body: c.body,
          author: c.author,
          createdAt: c.createdAt,
          reactions: c.reactions?.nodes || [],
        })),
      }));

      if (threads.length) {
        prReviews[pr.hip] = threads;
        const total = threads.reduce((n, t) => n + t.comments.length, 0);
        console.log(`  HIP-${pr.hip}: fetched ${threads.length} review threads (${total} comments)`);
      }
    } catch (e) {
      console.warn(`  HIP-${pr.hip}: error fetching review threads: ${e.message}`);
    }
  }

  return prReviews;
}

async function main() {
  await fetchDraftHips();

  hips.sort((a, b) => Number(a.hip) - Number(b.hip));

  const [discussions, prReviews] = await Promise.all([
    fetchDiscussions(),
    fetchPRReviewComments(),
  ]);

  fs.writeFileSync(path.join(OUT_DIR, 'hips.json'), JSON.stringify(hips, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'hip-bodies.json'), JSON.stringify(hipBodies));
  fs.writeFileSync(path.join(OUT_DIR, 'discussions.json'), JSON.stringify(discussions));
  fs.writeFileSync(path.join(OUT_DIR, 'pr-reviews.json'), JSON.stringify(prReviews));

  console.log(`Built data for ${hips.length} total HIPs`);
  if (Object.keys(discussions).length) console.log(`  ${Object.keys(discussions).length} discussions cached`);
  if (Object.keys(prReviews).length) console.log(`  ${Object.keys(prReviews).length} PR review threads cached`);
}

main();
