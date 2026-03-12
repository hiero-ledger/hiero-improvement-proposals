import { marked } from 'marked';
import './style.css';

/* =============================================
   DATA & CONSTANTS
   ============================================= */
let allHips = [];
let hipBodies = {};
let discussionsData = {};
let prReviewsData = {};
let viewMode = 'list'; // 'list' | 'grid'

const REPO_OWNER = 'hiero-ledger';
const REPO_NAME = 'hiero-improvement-proposals';

const STATUS_ORDER = [
  'Last Call', 'Draft', 'Review', 'Approved', 'Accepted',
  'Final', 'Active', 'Stagnant', 'Deferred', 'Withdrawn', 'Rejected', 'Replaced'
];

const PIPELINE_STAGES = ['Draft', 'Review', 'Last Call', 'Approved', 'Final', 'Active'];

const STATUS_TIPS = {
  Draft: 'The formal starting point. The HIP is being drafted and is not yet ready for review.',
  Review: 'The HIP is ready for review by the community and HIP editors.',
  'Last Call': 'Final review window (typically 14 days) before moving to a Hiero TSC approval vote or Active.',
  Approved: 'A Standards Track HIP has been approved by Hiero TSC.',
  Accepted: 'A Standards Track HIP has been accepted.',
  Final: 'Approved by Hiero TSC and its reference implementation has been merged.',
  Active: 'A Process, Informational, or Application HIP currently in effect.',
  Deferred: 'Not currently being pursued but may be revisited.',
  Withdrawn: 'Author has withdrawn the HIP.',
  Stagnant: 'Inactive for 6+ months, marked as Stagnant by HIP editors.',
  Rejected: 'Rejected by HIP editors, the community, or a Hiero TSC vote.',
  Replaced: 'Replaced by a newer HIP.',
};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// Filter state
let filters = { types: [], statuses: [], hiero: null, hedera: null };
let searchQuery = '';
let sectionSorts = {};

/* =============================================
   INIT
   ============================================= */
async function init() {
  initTheme();

  const base = import.meta.env.BASE_URL;
  const [hipsRes, bodiesRes, discRes, prRevRes] = await Promise.all([
    fetch(`${base}data/hips.json`),
    fetch(`${base}data/hip-bodies.json`),
    fetch(`${base}data/discussions.json`).catch(() => ({ json: () => ({}) })),
    fetch(`${base}data/pr-reviews.json`).catch(() => ({ json: () => ({}) })),
  ]);
  allHips = await hipsRes.json();
  hipBodies = await bodiesRes.json();
  discussionsData = await discRes.json().catch(() => ({}));
  prReviewsData = await prRevRes.json().catch(() => ({}));

  setupMultiSelect('type-filter', [
    'Core', 'Service', 'Mirror', 'Block Node', 'Application', 'Informational', 'Process'
  ]);
  setupMultiSelect('status-filter', STATUS_ORDER.filter(s => s !== 'Accepted'));

  bindEvents();
  handleRoute();
  window.addEventListener('hashchange', handleRoute);
}

/* =============================================
   DARK MODE
   ============================================= */
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  $('#theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
}

/* =============================================
   MULTI-SELECT
   ============================================= */
function setupMultiSelect(id, options) {
  const el = document.getElementById(id);
  const dropdown = el.querySelector('.ms-dropdown');
  const trigger = el.querySelector('.ms-trigger');
  const textEl = el.querySelector('.ms-text');
  const placeholder = el.dataset.placeholder;

  dropdown.innerHTML = options.map(o =>
    `<label class="ms-option"><input type="checkbox" value="${o}"> ${o}</label>`
  ).join('');

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    $$('.multi-select.open').forEach(ms => { if (ms !== el) ms.classList.remove('open'); });
    el.classList.toggle('open');
  });

  dropdown.addEventListener('change', () => {
    const checked = [...dropdown.querySelectorAll('input:checked')].map(i => i.value);
    if (!checked.length) {
      textEl.innerHTML = placeholder;
    } else {
      textEl.innerHTML = checked.map(v =>
        `<span class="ms-tag">${esc(v)}<span class="ms-tag-x" data-val="${esc(v)}">&times;</span></span>`
      ).join('');
    }
    updateFilters();
    renderList();
  });

  textEl.addEventListener('click', e => {
    const x = e.target.closest('.ms-tag-x');
    if (x) {
      e.stopPropagation();
      const cb = dropdown.querySelector(`input[value="${x.dataset.val}"]`);
      if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    }
  });
}

/* =============================================
   EVENTS
   ============================================= */
