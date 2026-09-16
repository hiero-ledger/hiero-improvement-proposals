const DEFAULT_OWNER = 'hiero-ledger';
const DEFAULT_REPOSITORY = 'hiero-improvement-proposals';

const OPEN_PULL_REQUESTS_QUERY = `
  query OpenPullRequests($owner: String!, $repository: String!, $cursor: String) {
    repository(owner: $owner, name: $repository) {
      pullRequests(
        first: 100
        after: $cursor
        states: [OPEN]
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          title
          number
          url
          headRefOid
          files(first: 100) {
            edges {
              node {
                path
                changeType
                additions
                deletions
              }
            }
          }
          author {
            login
          }
        }
      }
    }
  }
`;

export function isDraftHipPullRequest(pr) {
  return (pr?.files?.edges || []).some(({ node }) =>
    node?.changeType === 'ADDED' &&
    /^HIP\/hip-[A-Za-z0-9-]+\.md$/.test(node.path)
  );
}

/**
 * Fetch every open pull request and retain those that add a HIP Markdown file.
 * GitHub caps a GraphQL connection at 100 nodes, so following pageInfo is
 * essential: older draft HIPs must not silently disappear from the site.
 */
export async function fetchOpenDraftPullRequests({
  token,
  fetchImpl = fetch,
  owner = DEFAULT_OWNER,
  repository = DEFAULT_REPOSITORY,
} = {}) {
  if (!token) throw new Error('A GitHub token is required to query open draft HIPs');

  const drafts = [];
  const seenCursors = new Set();
  let cursor = null;

  do {
    const response = await fetchImpl('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'hips-build',
      },
      body: JSON.stringify({
        query: OPEN_PULL_REQUESTS_QUERY,
        variables: { owner, repository, cursor },
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub GraphQL request failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(payload.errors[0]?.message || 'GitHub GraphQL request failed');
    }

    const connection = payload.data?.repository?.pullRequests;
    if (!connection) throw new Error('GitHub GraphQL response did not include pull requests');

    drafts.push(...(connection.nodes || []).filter(isDraftHipPullRequest));

    if (!connection.pageInfo?.hasNextPage) break;

    const nextCursor = connection.pageInfo.endCursor;
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error('GitHub GraphQL pagination returned an invalid cursor');
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (true);

  return drafts;
}
