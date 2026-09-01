'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  parseFrontMatter,
  validateChange,
  validateDocument,
} = require('./validateHIP');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');

function makeHip(overrides = {}) {
  const values = {
    hip: '123',
    title: 'Deterministic HIP validation',
    author: 'Example Author (@example)',
    requestedBy: 'Example Project',
    discussionsTo: 'https://github.com/hiero-ledger/hiero-improvement-proposals/pull/123',
    type: 'Standards Track',
    category: 'Service',
    needsHieroApproval: 'Yes',
    needsHederaReview: 'Yes',
    status: 'Draft',
    created: '2026-08-01',
    updated: '2026-08-01',
    ...overrides,
  };

  const headers = [
    '---',
    `hip: ${values.hip}`,
    `title: ${values.title}`,
    `author: ${values.author}`,
  ];
  if (values.requestedBy !== null) headers.push(`requested-by: ${values.requestedBy}`);
  headers.push(`discussions-to: ${values.discussionsTo}`);
  headers.push(`type: ${values.type}`);
  if (values.category !== null) headers.push(`category: ${values.category}`);
  headers.push(`needs-hiero-approval: ${values.needsHieroApproval}`);
  headers.push(`needs-hedera-review: ${values.needsHederaReview}`);
  headers.push(`status: ${values.status}`);
  if (values.lastCallDateTime !== undefined) {
    headers.push(`last-call-date-time: ${values.lastCallDateTime}`);
  } else if (values.status === 'Last Call') {
    headers.push('last-call-date-time: 2026-09-15T07:00:00Z');
  }
  if (values.hederaDecision !== undefined) {
    headers.push(`hedera-acceptance-decision: ${values.hederaDecision}`);
  }
  if (values.hederaReviewedOn !== undefined) {
    headers.push(`hedera-reviewed-on: ${values.hederaReviewedOn}`);
  }
  headers.push(`created: ${values.created}`);
  headers.push(`updated: ${values.updated}`);
  if (values.requires !== undefined) headers.push(`requires: ${values.requires}`);
  if (values.replaces !== undefined) headers.push(`replaces: ${values.replaces}`);
  if (values.supersededBy !== undefined) {
    headers.push(`superseded-by: ${values.supersededBy}`);
  } else if (values.status === 'Replaced') {
    headers.push('superseded-by: 456');
  }
  if (values.release !== undefined) {
    headers.push(`release: ${values.release}`);
  } else if (values.status === 'Final') {
    headers.push('release: v0.99.0');
  }
  headers.push('---', '', '## Abstract', '', values.body || 'A complete proposal.', '');
  return headers.join('\n');
}

function codes(validation, collection = 'issues') {
  return validation[collection].map((entry) => entry.code);
}

function assertValidDocument(source, options = {}) {
  const validation = validateDocument(source, {
    path: 'HIP/hip-123.md',
    ...options,
  });
  assert.deepEqual(validation.issues, []);
}

