#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TYPES = ['Standards Track', 'Informational', 'Process'];
const STANDARD_CATEGORIES = ['Core', 'Service', 'Mirror', 'Block Node', 'Application'];
const STATUSES = [
  'Draft',
  'Review',
  'Last Call',
  'Approved',
  'Final',
  'Active',
  'Deferred',
  'Withdrawn',
  'Stagnant',
  'Rejected',
  'Replaced',
];

const STANDARD_STATUSES = new Set([
  'Draft',
  'Review',
  'Last Call',
  'Approved',
  'Final',
  'Deferred',
  'Withdrawn',
  'Stagnant',
  'Rejected',
  'Replaced',
]);

const ACTIVE_STATUSES = new Set([
  'Draft',
  'Review',
  'Last Call',
  'Active',
  'Deferred',
  'Withdrawn',
  'Stagnant',
  'Rejected',
  'Replaced',
]);

// HIP-1's diagrams define the normal paths. Its review prose also permits Last
// Call to be waived for minor changes, which is why Review can resolve directly.
// Deferred and Stagnant HIPs may be revisited, so they can return to Draft;
// unchanged statuses are handled separately. Stagnant is available from each
// pre-resolution stage because HIP-1 defines it by inactivity, not proposal type.
const TRANSITIONS = {
  standard: new Map([
    ['Draft', new Set(['Review', 'Deferred', 'Withdrawn', 'Stagnant'])],
    ['Review', new Set(['Last Call', 'Approved', 'Rejected', 'Stagnant'])],
    ['Last Call', new Set(['Approved', 'Rejected', 'Withdrawn', 'Stagnant'])],
    ['Approved', new Set(['Final'])],
    ['Final', new Set(['Replaced'])],
    ['Deferred', new Set(['Draft'])],
    ['Stagnant', new Set(['Draft'])],
    ['Withdrawn', new Set()],
    ['Rejected', new Set()],
    ['Replaced', new Set()],
  ]),
  active: new Map([
    ['Draft', new Set(['Review', 'Deferred', 'Withdrawn', 'Stagnant'])],
    ['Review', new Set(['Last Call', 'Active', 'Rejected', 'Stagnant'])],
    ['Last Call', new Set(['Active', 'Rejected', 'Withdrawn', 'Stagnant'])],
    ['Active', new Set(['Replaced'])],
    ['Deferred', new Set(['Draft'])],
    ['Stagnant', new Set(['Draft'])],
    ['Withdrawn', new Set()],
    ['Rejected', new Set()],
    ['Replaced', new Set()],
  ]),
};

const REQUIRED_FIELDS = [
  'hip',
  'title',
  'author',
  'requested-by',
  'discussions-to',
  'type',
  'needs-hiero-approval',
  'needs-hedera-review',
  'status',
  'created',
  'updated',
];

const OPTIONAL_EMPTY_FIELDS = new Set([
  'working-group',
  'last-call-date-time',
  'hedera-acceptance-decision',
  'hedera-reviewed-on',
  'requires',
  'replaces',
  'superseded-by',
  'release',
]);

const COLORS = {
  reset: '\u001b[0m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
  bold: '\u001b[1m',
};

function issue(code, field, line, message, suggestion) {
  return { code, field, line, message, suggestion };
}

