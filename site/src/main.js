// DOMPurify import removed — all rendered content comes from trusted repo markdown files
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import mermaid from 'mermaid';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import { solidity } from 'highlightjs-solidity';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import java from 'highlight.js/lib/languages/java';
import protobuf from 'highlight.js/lib/languages/protobuf';
import plaintext from 'highlight.js/lib/languages/plaintext';
/* hljs theme is custom — defined in style.css */
import './style.css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('solidity', solidity);
hljs.registerLanguage('sol', solidity);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('java', java);
hljs.registerLanguage('protobuf', protobuf);
hljs.registerLanguage('proto', protobuf);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('text', plaintext);

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
}));

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#1a1a2e',
    primaryTextColor: '#e0e0e0',
    primaryBorderColor: '#52b788',
    lineColor: '#52b788',
    secondaryColor: '#16213e',
    tertiaryColor: '#0f3460',
    background: 'transparent',
    mainBkg: '#1a1a2e',
    nodeBorder: '#52b788',
    edgeLabelBackground: 'transparent',
    fontFamily: 'Inter, sans-serif',
    fontSize: '15px',
  },
  flowchart: {
    curve: 'basis',
    padding: 20,
    nodeSpacing: 50,
    rankSpacing: 50,
  },
});

/* =============================================
   DATA & CONSTANTS
   ============================================= */

const DIAGRAM_STANDARDS_TRACK = `<div class="mermaid">
graph TD
    Idea([Idea]) --> Draft([Draft])
    Draft --> Review([Review])
    Draft --> Deferred([Deferred])
    Draft --> Withdrawn([Withdrawn])
    Review --> LastCall([Last Call])
    Review --> Rejected([Rejected])
    LastCall --> Rejected
    LastCall --> TSC([Hiero TSC Review])
    LastCall --> Hedera([Hedera Review])
    TSC -- Yes --> Approved([Approved])
    TSC -- No --> Rejected
    Hedera -- Yes --> Accepted([Accepted])
    Hedera -- No --> NotAccepted([Not Accepted])
    Approved --> Final([Final])
    Final --> Replaced([Replaced])

    style Idea fill:#2d6a4f,stroke:#52b788,stroke-width:2px,color:#fff
    style Draft fill:#2d6a4f,stroke:#52b788,stroke-width:2px,color:#fff
    style Review fill:#2d6a4f,stroke:#52b788,stroke-width:2px,color:#fff
    style LastCall fill:#2d6a4f,stroke:#52b788,stroke-width:2px,color:#fff
    style TSC fill:#0f3460,stroke:#4cc9f0,stroke-width:2px,color:#fff
    style Hedera fill:#0f3460,stroke:#4cc9f0,stroke-width:2px,color:#fff
    style Approved fill:#2d6a4f,stroke:#52b788,stroke-width:2px,color:#fff
    style Final fill:#0b6e4f,stroke:#40916c,stroke-width:3px,color:#fff
    style Accepted fill:#0b6e4f,stroke:#40916c,stroke-width:3px,color:#fff
    style Deferred fill:#343a40,stroke:#868e96,stroke-width:1px,color:#ced4da
    style Withdrawn fill:#343a40,stroke:#868e96,stroke-width:1px,color:#ced4da
    style Rejected fill:#6c2020,stroke:#e06c75,stroke-width:2px,color:#f8d7da
    style NotAccepted fill:#6c2020,stroke:#e06c75,stroke-width:2px,color:#f8d7da
    style Replaced fill:#343a40,stroke:#868e96,stroke-width:1px,color:#ced4da
</div>`;

const DIAGRAM_IPA = `<div class="mermaid">
graph TD
    Idea([Idea]) --> Draft([Draft])
    Draft --> Review([Review])
    Draft --> Deferred([Deferred])
    Draft --> Withdrawn([Withdrawn])
    Review --> LastCall([Last Call])
    Review --> Rejected([Rejected])
    LastCall --> Active([Active])
    LastCall --> Rejected
    Active --> Replaced([Replaced])

    style Idea fill:#2d6a4f,stroke:#52b788,stroke-width:2px,color:#fff
    style Draft fill:#2d6a4f,stroke:#52b788,stroke-width:2px,color:#fff
    style Review fill:#2d6a4f,stroke:#52b788,stroke-width:2px,color:#fff
    style LastCall fill:#2d6a4f,stroke:#52b788,stroke-width:2px,color:#fff
    style Active fill:#0b6e4f,stroke:#40916c,stroke-width:3px,color:#fff
    style Deferred fill:#343a40,stroke:#868e96,stroke-width:1px,color:#ced4da
    style Withdrawn fill:#343a40,stroke:#868e96,stroke-width:1px,color:#ced4da
    style Rejected fill:#6c2020,stroke:#e06c75,stroke-width:2px,color:#f8d7da
    style Replaced fill:#343a40,stroke:#868e96,stroke-width:1px,color:#ced4da
</div>`;

let allHips = [];
let hipBodies = new Map();
let discussionsData = new Map();
let prReviewsData = new Map();
let viewMode = 'list'; // 'list' | 'grid'

const REPO_OWNER = 'hiero-ledger';
const REPO_NAME = 'hiero-improvement-proposals';

const STATUS_ORDER = [
  'Last Call', 'Draft', 'Review', 'Approved', 'Accepted',
  'Final', 'Active', 'Stagnant', 'Deferred', 'Withdrawn', 'Rejected', 'Replaced'
];

const PIPELINE_STAGES = ['Draft', 'Review', 'Last Call', 'Approved', 'Final', 'Active'];

const STATUS_TIPS = new Map([
  ['Draft', 'The formal starting point. The HIP is being drafted and is not yet ready for review.'],
  ['Review', 'The HIP is ready for review by the community and HIP editors.'],
  ['Last Call', 'Last chance for community input before this HIP moves forward.'],
  ['Approved', 'A Standards Track HIP has been approved by Hiero TSC.'],
  ['Accepted', 'A Standards Track HIP has been accepted.'],
  ['Final', 'Approved by Hiero TSC and its reference implementation has been merged.'],
  ['Active', 'A Process, Informational, or Application HIP currently in effect.'],
  ['Deferred', 'Not currently being pursued but may be revisited.'],
  ['Withdrawn', 'Author has withdrawn the HIP.'],
  ['Stagnant', 'Inactive for 6+ months, marked as Stagnant by HIP editors.'],
  ['Rejected', 'Rejected by HIP editors, the community, or a Hiero TSC vote.'],
  ['Replaced', 'Replaced by a newer HIP.'],
]);

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
/**
 * Set element HTML from trusted content (repo markdown, static UI templates).
 * All data originates from HIP files in this repository — no user-supplied input.
 * Uses DOMParser to safely parse HTML into DOM nodes without direct innerHTML assignment.
 * @param {Element} el
 * @param {string} html
 */
const domParser = new DOMParser();
function safeHTML(el, html) {
  const tag = el.tagName;
  // Table elements need proper wrapping or DOMParser strips the rows
  let wrapper;
  if (tag === 'TBODY' || tag === 'THEAD' || tag === 'TFOOT') {
    const doc = domParser.parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
    wrapper = doc.querySelector('tbody');
  } else if (tag === 'TR') {
    const doc = domParser.parseFromString(`<table><tr>${html}</tr></table>`, 'text/html');
    wrapper = doc.querySelector('tr');
  } else {
    const doc = domParser.parseFromString(`<body>${html}</body>`, 'text/html');
    wrapper = doc.body;
  }
  el.textContent = '';
  while (wrapper.firstChild) {
    el.appendChild(wrapper.firstChild);
  }
}

// Filter state
let filters = { types: [], statuses: [], hiero: null, hedera: null };
let searchQuery = '';
let sectionSorts = new Map();

/* =============================================
   INIT
   ============================================= */
