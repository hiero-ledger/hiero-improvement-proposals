import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchOpenDraftPullRequests,
  isDraftHipPullRequest,
} from './github-drafts.js';

function pr(number, path, changeType = 'ADDED') {
  return {
    number,
    files: { edges: [{ node: { path, changeType } }] },
  };
}

test('isDraftHipPullRequest only accepts newly added HIP Markdown files', () => {
  assert.equal(isDraftHipPullRequest(pr(1500, 'HIP/hip-0000-periodic-fee.md')), true);
  assert.equal(isDraftHipPullRequest(pr(1501, 'HIP/hip-1501.md', 'MODIFIED')), false);
  assert.equal(isDraftHipPullRequest(pr(1502, 'README.md')), false);
  assert.equal(isDraftHipPullRequest(null), false);
});

test('fetchOpenDraftPullRequests follows every GraphQL page', async () => {
  const requests = [];
  const pages = [
    {
      data: {
        repository: {
          pullRequests: {
            nodes: [pr(1500, 'HIP/hip-0000-periodic-fee.md'), pr(1499, 'README.md')],
            pageInfo: { hasNextPage: true, endCursor: 'page-2' },
          },
        },
      },
    },
    {
      data: {
        repository: {
          pullRequests: {
            nodes: [pr(1400, 'HIP/hip-1400.md')],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
  ];
  const fetchImpl = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => pages.shift() };
  };

  const drafts = await fetchOpenDraftPullRequests({ token: 'token', fetchImpl });

  assert.deepEqual(drafts.map(({ number }) => number), [1500, 1400]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].variables.cursor, null);
  assert.equal(requests[1].variables.cursor, 'page-2');
  assert.match(requests[0].query, /after: \$cursor/);
});

test('fetchOpenDraftPullRequests rejects broken pagination cursors', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        repository: {
          pullRequests: {
            nodes: [],
            pageInfo: { hasNextPage: true, endCursor: null },
          },
        },
      },
    }),
  });

  await assert.rejects(
    fetchOpenDraftPullRequests({ token: 'token', fetchImpl }),
    /invalid cursor/,
  );
});
