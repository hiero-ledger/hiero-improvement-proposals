import test from 'node:test';
import assert from 'node:assert/strict';
import { githubTokens } from './github-tokens.js';

test('prefers the dedicated data token and falls back to the Actions token', () => {
  assert.deepEqual(githubTokens({ GITHUB_DATA_TOKEN: 'pat', GITHUB_TOKEN: 'ghs' }), ['pat', 'ghs']);
  assert.deepEqual(githubTokens({ GITHUB_TOKEN: 'ghs' }), ['ghs']);
  assert.deepEqual(githubTokens({ GITHUB_DATA_TOKEN: 'pat' }), ['pat']);
});

test('ignores blank values and de-duplicates identical tokens', () => {
  assert.deepEqual(githubTokens({ GITHUB_DATA_TOKEN: '  ', GITHUB_TOKEN: ' ghs ' }), ['ghs']);
  assert.deepEqual(githubTokens({ GITHUB_DATA_TOKEN: 'same', GITHUB_TOKEN: 'same' }), ['same']);
  assert.deepEqual(githubTokens({}), []);
  assert.deepEqual(githubTokens({ GITHUB_TOKEN: 42 }), []);
});