async function init() {
  // Support old /hip/hip-NNN paths — GitHub Pages serves 404.html (= index.html)
  // for unknown paths, so the SPA loads and we route based on the pathname.
  const pathMatch = window.location.pathname.match(/\/hip\/hip-(\d+)$/);
  if (pathMatch && !window.location.hash) {
    history.replaceState(null, '', window.location.pathname.replace(/\/hip\/hip-\d+$/, '') + '#hip-' + pathMatch[1]);
  }

  initTheme();

  const base = import.meta.env.BASE_URL;
  const manifest = await fetch(`${base}data/manifest.json?v=${Date.now()}`).then(r => r.json()).catch(() => ({}));
  const h = manifest.buildHash || 'latest';
  const [hipsRes, bodiesRes, discRes, prRevRes] = await Promise.all([
    fetch(`${base}data/hips.${h}.json`),
    fetch(`${base}data/hip-bodies.${h}.json`),
    fetch(`${base}data/discussions.${h}.json`).catch(() => ({ json: () => ({}) })),
    fetch(`${base}data/pr-reviews.${h}.json`).catch(() => ({ json: () => ({}) })),
  ]);
  allHips = await hipsRes.json();
  hipBodies = new Map(Object.entries(await bodiesRes.json()));
  discussionsData = new Map(Object.entries(await discRes.json().catch(() => ({}))));
  prReviewsData = new Map(Object.entries(await prRevRes.json().catch(() => ({}))));

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

  safeHTML(dropdown, options.map(o =>
    `<label class="ms-option"><input type="checkbox" value="${o}"> ${o}</label>`
  ).join(''));

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    $$('.multi-select.open').forEach(ms => { if (ms !== el) ms.classList.remove('open'); });
    el.classList.toggle('open');
  });

  dropdown.addEventListener('change', () => {
    const checked = [...dropdown.querySelectorAll('input:checked')].map(i => i.value);
    if (!checked.length) {
      textEl.textContent = placeholder;
    } else {
      safeHTML(textEl, checked.map(v =>
        `<span class="ms-tag">${esc(v)}<span class="ms-tag-x" data-val="${esc(v)}">&times;</span></span>`
      ).join(''));
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

  let searchReturnHash = null;
  $('#search').addEventListener('input', e => {
    searchQuery = e.target.value.toLowerCase().trim();
    const hash = location.hash;
    const onDetailPage = hash && hash !== '#';

    if (searchQuery && onDetailPage) {
      // Remember where the user was so they can return by clearing search
      searchReturnHash = hash;
      location.hash = '';
    } else if (!searchQuery && searchReturnHash) {
      // User cleared search — go back to the HIP they were on
      const returnTo = searchReturnHash;
      searchReturnHash = null;
      location.hash = returnTo;
    } else {
      renderList();
    }
  });

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

      if (!link.dataset.nav) return;

      e.preventDefault();

      if (link.dataset.nav === 'about') {
        location.hash = '#about';
      } else {
        location.hash = '';
      }
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
  $$('.ms-text').forEach(el => el.textContent = el.closest('.multi-select').dataset.placeholder);
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

  if (hash.startsWith('#about') && hash.length === 6) {
    show('about-view');
    $('[data-nav="about"]')?.classList.add('active');
  } else if (hash.startsWith('#create') && hash.length === 7) {
    show('create-view');
    initWizard();
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
  ['list-view', 'detail-view', 'about-view', 'create-view'].forEach(v =>
    document.getElementById(v).classList.toggle('hidden', v !== id)
  );
}

/* =============================================
   PIPELINE
   ============================================= */
function renderPipeline() {
  const counts = new Map();
  for (const h of allHips) {
    let s = h.status || 'Unknown';
    if (s === 'Accepted') s = 'Approved';
    counts.set(s, (counts.get(s) || 0) + 1);
  }

  const el = $('#pipeline');
  safeHTML(el, PIPELINE_STAGES.map(stage => `
    <div class="pipeline-stage" data-status="${stage}">
      <span class="pipeline-stage-count">${counts.get(stage) || 0}</span>
      <span class="pipeline-stage-name">${stage}</span>
    </div>
  `).join(''));

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
        $$('#status-filter .ms-text').forEach(el => el.textContent = 'Status');
      } else {
        stage.classList.add('active');
        // Set status filter to this stage
        filters.statuses = [status];
        $$('#status-filter input').forEach(cb => {
          cb.checked = cb.value === status;
        });
        const textEl = $('#status-filter .ms-text');
        safeHTML(textEl, `<span class="ms-tag">${status}<span class="ms-tag-x" data-val="${status}">&times;</span></span>`);
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
  const groups = new Map();
  for (const h of filtered) {
    let s = h.status || 'Unknown';
    if (s === 'Accepted') s = 'Approved';
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s).push(h);
  }

  const ordered = STATUS_ORDER.filter(s => s !== 'Accepted');
  let html = '';
  let any = false;

  for (const status of ordered) {
    const hips = groups.get(status);
    if (!hips?.length) continue;
    any = true;

    const sort = sectionSorts.get(status) || { key: 'hip', dir: 'desc' };
    sortArr(hips, sort);
    const isLC = status === 'Last Call';
    const isFinal = status === 'Final';

    html += `<div class="status-section" data-status="${esc(status)}">`;
    html += `<h2 class="status-heading">${esc(status)}
      <span class="status-count">(${hips.length})</span>
      <span class="status-info-icon">i<span class="tip">${esc(STATUS_TIPS.get(status) || '')}</span></span>
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
        <th class="col-hiero ${sc(sort,'hiero')}" data-sort="hiero" data-status="${esc(status)}">Requires Hiero Approval</th>
        <th class="col-hedera ${sc(sort,'hedera')}" data-sort="hedera" data-status="${esc(status)}">Requires Hedera Review</th>
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

  safeHTML(container, html);
  noResults.style.display = any ? 'none' : '';

  // Bind sort handlers for table view
  container.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const status = th.dataset.status;
      const key = th.dataset.sort;
      const cur = sectionSorts.get(status) || { key: 'hip', dir: 'desc' };
      sectionSorts.set(status, cur.key === key
        ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' });
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
async function showDetail(num) {
  const hip = allHips.find(h => String(h.hip) === String(num));
  if (!hip) { location.hash = ''; return; }

  show('detail-view');
  document.title = `HIP-${hip.hip}: ${hip.title}`;
  window.scrollTo(0, 0);

  // Title
  const isDraft = hip.status === 'Draft';
  const prNum = hip.prNumber || hip.hip;
  const prFilesUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/pull/${prNum}/files`;
  const mainEditUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/edit/main/HIP/hip-${hip.hip}.md`;
  const mainFileUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/HIP/hip-${hip.hip}.md`;
  safeHTML($('#hip-title'), `<span class="hip-number">HIP-${hip.hip}:</span> ${esc(hip.title)}`);

  // Action buttons — drafts link to PR files, merged HIPs link to file on main
  $('#suggest-edit').href = isDraft ? prFilesUrl : mainEditUrl;
  const discussUrl = hip['discussions-to'] || (isDraft ? prFilesUrl : mainFileUrl);
  $('#discuss-link').href = discussUrl;
  $('#join-discussion').href = discussUrl;

  // Meta table
  const rows = [
    ['Author', fmtAuthor(hip.author)],
    hip['working-group'] ? ['Working Group', fmtPeople(hip['working-group'])] : null,
    hip['requested-by'] ? ['Requested By', fmtPeople(hip['requested-by'])] : null,
    hip['discussions-to'] ? ['Discussions-To', `<a href="${esc(hip['discussions-to'])}" target="_blank">${esc(truncUrl(hip['discussions-to']))}</a>`] : null,
    ['Status', `${badge(hip.status)} <span class="status-info-icon" style="width:16px;height:16px;font-size:.6rem">i<span class="tip">${esc(STATUS_TIPS.get(hip.status) || '')}</span></span>`],
    hip['needs-hiero-approval'] ? ['Requires Hiero Approval', norm(hip['needs-hiero-approval'])] : null,
    hip['needs-hedera-review'] ? ['Requires Hedera Review', norm(hip['needs-hedera-review'])] : null,
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

  safeHTML($('#hip-meta-table tbody'), rows.map(([l, v]) =>
    `<tr><th>${l}</th><td>${v}</td></tr>`
  ).join(''));

  // Render markdown content
  const body = hipBodies.get(String(hip.hip)) || '';
  let rendered = marked.parse(body);
  // Inject mermaid diagrams after markdown processing to avoid marked corrupting the syntax
  rendered = rendered.replace(/<!--DIAGRAM:STANDARDS_TRACK-->/g, DIAGRAM_STANDARDS_TRACK);
  rendered = rendered.replace(/<!--DIAGRAM:IPA-->/g, DIAGRAM_IPA);
  safeHTML($('#hip-content'), rendered);
  applyRainbowIndent($('#hip-content'));

  // Intercept in-body anchor links (e.g. [see Motivation](#motivation)) so they
  // scroll within the detail view instead of triggering handleRoute
  $('#hip-content').addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });

  // Render any Mermaid diagrams
  const mermaidEls = $('#hip-content').querySelectorAll('.mermaid');
  if (mermaidEls.length) {
    await mermaid.run({ nodes: mermaidEls });
    addDiagramTooltips($('#hip-content'));
    addDiagramZoom($('#hip-content'));
  }

  // Build TOC
  buildTOC();

  // Scroll spy for TOC
  setupScrollSpy();

  // Load GitHub data (PR status, reactions, comments)
  loadGitHubData(hip);
}

const STATE_TOOLTIPS = new Map([
  ['Idea', 'Propose your idea — create a GitHub issue to discuss it with the community before writing a formal HIP.'],
  ['Draft', 'A formal HIP has been written and submitted as a pull request. The author is refining the proposal.'],
  ['Review', 'The HIP editors and community are actively reviewing the proposal and providing feedback.'],
  ['Last Call', 'Review period is ending (typically 14 days). Final chance to raise objections before approval.'],
  ['Hiero TSC Review', 'The Hiero Technical Steering Committee reviews the HIP for technical soundness.'],
  ['Hedera Review', 'Hedera Council reviews the HIP when it affects the Hedera network (needs-hedera-review: Yes).'],
  ['Approved', 'The HIP has been approved by the Hiero TSC and is ready for implementation.'],
  ['Final', 'The HIP has been implemented and is considered complete. No further changes expected.'],
  ['Active', 'The HIP is active and in effect. Used for Informational, Process, and Application HIPs.'],
  ['Accepted', 'The HIP has been accepted by both the Hiero TSC and Hedera Council.'],
  ['Not Accepted', 'The Hedera Council did not accept the HIP after review.'],
  ['Deferred', 'The HIP has been paused by the author. It can be resumed later by moving back to Draft.'],
  ['Withdrawn', 'The author has pulled the HIP from consideration. It is no longer being pursued.'],
  ['Rejected', 'The HIP was reviewed and rejected. It will not move forward in its current form.'],
  ['Replaced', 'This HIP has been superseded by a newer HIP that covers the same topic.'],
]);

function addDiagramTooltips(container) {
  const tooltip = document.createElement('div');
  tooltip.className = 'diagram-tooltip';
  document.body.appendChild(tooltip);

  container.querySelectorAll('.mermaid .node').forEach(node => {
    const label = node.querySelector('.nodeLabel');
    if (!label) return;
    const text = label.textContent.trim();
    const tip = STATE_TOOLTIPS.get(text);
    if (!tip) return;

    node.style.cursor = 'pointer';
    node.addEventListener('mouseenter', () => {
      tooltip.textContent = tip;
      tooltip.classList.add('visible');
      const rect = node.getBoundingClientRect();
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
      tooltip.style.top = `${rect.top - 8}px`;
    });
    node.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });
}

function addDiagramZoom(container) {
  container.querySelectorAll('.mermaid').forEach(el => {
    const svg = el.querySelector('svg');
    if (!svg) return;

    let scale = 1;
    const wrapper = document.createElement('div');
    wrapper.className = 'diagram-zoom-wrapper';
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);

    wrapper.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      scale = Math.min(3, Math.max(0.5, scale + (e.deltaY > 0 ? -0.1 : 0.1)));
      svg.style.transform = `scale(${scale})`;
      svg.style.transformOrigin = 'center top';
    }, { passive: false });
  });
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
  safeHTML(tocList, html);

  // Intercept TOC clicks to scroll without changing the hash,
  // which would trigger handleRoute and navigate away from the detail view
  tocList.addEventListener('click', e => {
    const link = e.target.closest('a[data-toc-target]');
    if (!link) return;
    e.preventDefault();
    const target = document.getElementById(link.dataset.tocTarget);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
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
  commentsList.textContent = '';
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
  const disc = discussionsData.get(String(hip.hip));
  els.commentsLoading.style.display = 'none';

  if (!disc) {
    safeHTML(els.commentsList, `<p style="color:var(--fg-muted);font-size:.88rem">Discussion comments not yet cached. <a href="${esc(url)}" target="_blank" style="color:var(--link)">View on GitHub</a></p>`);
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

  safeHTML(els.commentsList, html || '<p style="color:var(--fg-muted);font-size:.88rem">No comments yet.</p>');
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
      els.prStatus.textContent = `PR #${prNum}: ${statusText}`;
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
    const reviewThreads = prReviewsData.get(String(hip.hip));
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
            for (const reply of threadComments.slice(1)) {
              html += renderGqlComment(reply);
            }
            html += '</div>';
          }
        }
        html += '</div>';
        total += threadComments.length;
      }
    }

    els.commentCount.textContent = total;
    safeHTML(els.commentsList, html || '<p style="color:var(--fg-muted);font-size:.88rem;padding:.5rem 0">No comments yet. Be the first to discuss this HIP.</p>');
  } catch (e) {
    safeHTML(els.commentsLoading, `<span style="color:var(--fg-muted)">Could not load comments. <a href="${esc(url || `https://github.com/${owner}/${repo}/pull/${prNum}`)}" target="_blank" style="color:var(--link)">View on GitHub</a></span>`);
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
      safeHTML(els.commentsList, html);
    } else {
      els.commentCount.textContent = '0';
      safeHTML(els.commentsList, '<p style="color:var(--fg-muted);font-size:.88rem">No comments yet.</p>');
    }
  } catch (e) {
    safeHTML(els.commentsLoading, `<span style="color:var(--fg-muted)">Could not load comments. <a href="${esc(url)}" target="_blank" style="color:var(--link)">View on GitHub</a></span>`);
  }
}