function bindEvents() {
  document.addEventListener('click', () => $$('.multi-select.open').forEach(ms => ms.classList.remove('open')));
  $$('.ms-dropdown').forEach(dd => dd.addEventListener('click', e => e.stopPropagation()));

  $('#search').addEventListener('input', e => { searchQuery = e.target.value.toLowerCase().trim(); renderList(); });

  // Toggle filters (deselectable)
  setupToggle('hiero-toggle', val => { filters.hiero = val; updateClearBtn(); renderList(); });
  setupToggle('hedera-toggle', val => { filters.hedera = val; updateClearBtn(); renderList(); });

  $('#clear-filters').addEventListener('click', clearAllFilters);

  // View toggle
  $$('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.view;
      $$('.view-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderList();
    });
  });

  // Nav
  $$('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      location.hash = link.dataset.nav === 'about' ? '#about' : '';
    });
  });

  $('#back-link').addEventListener('click', e => { e.preventDefault(); location.hash = ''; });
  $('#about-back').addEventListener('click', e => { e.preventDefault(); location.hash = ''; });
}

function setupToggle(id, onChange) {
  const container = document.getElementById(id);
  container.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const wasActive = btn.classList.contains('active');
      container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      if (wasActive) {
        onChange(null);
      } else {
        btn.classList.add('active');
        onChange(btn.dataset.value);
      }
    });
  });
}

function updateFilters() {
  filters.types = [...$$('#type-filter input:checked')].map(i => i.value);
  filters.statuses = [...$$('#status-filter input:checked')].map(i => i.value);
  updateClearBtn();
}

function updateClearBtn() {
  const has = filters.types.length || filters.statuses.length || filters.hiero || filters.hedera;
  $('#clear-filters').style.display = has ? '' : 'none';
}

function clearAllFilters() {
  $$('.ms-dropdown input:checked').forEach(cb => cb.checked = false);
  $$('.ms-text').forEach(el => el.innerHTML = el.closest('.multi-select').dataset.placeholder);
  $$('.toggle-btn.active').forEach(b => b.classList.remove('active'));
  $('#search').value = '';
  searchQuery = '';
  filters = { types: [], statuses: [], hiero: null, hedera: null };
  updateClearBtn();
  renderList();
  // Also clear pipeline active state
  $$('.pipeline-stage.active').forEach(s => s.classList.remove('active'));
}

/* =============================================
   FILTERING
   ============================================= */