test('front matter parser preserves scalar values containing colons', () => {
  const parsed = parseFrontMatter(makeHip());
  assert.equal(
    parsed.fields['discussions-to'],
    'https://github.com/hiero-ledger/hiero-improvement-proposals/pull/123',
  );
  assert.match(parsed.body, /## Abstract/);
});

test('front matter parser supports template comments without stripping URL fragments', () => {
  const source = makeHip()
    .replace('hip: 123', 'hip: 123 # Assigned by an editor')
    .replace('Example Author (@example)', "Pat O'Brien (@example) # Primary author")
    .replace('/pull/123', '/pull/123#discussion_r1');
  const parsed = parseFrontMatter(source);
  assert.equal(parsed.fields.hip, '123');
  assert.equal(parsed.fields.author, "Pat O'Brien (@example)");
  assert.equal(
    parsed.fields['discussions-to'],
    'https://github.com/hiero-ledger/hiero-improvement-proposals/pull/123#discussion_r1',
  );
});

test('front matter parser treats quoted YAML scalars as their values', () => {
  const source = makeHip()
    .replace('type: Standards Track', 'type: "Standards Track"')
    .replace('category: Service', "category: 'Service'")
    .replace('status: Draft', 'status: "Draft"');
  assertValidDocument(source);
});

test('front matter parser reports malformed delimiters, lines, and duplicate headers', async (t) => {
  await t.test('opening delimiter', () => {
    assert.deepEqual(codes(parseFrontMatter('hip: 123\n---\n')), ['frontmatter-opening-delimiter']);
  });
  await t.test('closing delimiter', () => {
    assert.deepEqual(codes(parseFrontMatter('---\nhip: 123\n')), ['frontmatter-closing-delimiter']);
  });
  await t.test('malformed line and duplicate', () => {
    const parsed = parseFrontMatter('---\nhip: 123\nnot a header\nhip: 456\n---\n');
    assert.deepEqual(codes(parsed), ['frontmatter-line-format', 'duplicate-header']);
  });
});

test('new Draft HIPs pass for every HIP-1 type and category flow', async (t) => {
  const variants = [
    ['Standards Track / Core', { type: 'Standards Track', category: 'Core' }],
    ['Standards Track / Service', { type: 'Standards Track', category: 'Service' }],
    ['Standards Track / Mirror', { type: 'Standards Track', category: 'Mirror' }],
    ['Standards Track / Block Node', { type: 'Standards Track', category: 'Block Node' }],
    ['Standards Track / Application', {
      type: 'Standards Track',
      category: 'Application',
      needsHieroApproval: 'No',
      needsHederaReview: 'No',
    }],
    ['Informational', {
      type: 'Informational',
      category: null,
      needsHieroApproval: 'No',
      needsHederaReview: 'No',
    }],
    ['Process', {
      type: 'Process',
      category: null,
      needsHieroApproval: 'No',
      needsHederaReview: 'No',
    }],
  ];

  for (const [name, variant] of variants) {
    await t.test(name, () => {
      const source = makeHip({ hip: '0000', ...variant });
      const validation = validateChange(source, {
        path: 'HIP/hip-0000-example.md',
        baseSource: null,
        today: '2026-08-01',
      });
      assert.deepEqual(validation.errors, []);
      assert.equal(validation.isNew, true);
    });
  }
});

test('new HIPs must use Draft status and the HIP-1 placeholder number and filename', () => {
  const notDraft = validateChange(makeHip({ hip: '0000', status: 'Review' }), {
    path: 'HIP/hip-0000-example.md',
    baseSource: null,
  });
  assert.ok(codes(notDraft, 'errors').includes('new-hip-status'));

  const wrongFilename = validateChange(makeHip({ hip: '0000' }), {
    path: 'HIP/my-proposal.md',
    baseSource: null,
  });
  assert.ok(codes(wrongFilename, 'errors').includes('hip-filename'));

  const wrongNumber = validateChange(makeHip(), {
    path: 'HIP/hip-456.md',
    baseSource: null,
  });
  assert.ok(codes(wrongNumber, 'errors').includes('hip-filename-number'));
});

test('every current status is accepted only by its HIP-1 workflow', async (t) => {
  const standardStatuses = [
    'Draft', 'Review', 'Last Call', 'Approved', 'Final',
    'Deferred', 'Withdrawn', 'Stagnant', 'Rejected', 'Replaced',
  ];
  const activeStatuses = [
    'Draft', 'Review', 'Last Call', 'Active',
    'Deferred', 'Withdrawn', 'Stagnant', 'Rejected', 'Replaced',
  ];

  await t.test('Standards Track approval flow statuses', () => {
    for (const status of standardStatuses) {
      assertValidDocument(makeHip({ status }));
    }
  });

  for (const [name, variant] of [
    ['Application', { type: 'Standards Track', category: 'Application' }],
    ['Informational', { type: 'Informational', category: null }],
    ['Process', { type: 'Process', category: null }],
  ]) {
    await t.test(`${name} active flow statuses`, () => {
      for (const status of activeStatuses) {
        assertValidDocument(makeHip({
          ...variant,
          needsHieroApproval: 'No',
          needsHederaReview: 'No',
          status,
        }));
      }
    });
  }

  const standardActive = validateDocument(makeHip({ status: 'Active' }), { path: 'HIP/hip-123.md' });
  assert.ok(codes(standardActive).includes('status-for-flow'));

  for (const status of ['Approved', 'Final']) {
    const applicationResolution = validateDocument(makeHip({
      category: 'Application',
      needsHieroApproval: 'No',
      needsHederaReview: 'No',
      status,
    }), { path: 'HIP/hip-123.md' });
    assert.ok(codes(applicationResolution).includes('status-for-flow'));
  }
});

test('approval and review flags follow each HIP-1 workflow', async (t) => {
  await t.test('approval-track categories require Yes', () => {
    for (const category of ['Core', 'Service', 'Mirror', 'Block Node']) {
      for (const field of ['needsHieroApproval', 'needsHederaReview']) {
        const invalid = validateDocument(makeHip({ category, [field]: 'No' }), {
          path: 'HIP/hip-123.md',
        });
        assert.ok(codes(invalid).includes('approval-for-flow'), `${category} ${field}`);
      }
    }
  });

  await t.test('active-flow types require No', () => {
    const variants = [
      { type: 'Standards Track', category: 'Application' },
      { type: 'Informational', category: null },
      { type: 'Process', category: null },
    ];
    for (const variant of variants) {
      const invalid = validateDocument(makeHip({ ...variant }), { path: 'HIP/hip-123.md' });
      assert.equal(codes(invalid).filter((code) => code === 'approval-for-flow').length, 2);
    }
  });
});

test('type, category, and status spellings are exact', () => {
  const invalid = validateDocument(makeHip({
    type: 'Standards',
    category: 'API',
    status: 'Council Review',
  }), { path: 'HIP/hip-123.md' });
  assert.ok(codes(invalid).includes('type-value'));
  assert.ok(codes(invalid).includes('status-value'));

  const invalidCategory = validateDocument(makeHip({ category: 'Mirror Node' }), {
    path: 'HIP/hip-123.md',
  });
  assert.ok(codes(invalidCategory).includes('category-value'));
});

test('discussions-to must be a full HTTP(S) URL', () => {
  const invalid = validateDocument(makeHip({ discussionsTo: 'PR 123' }), {
    path: 'HIP/hip-123.md',
  });
  assert.ok(codes(invalid).includes('discussions-url'));
});

test('Accepted is grandfathered only for pre-2025 Standards Track HIPs', () => {
  assertValidDocument(makeHip({
    status: 'Accepted',
    created: '2024-12-31',
    updated: '2024-12-31',
  }));

  const modern = validateDocument(makeHip({ status: 'Accepted' }), { path: 'HIP/hip-123.md' });
  assert.ok(codes(modern).includes('legacy-accepted-status'));
});

test('status-specific headers are enforced', () => {
  const lastCall = validateDocument(makeHip({
    status: 'Last Call',
    lastCallDateTime: '',
  }), { path: 'HIP/hip-123.md' });
  assert.ok(codes(lastCall).includes('last-call-date-time-required'));

  const final = validateDocument(makeHip({ status: 'Final', release: '' }), {
    path: 'HIP/hip-123.md',
  });
  assert.ok(codes(final).includes('release-required'));

  const replaced = validateDocument(makeHip({ status: 'Replaced', supersededBy: '' }), {
    path: 'HIP/hip-123.md',
  });
  assert.ok(codes(replaced).includes('superseded-by-required'));
});

test('dates, timestamps, and HIP reference lists are validated', () => {
  const invalid = validateDocument(makeHip({
    created: '2026-02-30',
    updated: '2026-09-01, 2026-08-01',
    lastCallDateTime: '2026-09-15 07:00:00 UTC',
    requires: '123, cutover',
  }), { path: 'HIP/hip-123.md' });
  const invalidCodes = codes(invalid);
  assert.ok(invalidCodes.includes('date-format'));
  assert.ok(invalidCodes.includes('updated-date-order'));
  assert.ok(invalidCodes.includes('last-call-date-time-format'));
  assert.ok(invalidCodes.includes('hip-reference-list'));
});

test('Hedera decision metadata is paired and follows approval ordering', () => {
  assertValidDocument(makeHip({
    status: 'Approved',
    hederaDecision: 'Accepted',
    hederaReviewedOn: '2026-08-20',
  }));

  const incomplete = validateDocument(makeHip({
    status: 'Approved',
    hederaDecision: 'Accepted',
  }), { path: 'HIP/hip-123.md' });
  assert.ok(codes(incomplete).includes('hedera-review-pair'));

  const tooEarly = validateDocument(makeHip({
    status: 'Review',
    hederaDecision: 'Accepted',
    hederaReviewedOn: '2026-08-20',
  }), { path: 'HIP/hip-123.md' });
  assert.ok(codes(tooEarly).includes('hedera-review-before-approved'));
});

test('all primary transitions pass across all HIP types and categories', async (t) => {
  const transitions = [
    ['Core Draft → Review', { category: 'Core' }, 'Draft', 'Review'],
    ['Service Review → Last Call', { category: 'Service' }, 'Review', 'Last Call'],
    ['Mirror Last Call → Approved', { category: 'Mirror' }, 'Last Call', 'Approved'],
    ['Block Node Approved → Final', { category: 'Block Node' }, 'Approved', 'Final'],
    ['Application Last Call → Active', {
      category: 'Application', needsHieroApproval: 'No', needsHederaReview: 'No',
    }, 'Last Call', 'Active'],
    ['Informational Review → Last Call', {
      type: 'Informational', category: null, needsHieroApproval: 'No', needsHederaReview: 'No',
    }, 'Review', 'Last Call'],
    ['Process Last Call → Active', {
      type: 'Process', category: null, needsHieroApproval: 'No', needsHederaReview: 'No',
    }, 'Last Call', 'Active'],
  ];

  for (const [name, variant, from, to] of transitions) {
    await t.test(name, () => {
      const baseSource = makeHip({ ...variant, status: from });
      const source = makeHip({ ...variant, status: to, updated: '2026-09-01' });
      const validation = validateChange(source, {
        path: 'HIP/hip-123.md',
        baseSource,
        today: '2026-09-01',
      });
      assert.deepEqual(validation.errors, []);
    });
  }
});

test('Last Call may be waived for a minor change as documented by HIP-1', () => {
  const standard = validateChange(makeHip({ status: 'Approved', updated: '2026-09-01' }), {
    path: 'HIP/hip-123.md',
    baseSource: makeHip({ status: 'Review' }),
    today: '2026-09-01',
  });
  assert.deepEqual(standard.errors, []);

  const activeVariant = {
    type: 'Process',
    category: null,
    needsHieroApproval: 'No',
    needsHederaReview: 'No',
  };
  const active = validateChange(makeHip({
    ...activeVariant,
    status: 'Active',
    updated: '2026-09-01',
  }), {
    path: 'HIP/hip-123.md',
    baseSource: makeHip({ ...activeVariant, status: 'Review' }),
    today: '2026-09-01',
  });
  assert.deepEqual(active.errors, []);
});

test('the complete status-transition matrix matches both HIP-1 workflows', async (t) => {
  const workflows = [
    ['Standards Track', {}, {
      Draft: ['Draft', 'Review', 'Deferred', 'Withdrawn', 'Stagnant'],
      Review: ['Review', 'Last Call', 'Approved', 'Rejected', 'Stagnant'],
      'Last Call': ['Last Call', 'Approved', 'Rejected', 'Withdrawn', 'Stagnant'],
      Approved: ['Approved', 'Final'],
      Final: ['Final', 'Replaced'],
      Deferred: ['Deferred', 'Draft'],
      Stagnant: ['Stagnant', 'Draft'],
      Withdrawn: ['Withdrawn'],
      Rejected: ['Rejected'],
      Replaced: ['Replaced'],
    }],
    ['Informational / Process / Application', {
      type: 'Process',
      category: null,
      needsHieroApproval: 'No',
      needsHederaReview: 'No',
    }, {
      Draft: ['Draft', 'Review', 'Deferred', 'Withdrawn', 'Stagnant'],
      Review: ['Review', 'Last Call', 'Active', 'Rejected', 'Stagnant'],
      'Last Call': ['Last Call', 'Active', 'Rejected', 'Withdrawn', 'Stagnant'],
      Active: ['Active', 'Replaced'],
      Deferred: ['Deferred', 'Draft'],
      Stagnant: ['Stagnant', 'Draft'],
      Withdrawn: ['Withdrawn'],
      Rejected: ['Rejected'],
      Replaced: ['Replaced'],
    }],
  ];

  for (const [name, variant, expected] of workflows) {
    await t.test(name, () => {
      const statuses = Object.keys(expected);
      for (const from of statuses) {
        for (const to of statuses) {
          const validation = validateChange(makeHip({
            ...variant,
            status: to,
            updated: '2026-09-01',
          }), {
            path: 'HIP/hip-123.md',
            baseSource: makeHip({ ...variant, status: from }),
            today: '2026-09-01',
          });
          const transitionFailed = codes(validation, 'errors').includes('status-transition');
          assert.equal(
            transitionFailed,
            !expected[from].includes(to),
            `${name}: ${from} → ${to}`,
          );
        }
      }
    });
  }
});

test('terminal, skipped, and cross-flow transitions fail helpfully', () => {
  const skipped = validateChange(makeHip({ status: 'Final', updated: '2026-09-01' }), {
    path: 'HIP/hip-123.md',
    baseSource: makeHip({ status: 'Draft' }),
    today: '2026-09-01',
  });
  assert.ok(codes(skipped, 'errors').includes('status-transition'));
  assert.match(
    skipped.errors.find((entry) => entry.code === 'status-transition').suggestion,
    /Review, Deferred, Withdrawn, Stagnant/,
  );

  const terminal = validateChange(makeHip({ status: 'Review', updated: '2026-09-01' }), {
    path: 'HIP/hip-123.md',
    baseSource: makeHip({ status: 'Rejected' }),
    today: '2026-09-01',
  });
  assert.ok(codes(terminal, 'errors').includes('status-transition'));

  const wrongResolution = validateChange(makeHip({
    category: 'Application',
    needsHieroApproval: 'No',
    needsHederaReview: 'No',
    status: 'Approved',
    updated: '2026-09-01',
  }), {
    path: 'HIP/hip-123.md',
    baseSource: makeHip({
      category: 'Application',
      needsHieroApproval: 'No',
      needsHederaReview: 'No',
      status: 'Last Call',
    }),
    today: '2026-09-01',
  });
  assert.ok(codes(wrongResolution, 'errors').includes('status-for-flow'));
  assert.ok(codes(wrongResolution, 'errors').includes('status-transition'));
});

test('existing HIP edits require a non-regressing updated date', () => {
  const baseSource = makeHip();
  const unchangedDate = validateChange(`${makeHip()}\nChanged body.\n`, {
    path: 'HIP/hip-123.md',
    baseSource,
    today: '2026-09-01',
  });
  assert.ok(codes(unchangedDate, 'errors').includes('updated-date-not-recorded'));

  const updated = validateChange(makeHip({ updated: '2026-09-01', body: 'Changed body.' }), {
    path: 'HIP/hip-123.md',
    baseSource,
    today: '2026-09-01',
  });
  assert.deepEqual(updated.errors, []);

  const regressed = validateChange(makeHip({ updated: '2026-07-01', body: 'Changed body.' }), {
    path: 'HIP/hip-123.md',
    baseSource,
    today: '2026-09-01',
  });
  assert.ok(codes(regressed, 'errors').includes('updated-date-regressed'));
});

test('HIP number and creation date cannot change after assignment', () => {
  const baseSource = makeHip();
  const changed = validateChange(makeHip({
    hip: '456',
    created: '2026-08-02',
    updated: '2026-09-01',
  }), {
    path: 'HIP/hip-456.md',
    baseSource,
    today: '2026-09-01',
  });
  const errorCodes = codes(changed, 'errors');
  assert.ok(errorCodes.includes('hip-number-changed'));
  assert.ok(errorCodes.includes('created-date-changed'));
});

test('pre-existing legacy issues warn without blocking unrelated edits', () => {
  const variant = { requestedBy: null, type: 'Standards', category: 'Core' };
  const validation = validateChange(makeHip({ ...variant, updated: '2026-09-01' }), {
    path: 'HIP/hip-123.md',
    baseSource: makeHip(variant),
    today: '2026-09-01',
  });
  assert.deepEqual(validation.errors, []);
  assert.ok(codes(validation, 'warnings').includes('required-header'));
  assert.ok(codes(validation, 'warnings').includes('type-value'));
});

test('newly introduced violations still fail an existing legacy HIP', () => {
  const baseSource = makeHip({ requestedBy: null });
  const validation = validateChange(makeHip({
    requestedBy: null,
    title: '<The HIP Title>',
    updated: '2026-09-01',
  }), {
    path: 'HIP/hip-123.md',
    baseSource,
    today: '2026-09-01',
  });
  assert.ok(codes(validation, 'warnings').includes('required-header'));
  assert.ok(codes(validation, 'errors').includes('placeholder-header'));
});

test('every merged HIP can be edited without pre-existing metadata blocking the PR', () => {
  const hipDirectory = path.join(REPOSITORY_ROOT, 'HIP');
  const hipFiles = fs.readdirSync(hipDirectory)
    .filter((filename) => /^hip-\d+\.md$/.test(filename));
  assert.ok(hipFiles.length > 100, 'expected the merged HIP corpus');

  for (const filename of hipFiles) {
    const source = fs.readFileSync(path.join(hipDirectory, filename), 'utf8');
    const validation = validateChange(source, {
      path: `HIP/${filename}`,
      baseSource: source,
      today: '2026-09-01',
    });
    assert.deepEqual(validation.errors, [], filename);
  }
});

test('CLI aggregates actionable errors and emits GitHub annotations', (t) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hip-validator-'));
  t.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const hipDirectory = path.join(temporaryDirectory, 'HIP');
  fs.mkdirSync(hipDirectory);
  const hipPath = path.join(hipDirectory, 'hip-0000-example.md');
  fs.writeFileSync(hipPath, makeHip({
    hip: '0000',
    type: 'Informational',
    category: null,
    needsHieroApproval: 'Yes',
    needsHederaReview: 'Yes',
  }));

  const result = spawnSync(process.execPath, [path.join(__dirname, 'validateHIP.js'), hipPath], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: 'true' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /conflicts with the HIP-1/);
  assert.match(result.stdout, /::error file=HIP\/hip-0000-example\.md/);
  assert.match(result.stdout, /Fix:/);
});