function stripInlineYamlComment(rawValue) {
  const firstValueIndex = rawValue.search(/\S/);
  const quote = firstValueIndex >= 0 && ['"', "'"].includes(rawValue[firstValueIndex])
    ? rawValue[firstValueIndex]
    : null;
  let inQuotes = Boolean(quote);
  let escaped = false;

  for (let index = 0; index < rawValue.length; index += 1) {
    const character = rawValue[index];
    if (quote === '"' && inQuotes && character === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (quote && inQuotes && index > firstValueIndex && character === quote && !escaped) {
      if (quote === "'" && rawValue[index + 1] === "'") {
        index += 1;
        continue;
      }
      inQuotes = false;
    } else if (character === '#' && !inQuotes
      && (index === 0 || /\s/.test(rawValue[index - 1]))) {
      return rawValue.slice(0, index).trim();
    }
    escaped = false;
  }
  return rawValue.trim();
}

function parseScalarValue(rawValue) {
  const value = stripInlineYamlComment(rawValue);
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function parseFrontMatter(source) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const issues = [];
  const fields = Object.create(null);
  const locations = Object.create(null);

  if (lines[0] !== '---') {
    issues.push(issue(
      'frontmatter-opening-delimiter',
      'front matter',
      1,
      'The HIP must start with a YAML front-matter delimiter (`---`).',
      'Put `---` on the first line, followed by the HIP headers.',
    ));
    return { fields, locations, body: normalized, issues };
  }

  const closingIndex = lines.indexOf('---', 1);
  if (closingIndex === -1) {
    issues.push(issue(
      'frontmatter-closing-delimiter',
      'front matter',
      1,
      'The YAML front matter has no closing `---` delimiter.',
      'Add a line containing only `---` after the last header.',
    ));
    return { fields, locations, body: '', issues };
  }

  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index];
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      continue;
    }

    const separator = line.indexOf(':');
    if (separator <= 0) {
      issues.push(issue(
        'frontmatter-line-format',
        'front matter',
        index + 1,
        `Header line ${index + 1} is not in \`name: value\` form.`,
        'Use one scalar HIP header per line, for example `status: Draft`.',
      ));
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = parseScalarValue(line.slice(separator + 1));

    if (!/^[a-z][a-z0-9-]*$/.test(key)) {
      issues.push(issue(
        'frontmatter-key-format',
        key || 'front matter',
        index + 1,
        `\`${key || line.slice(0, separator)}\` is not a valid HIP header name.`,
        'Use lowercase header names with hyphens, as shown in HIP-1.',
      ));
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      issues.push(issue(
        'duplicate-header',
        key,
        index + 1,
        `The \`${key}\` header appears more than once.`,
        `Keep a single \`${key}: ...\` line in the front matter.`,
      ));
      continue;
    }

    fields[key] = value;
    locations[key] = index + 1;
  }

  return {
    fields,
    locations,
    body: lines.slice(closingIndex + 1).join('\n'),
    issues,
  };
}

function hasValue(fields, field) {
  return Object.prototype.hasOwnProperty.call(fields, field) && fields[field] !== '';
}

function isPlaceholder(value) {
  return /^<.*>$/.test(value.trim()) || /\bto be (?:assigned|filled)\b/i.test(value);
}