function getFiltered() {
  return allHips.filter(h => {
    if (filters.types.length) {
      const t = (h.type || '').toLowerCase();
      const c = (h.category || '').toLowerCase();
      const cats = c.split(/,\s*/).map(s => s.trim());
      const match = filters.types.some(f => {
        const fl = f.toLowerCase();
        if (t !== 'standards track') return t === fl;
        return cats.some(cat => cat === fl || (fl === 'block node' && cat === 'block') || (fl === 'mirror' && cat === 'mirror node'));
      });
      if (!match) return false;
    }
    if (filters.statuses.length) {
      const s = (h.status || '').toLowerCase();
      if (!filters.statuses.some(f => {
        const fl = f.toLowerCase();
        return s === fl || (fl === 'approved' && s === 'accepted');
      })) return false;
    }
    if (filters.hiero) {
      const v = norm(h['needs-hiero-approval']);
      if (v !== filters.hiero) return false;
    }
    if (filters.hedera) {
      const v = norm(h['needs-hedera-review']);
      if (v !== filters.hedera) return false;
    }
    if (searchQuery) {
      const hay = `${h.hip} ${h.title} ${h.author} ${h.type} ${h.category} ${h.status}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  });
}

/* =============================================
   ROUTING
   ============================================= */
function handleRoute() {
  const hash = location.hash;
  $$('.nav-link').forEach(l => l.classList.remove('active'));

  if (hash === '#about') {
    show('about-view');
    $('[data-nav="about"]')?.classList.add('active');
  } else if (hash.startsWith('#hip-')) {
    showDetail(hash.slice(5));
    $('[data-nav="hips"]')?.classList.add('active');
  } else {
    show('list-view');
    $('[data-nav="hips"]')?.classList.add('active');
    renderPipeline();
    renderList();
  }
}

function show(id) {
  ['list-view', 'detail-view', 'about-view'].forEach(v =>
    document.getElementById(v).classList.toggle('hidden', v !== id)
  );
}

/* =============================================
   PIPELINE
   ============================================= */
function renderPipeline() {
  const counts = {};
  for (const h of allHips) {
    let s = h.status || 'Unknown';
    if (s === 'Accepted') s = 'Approved';
    counts[s] = (counts[s] || 0) + 1;
  }

  const el = $('#pipeline');
  el.innerHTML = PIPELINE_STAGES.map(stage => `
    <div class="pipeline-stage" data-status="${stage}">
      <span class="pipeline-stage-count">${counts[stage] || 0}</span>
      <span class="pipeline-stage-name">${stage}</span>
    </div>
  `).join('');

  el.querySelectorAll('.pipeline-stage').forEach(stage => {
    stage.addEventListener('click', () => {
      const status = stage.dataset.status;
      const wasActive = stage.classList.contains('active');

      // Clear pipeline active states
      el.querySelectorAll('.pipeline-stage').forEach(s => s.classList.remove('active'));

      if (wasActive) {
        // Clear status filter
        filters.statuses = [];
        $$('#status-filter input').forEach(cb => cb.checked = false);
        $$('#status-filter .ms-text').forEach(el => el.innerHTML = 'Status');
      } else {
        stage.classList.add('active');
        // Set status filter to this stage
        filters.statuses = [status];
        $$('#status-filter input').forEach(cb => {
          cb.checked = cb.value === status;
        });
        const textEl = $('#status-filter .ms-text');
        textEl.innerHTML = `<span class="ms-tag">${status}<span class="ms-tag-x" data-val="${status}">&times;</span></span>`;
      }
      updateClearBtn();
      renderList();
    });
  });
}

/* =============================================
   LIST RENDER
   ============================================= */
function renderList() {
  const filtered = getFiltered();
  const container = $('#status-sections');
  const noResults = $('#no-results');

  $('#result-count').textContent = filtered.length === allHips.length
    ? `${allHips.length} proposals`
    : `${filtered.length} of ${allHips.length}`;

  // Group by status
  const groups = {};
  for (const h of filtered) {
    let s = h.status || 'Unknown';
    if (s === 'Accepted') s = 'Approved';
    if (!groups[s]) groups[s] = [];
    groups[s].push(h);
  }

  const ordered = STATUS_ORDER.filter(s => s !== 'Accepted');
  let html = '';
  let any = false;

  for (const status of ordered) {
    const hips = groups[status];
    if (!hips?.length) continue;
    any = true;

    const sort = sectionSorts[status] || { key: 'hip', dir: 'desc' };
    sortArr(hips, sort);
    const isLC = status === 'Last Call';
    const isFinal = status === 'Final';

    html += `<div class="status-section" data-status="${esc(status)}">`;
    html += `<h2 class="status-heading">${esc(status)}
      <span class="status-count">(${hips.length})</span>
      <span class="status-info-icon">i<span class="tip">${esc(STATUS_TIPS[status] || '')}</span></span>
    </h2>`;

    if (viewMode === 'grid') {
      html += '<div class="hips-grid">';
      for (const h of hips) {
        html += `<div class="hip-card" data-hip="${h.hip}">
          <div class="hip-card-top">
            <span class="hip-card-num">HIP-${h.hip}</span>
            ${badge(h.status)}
          </div>
          <div class="hip-card-title"><a href="#hip-${h.hip}">${esc(h.title)}</a></div>
          <div class="hip-card-meta">
            <span>${esc(shortAuthor(h.author))}</span>
            ${h.type ? `<span>${esc(h.type === 'Standards Track' && h.category ? h.category : h.type)}</span>` : ''}
            ${h.created ? `<span>${formatDate(h.created)}</span>` : ''}
          </div>
        </div>`;
      }
      html += '</div>';
    } else {
      html += `<table class="hips-table"><thead><tr>
        <th class="${sc(sort,'hip')}" data-sort="hip" data-status="${esc(status)}">Number</th>
        <th class="${sc(sort,'title')}" data-sort="title" data-status="${esc(status)}">Title</th>
        <th class="col-author ${sc(sort,'author')}" data-sort="author" data-status="${esc(status)}">Author</th>
        <th class="col-hiero ${sc(sort,'hiero')}" data-sort="hiero" data-status="${esc(status)}">Hiero Approval</th>
        <th class="col-hedera ${sc(sort,'hedera')}" data-sort="hedera" data-status="${esc(status)}">Hedera Review</th>
        ${isLC
          ? `<th class="col-extra ${sc(sort,'lastcall')}" data-sort="lastcall" data-status="${esc(status)}">Last Call Ends</th>`
          : isFinal
            ? `<th class="col-extra ${sc(sort,'release')}" data-sort="release" data-status="${esc(status)}">Release</th>`
            : ''
        }
      </tr></thead><tbody>`;

      for (const h of hips) {
        html += `<tr>
          <td class="hip-num"><a href="#hip-${h.hip}">${h.hip}</a></td>
          <td class="hip-title-cell"><a href="#hip-${h.hip}">${esc(h.title)}</a></td>
          <td class="hip-author-cell col-author" title="${esc(h.author)}">${esc(shortAuthor(h.author))}</td>
          <td class="approval-cell col-hiero">${norm(h['needs-hiero-approval'])}</td>
          <td class="approval-cell col-hedera">${norm(h['needs-hedera-review'])}</td>
          ${isLC
            ? `<td class="col-extra">${formatDate(h['last-call-date-time'])}</td>`
            : isFinal
              ? `<td class="col-extra">${h.release ? esc(String(h.release)) : ''}</td>`
              : ''
          }
        </tr>`;
      }
      html += '</tbody></table>';
    }
    html += '</div>';
  }

  container.innerHTML = html;
  noResults.style.display = any ? 'none' : '';

  // Bind sort handlers for table view
  container.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const status = th.dataset.status;
      const key = th.dataset.sort;
      const cur = sectionSorts[status] || { key: 'hip', dir: 'desc' };
      sectionSorts[status] = cur.key === key
        ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' };
      renderList();
    });
  });

  // Bind card clicks
  container.querySelectorAll('.hip-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      location.hash = `#hip-${card.dataset.hip}`;
    });
  });
}

