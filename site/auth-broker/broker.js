// GitHub OAuth broker for the HIPs site edit modal.
//
// The site is static (GitHub Pages) and github.com's OAuth endpoints send no
// CORS headers, so the browser cannot exchange an authorization code itself.
// This tiny Web-standard fetch handler does it server-side and hands the token
// back to the page that opened the sign-in popup via window.postMessage.
//
// Contract with site/src/main.js (requestGitHubTokenFromPopup):
//   popup  →  GET {BROKER_ORIGIN}/start?state=<s>&origin=<site origin>&return_to=<ignored>
//   broker →  302 github.com/login/oauth/authorize  →  GET /callback?code&state
//   broker →  HTML page that posts { type: 'hips:github-token', state: <s>, token }
//             (or { type, state, error, error_description }) to window.opener,
//             with the allow-listed site origin as targetOrigin.
//
// Only Web APIs that behave identically in Cloudflare Workers and Node 20 are
// used (URL, Headers, Request, Response, fetch, crypto.subtle, TextEncoder,
// atob/btoa, AbortSignal.timeout), so this file is unit-tested with node --test.

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_AGENT = 'hips-github-auth-broker';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_BLOB_LENGTH = 1024;
const MAX_TOKEN_LENGTH = 255;

export const STATE_RE = /^[A-Za-z0-9._~-]{16,128}$/; // crypto.randomUUID() or 32 hex chars from the client
export const CODE_RE = /^[A-Za-z0-9_-]{1,256}$/;
export const STATE_TTL_SECONDS = 600;
export const EXCHANGE_TIMEOUT_MS = 10_000;

const NONCE_RE = /^[A-Za-z0-9_-]{43}$/; // base64url of 32 random bytes
const ERROR_CODE_RE = /^[a-z_]{1,64}$/;

// Error copy posted back to the site. GitHub's own error_description is never
// forwarded, so nothing attacker-steerable ever reaches the page.
export const ERROR_TEXT = Object.freeze({
  expired: 'GitHub sign-in took too long. Click Connect GitHub to try again.',
  session_missing: 'Your browser did not send the sign-in cookie for {host}. Allow cookies for that site and try again.',
  session_mismatch: 'This sign-in window no longer matches the page that opened it. Close it and click Connect GitHub again.',
  access_denied: 'You declined the GitHub authorization. Click Connect GitHub to try again.',
  bad_verification_code: 'The GitHub sign-in code expired or was already used. Try again.',
  unverified_user_email: 'Verify the primary email address on your GitHub account, then try again.',
  incorrect_client_credentials: 'The HIPs GitHub sign-in service is misconfigured. Tell the HIP editors.',
  redirect_uri_mismatch: 'The HIPs GitHub sign-in service is misconfigured. Tell the HIP editors.',
  application_suspended: 'The HIPs GitHub sign-in service is misconfigured. Tell the HIP editors.',
  insufficient_scope: 'GitHub did not grant the public_repo permission, which is needed to open pull requests. Try again and keep it ticked.',
  invalid_request: 'GitHub did not return a valid sign-in code. Try again.',
  temporarily_unavailable: 'GitHub did not answer the sign-in request. Try again in a moment.',
  server_error: 'GitHub sign-in hit an unexpected error. Try again later.',
  default: 'GitHub refused the sign-in. Try again later.',
});

/* ------------------------------------------------------------------ */
/* configuration                                                       */
/* ------------------------------------------------------------------ */

function parseOrigins(value) {
  if (typeof value !== 'string') return null;
  const entries = value.split(',').map(s => s.trim()).filter(Boolean);
  if (!entries.length) return null;
  const origins = new Set();
  for (const entry of entries) {
    let url;
    try { url = new URL(entry); } catch { return null; }
    if (!/^https?:$/.test(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.origin === 'null') return null;
    if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) return null;
    origins.add(url.origin);
  }
  return origins;
}

function parseBrokerOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let url;
  try { url = new URL(value.trim()); } catch { return null; }
  if (!/^https?:$/.test(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.origin === 'null') return null;
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) return null;
  return url.origin;
}

/**
 * Validate the Worker environment. Returns { ok: true, config } or
 * { ok: false, invalid: [variable names] } — never values.
 */
export function parseConfig(env = {}) {
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const invalid = [];

  const clientId = str(env.GITHUB_CLIENT_ID);
  if (!clientId) invalid.push('GITHUB_CLIENT_ID');

  const clientSecret = str(env.GITHUB_CLIENT_SECRET);
  if (!clientSecret) invalid.push('GITHUB_CLIENT_SECRET');

  const signingKey = typeof env.STATE_SIGNING_KEY === 'string' ? env.STATE_SIGNING_KEY : '';
  if (signingKey.length < 32) invalid.push('STATE_SIGNING_KEY');

  const allowedOrigins = parseOrigins(env.ALLOWED_ORIGINS);
  if (!allowedOrigins) invalid.push('ALLOWED_ORIGINS');

  const brokerOrigin = parseBrokerOrigin(env.BROKER_ORIGIN);
  if (!brokerOrigin) invalid.push('BROKER_ORIGIN');

  if (invalid.length) return { ok: false, invalid };

  return {
    ok: true,
    config: {
      clientId,
      clientSecret,
      signingKey,
      allowedOrigins,
      brokerOrigin,
      brokerHost: new URL(brokerOrigin).host,
      secure: brokerOrigin.startsWith('https:'),
      buildSha: str(env.BUILD_SHA) || 'unknown',
    },
  };
}

/* ------------------------------------------------------------------ */
/* encoding and signing                                                */
/* ------------------------------------------------------------------ */

const utf8 = new TextEncoder();
const utf8Strict = new TextDecoder('utf-8', { fatal: true });

export function base64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(value) {
  if (typeof value !== 'string' || /[^A-Za-z0-9_-]/.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  try {
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function randomBase64url(byteLength = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Base64url(value) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8.encode(value))));
}

const hmacKeys = new Map();
function hmacKey(secret) {
  if (!hmacKeys.has(secret)) {
    hmacKeys.set(secret, crypto.subtle.importKey('raw', utf8.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
  }
  return hmacKeys.get(secret);
}

/**
 * `payload.sig`, both base64url. `kind` ('st' for GitHub's state parameter,
 * 'ck' for the cookie) is mixed into the signed bytes so one blob can never be
 * presented as the other.
 */
export async function signBlob(kind, payload, secret) {
  const encoded = base64url(utf8.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), utf8.encode(`${kind}.${encoded}`));
  return `${encoded}.${base64url(new Uint8Array(signature))}`;
}

export async function verifyBlob(kind, blob, secret) {
  if (typeof blob !== 'string' || !blob || blob.length > MAX_BLOB_LENGTH) return null;
  const parts = blob.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [encoded, signature] = parts;
  const signatureBytes = base64urlDecode(signature);
  const payloadBytes = base64urlDecode(encoded);
  if (!signatureBytes || !payloadBytes) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), signatureBytes, utf8.encode(`${kind}.${encoded}`));
    if (!valid) return null;
    const payload = JSON.parse(utf8Strict.decode(payloadBytes));
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