function hasConcreteValue(fields, field) {
  return hasValue(fields, field) && !isPlaceholder(fields[field]);
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseDateList(value) {
  if (!value) {
    return [];
  }
  return value.split(',').map((entry) => entry.trim());
}

function isUtcDateTime(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().replace('.000Z', 'Z') === value;
}

function normalizePath(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  const hipDirectory = normalized.lastIndexOf('/HIP/');
  return hipDirectory === -1 ? normalized : normalized.slice(hipDirectory + 1);
}

function flowFor(fields) {
  if (fields.type === 'Standards Track') {
    if (!STANDARD_CATEGORIES.includes(fields.category)) {
      return null;
    }
    return fields.category === 'Application' ? 'active' : 'standard';
  }
  if (fields.type === 'Informational' || fields.type === 'Process') {
    return 'active';
  }
  return null;
}

function flowLabel(fields) {
  if (fields.type === 'Standards Track' && fields.category === 'Application') {
    return 'Standards Track / Application';
  }
  return fields.type || 'this HIP';
}

function acceptedIsLegacy(fields) {
  return fields.status === 'Accepted'
    && isCalendarDate(fields.created)
    && fields.created < '2025-01-01';
}

function normalizedStatus(fields) {
  return acceptedIsLegacy(fields) ? 'Approved' : fields.status;
}

function validateDateField(result, fields, locations, field, multiple) {
  if (!hasConcreteValue(fields, field)) {
    return;
  }
  const dates = multiple ? parseDateList(fields[field]) : [fields[field]];
  if (dates.some((date) => !isCalendarDate(date))) {
    result.push(issue(
      'date-format',
      field,
      locations[field],
      `\`${field}\` must contain ${multiple ? 'comma-separated dates' : 'a date'} in YYYY-MM-DD format.`,
      multiple
        ? `Use a value such as \`${field}: 2026-08-01, 2026-09-01\`.`
        : `Use a value such as \`${field}: 2026-09-01\`.`,
    ));
  }
}

function validateDocument(source, options = {}) {
  const filePath = options.path || 'HIP/hip-0000-proposal.md';
  const parsed = parseFrontMatter(source);
  const { fields, locations } = parsed;
  const result = [...parsed.issues];

  if (parsed.issues.some((entry) => entry.code.startsWith('frontmatter-') && entry.code.includes('delimiter'))) {
    return { ...parsed, issues: result };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!hasValue(fields, field)) {
      result.push(issue(
        'required-header',
        field,
        locations[field] || 1,
        `The required \`${field}\` header is missing or empty.`,
        `Add \`${field}: ...\` to the YAML front matter; HIP-1 lists the required preamble fields.`,
      ));
    } else if (isPlaceholder(fields[field])) {
      result.push(issue(
        'placeholder-header',
        field,
        locations[field],
        `The \`${field}\` header still contains a template placeholder.`,
        `Replace \`${fields[field]}\` with the actual ${field} value.`,
      ));
    }
  }

  for (const field of OPTIONAL_EMPTY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, field) && isPlaceholder(fields[field])) {
      result.push(issue(
        'placeholder-header',
        field,
        locations[field],
        `The optional \`${field}\` header still contains a template placeholder.`,
        `Remove the \`${field}\` line until it has a real value, or replace the placeholder.`,
      ));
    }
  }

  if (hasConcreteValue(fields, 'hip') && !/^(?:0000|[1-9]\d*)$/.test(fields.hip)) {
    result.push(issue(
      'hip-number',
      'hip',
      locations.hip,
      '`hip` must be a positive integer, or `0000` while awaiting assignment.',
      'Use `hip: 0000` for a new submission; an editor or automation will assign its final number.',
    ));
  }

  const normalizedFilePath = normalizePath(filePath);
  const filenameMatch = normalizedFilePath.match(/^HIP\/hip-(\d+)(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?\.md$/);
  if (!filenameMatch) {
    result.push(issue(
      'hip-filename',
      'hip',
      locations.hip || 1,
      `\`${normalizedFilePath}\` does not follow HIP-1's HIP filename format.`,
      'For a new proposal, use `HIP/hip-0000-my-feature.md`; assigned HIPs use `HIP/hip-<number>.md`.',
    ));
  } else if (hasConcreteValue(fields, 'hip')) {
    const fileNumber = filenameMatch[1];
    const headerNumber = fields.hip;
    const numbersMatch = headerNumber === '0000'
      ? fileNumber === '0000'
      : String(Number(fileNumber)) === headerNumber;
    if (!numbersMatch) {
      result.push(issue(
        'hip-filename-number',
        'hip',
        locations.hip,
        `HIP number \`${headerNumber}\` does not match filename \`${normalizedFilePath}\`.`,
        `Rename the file or change the header so both use HIP ${headerNumber}.`,
      ));
    }
  }

  if (hasConcreteValue(fields, 'type') && !TYPES.includes(fields.type)) {
    result.push(issue(
      'type-value',
      'type',
      locations.type,
      `\`${fields.type}\` is not a HIP-1 type.`,
      `Use exactly one of: ${TYPES.join(', ')}.`,
    ));
  }

  if (hasConcreteValue(fields, 'discussions-to')) {
    let discussionUrl;
    try {
      discussionUrl = new URL(fields['discussions-to']);
    } catch {
      discussionUrl = null;
    }
    if (!discussionUrl || !['http:', 'https:'].includes(discussionUrl.protocol)) {
      result.push(issue(
        'discussions-url',
        'discussions-to',
        locations['discussions-to'],
        '`discussions-to` must be the full HTTP(S) URL of the HIP\'s official discussion or pull request.',
        'Use a URL such as `https://github.com/hiero-ledger/hiero-improvement-proposals/pull/123`.',
      ));
    }
  }

  if (fields.type === 'Standards Track') {
    if (!hasValue(fields, 'category')) {
      result.push(issue(
        'category-required',
        'category',
        1,
        'Standards Track HIPs require a category so their HIP-1 workflow can be determined.',
        `Add one of: ${STANDARD_CATEGORIES.join(', ')}.`,
      ));
    } else if (!isPlaceholder(fields.category) && !STANDARD_CATEGORIES.includes(fields.category)) {
      result.push(issue(
        'category-value',
        'category',
        locations.category,
        `\`${fields.category}\` is not a Standards Track category from HIP-1.`,
        `Use exactly one of: ${STANDARD_CATEGORIES.join(', ')}.`,
      ));
    }
  } else if (fields.type === 'Informational' && hasValue(fields, 'category')) {
    result.push(issue(
      'category-not-applicable',
      'category',
      locations.category,
      'Informational HIPs do not use a Standards Track category.',
      'Remove the `category` header.',
    ));
  } else if (fields.type === 'Process' && hasValue(fields, 'category') && fields.category !== 'Process') {
    result.push(issue(
      'category-not-applicable',
      'category',
      locations.category,
      'A Process HIP may omit `category`; if present, its category must be `Process`.',
      'Remove the `category` header or use `category: Process`.',
    ));
  }

  const flow = flowFor(fields);
  if (hasConcreteValue(fields, 'status')) {
    if (fields.status === 'Accepted') {
      if (!acceptedIsLegacy(fields)) {
        result.push(issue(
          'legacy-accepted-status',
          'status',
          locations.status,
          '`Accepted` is a legacy status and cannot be assigned to a HIP on or after 2025-01-01.',
          'Use `Approved` for the Standards Track approval workflow, or `Active` for Informational, Process, and Application HIPs.',
        ));
      }
    } else if (!STATUSES.includes(fields.status)) {
      result.push(issue(
        'status-value',
        'status',
        locations.status,
        `\`${fields.status}\` is not a current HIP-1 status.`,
        `Use exactly one of: ${STATUSES.join(', ')}.`,
      ));
    }

    const status = normalizedStatus(fields);
    const allowedStatuses = flow === 'standard' ? STANDARD_STATUSES : flow === 'active' ? ACTIVE_STATUSES : null;
    if (allowedStatuses && !allowedStatuses.has(status)) {
      const expected = flow === 'standard'
        ? 'Approved and Final (not Active)'
        : 'Active (not Approved or Final)';
      result.push(issue(
        'status-for-flow',
        'status',
        locations.status,
        `Status \`${fields.status}\` is not valid for the ${flowLabel(fields)} workflow.`,
        `HIP-1 uses ${expected} for this workflow. Allowed statuses: ${[...allowedStatuses].join(', ')}.`,
      ));
    }
  }

  for (const field of ['needs-hiero-approval', 'needs-hedera-review']) {
    if (hasConcreteValue(fields, field) && !['Yes', 'No'].includes(fields[field])) {
      result.push(issue(
        'yes-no-value',
        field,
        locations[field],
        `\`${field}\` must be exactly \`Yes\` or \`No\`.`,
        `Use \`${field}: Yes\` or \`${field}: No\` with matching capitalization.`,
      ));
    }
  }

  if (flow) {
    const expectedApproval = flow === 'standard' ? 'Yes' : 'No';
    const workflowName = flow === 'standard'
      ? 'Standards Track Core, Service, Mirror, and Block Node'
      : 'Informational, Process, and Standards Track Application';
    for (const field of ['needs-hiero-approval', 'needs-hedera-review']) {
      if (['Yes', 'No'].includes(fields[field]) && fields[field] !== expectedApproval) {
        result.push(issue(
          'approval-for-flow',
          field,
          locations[field],
          `\`${field}: ${fields[field]}\` conflicts with the HIP-1 ${workflowName} workflow.`,
          `Use \`${field}: ${expectedApproval}\` for ${flowLabel(fields)} HIPs.`,
        ));
      }
    }
  }

  validateDateField(result, fields, locations, 'created', false);
  validateDateField(result, fields, locations, 'updated', true);
  validateDateField(result, fields, locations, 'hedera-reviewed-on', true);

  const updatedDates = parseDateList(fields.updated);
  if (updatedDates.length > 0 && updatedDates.every(isCalendarDate)) {
    for (let index = 1; index < updatedDates.length; index += 1) {
      if (updatedDates[index] <= updatedDates[index - 1]) {
        result.push(issue(
          'updated-date-order',
          'updated',
          locations.updated,
          '`updated` dates must be unique and listed from oldest to newest.',
          'Remove duplicate dates and put the most recent update last.',
        ));
        break;
      }
    }
    if (isCalendarDate(fields.created) && updatedDates[updatedDates.length - 1] < fields.created) {
      result.push(issue(
        'updated-before-created',
        'updated',
        locations.updated,
        'The latest `updated` date is earlier than the HIP `created` date.',
        'Correct the dates so creation occurs first and the latest update is last.',
      ));
    }
  }

  if (hasConcreteValue(fields, 'last-call-date-time') && !isUtcDateTime(fields['last-call-date-time'])) {
    result.push(issue(
      'last-call-date-time-format',
      'last-call-date-time',
      locations['last-call-date-time'],
      '`last-call-date-time` must be a valid UTC timestamp in YYYY-MM-DDTHH:MM:SSZ format.',
      'Use a value such as `last-call-date-time: 2026-09-15T07:00:00Z`.',
    ));
  }

  if (fields.status === 'Last Call' && !hasValue(fields, 'last-call-date-time')) {
    result.push(issue(
      'last-call-date-time-required',
      'last-call-date-time',
      1,
      'A Last Call HIP must state when its final review window ends.',
      'Ask a HIP editor to add `last-call-date-time: YYYY-MM-DDTHH:MM:SSZ`.',
    ));
  }

  if (normalizedStatus(fields) === 'Final' && !hasValue(fields, 'release')) {
    result.push(issue(
      'release-required',
      'release',
      1,
      'HIP-1 requires a Final Standards Track HIP to identify its implementation release.',
      'Add the merged implementation version, for example `release: v0.70.0`.',
    ));
  }

  if (fields.status === 'Replaced' && !hasValue(fields, 'superseded-by')) {
    result.push(issue(
      'superseded-by-required',
      'superseded-by',
      1,
      'A Replaced HIP must identify the newer HIP that replaced it.',
      'Add `superseded-by: <HIP number>`.',
    ));
  }

  for (const field of ['requires', 'replaces', 'superseded-by']) {
    if (hasConcreteValue(fields, field) && !/^\d+(?:\s*,\s*\d+)*$/.test(fields[field])) {
      result.push(issue(
        'hip-reference-list',
        field,
        locations[field],
        `\`${field}\` must be a comma-separated list of HIP numbers.`,
        `Use a value such as \`${field}: 123, 456\`.`,
      ));
    }
  }

  const decisionPresent = hasConcreteValue(fields, 'hedera-acceptance-decision');
  const reviewedPresent = hasConcreteValue(fields, 'hedera-reviewed-on');
  if (decisionPresent && !['Accepted', 'Not Accepted'].includes(fields['hedera-acceptance-decision'])) {
    result.push(issue(
      'hedera-decision-value',
      'hedera-acceptance-decision',
      locations['hedera-acceptance-decision'],
      '`hedera-acceptance-decision` must be exactly `Accepted` or `Not Accepted`.',
      'Use the decision recorded by Hedera, with matching capitalization.',
    ));
  }
  if (decisionPresent !== reviewedPresent) {
    const missing = decisionPresent ? 'hedera-reviewed-on' : 'hedera-acceptance-decision';
    result.push(issue(
      'hedera-review-pair',
      missing,
      1,
      '`hedera-acceptance-decision` and `hedera-reviewed-on` must be recorded together.',
      `Add the \`${missing}\` header, or remove the incomplete Hedera review metadata.`,
    ));
  }
  if ((decisionPresent || reviewedPresent) && fields['needs-hedera-review'] !== 'Yes') {
    result.push(issue(
      'hedera-review-flag',
      'needs-hedera-review',
      locations['needs-hedera-review'] || 1,
      'Recorded Hedera review metadata conflicts with `needs-hedera-review: No`.',
      'Use `needs-hedera-review: Yes` when a Hedera review decision is recorded.',
    ));
  }
  if ((decisionPresent || reviewedPresent) && flow === 'standard'
    && !['Approved', 'Final', 'Replaced'].includes(normalizedStatus(fields))) {
    result.push(issue(
      'hedera-review-before-approved',
      'hedera-acceptance-decision',
      locations['hedera-acceptance-decision'] || locations['hedera-reviewed-on'],
      'HIP-1 permits Hedera review of approval-track HIPs only after Hiero approval.',
      'Remove the decision metadata until the HIP is Approved, or correct the HIP status.',
    ));
  }

  return { ...parsed, issues: result };
}

