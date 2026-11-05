# HIPs GitHub OAuth broker

A tiny, dependency-free Cloudflare Worker that lets the HIPs site's in-page
editor submit pull requests with one click.

The site is static (GitHub Pages). GitHub's OAuth token endpoint
(`github.com/login/oauth/access_token`) requires the OAuth App's client secret
and sends no CORS headers, so the browser cannot obtain a token by itself. This
Worker holds the secret, completes the OAuth web flow in a popup, and hands the
resulting token back to the page that opened the popup. Nothing is stored
server-side.

Until a broker is deployed and `HIPS_GITHUB_AUTH_START_URL` is set, the editor
falls back to GitHub's web editor (copy markdown, paste, "Propose changes").

## How a sign-in works

```
HIPs page (site/src/main.js)          Broker (this Worker)                 GitHub
──────────────────────────────         ─────────────────────                ──────
click "Connect GitHub & Submit PR"
  window.open(START?state=s&origin=o) ─► GET /start
                                        validate s (shape) and o (allow-list)
                                        mint nonce n, PKCE verifier pv
                                        T = sign{s, o, n, exp}   (GitHub state)
                                        C = sign{n, pv}          (HttpOnly cookie)
                                        302 ───────────────────────────────► /login/oauth/authorize?state=T&code_challenge=…
                                                                              user signs in, approves public_repo
                                        GET /callback?code&state=T ◄───────── 302
                                        verify T, re-check o, verify cookie C (n matches)
                                        POST /login/oauth/access_token (secret, code, pv) ─►
                                        ◄──────────────────────────── { access_token, scope }
                                        check scope ⊇ public_repo
                                        200 HTML page (CSP nonce, no-store)
  ◄── window.opener.postMessage({ type:'hips:github-token', state:s, token }, o)
  page closes the popup, calls the GitHub API with the token
```

On any failure after the state blob verifies, the page posts
`{ type: 'hips:github-token', state: s, error, error_description }` instead, so
the site shows the reason immediately rather than waiting for its timeout.

The token exists only in GitHub's response body and in the one `no-store` HTML
response. It is never placed in a URL, header, cookie, or log line.

## Security design in one paragraph

Every `/start` mints a per-flow nonce. GitHub's `state` parameter is an
HMAC-signed blob carrying the client's own state, the allow-listed site origin,
the nonce and an expiry, so the callback always knows exactly which origin may
receive the result. A per-flow `__Host-` cookie (HttpOnly, Secure, SameSite=Lax)
carries the same nonce plus the PKCE verifier, binding the callback to the
browser that started the flow; a callback URL leaked from logs or history is
useless without it. The origin allow-list is enforced at `/start`, signed into
the state, and re-checked at `/callback`. The callback page has a nonce-only
Content-Security-Policy, embeds data only in a non-executable JSON block, scrubs
the code from its URL with `history.replaceState`, and never calls
`window.close()` after posting (the site closes the popup). Only `GET` reaches
`/start` and `/callback`, so a `HEAD` from a link unfurler or prefetcher never
mints a flow or spends a code, and without the flow cookie a crawled callback
URL cannot spend one either. Requests for any hostname other than
`BROKER_ORIGIN` get 404, which keeps `redirect_uri` equal to the registered
callback URL.

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | `wrangler.jsonc` `vars` | Client ID of the OAuth App whose callback URL is `BROKER_ORIGIN/callback`. |
| `GITHUB_CLIENT_SECRET` | `wrangler secret put` | OAuth App client secret. Used only in the server-to-server token exchange. |
| `STATE_SIGNING_KEY` | `wrangler secret put` | HMAC-SHA256 key for the state blob and cookie, at least 32 characters (`openssl rand -base64 48`). Rotating it only invalidates sign-ins that are in flight. |
| `ALLOWED_ORIGINS` | `wrangler.jsonc` `vars` | Comma-separated site origins that may receive tokens, e.g. `https://hips.hedera.com`. Exact `https` origins only (scheme, host, port; plain `http` only for loopback hosts); entries with a path are rejected at startup. Never list an origin other projects can publish to, such as `https://hiero-ledger.github.io` (shared by every GitHub Pages site in the organization), `*.pages.dev` or `*.netlify.app`. |
| `BROKER_ORIGIN` | `wrangler.jsonc` `vars` | The single public origin this Worker answers on, e.g. `https://hips-auth.hedera.com`. Plain `http` is accepted only for loopback hosts. |
| `BUILD_SHA` | `wrangler deploy --var` | Optional; `/healthz` returns `ok <BUILD_SHA>` so you can see which commit is live. |