/* =============================================
   DETAIL VIEW
   ============================================= */
function showDetail(num) {
  const hip = allHips.find(h => String(h.hip) === String(num));
  if (!hip) { location.hash = ''; return; }

  show('detail-view');
  document.title = `HIP-${hip.hip}: ${hip.title}`;
  window.scrollTo(0, 0);

  // Title
  const isDraft = hip.status === 'Draft';
  const prUrl = hip['discussions-to']?.includes('/pull/') ? hip['discussions-to'] : '';
  const ghUrl = isDraft && prUrl
    ? `${prUrl}/files`
    : `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/HIP/hip-${hip.hip}.md`;
  $('#hip-title').innerHTML = `<span class="hip-number">HIP-${hip.hip}:</span> ${esc(hip.title)}`;

  // Action buttons — drafts link to the PR, merged HIPs link to the file on main
  const editUrl = isDraft && prUrl
    ? prUrl
    : `https://github.com/${REPO_OWNER}/${REPO_NAME}/edit/main/HIP/hip-${hip.hip}.md`;
  $('#suggest-edit').href = editUrl;
  const discussUrl = hip['discussions-to'] || ghUrl;
  $('#discuss-link').href = discussUrl;
  $('#join-discussion').href = discussUrl;

  // Meta table
  const rows = [
    ['Author', fmtAuthor(hip.author)],
    hip['working-group'] ? ['Working Group', fmtPeople(hip['working-group'])] : null,
    hip['requested-by'] ? ['Requested By', fmtPeople(hip['requested-by'])] : null,
    hip['discussions-to'] ? ['Discussions-To', `<a href="${esc(hip['discussions-to'])}" target="_blank">${esc(truncUrl(hip['discussions-to']))}</a>`] : null,
    ['Status', `${badge(hip.status)} <span class="status-info-icon" style="width:16px;height:16px;font-size:.6rem">i<span class="tip">${esc(STATUS_TIPS[hip.status] || '')}</span></span>`],
    hip['needs-hiero-approval'] ? ['Needs Hiero Approval', norm(hip['needs-hiero-approval'])] : null,
    hip['needs-hedera-review'] ? ['Needs Hedera Review', norm(hip['needs-hedera-review'])] : null,
    hip['last-call-date-time'] ? ['Last Call Ends', formatDate(hip['last-call-date-time'])] : null,
    ['Type', esc(hip.type)],
    hip.category ? ['Category', esc(hip.category)] : null,
    ['Created', formatDate(hip.created)],
    hip.updated ? ['Updated', formatDate(hip.updated)] : null,
    hip.requires ? ['Requires', hipLinks(hip.requires)] : null,
    hip.replaces ? ['Replaces', hipLinks(hip.replaces)] : null,
    hip['superseded-by'] ? ['Superseded By', hipLinks(hip['superseded-by'])] : null,
    hip.release ? ['Release', fmtRelease(hip.release, hip.category)] : null,
  ].filter(Boolean);

  $('#hip-meta-table tbody').innerHTML = rows.map(([l, v]) =>
    `<tr><th>${l}</th><td>${v}</td></tr>`
  ).join('');

  // Render markdown content
  const body = hipBodies[hip.hip] || '';
  $('#hip-content').innerHTML = marked.parse(body);

  // Build TOC
  buildTOC();

  // Scroll spy for TOC
  setupScrollSpy();

  // Load GitHub data (PR status, reactions, comments)
  loadGitHubData(hip);
}

