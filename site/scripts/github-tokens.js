/**
 * GitHub tokens the data build may use, most generous rate-limit pool first.
 *
 * GITHUB_DATA_TOKEN is a personal access token with its own 5,000 requests per
 * hour. GITHUB_TOKEN is the Actions installation token, whose 1,000 requests
 * per hour are shared by every workflow run in the repository; a data build
 * makes a GraphQL request per HIP, so a few deploys in one hour exhaust it.
 *
 * Returns a de-duplicated list; an empty list means "no token available".
 */
export function githubTokens(env = process.env) {
  const candidates = [env.GITHUB_DATA_TOKEN, env.GITHUB_TOKEN]
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return [...new Set(candidates)];
}