If any variable is missing or malformed, every route answers `503
misconfigured: <names>` and no user is ever redirected to GitHub.

Routes: `GET /start`, `GET /callback`, `GET|HEAD /healthz`. Everything else is
404; other methods are 405.

## Rollout checklist

Do these in order. Steps 1 to 4 are safe to do at any time because nothing on
the site changes until step 6.

1. **Register the OAuth App** (preferably under the `hiero-ledger`
   organization: *Settings → Developer settings → OAuth Apps → New OAuth App*).
   - Homepage URL: `https://hips.hedera.com`
   - Authorization callback URL: exactly `<BROKER_ORIGIN>/callback`, with
     wildcard matching **off**.
   - Make sure *Expire user authorization tokens* is **unchecked**; the site
     has no refresh flow.
   - Generate a client secret. If the app is org-owned, make sure the org's
     third-party OAuth App access policy allows it.
2. **Deploy the Worker** from this directory (needs Node 22+ for Wrangler):

   ```bash
   cd site/auth-broker
   npx --yes wrangler@4 login
   # edit wrangler.jsonc: GITHUB_CLIENT_ID, ALLOWED_ORIGINS, BROKER_ORIGIN
   npx --yes wrangler@4 secret put GITHUB_CLIENT_SECRET
   openssl rand -base64 48 | npx --yes wrangler@4 secret put STATE_SIGNING_KEY
   npx --yes wrangler@4 deploy --var BUILD_SHA:$(git rev-parse --short HEAD)
   ```

   The first deploy on the free `*.workers.dev` origin is fine; put that origin
   in `BROKER_ORIGIN` and in the OAuth App callback URL. To move to a custom
   domain later (for example `hips-auth.hedera.com`), add a `custom_domain`
   route in `wrangler.jsonc`, set `workers_dev` to `false`, update
   `BROKER_ORIGIN` and the OAuth App callback URL, and redeploy. If the zone
   sits behind Cloudflare's WAF, exempt this hostname from managed challenges,
   Bot Fight Mode, Rocket Loader and Auto Minify; a challenge page carries
   `Cross-Origin-Opener-Policy: same-origin`, which severs `window.opener`,
   and any injected script would break the popup handshake.
3. **Smoke test** the deployment:

   ```bash
   B=https://<broker host>
   curl -s $B/healthz                                   # ok <sha>
   curl -s -o /dev/null -w '%{http_code}\n' "$B/start?state=0123456789abcdef&origin=https://evil.example"   # 403
   curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/callback"                                           # 405
   curl -s -o /dev/null -D - "$B/start?state=0123456789abcdef&origin=https://hips.hedera.com" | grep -i -E 'location|set-cookie'
   curl -s -o /dev/null -D - "$B/healthz" | grep -i cf-mitigated || echo "no Cloudflare challenge in the way"
   ```

   The `Location` header must point at `github.com/login/oauth/authorize` and
   the cookie must be a `__Host-hips_oauth_…` cookie.
4. **Test the real flow against the live site without changing it.** Open any
   HIP on hips.hedera.com, run
   `window.HIPS_GITHUB_AUTH_START_URL = 'https://<broker host>/start'` in the
   devtools console, click *Edit → Connect GitHub & Submit PR*, approve on
   GitHub, and confirm a pull request opens from your fork. Repeat once in
   Safari, whose cookie handling is the strictest.