function buildTOC() {
  const headings = $('#hip-content').querySelectorAll('h2, h3, h4');
  const tocList = $('#toc-list');
  const sidebar = $('#detail-sidebar');

  if (!headings.length) {
    sidebar.style.display = 'none';
    return;
  }
  sidebar.style.display = '';

  let html = '';
  headings.forEach((h, i) => {
    const id = h.id || `section-${i}`;
    h.id = id;
    const lvl = h.tagName === 'H3' ? ' toc-h3' : h.tagName === 'H4' ? ' toc-h4' : '';
    html += `<li class="${lvl}"><a href="#${id}" data-toc-target="${id}">${h.textContent}</a></li>`;
  });
  tocList.innerHTML = html;
}

function setupScrollSpy() {
  const tocLinks = $$('#toc-list a[data-toc-target]');
  if (!tocLinks.length) return;

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        tocLinks.forEach(l => l.classList.remove('active'));
        const link = $(`#toc-list a[data-toc-target="${entry.target.id}"]`);
        if (link) link.classList.add('active');
      }
    }
  }, { rootMargin: '-80px 0px -70% 0px' });

  $('#hip-content').querySelectorAll('h2, h3, h4').forEach(h => observer.observe(h));
}

/* =============================================
   GITHUB INTEGRATION
   ============================================= */
function parseGitHubUrl(url) {
  // Extract owner, repo, type (pull/issues/discussions), and number from any GitHub URL
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/(pull|issues|discussions)\/(\d+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], type: m[3], num: m[4] };
}