function issueFingerprint(entry) {
  return [entry.code, entry.field, entry.message, entry.suggestion].join('\u0000');
}

function latestValidDate(value) {
  const dates = parseDateList(value);
  return dates.length > 0 && dates.every(isCalendarDate) ? dates[dates.length - 1] : null;
}

function validateTransition(base, current) {
  const result = [];
  const oldStatus = normalizedStatus(base.fields);
  const newStatus = normalizedStatus(current.fields);

  if (!oldStatus || !newStatus || oldStatus === newStatus) {
    return result;
  }

  const flow = flowFor(current.fields);
  const allowed = flow && TRANSITIONS[flow].get(oldStatus);
  if (!allowed || !allowed.has(newStatus)) {
    const allowedText = allowed && allowed.size > 0
      ? [...allowed].join(', ')
      : 'no further status transitions';
    result.push(issue(
      'status-transition',
      'status',
      current.locations.status || 1,
      `HIP-1 does not allow the ${flowLabel(current.fields)} status transition \`${base.fields.status}\` → \`${current.fields.status}\`.`,
      `From \`${base.fields.status}\`, the next status may be: ${allowedText}. Keep the status unchanged for content-only edits.`,
    ));
  }
  return result;
}

function validateChange(source, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const current = validateDocument(source, options);

  if (options.baseSource === null || options.baseSource === undefined) {
    const errors = [...current.issues];
    if (hasConcreteValue(current.fields, 'status') && current.fields.status !== 'Draft') {
      errors.push(issue(
        'new-hip-status',
        'status',
        current.locations.status || 1,
        `A new HIP enters the repository as \`Draft\`, not \`${current.fields.status}\`.`,
        'Use `status: Draft`; later status changes follow the type-specific HIP-1 workflow.',
      ));
    }
    return { ...current, errors, warnings: [], isNew: true };
  }

  const base = validateDocument(options.baseSource, options);
  const baselineFingerprints = new Set(base.issues.map(issueFingerprint));
  const errors = current.issues.filter((entry) => !baselineFingerprints.has(issueFingerprint(entry)));
  const warnings = current.issues.filter((entry) => baselineFingerprints.has(issueFingerprint(entry)));

  errors.push(...validateTransition(base, current));

  if (hasValue(base.fields, 'hip') && hasValue(current.fields, 'hip')
    && base.fields.hip !== current.fields.hip) {
    errors.push(issue(
      'hip-number-changed',
      'hip',
      current.locations.hip || 1,
      `An assigned HIP number is immutable (changed from ${base.fields.hip} to ${current.fields.hip}).`,
      `Restore \`hip: ${base.fields.hip}\` and keep the filename aligned with it.`,
    ));
  }

  if (hasValue(base.fields, 'created') && hasValue(current.fields, 'created')
    && base.fields.created !== current.fields.created) {
    errors.push(issue(
      'created-date-changed',
      'created',
      current.locations.created || 1,
      `The HIP creation date is immutable (changed from ${base.fields.created} to ${current.fields.created}).`,
      `Restore \`created: ${base.fields.created}\`; record this edit in \`updated\` instead.`,
    ));
  }

  if (source !== options.baseSource) {
    const baseUpdated = latestValidDate(base.fields.updated);
    const currentUpdated = latestValidDate(current.fields.updated);
    if (baseUpdated && currentUpdated && currentUpdated < baseUpdated) {
      errors.push(issue(
        'updated-date-regressed',
        'updated',
        current.locations.updated || 1,
        `The latest \`updated\` date moved backwards from ${baseUpdated} to ${currentUpdated}.`,
        `Keep the existing dates and append the date of this change (${today}).`,
      ));
    } else if (!currentUpdated || (currentUpdated === baseUpdated && currentUpdated !== today)) {
      errors.push(issue(
        'updated-date-not-recorded',
        'updated',
        current.locations.updated || 1,
        'The HIP changed without recording a new `updated` date.',
        `Append the date of this change in YYYY-MM-DD form (for example \`${today}\`).`,
      ));
    }
  }

  return { ...current, base, errors, warnings, isNew: false };
}