5. **Before exposing tokens to the page, close the site's XSS gap.** The site
   renders draft HIPs from open pull requests by anyone with a GitHub account,
   and the markdown is rendered without sanitisation. Today that is a
   defacement risk; once visitors hold `public_repo` tokens in page memory it
   becomes a token-theft risk. Sanitise rendered HTML (DOMPurify is already in
   the site's dependency tree via Mermaid) before step 6.
6. **Switch the site over.** Set the repository variable and redeploy the site:

   ```bash
   gh variable set HIPS_GITHUB_AUTH_START_URL --body 'https://<broker host>/start' -R hiero-ledger/hiero-improvement-proposals
   gh workflow run deploy-site.yml -R hiero-ledger/hiero-improvement-proposals
   ```

   The deploy workflow bakes the value into the bundle as
   `VITE_GITHUB_AUTH_START_URL`; the editor's submit panel switches from the
   GitHub web-editor fallback to *Connect GitHub & Submit PR*. To roll back,
   delete the variable and redeploy.

Optional hardening on the Cloudflare side: a rate-limiting rule such as 30
requests per minute per IP on `/start` and 10 on `/callback`.

## Local development

```bash
cd site/auth-broker
cp .dev.vars.example .dev.vars      # fill in a *separate* dev OAuth App (callback http://127.0.0.1:8787/callback)
npx --yes wrangler@4 dev            # serves http://127.0.0.1:8787

# in another shell, point the site at it
cd site
VITE_GITHUB_AUTH_START_URL=http://127.0.0.1:8787/start npm run dev
```

`ALLOWED_ORIGINS` in `.dev.vars` must list the Vite dev server origin.

## Operations

- **Logs.** Each `/start` and `/callback` writes one JSON line:
  `{ route, outcome, error, cookie, n }`. Tokens, codes, client state, cookies,
  query strings and GitHub response bodies are never logged. The `n` field is
  the per-flow nonce, useful to correlate a `/start` with its `/callback`.
- **Rotating the client secret.** Generate a second secret on the OAuth App,
  `wrangler secret put GITHUB_CLIENT_SECRET`, then delete the old secret on
  GitHub. In-flight sign-ins are unaffected.
- **Rotating the signing key.** `wrangler secret put STATE_SIGNING_KEY`; the
  only effect is that sign-ins started in the previous ten minutes fail with
  `session_mismatch` or an invalid-state page and the user clicks again.
- **Revoking access.** Users can revoke the app at
  `https://github.com/settings/connections/applications/<client id>`.
  Maintainers can revoke every issued token with *Revoke all user tokens* on
  the OAuth App's settings page; rotating the client secret does not revoke
  tokens that were already issued.
- **Updating.** `npx --yes wrangler@4 deploy --var BUILD_SHA:$(git rev-parse --short HEAD)`
  from a checkout of `main`; `/healthz` shows the deployed SHA.

## Error codes posted to the site

| `error` | Meaning |
| --- | --- |
| `expired` | More than ten minutes passed between `/start` and `/callback`. |
| `session_missing` | The browser did not send the flow cookie (cookies blocked for the broker host, or a different browser profile). |
| `session_mismatch` | The cookie belongs to another flow or was tampered with. |
| `access_denied` | The user cancelled on GitHub's authorization page. |
| `bad_verification_code` | The code was reused or expired; GitHub rejected the exchange. |
| `unverified_user_email` | GitHub requires a verified primary email before authorizing. |
| `incorrect_client_credentials`, `redirect_uri_mismatch`, `application_suspended` | Broker or OAuth App misconfiguration; check client ID, secret and callback URL. |
| `insufficient_scope` | The user unticked `public_repo`; the token was discarded. |
| `invalid_request` | GitHub returned no usable code, or an `error` parameter that is not a lowercase snake_case code. |
| `temporarily_unavailable` | The token exchange could not connect to GitHub or timed out after ten seconds. |
| `server_error` | GitHub returned an unexpected response body. |

Any other error code GitHub returns from the token exchange is passed through
unchanged with a generic description.

## Tests

The handler is Web-standard code with injectable `fetch`, `now` and `log`, so
it runs unchanged under Node's test runner:

```bash
cd site
npm test          # includes scripts/github-auth-broker.test.js
```

The suite covers configuration validation, routing and method gates, the
`/start` redirect and cookie, blob tampering, every branch of the `/callback`
decision ladder, token containment (a property test checks that random tokens
appear only inside the page's data block), HTML escaping, and a contract check
that `site/src/main.js` still speaks the same message protocol.