async function loadGitHubData(hip) {
  const prStatus = $('#pr-status');
  const reactionsBar = $('#reactions-bar');
  const discussionSection = $('#discussion-section');
  const commentsList = $('#comments-list');
  const commentsLoading = $('#comments-loading');
  const commentCount = $('#comment-count');

  // Reset
  prStatus.style.display = 'none';
  reactionsBar.style.display = 'none';
  discussionSection.style.display = 'none';
  commentsList.innerHTML = '';
  commentsLoading.style.display = '';

  const url = hip['discussions-to'] || '';
  let gh = parseGitHubUrl(url);

  if (!gh) {
    const fallbackUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/pull/${hip.hip}`;
    gh = parseGitHubUrl(fallbackUrl);
    if (!gh) return;
    const check = await ghFetch(`/repos/${gh.owner}/${gh.repo}/pulls/${gh.num}`);
    if (!check) return;
  }

  discussionSection.style.display = '';

  const els = { prStatus, reactionsBar, commentsList, commentsLoading, commentCount };

  if (gh.type === 'discussions') {
    await loadDiscussionData(hip, url, els);
  } else if (gh.type === 'pull') {
    await loadPRData(gh.owner, gh.repo, gh.num, url, hip, els);
  } else if (gh.type === 'issues') {
    await loadIssueComments(gh.owner, gh.repo, gh.num, url, els);
  }
}

// ---- Discussion rendering (from pre-built data) ----
async function loadDiscussionData(hip, url, els) {
  const disc = discussionsData[hip.hip];
  els.commentsLoading.style.display = 'none';

  if (!disc) {
    els.commentsList.innerHTML = `<p style="color:var(--fg-muted);font-size:.88rem">Discussion comments not yet cached. <a href="${esc(url)}" target="_blank" style="color:var(--link)">View on GitHub</a></p>`;
    els.commentCount.textContent = '0';
    return;
  }

  // Count all comments + replies
  const total = disc.comments.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);
  els.commentCount.textContent = total;

  let html = '';
  for (const comment of disc.comments) {
    html += '<div class="thread">';
    html += renderGqlComment(comment);
    if (comment.replies?.length) {
      html += '<div class="thread-replies">';
      for (const reply of comment.replies) {
        html += renderGqlComment(reply);
      }
      html += '</div>';
    }
    html += '</div>';
  }

  els.commentsList.innerHTML = html || '<p style="color:var(--fg-muted);font-size:.88rem">No comments yet.</p>';
}

// ---- PR rendering (REST + pre-built review threads) ----
async function loadPRData(owner, repo, prNum, url, hip, els) {
  try {
    const prRes = await ghFetch(`/repos/${owner}/${repo}/pulls/${prNum}`);
    if (prRes) {
      let statusClass = 'pr-status--open';
      let statusText = 'Open';
      if (prRes.merged) { statusClass = 'pr-status--merged'; statusText = 'Merged'; }
      else if (prRes.state === 'closed') { statusClass = 'pr-status--closed'; statusText = 'Closed'; }

      if (prRes.state === 'open' && prRes.requested_reviewers?.length) {
        statusClass = 'pr-status--review';
        statusText = 'Review Requested';
      }

      els.prStatus.className = `pr-status ${statusClass}`;
      els.prStatus.innerHTML = `PR #${prNum}: ${statusText}`;
      els.prStatus.style.display = '';

      if (prRes.reactions) {
        renderReactions(prRes.reactions, els.reactionsBar);
      }
    }

    // Fetch top-level issue comments via REST
    const comments = await ghFetch(`/repos/${owner}/${repo}/issues/${prNum}/comments?per_page=100`);
    els.commentsLoading.style.display = 'none';

    let html = '';
    let total = 0;

    // Render top-level conversation comments
    if (comments?.length) {
      html += '<h3 class="thread-section-title">Conversation</h3>';
      for (const c of comments) {
        html += '<div class="thread">';
        html += renderRestComment(c);
        html += '</div>';
        total++;
      }
    }

    // Render pre-built review threads (including resolved)
    const reviewThreads = prReviewsData[hip.hip];
    if (reviewThreads?.length) {
      html += '<h3 class="thread-section-title">Review Threads</h3>';
      for (const thread of reviewThreads) {
        const resolvedClass = thread.isResolved ? ' thread--resolved' : '';
        html += `<div class="thread${resolvedClass}">`;
        if (thread.isResolved) {
          html += '<div class="thread-resolved-badge">Resolved</div>';
        }
        const threadComments = thread.comments || [];
        if (threadComments.length) {
          html += renderGqlComment(threadComments[0]);
          if (threadComments.length > 1) {
            html += '<div class="thread-replies">';
            for (let i = 1; i < threadComments.length; i++) {
              html += renderGqlComment(threadComments[i]);
            }
            html += '</div>';
          }
        }
        html += '</div>';
        total += threadComments.length;
      }
    }

    els.commentCount.textContent = total;
    els.commentsList.innerHTML = html || '<p style="color:var(--fg-muted);font-size:.88rem;padding:.5rem 0">No comments yet. Be the first to discuss this HIP.</p>';
  } catch (e) {
    els.commentsLoading.innerHTML = `<span style="color:var(--fg-muted)">Could not load comments. <a href="${esc(url || `https://github.com/${owner}/${repo}/pull/${prNum}`)}" target="_blank" style="color:var(--link)">View on GitHub</a></span>`;
  }
}

async function loadIssueComments(owner, repo, issueNum, url, els) {
  try {
    const issue = await ghFetch(`/repos/${owner}/${repo}/issues/${issueNum}`);
    if (issue?.reactions) {
      renderReactions(issue.reactions, els.reactionsBar);
    }

    const comments = await ghFetch(`/repos/${owner}/${repo}/issues/${issueNum}/comments?per_page=100`);
    els.commentsLoading.style.display = 'none';

    if (comments?.length) {
      els.commentCount.textContent = comments.length;
      let html = '';
      for (const c of comments) {
        html += '<div class="thread">';
        html += renderRestComment(c);
        html += '</div>';
      }
      els.commentsList.innerHTML = html;
    } else {
      els.commentCount.textContent = '0';
      els.commentsList.innerHTML = '<p style="color:var(--fg-muted);font-size:.88rem">No comments yet.</p>';
    }
  } catch (e) {
    els.commentsLoading.innerHTML = `<span style="color:var(--fg-muted)">Could not load comments. <a href="${esc(url)}" target="_blank" style="color:var(--link)">View on GitHub</a></span>`;
  }
}

// ---- Shared rendering helpers ----
const REACTION_EMOJI = { '+1': '\ud83d\udc4d', '-1': '\ud83d\udc4e', THUMBS_UP: '\ud83d\udc4d', THUMBS_DOWN: '\ud83d\udc4e', laugh: '\ud83d\ude04', LAUGH: '\ud83d\ude04', hooray: '\ud83c\udf89', HOORAY: '\ud83c\udf89', confused: '\ud83d\ude15', CONFUSED: '\ud83d\ude15', heart: '\u2764\ufe0f', HEART: '\u2764\ufe0f', rocket: '\ud83d\ude80', ROCKET: '\ud83d\ude80', eyes: '\ud83d\udc40', EYES: '\ud83d\udc40' };