export function parseCookies(header) {
  const cookies = {};
  if (typeof header !== 'string') return cookies;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    cookies[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return cookies;
}

// One cookie per flow, named from the flow nonce, so concurrent sign-ins never
// overwrite each other. `__Host-` makes browsers enforce Secure + Path=/ + no Domain.
export function cookieName(nonce, brokerOrigin) {
  const prefix = String(brokerOrigin).startsWith('https:') ? '__Host-' : '';
  return `${prefix}hips_oauth_${String(nonce).slice(0, 16)}`;
}

function setCookieHeader(name, value, secure, maxAge) {
  return `${name}=${value}; Path=/; ${secure ? 'Secure; ' : ''}HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function buildAuthorizeUrl({ clientId, brokerOrigin, state, codeChallenge }) {
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${brokerOrigin}/callback`,
    scope: 'public_repo',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

export function sanitizeErrorCode(code) {
  return typeof code === 'string' && ERROR_CODE_RE.test(code) ? code : 'invalid_request';
}

function describeError(code, brokerHost) {
  // Own properties only: codes such as "constructor" must not reach the prototype chain.
  const text = Object.prototype.hasOwnProperty.call(ERROR_TEXT, code) ? ERROR_TEXT[code] : ERROR_TEXT.default;
  return text.replace('{host}', brokerHost);
}

/**
 * JSON that is safe to embed inside a <script type="application/json"> block:
 * characters that could close the element or break a line are written as JSON
 * unicode escapes (never HTML entities, which are not decoded inside <script>).
 */
export function jsonForHtml(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/* ------------------------------------------------------------------ */
/* callback page                                                       */
/* ------------------------------------------------------------------ */

/**
 * The only dynamic bytes are the CSP nonce and the JSON data block. All visible
 * copy is fixed; the nonce'd script selects which sentence to show.
 *
 * - history.replaceState runs first so the consumed code and signed state leave
 *   the popup's URL bar and history.
 * - After posting, the page never closes itself: the site's own cleanup() closes
 *   the popup once it has processed the message. Only the "nothing to post"
 *   branch self-closes, so the site gets a prompt "closed before approval".
 */
export function renderPage({ targetOrigin, message, nonce }) {
  const data = jsonForHtml({ targetOrigin: targetOrigin || null, message: message || null });
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
<title>GitHub sign-in</title>
<style nonce="${nonce}">body{font:16px/1.5 system-ui,sans-serif;margin:2rem;color:#1f2328}p{max-width:36rem}[hidden]{display:none}</style>
</head><body>
<p id="working">Finishing GitHub sign-in…</p>
<p id="done" hidden>Connected to GitHub. Returning to the HIPs page…</p>
<p id="failed" hidden>GitHub sign-in did not complete. The HIPs page shows the reason; you can close this window.</p>
<p id="invalid" hidden>This sign-in link is invalid or expired. Close this window, return to the HIPs page and click Connect GitHub again.</p>
<p id="no-opener" hidden>This window is not attached to the HIPs page, so the sign-in cannot be handed back. Close it, allow popups for the HIPs site, and click Connect GitHub again.</p>
<script type="application/json" id="hips-auth">${data}</script>
<script nonce="${nonce}">
(function () {
  try { history.replaceState(null, '', '/callback'); } catch (e) {}
  function show(id) {
    var ps = document.querySelectorAll('p');
    for (var i = 0; i < ps.length; i++) ps[i].hidden = ps[i].id !== id;
  }
  var data;
  try { data = JSON.parse(document.getElementById('hips-auth').textContent); } catch (e) { show('invalid'); return; }
  if (!data || !data.targetOrigin || !data.message) {
    show('invalid');
    setTimeout(function () { try { window.close(); } catch (e) {} }, 10000);
    return;
  }
  var opener = window.opener;
  if (!opener || opener.closed) { show('no-opener'); return; }
  try { opener.postMessage(data.message, data.targetOrigin); } catch (e) { show('no-opener'); return; }
  show(data.message.token ? 'done' : 'failed');
})();
</script>
</body></html>
`;
}

/* ------------------------------------------------------------------ */
/* responses                                                           */
/* ------------------------------------------------------------------ */

function baseHeaders(secure) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex',
  });
  if (secure) headers.set('Strict-Transport-Security', 'max-age=31536000');
  return headers;
}

function textResponse(status, body, headers, extra = {}) {
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return new Response(body, { status, headers });
}

function pageResponse(status, { targetOrigin, message }, headers, clearCookie) {
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(16)));
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
  headers.set('Cross-Origin-Opener-Policy', 'unsafe-none');
  headers.set('X-Frame-Options', 'DENY');
  if (clearCookie) headers.append('Set-Cookie', clearCookie);
  return new Response(renderPage({ targetOrigin, message, nonce }), { status, headers });
}

/* ------------------------------------------------------------------ */
/* routes                                                              */
/* ------------------------------------------------------------------ */

async function handleStart(url, config, headers, { now, log }) {
  const state = url.searchParams.get('state');
  if (!state || !STATE_RE.test(state)) {
    log({ route: 'start', outcome: 'rejected', error: 'invalid_state' });
    return textResponse(400, 'invalid state', headers);
  }

  const origin = url.searchParams.get('origin');
  if (!origin || !config.allowedOrigins.has(origin)) {
    log({ route: 'start', outcome: 'rejected', error: 'origin_not_allowed' });
    return textResponse(403, 'origin not allowed', headers);
  }

  const nonce = randomBase64url(32);
  const verifier = randomBase64url(32);
  const challenge = await sha256Base64url(verifier);
  const exp = Math.floor(now() / 1000) + STATE_TTL_SECONDS;

  const stateBlob = await signBlob('st', { v: 1, s: state, o: origin, n: nonce, exp }, config.signingKey);
  const cookieBlob = await signBlob('ck', { v: 1, n: nonce, pv: verifier }, config.signingKey);

  headers.set('Location', buildAuthorizeUrl({ clientId: config.clientId, brokerOrigin: config.brokerOrigin, state: stateBlob, codeChallenge: challenge }));
  headers.append('Set-Cookie', setCookieHeader(cookieName(nonce, config.brokerOrigin), cookieBlob, config.secure, STATE_TTL_SECONDS));
  log({ route: 'start', outcome: 'redirected', n: nonce });
  return new Response(null, { status: 302, headers });
}

async function exchangeCode({ code, verifier, config, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: `${config.brokerOrigin}/callback`,
        code_verifier: verifier,
      }).toString(),
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    });
  } catch (e) {
    return { error: 'temporarily_unavailable', detail: String(e?.name || 'fetch_failed').slice(0, 80) };
  }

  if (!response || typeof response.json !== 'function') {
    throw new TypeError('token exchange did not return a Response');
  }

  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!body || typeof body !== 'object') return { error: 'server_error' };

  // An unknown client_id answers 404 {"error":"Not Found"} rather than the documented shape.
  if (response.status === 404 && body.error === 'Not Found') return { error: 'incorrect_client_credentials' };
  if (body.error !== undefined) {
    return { error: typeof body.error === 'string' && ERROR_CODE_RE.test(body.error) ? body.error : 'server_error' };
  }

  const token = body.access_token;
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH || /\s/.test(token)) {
    return { error: 'server_error' };
  }

  // Users can untick scopes on GitHub's consent screen; without public_repo the
  // site could not fork, commit or open the pull request, so do not hand it over.
  const scopes = String(body.scope || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!scopes.includes('public_repo') && !scopes.includes('repo')) return { error: 'insufficient_scope' };

  return { token, tokenType: typeof body.token_type === 'string' && body.token_type ? body.token_type : 'bearer', scope: scopes.join(',') };
}

async function handleCallback(url, request, config, headers, { now, log, fetchImpl }, flow) {
  const statePayload = await verifyBlob('st', url.searchParams.get('state'), config.signingKey);
  const stateValid = statePayload
    && statePayload.v === 1
    && typeof statePayload.s === 'string' && STATE_RE.test(statePayload.s)
    && typeof statePayload.o === 'string'
    && typeof statePayload.n === 'string' && NONCE_RE.test(statePayload.n)
    && Number.isInteger(statePayload.exp);

  if (!stateValid) {
    log({ route: 'callback', outcome: 'static', error: 'invalid_state', cookie: 'n/a' });
    return pageResponse(400, {}, headers);
  }

  const { s: clientState, o: targetOrigin, n: nonce, exp } = statePayload;
  flow.n = nonce;
  const name = cookieName(nonce, config.brokerOrigin);
  const clearCookie = setCookieHeader(name, '', config.secure, 0);

  // Re-checked against the live allow-list so a tightened list can never be widened by an old blob.
  if (!config.allowedOrigins.has(targetOrigin)) {
    log({ route: 'callback', outcome: 'static', error: 'origin_not_allowed', cookie: 'n/a', n: nonce });
    return pageResponse(400, {}, headers, clearCookie);
  }

  const post = (message, outcome, error, cookie, detail) => {
    log({ route: 'callback', outcome, error, cookie, n: nonce, ...(detail ? { detail } : {}) });
    return pageResponse(200, { targetOrigin, message: { type: 'hips:github-token', state: clientState, ...message } }, headers, clearCookie);
  };
  const fail = (code, cookie = 'n/a', detail) => post({ error: code, error_description: describeError(code, config.brokerHost) }, 'posted_error', code, cookie, detail);

  if (exp < Math.floor(now() / 1000)) return fail('expired');

  const githubError = url.searchParams.get('error');
  if (githubError !== null) return fail(sanitizeErrorCode(githubError));

  const cookieValue = parseCookies(request.headers.get('cookie'))[name];
  if (cookieValue === undefined) return fail('session_missing', 'missing');

  const cookiePayload = await verifyBlob('ck', cookieValue, config.signingKey);
  const cookieValid = cookiePayload
    && cookiePayload.v === 1
    && cookiePayload.n === nonce
    && typeof cookiePayload.pv === 'string' && NONCE_RE.test(cookiePayload.pv);
  if (!cookieValid) return fail('session_mismatch', 'mismatch');

  const code = url.searchParams.get('code');
  if (!code || !CODE_RE.test(code)) return fail('invalid_request', 'match');

  const result = await exchangeCode({ code, verifier: cookiePayload.pv, config, fetchImpl });
  if (result.error) return fail(result.error, 'match', result.detail);

  return post({ token: result.token, token_type: result.tokenType, scope: result.scope }, 'posted_token', null, 'match');
}

/**
 * Entry point shared by the Worker and the tests.
 * deps.fetch / deps.now / deps.log are injectable for testing.
 */
export async function handleRequest(request, env, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const now = deps.now || (() => Date.now());
  const rawLog = deps.log || (line => console.log(line));
  const log = fields => rawLog(JSON.stringify({ error: null, cookie: 'n/a', ...fields }));

  const url = new URL(request.url);
  const headers = baseHeaders(url.protocol === 'https:');
  const path = url.pathname;

  const allowedMethods = path === '/healthz' ? 'GET, HEAD' : (path === '/start' || path === '/callback') ? 'GET' : null;
  if (allowedMethods && !allowedMethods.split(', ').includes(request.method)) {
    return textResponse(405, 'method not allowed', headers, { Allow: allowedMethods });
  }

  const parsed = parseConfig(env);
  if (!parsed.ok) {
    return textResponse(503, `misconfigured: ${parsed.invalid.join(', ')}`, headers);
  }
  const { config } = parsed;

  if (url.origin !== config.brokerOrigin) {
    return textResponse(404, 'not found', headers);
  }

  if (path === '/healthz') {
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    return new Response(request.method === 'HEAD' ? null : `ok ${config.buildSha}`, { status: 200, headers });
  }

  if (path === '/start') {
    return handleStart(url, config, headers, { now, log });
  }

  if (path === '/callback') {
    const flow = {};
    try {
      return await handleCallback(url, request, config, headers, { now, log, fetchImpl }, flow);
    } catch (e) {
      // Only the error class and message, never request data, so operators can diagnose it.
      log({ route: 'callback', outcome: 'static', error: 'exception', n: flow.n, detail: String(e?.message || e).slice(0, 200) });
      const clearCookie = flow.n ? setCookieHeader(cookieName(flow.n, config.brokerOrigin), '', config.secure, 0) : undefined;
      return pageResponse(500, {}, baseHeaders(url.protocol === 'https:'), clearCookie);
    }
  }

  return textResponse(404, 'not found', headers);
}