function readBaseRevision(baseRef, filePath) {
  const normalizedFilePath = normalizePath(filePath);
  const commitExists = spawnSync('git', ['cat-file', '-e', `${baseRef}^{commit}`], {
    encoding: 'utf8',
  });
  if (commitExists.status !== 0) {
    throw new Error(`Cannot read base revision \`${baseRef}\`. Make sure the base commit was fetched.`);
  }

  let basePath = normalizedFilePath;
  let blobExists = spawnSync('git', ['cat-file', '-e', `${baseRef}:${basePath}`], {
    encoding: 'utf8',
  });
  if (blobExists.status !== 0) {
    const changes = spawnSync(
      'git',
      ['diff', '--name-status', '-z', '--find-renames', baseRef, 'HEAD', '--', ':(glob)HIP/*.md'],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
    );
    if (changes.status !== 0) {
      throw new Error(`Cannot compare changed HIPs with base revision \`${baseRef}\`.`);
    }
    const entries = changes.stdout.split('\0');
    for (let index = 0; index < entries.length - 1;) {
      const status = entries[index];
      index += 1;
      if (status.startsWith('R')) {
        const oldPath = entries[index];
        const newPath = entries[index + 1];
        index += 2;
        if (newPath === normalizedFilePath) {
          basePath = oldPath;
          break;
        }
      } else {
        index += 1;
      }
    }
    blobExists = spawnSync('git', ['cat-file', '-e', `${baseRef}:${basePath}`], {
      encoding: 'utf8',
    });
    if (blobExists.status !== 0) {
      return null;
    }
  }

  const result = spawnSync('git', ['show', `${baseRef}:${basePath}`], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Cannot read \`${basePath}\` from base revision \`${baseRef}\`.`);
  }
  return result.stdout;
}