function renderReactions(reactions, container) {
  const map = [
    ['+1', reactions['+1']],
    ['-1', reactions['-1']],
    ['laugh', reactions.laugh],
    ['hooray', reactions.hooray],
    ['confused', reactions.confused],
    ['heart', reactions.heart],
    ['rocket', reactions.rocket],
    ['eyes', reactions.eyes],
  ];

  const chips = map
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `<span class="reaction-chip">${REACTION_EMOJI[key] || key} <span class="reaction-count">${count}</span></span>`)
    .join('');

  if (chips) {
    container.innerHTML = chips;
    container.style.display = '';
  }
}

function renderReactionChips(reactions) {
  if (!reactions) return '';
  // REST API format: { "+1": 2, ... }
  if (typeof reactions['+1'] === 'number') {
    const chips = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes']
      .filter(k => reactions[k] > 0)
      .map(k => `<span class="reaction-chip">${REACTION_EMOJI[k]} <span class="reaction-count">${reactions[k]}</span></span>`);
    return chips.length ? `<div class="comment-reactions">${chips.join('')}</div>` : '';
  }
  // GraphQL format: [{ content: "THUMBS_UP" }, ...]
  if (Array.isArray(reactions)) {
    const counts = {};
    for (const r of reactions) { counts[r.content] = (counts[r.content] || 0) + 1; }
    const chips = Object.entries(counts)
      .map(([k, n]) => `<span class="reaction-chip">${REACTION_EMOJI[k] || k} <span class="reaction-count">${n}</span></span>`);
    return chips.length ? `<div class="comment-reactions">${chips.join('')}</div>` : '';
  }
  return '';
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Render a comment from the REST API (PR issue comments)
function parseSuggestions(raw) {
  // Transform ```suggestion blocks into styled HTML before markdown parsing
  return raw.replace(/```suggestion\r?\n([\s\S]*?)```/g, (_, code) => {
    const lines = code.replace(/\n$/, '').split('\n');
    const lineHtml = lines.map(l =>
      `<div class="suggestion-line suggestion-add"><span class="suggestion-prefix">+</span>${esc(l)}</div>`
    ).join('');
    return `<div class="suggestion-block"><div class="suggestion-header">Suggested change</div><div class="suggestion-diff">${lineHtml}</div></div>`;
  });
}

function stripEmailFooter(raw) {
  // Remove GitHub email notification footers from comments posted via email reply
  // Handles both direct text and blockquoted (> prefixed) versions
  return raw
    .replace(/\n*>?\s*[—\-]{1,3}\s*\n(?:>?\s*)?Reply to this email directly[\s\S]*$/im, '')
    .replace(/\n*[—\-]{1,3}\s*\n\s*Reply to this email directly[\s\S]*$/im, '')
    .replace(/\n*>?\s*Reply to this email directly[\s\S]*$/im, '')
    .replace(/\n*>?\s*You are receiving this because[\s\S]*$/im, '')
    .replace(/\n*>?\s*Message ID:\s*<[^>]+>[\s\S]*$/im, '');
}

function parseBody(raw) {
  const cleaned = stripEmailFooter(raw || '').replace(/\n>?\s*$/, '').trimEnd();
  const processed = parseSuggestions(cleaned);
  return marked.parse(processed);
}

function renderRestComment(c) {
  let body = parseBody(c.body);
  return `<div class="comment">
    <img class="comment-avatar" src="${c.user?.avatar_url || ''}" alt="" loading="lazy">
    <div class="comment-body">
      <div class="comment-header">
        <span class="comment-author"><a href="${c.user?.html_url || '#'}" target="_blank">${esc(c.user?.login || 'unknown')}</a></span>
        <span class="comment-date">${fmtDate(c.created_at)}</span>
      </div>
      <div class="comment-text">${body}</div>
      ${renderReactionChips(c.reactions)}
    </div>
  </div>`;
}

// Render a comment from pre-built GraphQL data (discussions + review threads)
function renderGqlComment(c) {
  const body = parseBody(c.body);
  const login = c.author?.login || 'unknown';
  const avatar = c.author?.avatarUrl || '';
  const profileUrl = c.author?.url || '#';
  return `<div class="comment">
    <img class="comment-avatar" src="${avatar}" alt="" loading="lazy">
    <div class="comment-body">
      <div class="comment-header">
        <span class="comment-author"><a href="${profileUrl}" target="_blank">${esc(login)}</a></span>
        <span class="comment-date">${fmtDate(c.createdAt)}</span>
      </div>
      <div class="comment-text">${body}</div>
      ${renderReactionChips(c.reactions)}
    </div>
  </div>`;
}

async function ghFetch(path) {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/* =============================================
   HELPERS
   ============================================= */
function norm(val) {
  if (!val) return 'No';
  const s = String(val).toLowerCase().trim();
  return (s === 'yes' || s === 'true') ? 'Yes' : 'No';
}

function shortAuthor(a) {
  if (!a) return '';
  return a.split(',')[0].trim().replace(/<[^>]+>/g, '').replace(/\([^)]+\)/g, '').trim();
}

function fmtPeople(a) {
  if (!a) return '';
  return a.split(',').map(s => {
    s = s.trim();
    // Match "Name <@github>", "Name <email>", or "Name (@github)"
    const m = s.match(/^(.+?)\s*(?:<([^>]+)>|\(([^)]+)\))$/);
    if (!m) return esc(s);
    const name = m[1].trim();
    const ref = (m[2] || m[3]).trim();
    if (ref.startsWith('@')) {
      const user = ref.slice(1);
      return `<a href="https://github.com/${encodeURIComponent(user)}" target="_blank">${esc(name)}</a>`;
    }
    if (ref.includes('@')) {
      return `<a href="mailto:${encodeURIComponent(ref)}">${esc(name)}</a>`;
    }
    return esc(s);
  }).join(', ');
}

