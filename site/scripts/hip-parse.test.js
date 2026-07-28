// Property-based tests (fuzzing) for the HIP parsing helpers.
//
// Draft HIPs are pulled from open PRs, i.e. untrusted input, so these parsers
// must never throw on arbitrary/malformed content — a crash here would break the
// entire site build. fast-check generates many random inputs per property to try
// to violate that invariant.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  parseMarkdown,
  extractHip,
  parsePositiveInteger,
  draftHipNumber,
  replaceHipImages,
} from './hip-parse.js';

const RUNS = { numRuns: 1000 };

test('parseMarkdown never throws on arbitrary input', () => {
  fc.assert(
    fc.property(fc.string(), (raw) => {
      parseMarkdown(raw);
    }),
    RUNS,
  );
});

test('parseMarkdown -> extractHip handles frontmatter-shaped input', () => {
  const frontmatterish = fc
    .tuple(fc.string(), fc.string())
    .map(([fm, body]) => `---\n${fm}\n---\n${body}`);
  fc.assert(
    fc.property(frontmatterish, (raw) => {
      const parsed = parseMarkdown(raw);
      if (parsed) extractHip(parsed.data || {}, parsed.content || '');
    }),
    RUNS,
  );
});

test('parsePositiveInteger is total and returns null or a positive integer', () => {
  fc.assert(
    fc.property(fc.anything(), (v) => {
      const out = parsePositiveInteger(v);
      assert.ok(out === null || (Number.isInteger(out) && out > 0));
    }),
    RUNS,
  );
});

test('draftHipNumber never throws for arbitrary frontmatter/path', () => {
  fc.assert(
    fc.property(fc.anything(), fc.integer(), fc.string(), (hip, pr, filePath) => {
      draftHipNumber(hip, pr, filePath);
    }),
    RUNS,
  );
});

test('replaceHipImages never throws on untrusted image paths', () => {
  // Draft-HIP bodies come straight from PR branches and routinely contain
  // ../assets/... image references with arbitrary (possibly malformed) paths.
  const imageRef = fc.string().map((s) => `![diagram](../assets/${s})`);
  const content = fc.oneof(
    fc.string(),
    imageRef,
    fc.array(imageRef).map((a) => a.join('\n')),
  );
  fc.assert(
    fc.property(content, (body) => {
      replaceHipImages(body, {
        rawBase: 'https://raw.githubusercontent.com/o/r/abc123',
        availableAssets: new Set(),
      });
    }),
    RUNS,
  );
});