function escapeWorkflowProperty(value) {
  return String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}

function escapeWorkflowData(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeSummaryCell(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/\\/g, '&#92;')
    .replace(/\|/g, '&#124;')
    .replace(/`/g, '&#96;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, ' ');
}

function formatIssue(entry, index, useColor) {
  const color = useColor ? COLORS.yellow : '';
  const bold = useColor ? COLORS.bold : '';
  const reset = useColor ? COLORS.reset : '';
  const location = entry.line ? ` (line ${entry.line})` : '';
  return `${color}${index + 1}. ${bold}${entry.field}${reset}${color}${location}: ${entry.message}${reset}\n`
    + `   ${useColor ? COLORS.cyan : ''}Fix: ${entry.suggestion}${reset}`;
}

function printResult(filePath, validation, options = {}) {
  const useColor = options.useColor;
  const githubActions = options.githubActions;
  const displayPath = normalizePath(filePath);

  if (validation.errors.length === 0) {
    const success = validation.warnings.length > 0
      ? 'introduces no new HIP-1 issues'
      : 'follows HIP-1';
    console.log(`${useColor ? COLORS.green + COLORS.bold : ''}✓ ${displayPath} ${success}${useColor ? COLORS.reset : ''}`);
  } else {
    console.error(`${useColor ? COLORS.red + COLORS.bold : ''}✗ ${displayPath} has ${validation.errors.length} HIP-1 validation error${validation.errors.length === 1 ? '' : 's'}:${useColor ? COLORS.reset : ''}`);
    validation.errors.forEach((entry, index) => console.error(formatIssue(entry, index, useColor)));
  }

  if (validation.warnings.length > 0) {
    console.warn(`${useColor ? COLORS.yellow : ''}⚠ ${validation.warnings.length} pre-existing issue${validation.warnings.length === 1 ? '' : 's'} also found; they do not fail this PR because it did not introduce them.${useColor ? COLORS.reset : ''}`);
    validation.warnings.forEach((entry, index) => console.warn(formatIssue(entry, index, useColor)));
  }

  if (githubActions) {
    for (const entry of validation.errors) {
      const title = escapeWorkflowProperty(`HIP-1: ${entry.code}`);
      const annotationPath = escapeWorkflowProperty(displayPath);
      const line = Number.isInteger(entry.line) && entry.line > 0 ? `,line=${entry.line}` : '';
      const message = escapeWorkflowData(`${entry.message} Fix: ${entry.suggestion}`);
      console.log(`::error file=${annotationPath}${line},title=${title}::${message}`);
    }
    for (const entry of validation.warnings) {
      const title = escapeWorkflowProperty(`Pre-existing HIP-1 issue: ${entry.code}`);
      const annotationPath = escapeWorkflowProperty(displayPath);
      const line = Number.isInteger(entry.line) && entry.line > 0 ? `,line=${entry.line}` : '';
      const message = escapeWorkflowData(`${entry.message} Fix: ${entry.suggestion}`);
      console.log(`::warning file=${annotationPath}${line},title=${title}::${message}`);
    }
  }
}

function appendStepSummary(results) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }
  const errorCount = results.reduce((sum, entry) => sum + entry.validation.errors.length, 0);
  const warningCount = results.reduce((sum, entry) => sum + entry.validation.warnings.length, 0);
  const lines = [
    '## HIP-1 validation',
    '',
    `Validated ${results.length} changed HIP${results.length === 1 ? '' : 's'}: ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} pre-existing warning${warningCount === 1 ? '' : 's'}.`,
    '',
    '| HIP | Result |',
    '| --- | --- |',
  ];
  for (const { filePath, validation } of results) {
    const status = validation.errors.length === 0
      ? `✅ Pass${validation.warnings.length ? ` (${validation.warnings.length} pre-existing warning${validation.warnings.length === 1 ? '' : 's'})` : ''}`
      : `❌ ${validation.errors.length} error${validation.errors.length === 1 ? '' : 's'}`;
    lines.push(`| <code>${escapeSummaryCell(normalizePath(filePath))}</code> | ${status} |`);
  }
  lines.push('');
  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`);
}