function fmtAuthor(a) { return fmtPeople(a); }

function releaseRepo(category) {
  const cats = (category || '').toLowerCase().split(/,\s*/);
  const hasCore = cats.some(c => c === 'core' || c === 'service');
  const hasMirror = cats.some(c => c === 'mirror' || c === 'mirror node');
  const hasBlock = cats.some(c => c === 'block' || c === 'block node');
  if (hasCore) return 'hiero-ledger/hiero-consensus-node';
  if (hasMirror) return 'hiero-ledger/hiero-mirror-node';
  if (hasBlock) return 'hiero-ledger/hiero-block-node';
  return 'hiero-ledger/hiero-consensus-node';
}

function fmtRelease(release, category) {
  const v = String(release).trim();
  if (!v || v.toLowerCase() === 'tbd') return esc(v);
  const repo = releaseRepo(category);
  const tag = v.startsWith('v') ? v : `v${v}`;
  return `<a href="https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}" target="_blank">${esc(v)}</a>`;
}

function hipLinks(val) {
  if (!val) return '';
  return String(val).split(',').map(v => {
    const num = String(v).trim().replace(/[^0-9]/g, '');
    return num ? `<a href="#hip-${num}">HIP-${num}</a>` : esc(String(v).trim());
  }).join(', ');
}

function truncUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname.length > 40 ? u.pathname.slice(0, 40) + '...' : u.pathname;
  } catch {
    return url.length > 50 ? url.slice(0, 50) + '...' : url;
  }
}

function badge(status) {
  if (!status) return '';
  const cls = 'badge--' + status.toLowerCase().replace(/\s+/g, '-');
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return esc(String(d));
  return date.toISOString().slice(0, 10);
}

function sc(sort, key) {
  return sort.key === key ? (sort.dir === 'asc' ? 'sort-asc' : 'sort-desc') : '';
}

function sortArr(arr, { key, dir }) {
  const m = dir === 'asc' ? 1 : -1;
  arr.sort((a, b) => {
    switch (key) {
      case 'hip': return (Number(a.hip) - Number(b.hip)) * m;
      case 'title': return (a.title || '').localeCompare(b.title || '') * m;
      case 'author': return (a.author || '').localeCompare(b.author || '') * m;
      case 'hiero': return norm(a['needs-hiero-approval']).localeCompare(norm(b['needs-hiero-approval'])) * m;
      case 'hedera': return norm(a['needs-hedera-review']).localeCompare(norm(b['needs-hedera-review'])) * m;
      case 'lastcall': return (new Date(a['last-call-date-time'] || 0) - new Date(b['last-call-date-time'] || 0)) * m;
      case 'release': return cmpVersion(a.release, b.release) * m;
      default: return 0;
    }
  });
}

function cmpVersion(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const pa = String(a).replace(/^v/i, '').split('.').map(Number);
  const pb = String(b).replace(/^v/i, '').split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* =============================================
   BOOT
   ============================================= */
init();