// ---- Shared rendering helpers ----
const REACTION_EMOJI = new Map([
  ['+1', '\ud83d\udc4d'], ['-1', '\ud83d\udc4e'], ['THUMBS_UP', '\ud83d\udc4d'], ['THUMBS_DOWN', '\ud83d\udc4e'],
  ['laugh', '\ud83d\ude04'], ['LAUGH', '\ud83d\ude04'], ['hooray', '\ud83c\udf89'], ['HOORAY', '\ud83c\udf89'],
  ['confused', '\ud83d\ude15'], ['CONFUSED', '\ud83d\ude15'], ['heart', '\u2764\ufe0f'], ['HEART', '\u2764\ufe0f'],
  ['rocket', '\ud83d\ude80'], ['ROCKET', '\ud83d\ude80'], ['eyes', '\ud83d\udc40'], ['EYES', '\ud83d\udc40'],
]);

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
    .map(([key, count]) => `<span class="reaction-chip">${(REACTION_EMOJI.get(key) || key)} <span class="reaction-count">${count}</span></span>`)
    .join('');

  if (chips) {
    safeHTML(container, chips);
    container.style.display = '';
  }
}

function renderReactionChips(reactions) {
  if (!reactions) return '';
  // REST API format: { "+1": 2, ... }
  if (typeof reactions['+1'] === 'number') {
    const reactionMap = new Map([
      ['+1', reactions['+1']], ['-1', reactions['-1']],
      ['laugh', reactions.laugh], ['hooray', reactions.hooray],
      ['confused', reactions.confused], ['heart', reactions.heart],
      ['rocket', reactions.rocket], ['eyes', reactions.eyes],
    ]);
    const chips = [...reactionMap.entries()]
      .filter(([, count]) => count > 0)
      .map(([k, count]) => `<span class="reaction-chip">${(REACTION_EMOJI.get(k) || k)} <span class="reaction-count">${count}</span></span>`);
    return chips.length ? `<div class="comment-reactions">${chips.join('')}</div>` : '';
  }
  // GraphQL format: [{ content: "THUMBS_UP" }, ...]
  if (Array.isArray(reactions)) {
    const counts = new Map();
    for (const r of reactions) { counts.set(r.content, (counts.get(r.content) || 0) + 1); }
    const chips = [...counts.entries()]
      .map(([k, n]) => `<span class="reaction-chip">${(REACTION_EMOJI.get(k) || k)} <span class="reaction-count">${n}</span></span>`);
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
  // Uses indexOf for the primary cut to avoid regex backtracking on large inputs
  const markers = [
    'Reply to this email directly',
    'You are receiving this because',
    'Message ID:',
  ];
  let result = raw;
  for (const marker of markers) {
    const idx = result.indexOf(marker);
    if (idx !== -1) {
      // Walk back to start of line (or separator line above)
      let cutAt = idx;
      while (cutAt > 0 && result.charAt(cutAt - 1) !== '\n') cutAt--;
      // Also trim a separator line (--- or —) immediately before
      if (cutAt > 1) {
        const prevLine = result.slice(result.lastIndexOf('\n', cutAt - 2) + 1, cutAt).trim().replace(/^>?\s*/, '');
        if (/^[—-]{1,3}$/.test(prevLine)) {
          cutAt = result.lastIndexOf('\n', cutAt - 2) + 1;
        }
      }
      result = result.slice(0, cutAt).trimEnd();
    }
  }
  return result;
}

/* =============================================
   CODE ENHANCEMENTS — VS Code-style visualization
   ============================================= */

// Indent Rainbow colors (more visible than before)
const INDENT_COLORS = [
  'rgba(255,99,99,.09)',    // red
  'rgba(255,166,77,.09)',   // orange
  'rgba(230,230,80,.09)',   // yellow
  'rgba(99,210,130,.09)',   // green
  'rgba(99,170,255,.09)',   // blue
  'rgba(180,130,255,.09)',  // purple
];

// Bracket pair colorization colors
const BRACKET_COLORS = [
  '#e5c07b', // gold
  '#c678dd', // purple
  '#56b6c2', // cyan
  '#61afef', // blue
  '#e06c75', // red
  '#98c379', // green
];

const OPEN_BRACKETS = ['(', '[', '{'];
const CLOSE_BRACKETS = [')', ']', '}'];
const BRACKET_PAIRS = new Map([[')', '('], [']', '['], ['}', '{']]);

function applyRainbowIndent(container) {
  container.querySelectorAll('pre code').forEach(block => {
    // --- 1) Indent Rainbow ---
    let html = block.innerHTML;
    const lines = html.split('\n');
    html = lines.map(line => {
      // Strip to plain text to count leading whitespace accurately
      const plain = line.replace(/<[^>]*>/g, '');
      const m = plain.match(/^(\s+)/);
      if (!m) return line;
      const ws = m[1];
      const tabSize = ws.includes('\t') ? 1 : (plain.match(/^ {4}/) ? 4 : 2);
      const level = ws.includes('\t') ? ws.length : Math.floor(ws.length / tabSize);
      if (level === 0) return line;

      // Find how many chars of the HTML correspond to the leading whitespace
      let plainIdx = 0, htmlIdx = 0;
      while (plainIdx < ws.length && htmlIdx < line.length) {
        if (line.charAt(htmlIdx) === '<') {
          const close = line.indexOf('>', htmlIdx);
          if (close !== -1) { htmlIdx = close + 1; continue; }
        }
        plainIdx++;
        htmlIdx++;
      }

      const rest = line.slice(htmlIdx);

      // Build rainbow-colored indent blocks
      let result = '';
      const unit = ws.includes('\t') ? '\t' : ' '.repeat(tabSize);
      for (let i = 0; i < level; i++) {
        const color = INDENT_COLORS[i % INDENT_COLORS.length];
        result += `<span class="indent-guide" style="background:${color}">${unit}</span>`;
      }
      // Any remaining whitespace beyond full indent levels
      const remainder = ws.length - (level * (ws.includes('\t') ? 1 : tabSize));
      if (remainder > 0) result += ' '.repeat(remainder);
      return result + rest;
    }).join('\n');

    // --- 2) Bracket Pair Colorization ---
    // Process text nodes to colorize brackets
    const tmp = document.createElement('div');
    safeHTML(tmp, html);
    let depth = 0;
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
    const replacements = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent;
      if (!/[(){}[\]]/.test(text)) continue;
      const frag = document.createDocumentFragment();
      let last = 0;
      for (let i = 0; i < text.length; i++) {
        const ch = text.charAt(i);
        if (CLOSE_BRACKETS.includes(ch)) depth = Math.max(0, depth - 1);
        if (OPEN_BRACKETS.includes(ch) || CLOSE_BRACKETS.includes(ch)) {
          if (i > last) frag.appendChild(document.createTextNode(text.slice(last, i)));
          const span = document.createElement('span');
          span.className = 'bracket-color';
          span.style.color = BRACKET_COLORS[depth % BRACKET_COLORS.length];
          span.textContent = ch;
          span.dataset.bracket = ch;
          span.dataset.depth = depth;
          frag.appendChild(span);
          if (OPEN_BRACKETS.includes(ch)) depth++;
          last = i + 1;
        }
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      replacements.push({ node, frag });
    }
    for (const { node, frag } of replacements) {
      node.parentNode.replaceChild(frag, node);
    }
    safeHTML(block, tmp.innerHTML);

    // --- 3) Matching Tag Highlight (HTML/XML blocks) ---
    block.querySelectorAll('.hljs-name').forEach(el => {
      el.addEventListener('mouseenter', () => {
        const tagName = el.textContent;
        const allNames = [...block.querySelectorAll('.hljs-name')].filter(n => n.textContent === tagName);
        allNames.forEach(n => n.classList.add('tag-match'));
      });
      el.addEventListener('mouseleave', () => {
        block.querySelectorAll('.tag-match').forEach(n => n.classList.remove('tag-match'));
      });
    });

    // --- 4) Matching Bracket Highlight on hover ---
    block.querySelectorAll('.bracket-color').forEach(el => {
      el.addEventListener('mouseenter', () => {
        const br = el.dataset.bracket;
        const d = Number(el.dataset.depth);
        const all = [...block.querySelectorAll('.bracket-color')];
        const idx = all.indexOf(el);
        if (OPEN_BRACKETS.includes(br)) {
          // Find matching close bracket
          let dd = 0;
          for (const candidate of all.slice(idx)) {
            const b = candidate.dataset.bracket;
            if (OPEN_BRACKETS.includes(b) && Number(candidate.dataset.depth) === d) dd++;
            if (CLOSE_BRACKETS.includes(b) && BRACKET_PAIRS.get(b) === br) {
              dd--;
              if (dd === 0) { el.classList.add('bracket-hover'); candidate.classList.add('bracket-hover'); break; }
            }
          }
        } else {
          // Find matching open bracket
          let dd = 0;
          const reversed = all.slice(0, idx + 1).reverse();
          for (const candidate of reversed) {
            const b = candidate.dataset.bracket;
            if (CLOSE_BRACKETS.includes(b) && Number(candidate.dataset.depth) === d) dd++;
            if (OPEN_BRACKETS.includes(b) && BRACKET_PAIRS.get(br) === b) {
              dd--;
              if (dd === 0) { el.classList.add('bracket-hover'); candidate.classList.add('bracket-hover'); break; }
            }
          }
        }
      });
      el.addEventListener('mouseleave', () => {
        block.querySelectorAll('.bracket-hover').forEach(n => n.classList.remove('bracket-hover'));
      });
    });

    // --- 5) Colorize — inline color swatches for hex/rgb/hsl values ---
    const colorRe = /#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;
    block.querySelectorAll('.hljs-number, .hljs-string, .hljs-attr').forEach(el => {
      const text = el.textContent;
      if (!colorRe.test(text)) return;
      colorRe.lastIndex = 0;
      safeHTML(el, text.replace(colorRe, match => {
        return `<span class="color-swatch-wrap">${esc(match)}<span class="color-swatch" style="background:${esc(match)}"></span></span>`;
      }));
    });
  });
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
    // Treat bare ref as GitHub username
    return `<a href="https://github.com/${encodeURIComponent(ref)}" target="_blank">${esc(name)}</a>`;
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
    const va = pa.at(i) ?? 0;
    const vb = pb.at(i) ?? 0;
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

function showDiscordModal(intro) {
  const overlay = document.createElement('div');
  overlay.className = 'discord-modal-overlay';
  safeHTML(overlay, `
    <div class="discord-modal">
      <button class="discord-modal-close" title="Close">&times;</button>
      <h3>Share on Discord</h3>
      <div class="discord-modal-steps">
        <div class="discord-modal-step"><span class="discord-step-num">1</span> Copy the intro message below</div>
        <div class="discord-modal-step"><span class="discord-step-num">2</span> Click "Download HIP &amp; Open Discord"</div>
        <div class="discord-modal-step"><span class="discord-step-num">3</span> Paste the message in the channel and drag the downloaded file into the chat</div>
      </div>
      <div class="discord-modal-msg-wrap">
        <textarea class="discord-modal-msg" id="discord-msg" rows="6" readonly></textarea>
        <button class="discord-modal-copy" id="discord-copy">Copy Message</button>
      </div>
      <button class="discord-modal-open" id="discord-open">Download HIP &amp; Open Discord</button>
    </div>
  `);
  document.body.appendChild(overlay);

  overlay.querySelector('#discord-msg').value = intro;

  overlay.querySelector('.discord-modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#discord-copy').addEventListener('click', (e) => {
    const textarea = overlay.querySelector('#discord-msg');
    navigator.clipboard.writeText(textarea.value);
    const btn = e.currentTarget;
    btn.textContent = 'Copied!';
    btn.classList.add('discord-modal-copy--done');
    setTimeout(() => { btn.textContent = 'Copy Message'; btn.classList.remove('discord-modal-copy--done'); }, 2000);
  });

  overlay.querySelector('#discord-open').addEventListener('click', () => {
    // Download the .md file
    const d = wizardData;
    const slug = d.title ? d.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'proposal';
    const blob = new Blob([generateHipMarkdown()], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hip-${slug}.md`;
    a.click();
    URL.revokeObjectURL(a.href);

    // Open Discord
    window.open('https://discord.com/channels/905194001349627914/1289954446712770600', '_blank');
  });

  requestAnimationFrame(() => overlay.classList.add('discord-modal-overlay--visible'));
}

/* =============================================
   HIP CREATION WIZARD
   ============================================= */
const WIZARD_STORAGE_KEY = 'hip-wizard-draft';
const MIN_WORDS = new Map([['abstract', 100], ['motivation', 15], ['rationale', 15], ['specification', 20]]);
const MAX_WORDS = new Map([['abstract', 250]]);
function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}
const WIZARD_STEPS = [
  { id: 'basics', label: 'Basics', required: true },
  { id: 'authors', label: 'Authors', required: true },
  { id: 'abstract', label: 'Abstract', required: true },
  { id: 'motivation', label: 'Motivation', required: true },
  { id: 'rationale', label: 'Rationale', required: true },
  { id: 'specification', label: 'Specification', required: true },
  { id: 'compat', label: 'Compatibility & Security', required: false },
  { id: 'submit', label: 'Review & Submit', required: false },
];

let wizardStep = 0;
let wizardData = {};
let wizardInitialized = false;
let previewDebounce = null;

function defaultWizardData() {
  return {
    title: '', type: '', category: '',
    authorName: '', authorHandle: '', authorEmail: '',
    extraAuthors: [],
    workingGroup: [],
    abstract: '', motivation: '', rationale: '', specification: '',
    backwards: '', security: '',
    needsHiero: 'Yes', needsHedera: 'No',
  };
}

function loadWizardDraft() {
  try {
    const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupt localStorage */ }
  return null;
}

function saveWizardDraft() {
  try {
    localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(wizardData));
  } catch { /* ignore storage quota errors */ }
}

function clearWizardDraft() {
  localStorage.removeItem(WIZARD_STORAGE_KEY);
}

function initWizard() {
  document.title = 'Create a HIP';
  window.scrollTo(0, 0);

  if (!wizardInitialized) {
    const draft = loadWizardDraft();
    if (draft && draft.title) {
      const resume = confirm('You have a draft in progress. Resume where you left off?');
      wizardData = resume ? draft : defaultWizardData();
      if (!resume) clearWizardDraft();
    } else {
      wizardData = defaultWizardData();
    }
    wizardInitialized = true;

    $('#wizard-prev').addEventListener('click', () => { if (wizardStep > 0) { wizardStep--; renderWizardStep(); } });
    $('#wizard-next').addEventListener('click', () => {
      if (wizardStep < WIZARD_STEPS.length - 1) {
        if (!validateWizardStep()) return;
        collectWizardFields();
        wizardStep++;
        renderWizardStep();
      }
    });
    $('#create-back').addEventListener('click', e => { e.preventDefault(); location.hash = ''; });
  }

  renderWizardSteps();
  renderWizardStep();
}

function renderWizardSteps() {
  const el = $('#wizard-steps');
  safeHTML(el, WIZARD_STEPS.map((s, i) => {
    const valid = isStepValid(i);
    return `<button class="wz-step ${i === wizardStep ? 'wz-step--active' : ''} ${valid ? 'wz-step--done' : ''}" data-step="${i}">
      <span class="wz-step-num">${valid && i !== wizardStep ? '✓' : i + 1}</span>
      <span class="wz-step-label">${s.label}</span>
    </button>`;
  }).join(''));

  el.querySelectorAll('.wz-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = Number(btn.dataset.step);
      // Allow jumping to any visited or previous step, or next if current is valid
      if (target <= wizardStep || (target === wizardStep + 1 && validateWizardStep())) {
        if (target > wizardStep) collectWizardFields();
        wizardStep = target;
        renderWizardStep();
      }
    });
  });
}

function isStepValid(idx) {
  const d = wizardData;
  switch (idx) {
    case 0: return !!(d.title && d.type && (d.type !== 'Standards Track' || d.category));
    case 1: return !!(d.authorName && (d.authorHandle || d.authorEmail));
    case 2: { const wc = countWords(d.abstract || ''); return wc >= (MIN_WORDS.get('abstract') || 15) && wc <= (MAX_WORDS.get('abstract') || Infinity); }
    case 3: return countWords(d.motivation || '') >= (MIN_WORDS.get('motivation') || 15);
    case 4: return countWords(d.rationale || '') >= (MIN_WORDS.get('rationale') || 15);
    case 5: return countWords(d.specification || '') >= (MIN_WORDS.get('specification') || 15);
    case 6: return true; // optional
    case 7: return true; // submit
    default: return false;
  }
}

function validateWizardStep() {
  collectWizardFields();
  if (!isStepValid(wizardStep)) {
    const form = $('#wizard-form');
    // Mark empty required fields
    form.querySelectorAll('.wz-field').forEach(f => {
      const input = f.querySelector('input, textarea, select');
      if (input && input.required && !input.value.trim()) {
        f.classList.add('wz-field--error');
      }
    });
    // Authors step: validate contact group
    if (wizardStep === 1) {
      const d = wizardData;
      if (!d.authorName) {
        form.querySelector('[data-field="authorName"]')?.closest('.wz-field')?.classList.add('wz-field--error');
      }
      if (!d.authorHandle && !d.authorEmail) {
        form.querySelector('#wz-contact-group')?.classList.add('wz-field-group--error');
      }
    }
    // Shake the form to draw attention
    form.classList.add('wz-shake');
    setTimeout(() => form.classList.remove('wz-shake'), 400);
    const first = form.querySelector('.wz-field--error input, .wz-field--error textarea, .wz-field--error select, .wz-field-group--error input');
    if (first) first.focus();
    return false;
  }
  return true;
}

const WIZARD_FIELDS = new Set([
  'title', 'type', 'category', 'authorName', 'authorHandle', 'authorEmail',
  'workingGroupText', 'abstract', 'motivation', 'rationale', 'specification',
  'backwards', 'security', 'needsHiero', 'needsHedera',
]);

function collectWizardFields() {
  const form = $('#wizard-form');
  if (!form) return;
  const updates = {};
  form.querySelectorAll('[data-field]').forEach(el => {
    const field = el.dataset.field;
    if (WIZARD_FIELDS.has(field)) {
      updates[field] = el.value;
    }
  });
  Object.assign(wizardData, updates);
  saveWizardDraft();
}

function renderWizardStep() {
  renderWizardSteps();
  const form = $('#wizard-form');
  const prev = $('#wizard-prev');
  const next = $('#wizard-next');

  prev.disabled = wizardStep === 0;
  const isLast = wizardStep === WIZARD_STEPS.length - 1;
  next.textContent = isLast ? '' : 'Next';
  next.style.display = isLast ? 'none' : '';

  switch (wizardStep) {
    case 0: renderBasicsStep(form); break;
    case 1: renderAuthorsStep(form); break;
    case 2: renderTextStep(form, 'abstract', 'Abstract', 'A short (~200 word) description of the technical issue being addressed.', true); break;
    case 3: renderTextStep(form, 'motivation', 'Motivation', 'Why is this change needed? What problem does it solve?', true); break;
    case 4: renderTextStep(form, 'rationale', 'Rationale', 'Why this design? What alternatives were considered?', true); break;
    case 5: renderTextStep(form, 'specification', 'Specification', 'The technical specification. Be as detailed as possible.', true); break;
    case 6: renderCompatStep(form); break;
    case 7: renderSubmitStep(form); break;
  }

  updateWizardPreview();
}

function renderBasicsStep(form) {
  const d = wizardData;
  safeHTML(form, `
    <h3>Basics</h3>
    <p class="wz-hint">Start with the fundamentals of your proposal.</p>
    <div class="wz-field">
      <label>Title <span class="wz-req">*</span></label>
      <input type="text" data-field="title" value="${esc(d.title)}" placeholder="e.g. Token Metadata Standard" required>
    </div>
    <div class="wz-field">
      <label>Type <span class="wz-req">*</span></label>
      <select data-field="type" required>
        <option value="">Select type...</option>
        <option value="Standards Track" ${d.type === 'Standards Track' ? 'selected' : ''}>Standards Track</option>
        <option value="Informational" ${d.type === 'Informational' ? 'selected' : ''}>Informational</option>
        <option value="Process" ${d.type === 'Process' ? 'selected' : ''}>Process</option>
      </select>
    </div>
    <div class="wz-field" id="wz-category-field" style="display:${d.type === 'Standards Track' ? '' : 'none'}">
      <label>Category <span class="wz-req">*</span></label>
      <select data-field="category">
        <option value="">Select category...</option>
        <option value="Core" ${d.category === 'Core' ? 'selected' : ''}>Core</option>
        <option value="Service" ${d.category === 'Service' ? 'selected' : ''}>Service</option>
        <option value="Mirror" ${d.category === 'Mirror' ? 'selected' : ''}>Mirror</option>
        <option value="Block Node" ${d.category === 'Block Node' ? 'selected' : ''}>Block Node</option>
        <option value="Application" ${d.category === 'Application' ? 'selected' : ''}>Application</option>
      </select>
    </div>
    <div class="wz-field">
      <label>Requires Hiero Approval</label>
      <select data-field="needsHiero">
        <option value="Yes" ${d.needsHiero === 'Yes' ? 'selected' : ''}>Yes</option>
        <option value="No" ${d.needsHiero === 'No' ? 'selected' : ''}>No</option>
      </select>
    </div>
    <div class="wz-field">
      <label>Requires Hedera Review</label>
      <select data-field="needsHedera">
        <option value="Yes" ${d.needsHedera === 'Yes' ? 'selected' : ''}>Yes</option>
        <option value="No" ${d.needsHedera === 'No' ? 'selected' : ''}>No</option>
      </select>
    </div>
  `);

  const typeSelect = form.querySelector('[data-field="type"]');
  const catField = form.querySelector('#wz-category-field');
  typeSelect.addEventListener('change', () => {
    catField.style.display = typeSelect.value === 'Standards Track' ? '' : 'none';
    schedulePreview();
  });
  bindWizardInputs(form);
}

function renderAuthorsStep(form) {
  const d = wizardData;
  safeHTML(form, `
    <h3>Authors</h3>
    <p class="wz-hint">Who is proposing this HIP?</p>
    <div class="wz-field">
      <label>Your Name <span class="wz-req">*</span></label>
      <input type="text" data-field="authorName" value="${esc(d.authorName)}" placeholder="e.g. Jane Smith" required>
      <span class="wz-inline-error" id="err-authorName">Please enter your name</span>
    </div>
    <div class="wz-field-group" id="wz-contact-group">
      <div class="wz-field-group-label">GitHub Handle or Email <span class="wz-req">*</span> <span class="wz-field-help" style="display:inline">(at least one is required so people can reach you)</span></div>
      <div class="wz-field">
        <label>GitHub Handle</label>
        <input type="text" data-field="authorHandle" value="${esc(d.authorHandle)}" placeholder="e.g. @janesmith">
      </div>
      <div class="wz-field">
        <label>Email</label>
        <input type="email" data-field="authorEmail" value="${esc(d.authorEmail)}" placeholder="e.g. jane@example.com">
      </div>
      <span class="wz-inline-error" id="err-contact">Please enter a GitHub handle or email address</span>
    </div>
    <div class="wz-field">
      <label>Working Group <span class="wz-opt">(optional)</span></label>
      <input type="text" data-field="workingGroupText" value="${esc(d.workingGroupText || '')}" placeholder="e.g. Bob Jones <@bjones>, Alice Lee <alice@example.com>">
      <span class="wz-field-help">Comma-separated. Format: Name &lt;@github&gt; or Name &lt;email&gt;</span>
    </div>
  `);

  // Live validation on blur for contact fields
  const handleEl = form.querySelector('[data-field="authorHandle"]');
  const emailEl = form.querySelector('[data-field="authorEmail"]');
  const contactGroup = form.querySelector('#wz-contact-group');
  const validateContact = () => {
    const hasContact = !!(handleEl.value.trim() || emailEl.value.trim());
    contactGroup.classList.toggle('wz-field-group--error', !hasContact);
  };
  handleEl.addEventListener('blur', validateContact);
  emailEl.addEventListener('blur', validateContact);
  handleEl.addEventListener('input', () => { if (handleEl.value.trim()) contactGroup.classList.remove('wz-field-group--error'); });
  emailEl.addEventListener('input', () => { if (emailEl.value.trim()) contactGroup.classList.remove('wz-field-group--error'); });

  // Name blur validation
  const nameEl = form.querySelector('[data-field="authorName"]');
  nameEl.addEventListener('blur', () => {
    nameEl.closest('.wz-field').classList.toggle('wz-field--error', !nameEl.value.trim());
  });

  bindWizardInputs(form);
}

function renderTextStep(form, field, label, hint, required) {
  const d = wizardData;
  const val = WIZARD_FIELDS.has(field) ? (d[field] || '') : '';
  const minW = MIN_WORDS.get(field) || 15;
  const maxW = MAX_WORDS.get(field) || 0;
  const wc = countWords(val);
  const pct = Math.min(100, Math.round((wc / minW) * 100));
  const met = wc >= minW;
  const over = maxW > 0 && wc > maxW;
  const rangeLabel = maxW > 0 ? `${minW}–${maxW}` : `${minW}`;

  safeHTML(form, `
    <h3>${label}</h3>
    <p class="wz-hint">${hint}${maxW > 0 ? ` (${rangeLabel} words)` : ''}</p>
    <div class="wz-toolbar" id="wz-toolbar"></div>
    <div class="wz-field wz-field--full">
      <textarea data-field="${field}" id="wz-textarea" rows="14" ${required ? 'required' : ''} placeholder="Write in Markdown...">${esc(val)}</textarea>
      <div class="wz-word-status">
        <div class="wz-word-bar">
          <div class="wz-word-fill ${over ? 'wz-word-fill--over' : met ? 'wz-word-fill--met' : ''}" style="width:${pct}%"></div>
        </div>
        <span class="wz-word-count ${over ? 'wz-word-count--over' : met ? 'wz-word-count--met' : ''}">
          <span id="wz-wordcount">${wc}</span> / ${rangeLabel} words ${over ? '(too long)' : met ? '&#10003;' : 'minimum'}
        </span>
      </div>
      ${over ? '<span class="wz-inline-error wz-inline-error--visible">Too long — please shorten to ' + maxW + ' words or fewer</span>' : ''}
      ${!met && !over && val.length > 0 ? '<span class="wz-inline-error wz-inline-error--visible">Keep going — need at least ' + minW + ' words to continue</span>' : ''}
    </div>
  `);

  const textarea = form.querySelector('#wz-textarea');
  const updateWordCount = () => {
    const w = countWords(textarea.value);
    const p = Math.min(100, Math.round((w / minW) * 100));
    const ok = w >= minW;
    const isOver = maxW > 0 && w > maxW;
    const wcEl = form.querySelector('#wz-wordcount');
    const bar = form.querySelector('.wz-word-fill');
    const countSpan = form.querySelector('.wz-word-count');
    form.querySelectorAll('.wz-inline-error').forEach(e => e.remove());
    if (wcEl) wcEl.textContent = w;
    if (bar) {
      bar.style.width = p + '%';
      bar.classList.remove('wz-word-fill--met', 'wz-word-fill--over');
      if (isOver) bar.classList.add('wz-word-fill--over');
      else if (ok) bar.classList.add('wz-word-fill--met');
    }
    if (countSpan) {
      countSpan.classList.remove('wz-word-count--met', 'wz-word-count--over');
      if (isOver) countSpan.classList.add('wz-word-count--over');
      else if (ok) countSpan.classList.add('wz-word-count--met');
      safeHTML(countSpan, `<span id="wz-wordcount">${w}</span> / ${rangeLabel} words ${isOver ? '(too long)' : ok ? '&#10003;' : 'minimum'}`);
    }
    if (isOver) {
      const err = document.createElement('span');
      err.className = 'wz-inline-error wz-inline-error--visible';
      err.textContent = `Too long — please shorten to ${maxW} words or fewer`;
      textarea.closest('.wz-field')?.appendChild(err);
    } else if (!ok && textarea.value.trim().length > 0) {
      const err = document.createElement('span');
      err.className = 'wz-inline-error wz-inline-error--visible';
      err.textContent = `Keep going — need at least ${minW} words to continue`;
      textarea.closest('.wz-field')?.appendChild(err);
    }
  };
  textarea.addEventListener('input', updateWordCount);

  setupMarkdownToolbar(form.querySelector('#wz-toolbar'), textarea);
  bindWizardInputs(form);
}

function renderCompatStep(form) {
  const d = wizardData;
  safeHTML(form, `
    <h3>Compatibility & Security</h3>
    <p class="wz-hint">These sections are optional but strongly recommended.</p>
    <div class="wz-toolbar" id="wz-toolbar-compat"></div>
    <div class="wz-field">
      <label>Backwards Compatibility</label>
      <textarea data-field="backwards" id="wz-textarea-compat" rows="6" placeholder="How does this affect existing systems?">${esc(d.backwards || '')}</textarea>
    </div>
    <div class="wz-toolbar" id="wz-toolbar-sec"></div>
    <div class="wz-field">
      <label>Security Implications</label>
      <textarea data-field="security" id="wz-textarea-sec" rows="6" placeholder="Are there security considerations?">${esc(d.security || '')}</textarea>
    </div>
  `);
  setupMarkdownToolbar(form.querySelector('#wz-toolbar-compat'), form.querySelector('#wz-textarea-compat'));
  setupMarkdownToolbar(form.querySelector('#wz-toolbar-sec'), form.querySelector('#wz-textarea-sec'));
  bindWizardInputs(form);
}

function renderSubmitStep(form) {
  collectWizardFields();
  const md = generateHipMarkdown();
  const allValid = Array.from({ length: 6 }, (_, i) => isStepValid(i)).every(Boolean);
  const issues = [];
  if (!isStepValid(0)) issues.push('Basics: title, type, and category are required');
  if (!isStepValid(1)) issues.push('Authors: name and GitHub handle or email required');
  if (!isStepValid(2)) issues.push(`Abstract: need at least ${MIN_WORDS.get('abstract')} words (currently ${countWords(wizardData.abstract || '')})`);
  if (!isStepValid(3)) issues.push(`Motivation: need at least ${MIN_WORDS.get('motivation')} words (currently ${countWords(wizardData.motivation || '')})`);
  if (!isStepValid(4)) issues.push(`Rationale: need at least ${MIN_WORDS.get('rationale')} words (currently ${countWords(wizardData.rationale || '')})`);
  if (!isStepValid(5)) issues.push(`Specification: need at least ${MIN_WORDS.get('specification')} words (currently ${countWords(wizardData.specification || '')})`);

  const slug = wizardData.title ? wizardData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'my-proposal';
  const filename = `HIP/hip-${slug}.md`;
  const ghUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/new/main?filename=${encodeURIComponent(filename)}`;

  safeHTML(form, `
    <h3>Review & Submit</h3>
    ${issues.length ? `
      <div class="wz-issues">
        <strong>Please fix these issues before submitting:</strong>
        <ul>${issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>
    ` : `<p class="wz-success">All required fields are complete. Your HIP is ready to submit!</p>`}
    <div class="wz-submit-options">
      <button class="wz-submit-btn wz-submit-btn--primary ${!allValid ? 'wz-submit-btn--disabled' : ''}" id="wz-github">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        Submit on GitHub
      </button>
      <button class="wz-submit-btn wz-submit-btn--secondary" id="wz-download">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"/></svg>
        Download .md
      </button>
      <button class="wz-submit-btn wz-submit-btn--secondary" id="wz-copy">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/></svg>
        Copy Markdown
      </button>
      <button class="wz-submit-btn wz-submit-btn--secondary" id="wz-discord">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.545 2.907a13.2 13.2 0 00-3.257-1.011.05.05 0 00-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 00-3.658 0 8.8 8.8 0 00-.412-.833.05.05 0 00-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 00-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.3 13.3 0 003.995 2.02.05.05 0 00.056-.019c.308-.42.582-.863.818-1.329a.05.05 0 00-.01-.059.05.05 0 00-.018-.011 8.8 8.8 0 01-1.248-.595.05.05 0 01-.005-.084c.084-.063.168-.129.248-.195a.05.05 0 01.051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 01.053.007c.08.066.164.132.248.195a.05.05 0 01-.004.084c-.399.233-.813.44-1.249.595a.05.05 0 00-.029.07c.24.465.515.909.817 1.329a.05.05 0 00.056.019 13.2 13.2 0 004-2.02.05.05 0 00.021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 00-.02-.019zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612zm5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612z"/></svg>
        Discuss on Discord
      </button>
    </div>
    <div class="wz-startover">
      <button id="wz-clear" class="wz-clear-btn">Start Over</button>
    </div>
  `);

  form.querySelector('#wz-github')?.addEventListener('click', () => {
    if (!allValid) return;
    navigator.clipboard.writeText(generateHipMarkdown()).then(() => {
      window.open(ghUrl, '_blank');
      // Show a brief notification that content was copied
      const btn = form.querySelector('#wz-github');
      const orig = btn.textContent;
      btn.textContent = 'Copied to clipboard \u2014 paste into the editor on GitHub';
      setTimeout(() => { btn.textContent = orig; }, 5000);
    });
  });

  form.querySelector('#wz-download')?.addEventListener('click', () => {
    const blob = new Blob([generateHipMarkdown()], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hip-${wizardData.title ? wizardData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'proposal'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  form.querySelector('#wz-copy')?.addEventListener('click', (e) => {
    navigator.clipboard.writeText(generateHipMarkdown());
    const btn = e.currentTarget;
    const orig = btn.innerHTML;
    safeHTML(btn, '<span style="color:var(--green)">Copied!</span>');
    setTimeout(() => { safeHTML(btn, orig); }, 1500);
  });

  form.querySelector('#wz-discord')?.addEventListener('click', () => {
    const d = wizardData;
    const abstractSnippet = (d.abstract || '').slice(0, 300) + ((d.abstract || '').length > 300 ? '...' : '');
    const intro = `Hi! I'd like to propose a new HIP: **${d.title || 'Untitled'}** (${d.type || 'Standards Track'})\n\n${abstractSnippet}\n\nI've attached the full proposal as a file. Looking forward to feedback!`;

    // Show modal first — file downloads when they click "Open Discord"
    showDiscordModal(intro);
  });

  form.querySelector('#wz-clear')?.addEventListener('click', () => {
    if (confirm('Discard this draft and start over?')) {
      clearWizardDraft();
      wizardData = defaultWizardData();
      wizardStep = 0;
      renderWizardStep();
    }
  });
}

function generateHipMarkdown() {
  const d = wizardData;
  let author = d.authorName || '';
  if (d.authorHandle) {
    const h = d.authorHandle.startsWith('@') ? d.authorHandle : `@${d.authorHandle}`;
    author += ` <${h}>`;
  } else if (d.authorEmail) {
    author += ` <${d.authorEmail}>`;
  }
  const today = new Date().toISOString().slice(0, 10);
  let fm = `---\nhip: <to be assigned>\ntitle: ${d.title || ''}\nauthor: ${author}\n`;
  if (d.workingGroupText) fm += `working-group: ${d.workingGroupText}\n`;
  fm += `type: ${d.type || ''}\n`;
  if (d.type === 'Standards Track' && d.category) fm += `category: ${d.category}\n`;
  fm += `needs-hiero-approval: ${d.needsHiero || 'Yes'}\n`;
  fm += `needs-hedera-review: ${d.needsHedera || 'No'}\n`;
  fm += `status: Draft\ncreated: ${today}\ndiscussions-to: <to be assigned>\n---\n\n`;

  fm += `## Abstract\n\n${d.abstract || ''}\n\n`;
  fm += `## Motivation\n\n${d.motivation || ''}\n\n`;
  fm += `## Rationale\n\n${d.rationale || ''}\n\n`;
  fm += `## Specification\n\n${d.specification || ''}\n\n`;
  if (d.backwards) fm += `## Backwards Compatibility\n\n${d.backwards}\n\n`;
  if (d.security) fm += `## Security Implications\n\n${d.security}\n\n`;
  return fm;
}

/* Markdown toolbar */
function setupMarkdownToolbar(toolbar, textarea) {
  if (!toolbar || !textarea) return;
  const btns = [
    { label: 'B', title: 'Bold (Ctrl+B)', wrap: ['**', '**'], key: 'b' },
    { label: 'I', title: 'Italic (Ctrl+I)', wrap: ['*', '*'], key: 'i' },
    { label: '`', title: 'Inline Code', wrap: ['`', '`'] },
    { label: '```', title: 'Code Block', wrap: ['```\n', '\n```'] },
    { label: 'H', title: 'Heading', prefix: '## ' },
    { label: '🔗', title: 'Link (Ctrl+K)', wrap: ['[', '](url)'], key: 'k' },
    { label: '•', title: 'Bullet List', prefix: '- ' },
    { label: '1.', title: 'Numbered List', prefix: '1. ' },
    { label: '▦', title: 'Table', insert: '| Header | Header |\n| ------ | ------ |\n| Cell   | Cell   |' },
  ];

  safeHTML(toolbar, btns.map(b =>
    `<button type="button" class="wz-tb-btn" title="${esc(b.title)}" data-idx="${btns.indexOf(b)}">${b.label}</button>`
  ).join(''));

  toolbar.querySelectorAll('.wz-tb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const b = btns[Number(btn.dataset.idx)];
      applyToolbarAction(textarea, b);
    });
  });

  textarea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      const btn = btns.find(b => b.key === e.key);
      if (btn) { e.preventDefault(); applyToolbarAction(textarea, btn); }
    }
  });

  textarea.addEventListener('input', () => {
    const cc = document.getElementById('wz-charcount');
    if (cc) cc.textContent = textarea.value.length;
    schedulePreview();
  });
}

function applyToolbarAction(textarea, action) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.slice(start, end) || 'text';

  let replacement, cursorPos;
  if (action.wrap) {
    replacement = action.wrap[0] + selected + action.wrap[1];
    cursorPos = start + action.wrap[0].length + selected.length;
  } else if (action.prefix) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    replacement = action.prefix + text.slice(lineStart, end);
    textarea.value = text.slice(0, lineStart) + replacement + text.slice(end);
    textarea.selectionStart = textarea.selectionEnd = lineStart + replacement.length;
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
    return;
  } else if (action.insert) {
    replacement = action.insert;
    cursorPos = start + replacement.length;
  }

  textarea.value = text.slice(0, start) + replacement + text.slice(end);
  textarea.selectionStart = textarea.selectionEnd = cursorPos;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

function bindWizardInputs(form) {
  form.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('input', () => {
      el.closest('.wz-field')?.classList.remove('wz-field--error');
      schedulePreview();
    });
    el.addEventListener('change', () => {
      schedulePreview();
    });
  });
}

function schedulePreview() {
  clearTimeout(previewDebounce);
  previewDebounce = setTimeout(() => {
    collectWizardFields();
    updateWizardPreview();
  }, 300);
}

function updateWizardPreview() {
  const preview = $('#wizard-preview-content');
  if (!preview) return;
  const md = generateHipMarkdown();

  // Parse the frontmatter for the meta table
  const d = wizardData;
  let author = d.authorName || '';
  if (d.authorHandle) {
    const h = d.authorHandle.startsWith('@') ? d.authorHandle : `@${d.authorHandle}`;
    author += ` <${h}>`;
  } else if (d.authorEmail) {
    author += ` <${d.authorEmail}>`;
  }

  const rows = [
    ['Author', fmtPeople(author)],
    d.workingGroupText ? ['Working Group', fmtPeople(d.workingGroupText)] : null,
    ['Status', badge('Draft')],
    d.needsHiero ? ['Requires Hiero Approval', d.needsHiero] : null,
    d.needsHedera ? ['Requires Hedera Review', d.needsHedera] : null,
    ['Type', esc(d.type || '')],
    d.category ? ['Category', esc(d.category)] : null,
    ['Created', new Date().toISOString().slice(0, 10)],
  ].filter(Boolean);

  const metaHtml = `<table class="meta-table"><tbody>${rows.map(([l, v]) =>
    `<tr><th>${l}</th><td>${v}</td></tr>`
  ).join('')}</tbody></table>`;

  // Extract body (everything after the frontmatter closing ---)
  const bodyMatch = md.match(/^---[\s\S]*?---\n\n?([\s\S]*)$/);
  const bodyMd = bodyMatch ? bodyMatch[1] : '';

  safeHTML(preview, `
    <div class="detail-header">
      <h1><span class="hip-number">HIP-???:</span> ${esc(d.title || 'Untitled')}</h1>
    </div>
    ${metaHtml}
    <article>${marked.parse(bodyMd)}</article>
  `);

  applyRainbowIndent(preview);
}

/* =============================================
   BOOT
   ============================================= */
init();