function usage() {
  return [
    'Usage: node scripts/validateHIP.js [--base-ref <git-ref>] <HIP file> [HIP file ...]',
    '',
    'Without --base-ref, each file is validated as a new HIP and must be Draft.',
    'With --base-ref, existing HIPs are also checked for valid status transitions',
    'and an updated date; pre-existing legacy issues are reported as warnings.',
  ].join('\n');
}

function parseArguments(argv) {
  const files = [];
  let baseRef = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      return { help: true, baseRef, files };
    }
    if (argument === '--base-ref') {
      baseRef = argv[index + 1];
      if (!baseRef) {
        throw new Error('`--base-ref` requires a git revision.');
      }
      index += 1;
      continue;
    }
    if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`);
    }
    files.push(argument);
  }
  return { help: false, baseRef, files };
}

function runCli(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArguments(argv);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(usage());
    return 2;
  }

  if (args.help) {
    console.log(usage());
    return 0;
  }
  if (args.files.length === 0) {
    console.error('Error: no HIP files were provided.');
    console.error(usage());
    return 2;
  }

  const githubActions = process.env.GITHUB_ACTIONS === 'true';
  const useColor = Boolean(process.stderr.isTTY && !process.env.NO_COLOR && !githubActions);
  const results = [];
  let failed = false;

  for (const filePath of args.files) {
    try {
      const source = fs.readFileSync(filePath, 'utf8');
      const baseSource = args.baseRef ? readBaseRevision(args.baseRef, filePath) : null;
      const validation = validateChange(source, { path: filePath, baseSource });
      printResult(filePath, validation, { useColor, githubActions });
      results.push({ filePath, validation });
      failed ||= validation.errors.length > 0;
    } catch (error) {
      failed = true;
      const validation = {
        errors: [issue(
          'validator-input',
          'file',
          1,
          error.message,
          'Confirm the file exists and the pull request base commit is available.',
        )],
        warnings: [],
      };
      printResult(filePath, validation, { useColor, githubActions });
      results.push({ filePath, validation });
    }
  }

  appendStepSummary(results);
  return failed ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = runCli();
}

module.exports = {
  ACTIVE_STATUSES,
  STANDARD_STATUSES,
  TRANSITIONS,
  escapeSummaryCell,
  flowFor,
  isCalendarDate,
  isUtcDateTime,
  parseArguments,
  parseFrontMatter,
  runCli,
  validateChange,
  validateDocument,
  validateTransition,
};