test('CLI compares a renamed HIP with its original base path', (t) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hip-validator-git-'));
  t.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const hipDirectory = path.join(temporaryDirectory, 'HIP');
  fs.mkdirSync(hipDirectory);
  const originalPath = path.join(hipDirectory, 'hip-123.md');
  const renamedPath = path.join(hipDirectory, 'hip-123-renamed.md');
  fs.writeFileSync(originalPath, makeHip({ status: 'Draft' }));

  for (const args of [
    ['init', '-q'],
    ['config', 'user.name', 'Validator Test'],
    ['config', 'user.email', 'validator@example.com'],
    ['config', 'commit.gpgsign', 'false'],
    ['add', 'HIP/hip-123.md'],
    ['commit', '-qm', 'base'],
  ]) {
    const git = spawnSync('git', args, { cwd: temporaryDirectory, encoding: 'utf8' });
    assert.equal(git.status, 0, git.stderr);
  }
  const base = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: temporaryDirectory,
    encoding: 'utf8',
  }).stdout.trim();
  fs.renameSync(originalPath, renamedPath);
  fs.writeFileSync(renamedPath, makeHip({ status: 'Review', updated: '2026-09-01' }));
  for (const args of [
    ['add', '-A'],
    ['commit', '-qm', 'rename HIP'],
  ]) {
    const git = spawnSync('git', args, { cwd: temporaryDirectory, encoding: 'utf8' });
    assert.equal(git.status, 0, git.stderr);
  }

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'validateHIP.js'), '--base-ref', base, 'HIP/hip-123-renamed.md'],
    { cwd: temporaryDirectory, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /follows HIP-1/);
});

test('workflow validates git-discovered HIP files without API secrets or pagination', () => {
  const workflow = fs.readFileSync(
    path.join(REPOSITORY_ROOT, '.github/workflows/validateHeaders.yml'),
    'utf8',
  );
  assert.match(workflow, /git diff --name-only --diff-filter=ACMR -z/);
  assert.match(workflow, /--base-ref "\$BASE_SHA"/);
  assert.match(workflow, /node-version: "20"/);
  assert.match(workflow, /run: npm test/);
  assert.doesNotMatch(workflow, /VERTESIA|curl|jq|GITHUB_TOKEN/);
});
