import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fc from 'fast-check';
import {
  ERROR_TEXT,
  STATE_RE,
  STATE_TTL_SECONDS,
  base64url,
  base64urlDecode,
  buildAuthorizeUrl,
  cookieName,
  handleRequest,
  jsonForHtml,
  parseConfig,
  parseCookies,
  renderPage,
  sanitizeErrorCode,
  sha256Base64url,
  signBlob,
  verifyBlob,
} from '../auth-broker/broker.js';

const BROKER = 'https://hips-auth.example.com';
const SITE = 'https://hips.hedera.com';
const ENV = {
  GITHUB_CLIENT_ID: 'Iv1.0123456789abcdef',
  GITHUB_CLIENT_SECRET: 'client-secret-value',
  STATE_SIGNING_KEY: 'signing-key-that-is-at-least-32-characters-long',
  ALLOWED_ORIGINS: ' https://hips.hedera.com/ , https://hips-staging.example.org',
  BROKER_ORIGIN: BROKER,
};
const CLIENT_STATE = '0f4a3c2e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
const NOW = 1_800_000_000_000;

function req(path, { method = 'GET', headers = {}, origin = BROKER } = {}) {
  return new Request(`${origin}${path}`, { method, headers });
}

function deps(overrides = {}) {
  const logs = [];
  const calls = [];
  const d = {
    now: () => NOW,
    log: line => logs.push(line),
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ access_token: 'gho_testtoken123', token_type: 'bearer', scope: 'public_repo' });
    },
    ...overrides,
  };
  return { d, logs, calls };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function startFlow({ state = CLIENT_STATE, origin = SITE, env = ENV, d } = {}) {
  const { d: defaults } = deps();
  const res = await handleRequest(req(`/start?state=${encodeURIComponent(state)}&origin=${encodeURIComponent(origin)}&return_to=%2F`), env, d || defaults);
  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('location'));
  const setCookie = res.headers.get('set-cookie');
  const [cookiePair] = setCookie.split(';');
  const T = location.searchParams.get('state');
  const payload = await verifyBlob('st', T, env.STATE_SIGNING_KEY);
  return { res, location, setCookie, cookiePair, T, n: payload.n, payload };
}

function pageData(html) {
  const match = html.match(/<script type="application\/json" id="hips-auth">([\s\S]*?)<\/script>/);
  assert.ok(match, 'callback page has a data block');
  return JSON.parse(match[1]);
}

function assertBaseHeaders(res) {
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.equal(res.headers.get('strict-transport-security'), 'max-age=31536000');
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  const coop = res.headers.get('cross-origin-opener-policy');
  assert.ok(coop === null || coop === 'unsafe-none', 'never sends a COOP that severs window.opener');
}

/* ---------- configuration ---------- */

test('parseConfig accepts the documented environment and canonicalises origins', () => {
  const parsed = parseConfig(ENV);
  assert.equal(parsed.ok, true);
  assert.deepEqual([...parsed.config.allowedOrigins], ['https://hips.hedera.com', 'https://hips-staging.example.org']);
  assert.equal(parsed.config.brokerOrigin, BROKER);
  assert.equal(parsed.config.brokerHost, 'hips-auth.example.com');
});

test('parseConfig names every invalid variable and never echoes values', () => {
  const bad = parseConfig({
    ...ENV,
    GITHUB_CLIENT_ID: '',
    STATE_SIGNING_KEY: 'too-short',
    BROKER_ORIGIN: 'https://hips-auth.example.com/path',
    ALLOWED_ORIGINS: 'https://hips.hedera.com/hips',
  });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.invalid, ['GITHUB_CLIENT_ID', 'STATE_SIGNING_KEY', 'ALLOWED_ORIGINS', 'BROKER_ORIGIN']);

  assert.equal(parseConfig({ ...ENV, BROKER_ORIGIN: 'http://hips-auth.example.com' }).ok, false, 'plain http is only allowed on loopback');
  assert.equal(parseConfig({ ...ENV, BROKER_ORIGIN: 'http://127.0.0.1:8787' }).ok, true);
  assert.equal(parseConfig({ ...ENV, ALLOWED_ORIGINS: '' }).ok, false);
  assert.equal(parseConfig({ ...ENV, ALLOWED_ORIGINS: 'http://hips.hedera.com' }).ok, false, 'plain http site origins are rejected');
  assert.equal(parseConfig({ ...ENV, ALLOWED_ORIGINS: 'http://localhost:5173, https://hips.hedera.com' }).ok, true, 'loopback http is fine for local dev');
  assert.equal(parseConfig({ ...ENV, GITHUB_CLIENT_SECRET: undefined }).ok, false);
});

test('misconfigured deployments answer 503 with variable names only', async () => {
  const env = { ...ENV, GITHUB_CLIENT_SECRET: '' };
  for (const path of ['/start?state=abcdefghijklmnop&origin=https://hips.hedera.com', '/callback?code=x&state=y', '/healthz']) {
    const res = await handleRequest(req(path), env, deps().d);
    assert.equal(res.status, 503);
    const body = await res.text();
    assert.equal(body, 'misconfigured: GITHUB_CLIENT_SECRET');
    assert.doesNotMatch(body, /signing-key/);
    assertBaseHeaders(res);
  }
});

/* ---------- routing ---------- */

test('unknown paths and foreign hostnames are 404 and set no cookie', async () => {
  for (const path of ['/', '/nope', '/start/extra']) {
    const res = await handleRequest(req(path), ENV, deps().d);
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('set-cookie'), null);
    assertBaseHeaders(res);
  }
  const { d, calls } = deps();
  for (const path of [`/start?state=${CLIENT_STATE}&origin=${SITE}`, '/callback?code=abc&state=def', '/healthz']) {
    const res = await handleRequest(req(path, { origin: 'https://hips-github-auth.example.workers.dev' }), ENV, d);
    assert.equal(res.status, 404, path);
    assert.equal(res.headers.get('set-cookie'), null);
  }
  assert.equal(calls.length, 0);
});

test('only GET reaches /start and /callback; /healthz also accepts HEAD', async () => {
  const { d, calls } = deps();
  for (const method of ['HEAD', 'POST', 'OPTIONS', 'PUT']) {
    const start = await handleRequest(req(`/start?state=${CLIENT_STATE}&origin=${SITE}`, { method }), ENV, d);
    assert.equal(start.status, 405, `${method} /start`);
    assert.equal(start.headers.get('allow'), 'GET');
    assert.equal(start.headers.get('set-cookie'), null);

    const callback = await handleRequest(req('/callback?code=abc&state=def', { method }), ENV, d);
    assert.equal(callback.status, 405, `${method} /callback`);
    assert.equal(callback.headers.get('allow'), 'GET');
    assert.equal(callback.headers.get('set-cookie'), null);
  }
  assert.equal(calls.length, 0, 'no token exchange for non-GET callbacks');

  const post = await handleRequest(req('/healthz', { method: 'POST' }), ENV, d);
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
});

test('/healthz reports the build and makes no outbound request', async () => {
  const { d, calls } = deps();
  const plain = await handleRequest(req('/healthz'), ENV, d);
  assert.equal(plain.status, 200);
  assert.equal(await plain.text(), 'ok unknown');

  const stamped = await handleRequest(req('/healthz'), { ...ENV, BUILD_SHA: 'abc1234' }, d);
  assert.equal(await stamped.text(), 'ok abc1234');

  const head = await handleRequest(req('/healthz', { method: 'HEAD' }), ENV, d);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(calls.length, 0);
});

/* ---------- /start ---------- */

test('/start rejects malformed client state without echoing it', async () => {
  const { d } = deps();
  for (const state of ['', 'short-15-chars!', 'x'.repeat(129), 'has/slash-in-it-ok', 'has space in it ok', 'has<angle>brackets', 'has%25percent-value', 'has+plus+sign+value']) {
    const res = await handleRequest(req(`/start?state=${encodeURIComponent(state)}&origin=${SITE}`), ENV, d);
    assert.equal(res.status, 400, JSON.stringify(state));
    assert.equal(await res.text(), 'invalid state');
    assert.equal(res.headers.get('set-cookie'), null);
  }
  for (const state of [CLIENT_STATE, 'a'.repeat(32), '0123456789abcdef0123456789abcdef']) {
    const res = await handleRequest(req(`/start?state=${state}&origin=${SITE}`), ENV, d);
    assert.equal(res.status, 302, state);
  }
});

test('/start allow-lists the exact site origin and never the raw query value', async () => {
  const { d } = deps();
  for (const origin of ['', 'https://hips.hedera.com/', 'http://hips.hedera.com', 'HTTPS://HIPS.HEDERA.COM', 'https://evil.hips.hedera.com', 'https://hips.hedera.com:8443', 'null', 'https://attacker.example']) {
    const res = await handleRequest(req(`/start?state=${CLIENT_STATE}&origin=${encodeURIComponent(origin)}`), ENV, d);
    assert.equal(res.status, 403, JSON.stringify(origin));
    assert.equal(await res.text(), 'origin not allowed');
    assert.equal(res.headers.get('set-cookie'), null);
  }
  const ok = await handleRequest(req(`/start?state=${CLIENT_STATE}&origin=${encodeURIComponent('https://hips-staging.example.org')}`), ENV, d);
  assert.equal(ok.status, 302);
});

test('/start redirects to GitHub with PKCE and binds the flow to a __Host- cookie', async () => {
  const { location, setCookie, cookiePair, T, payload } = await startFlow();

  assert.equal(location.origin + location.pathname, 'https://github.com/login/oauth/authorize');
  assert.deepEqual([...location.searchParams.keys()].sort(), ['client_id', 'code_challenge', 'code_challenge_method', 'redirect_uri', 'scope', 'state']);
  assert.equal(location.searchParams.get('client_id'), ENV.GITHUB_CLIENT_ID);
  assert.equal(location.searchParams.get('redirect_uri'), `${BROKER}/callback`);
  assert.equal(location.searchParams.get('scope'), 'public_repo');
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.match(location.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);

  assert.equal(payload.v, 1);
  assert.equal(payload.s, CLIENT_STATE);
  assert.equal(payload.o, SITE);
  assert.match(payload.n, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(payload.exp, Math.floor(NOW / 1000) + STATE_TTL_SECONDS);
  assert.ok(T.length < 400);

  const name = `__Host-hips_oauth_${payload.n.slice(0, 16)}`;
  const [cookieKey, cookieValue] = cookiePair.split('=');
  assert.equal(cookieKey, name);
  assert.equal(setCookie, `${name}=${cookieValue}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${STATE_TTL_SECONDS}`);

  const cookie = await verifyBlob('ck', cookieValue, ENV.STATE_SIGNING_KEY);
  assert.equal(cookie.n, payload.n);
  assert.match(cookie.pv, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(location.searchParams.get('code_challenge'), await sha256Base64url(cookie.pv));
});

test('/start on loopback http uses a plain cookie without Secure', async () => {
  const env = { ...ENV, BROKER_ORIGIN: 'http://127.0.0.1:8787' };
  const res = await handleRequest(req(`/start?state=${CLIENT_STATE}&origin=${SITE}`, { origin: 'http://127.0.0.1:8787' }), env, deps().d);
  assert.equal(res.status, 302);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /^hips_oauth_[A-Za-z0-9_-]{16}=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=600$/);
  assert.equal(res.headers.get('strict-transport-security'), null);
});

test('every /start mints a fresh nonce and cookie so concurrent flows cannot clobber each other', async () => {
  const a = await startFlow();
  const b = await startFlow();
  assert.notEqual(a.n, b.n);
  assert.notEqual(a.cookiePair.split('=')[0], b.cookiePair.split('=')[0]);
});

/* ---------- signed blobs ---------- */

test('signed blobs reject tampering, kind confusion and foreign keys', async () => {
  const key = ENV.STATE_SIGNING_KEY;
  const blob = await signBlob('st', { v: 1, s: CLIENT_STATE, o: SITE, n: 'n'.repeat(43), exp: 1 }, key);
  assert.deepEqual(await verifyBlob('st', blob, key), { v: 1, s: CLIENT_STATE, o: SITE, n: 'n'.repeat(43), exp: 1 });

  const [p, sig] = blob.split('.');
  const flip = (str, i) => str.slice(0, i) + (str[i] === 'A' ? 'B' : 'A') + str.slice(i + 1);
  assert.equal(await verifyBlob('st', `${flip(p, 3)}.${sig}`, key), null, 'payload tamper');
  assert.equal(await verifyBlob('st', `${p}.${flip(sig, 3)}`, key), null, 'signature tamper');
  assert.equal(await verifyBlob('st', `${p}${sig}`, key), null, 'missing dot');
  assert.equal(await verifyBlob('st', `${blob}.extra`, key), null, 'extra segment');
  assert.equal(await verifyBlob('st', `${p}.`, key), null, 'empty signature');
  assert.equal(await verifyBlob('st', 'a'.repeat(1030), key), null, 'oversized');
  const big = await signBlob('st', { v: 1, s: CLIENT_STATE, o: SITE, n: 'n'.repeat(43), exp: 1, pad: 'y'.repeat(1200) }, key);
  assert.ok(big.length > 1024);
  assert.equal(await verifyBlob('st', big, key), null, 'oversized but correctly signed');
  assert.equal(await verifyBlob('ck', blob, key), null, 'kind confusion');
  assert.equal(await verifyBlob('st', blob, 'another-key-that-is-also-32-chars-long!!'), null, 'foreign key');
  assert.equal(await verifyBlob('st', null, key), null);
});

test('base64url helpers round-trip arbitrary bytes', () => {
  fc.assert(fc.property(fc.uint8Array({ maxLength: 64 }), bytes => {
    const encoded = base64url(bytes);
    assert.match(encoded, /^[A-Za-z0-9_-]*$/);
    assert.deepEqual([...base64urlDecode(encoded)], [...bytes]);
    return true;
  }), { numRuns: 200 });
  assert.equal(base64urlDecode('not*valid'), null);
  assert.equal(base64urlDecode('abcde'), null, 'invalid length');
});

/* ---------- /callback ladder ---------- */

test('/callback with an unverifiable state is a static 400 page: nothing posted, no fetch, no cookie touched', async () => {
  const { d, calls, logs } = deps();
  for (const state of ['', 'garbage', 'a.b', 'x'.repeat(1030)]) {
    const res = await handleRequest(req(`/callback?code=abc&state=${state}`), ENV, d);
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('set-cookie'), null);
    assert.match(res.headers.get('content-type'), /^text\/html/);
    const data = pageData(await res.text());
    assert.equal(data.targetOrigin, null);
    assert.equal(data.message, null);
  }
  assert.equal(calls.length, 0);
  assert.ok(logs.every(line => JSON.parse(line).outcome === 'static'));
});

test('/callback re-checks the live allow-list before posting anywhere', async () => {
  const { T, cookiePair } = await startFlow();
  const shrunk = { ...ENV, ALLOWED_ORIGINS: 'https://hips-staging.example.org' };
  const { d, calls } = deps();
  const res = await handleRequest(req(`/callback?code=abc&state=${T}`, { headers: { cookie: cookiePair } }), shrunk, d);
  assert.equal(res.status, 400);
  assert.equal(pageData(await res.text()).targetOrigin, null);
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(calls.length, 0);
});

test('/callback after the TTL posts an expired error without contacting GitHub', async () => {
  const { T, cookiePair } = await startFlow();
  const { d, calls } = deps({ now: () => NOW + (STATE_TTL_SECONDS + 1) * 1000 });
  const res = await handleRequest(req(`/callback?code=abc&state=${T}`, { headers: { cookie: cookiePair } }), ENV, d);
  assert.equal(res.status, 200);
  const data = pageData(await res.text());
  assert.equal(data.targetOrigin, SITE);
  assert.deepEqual(data.message, { type: 'hips:github-token', state: CLIENT_STATE, error: 'expired', error_description: ERROR_TEXT.expired });
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(calls.length, 0);
});

test('/callback forwards a GitHub denial as a fixed message and discards GitHub\'s text', async () => {
  const { T, cookiePair } = await startFlow();
  const { d, calls } = deps();
  const hostile = '<img src=x onerror=alert(1)>';
  const res = await handleRequest(req(`/callback?error=access_denied&error_description=${encodeURIComponent(hostile)}&error_uri=%2Fx&state=${T}`, { headers: { cookie: cookiePair } }), ENV, d);
  const html = await res.text();
  const data = pageData(html);
  assert.deepEqual(data.message, { type: 'hips:github-token', state: CLIENT_STATE, error: 'access_denied', error_description: ERROR_TEXT.access_denied });
  assert.ok(!html.includes('onerror'));
  assert.equal(calls.length, 0);

  const weird = await handleRequest(req(`/callback?error=${encodeURIComponent('Weird Code!')}&state=${T}`), ENV, d);
  assert.equal(pageData(await weird.text()).message.error, 'invalid_request');

  for (const code of ['constructor', '__proto__', 'hasownproperty']) {
    const inherited = await handleRequest(req(`/callback?error=${code}&state=${T}`), ENV, d);
    assert.equal(inherited.status, 200, code);
    const message = pageData(await inherited.text()).message;
    assert.equal(message.error, code);
    assert.equal(message.error_description, ERROR_TEXT.default);
  }
});

test('/callback rejects signed blobs whose payload has the wrong shape', async () => {
  const key = ENV.STATE_SIGNING_KEY;
  const { d, calls } = deps();
  const badState = await signBlob('st', { v: 1, s: 'not valid state!', o: SITE, n: 'n'.repeat(43), exp: 1 }, key);
  const res = await handleRequest(req(`/callback?code=abc&state=${badState}`), ENV, d);
  assert.equal(res.status, 400);

  const { T, n, cookiePair } = await startFlow();
  const [name] = cookiePair.split('=');
  const badCookie = await signBlob('ck', { v: 1, n, pv: 'too-short' }, key);
  const mismatch = await handleRequest(req(`/callback?code=abc&state=${T}`, { headers: { cookie: `${name}=${badCookie}` } }), ENV, d);
  assert.equal(pageData(await mismatch.text()).message.error, 'session_mismatch');
  assert.equal(calls.length, 0);
});

test('/callback escapes tokens that contain markup while keeping the data block parseable', async () => {
  const { T, cookiePair } = await startFlow();
  const token = 'gho_</script><img/src=x/onerror=alert(1)>';
  const { d } = deps({ fetch: async () => jsonResponse({ access_token: token, token_type: 'bearer', scope: 'public_repo' }) });
  const res = await handleRequest(req(`/callback?code=abc&state=${T}`, { headers: { cookie: cookiePair } }), ENV, d);
  const html = await res.text();
  assert.ok(!html.includes('</script><img'));
  assert.equal(pageData(html).message.token, token);
});

test('/callback without the flow cookie posts session_missing naming the broker host', async () => {
  const { T } = await startFlow();
  const { d, calls, logs } = deps();
  const res = await handleRequest(req(`/callback?code=abc&state=${T}`), ENV, d);
  const data = pageData(await res.text());
  assert.equal(data.message.error, 'session_missing');
  assert.match(data.message.error_description, /hips-auth\.example\.com/);
  assert.equal(calls.length, 0);
  assert.equal(JSON.parse(logs.at(-1)).cookie, 'missing');
});

test('/callback with a cookie from another flow or a tampered cookie posts session_mismatch', async () => {
  const first = await startFlow();
  const second = await startFlow();
  const { d, calls } = deps();

  const otherFlow = await handleRequest(req(`/callback?code=abc&state=${first.T}`, { headers: { cookie: second.cookiePair } }), ENV, d);
  assert.equal(pageData(await otherFlow.text()).message.error, 'session_missing', 'a different flow\'s cookie has a different name');

  const [name, value] = first.cookiePair.split('=');
  const flipAt = 5; // inside the signed payload, so the HMAC can never still match
  const tampered = `${name}=${value.slice(0, flipAt)}${value[flipAt] === 'A' ? 'B' : 'A'}${value.slice(flipAt + 1)}`;
  const bad = await handleRequest(req(`/callback?code=abc&state=${first.T}`, { headers: { cookie: `unrelated=1; ${tampered} ; __Host-other=2` } }), ENV, d);
  assert.equal(pageData(await bad.text()).message.error, 'session_mismatch');

  const forged = await signBlob('ck', { v: 1, n: second.n, pv: 'p'.repeat(43) }, ENV.STATE_SIGNING_KEY);
  const swapped = await handleRequest(req(`/callback?code=abc&state=${first.T}`, { headers: { cookie: `${name}=${forged}` } }), ENV, d);
  assert.equal(pageData(await swapped.text()).message.error, 'session_mismatch');
  assert.equal(calls.length, 0);
});

test('/callback validates the code before spending it', async () => {
  const { T, cookiePair } = await startFlow();
  const { d, calls } = deps();
  for (const code of ['', 'has space', 'has&amp', 'x'.repeat(300)]) {
    const res = await handleRequest(req(`/callback?code=${encodeURIComponent(code)}&state=${T}`, { headers: { cookie: cookiePair } }), ENV, d);
    assert.equal(pageData(await res.text()).message.error, 'invalid_request', JSON.stringify(code));
  }
  assert.equal(calls.length, 0);
});

test('/callback exchanges the code server-side and posts the token to the validated origin', async () => {
  const { T, cookiePair, n, location } = await startFlow();
  const { d, calls, logs } = deps();
  const res = await handleRequest(req(`/callback?code=abc_123&state=${T}`, { headers: { cookie: cookiePair } }), ENV, d);

  assert.equal(calls.length, 1);
  const [{ url, init }] = calls;
  assert.equal(url, 'https://github.com/login/oauth/access_token');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Accept, 'application/json');
  assert.equal(init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.ok(init.headers['User-Agent']);
  const body = new URLSearchParams(init.body);
  assert.equal(body.get('client_id'), ENV.GITHUB_CLIENT_ID);
  assert.equal(body.get('client_secret'), ENV.GITHUB_CLIENT_SECRET);
  assert.equal(body.get('code'), 'abc_123');
  assert.equal(body.get('redirect_uri'), `${BROKER}/callback`);
  assert.match(body.get('code_verifier'), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(await sha256Base64url(body.get('code_verifier')), location.searchParams.get('code_challenge'), 'the verifier matches the PKCE challenge sent to GitHub');
  assert.ok(init.signal instanceof AbortSignal, 'the exchange carries a timeout signal');

  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/html; charset=utf-8/);
  assert.equal(res.headers.get('cross-origin-opener-policy'), 'unsafe-none');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('set-cookie'), `__Host-hips_oauth_${n.slice(0, 16)}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`);
  assertBaseHeaders(res);

  const html = await res.text();
  const csp = res.headers.get('content-security-policy');
  const nonce = csp.match(/script-src 'nonce-([^']+)'/)[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.ok(html.includes(`<script nonce="${nonce}">`));
  assert.ok(html.includes(`<style nonce="${nonce}">`));

  const data = pageData(html);
  assert.equal(data.targetOrigin, SITE);
  assert.deepEqual(data.message, { type: 'hips:github-token', state: CLIENT_STATE, token: 'gho_testtoken123', token_type: 'bearer', scope: 'public_repo' });

  assert.equal(html.split('gho_testtoken123').length - 1, 1, 'token appears exactly once, inside the data block');
  for (const [, value] of res.headers) assert.ok(!value.includes('gho_testtoken123'));
  assert.ok(logs.every(line => !line.includes('gho_testtoken123') && !line.includes('abc_123') && !line.includes(CLIENT_STATE)));
  assert.equal(JSON.parse(logs.at(-1)).outcome, 'posted_token');
});

test('/callback withholds tokens that lack the public_repo grant', async () => {
  for (const scope of ['', 'gist', undefined]) {
    const { T, cookiePair } = await startFlow();
    const { d } = deps({ fetch: async () => jsonResponse({ access_token: 'gho_nope', token_type: 'bearer', ...(scope === undefined ? {} : { scope }) }) });
    const res = await handleRequest(req(`/callback?code=abc&state=${T}`, { headers: { cookie: cookiePair } }), ENV, d);
    const html = await res.text();
    assert.equal(pageData(html).message.error, 'insufficient_scope', JSON.stringify(scope));
    assert.ok(!html.includes('gho_nope'));
  }
  for (const scope of ['repo', 'public_repo,gist', ' public_repo ']) {
    const { T, cookiePair } = await startFlow();
    const { d } = deps({ fetch: async () => jsonResponse({ access_token: 'gho_ok', token_type: 'bearer', scope }) });
    const res = await handleRequest(req(`/callback?code=abc&state=${T}`, { headers: { cookie: cookiePair } }), ENV, d);
    assert.equal(pageData(await res.text()).message.token, 'gho_ok', JSON.stringify(scope));
  }
});

test('/callback maps GitHub exchange failures to fixed error codes and copy', async () => {
  const cases = [
    [async () => jsonResponse({ error: 'bad_verification_code', error_description: 'ignored' }), 'bad_verification_code'],
    [async () => jsonResponse({ error: 'unverified_user_email' }), 'unverified_user_email'],
    [async () => jsonResponse({ error: 'incorrect_client_credentials' }), 'incorrect_client_credentials'],
    [async () => jsonResponse({ error: 'redirect_uri_mismatch' }), 'redirect_uri_mismatch'],
    [async () => jsonResponse({ error: 'Not Found' }, 404), 'incorrect_client_credentials'],
    [async () => jsonResponse({ error: 'some_new_code' }), 'some_new_code'],
    [async () => new Response('<html>oops</html>', { status: 502 }), 'server_error'],
    [async () => jsonResponse({ access_token: '', token_type: 'bearer', scope: 'public_repo' }), 'server_error'],
    [async () => jsonResponse({ access_token: 'has space', token_type: 'bearer', scope: 'public_repo' }), 'server_error'],
    [async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); }, 'temporarily_unavailable'],
    [async () => { throw new TypeError('fetch failed'); }, 'temporarily_unavailable'],
  ];
  for (const [fetch, expected] of cases) {
    const { T, cookiePair } = await startFlow();
    const { d } = deps({ fetch });
    const res = await handleRequest(req(`/callback?code=abc&state=${T}`, { headers: { cookie: cookiePair } }), ENV, d);
    assert.equal(res.status, 200);
    const data = pageData(await res.text());
    assert.equal(data.message.error, expected);
    assert.equal(data.message.error_description, ERROR_TEXT[expected] || ERROR_TEXT.default);
    assert.equal(data.message.state, CLIENT_STATE);
  }
});

test('/callback turns unexpected exceptions into a static 500 without leaking details', async () => {
  const { T, cookiePair } = await startFlow();
  const { d, logs } = deps({ fetch: async () => 'not a response' });
  const res = await handleRequest(req(`/callback?code=abc&state=${T}`, { headers: { cookie: cookiePair } }), ENV, d);
  assert.equal(res.status, 500);
  const html = await res.text();
  assert.equal(pageData(html).message, null);
  assert.ok(!/TypeError|not a response|\.js:\d+/.test(html));
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(JSON.parse(logs.at(-1)).error, 'exception');
});

/* ---------- properties ---------- */

test('client state round-trips byte-for-byte for every allowed shape (property)', async () => {
  const stateArb = fc.stringMatching(/^[A-Za-z0-9._~-]{16,128}$/);
  const originArb = fc.constantFrom('https://hips.hedera.com', 'https://hips-staging.example.org');
  await fc.assert(fc.asyncProperty(stateArb, originArb, async (state, origin) => {
    const { T, cookiePair } = await startFlow({ state, origin });
    const { d } = deps();
    const res = await handleRequest(req(`/callback?code=abc&state=${T}`, { headers: { cookie: cookiePair } }), ENV, d);
    const data = pageData(await res.text());
    return data.targetOrigin === origin && data.message.state === state && data.message.token === 'gho_testtoken123';
  }), { numRuns: 60 });
});

test('random tokens never reach headers, logs or more than one place in the body (property)', async () => {
  const tokenArb = fc.stringMatching(/^gho_[A-Za-z0-9]{20,40}$/);
  await fc.assert(fc.asyncProperty(tokenArb, async token => {
    const { T, cookiePair } = await startFlow();
    const { d, logs } = deps({ fetch: async () => jsonResponse({ access_token: token, token_type: 'bearer', scope: 'public_repo' }) });
    const res = await handleRequest(req(`/callback?code=abc&state=${T}`, { headers: { cookie: cookiePair } }), ENV, d);
    const html = await res.text();
    const inHeaders = [...res.headers].some(([, v]) => v.includes(token));
    const inLogs = logs.some(l => l.includes(token));
    return !inHeaders && !inLogs && html.split(token).length - 1 === 1 && res.headers.get('location') === null;
  }), { numRuns: 40 });
});

/* ---------- rendering ---------- */

test('jsonForHtml escapes script breakouts with JSON unicode escapes and stays parseable', () => {
  const data = { message: { error_description: '</script><!--  -->&amp;' } };
  const out = jsonForHtml(data);
  assert.ok(!out.includes('<'));
  assert.ok(!out.includes('>'));
  assert.ok(!out.includes('&'));
  assert.ok(!out.includes(' ') && !out.includes(' '));
  assert.ok(!out.includes('&lt;'), 'never HTML entities inside <script>');
  assert.deepEqual(JSON.parse(out), data);
});

test('renderPage scrubs the URL first, posts before any close, and never self-closes after posting', () => {
  const html = renderPage({ targetOrigin: SITE, message: { type: 'hips:github-token', state: 's', token: 't' }, nonce: 'abc', brokerHost: 'hips-auth.example.com' });
  const replaceState = html.indexOf('history.replaceState');
  const post = html.indexOf('postMessage(');
  assert.ok(replaceState > -1 && post > replaceState);
  const script = html.slice(html.indexOf('<script nonce="abc">'));
  const closeIdx = script.indexOf('window.close');
  assert.ok(closeIdx > -1 && closeIdx < script.indexOf('postMessage('), 'the close is on the static branch, before the post');
  assert.equal(script.lastIndexOf('window.close'), closeIdx, 'there is no close after the post');
  assert.equal(script.split('window.close').length - 1, 1, 'exactly one window.close in the page script');
  assert.ok(html.includes('<script type="application/json" id="hips-auth">'));
  const outsideData = html.replace(/<script type="application\/json"[\s\S]*?<\/script>/, '');
  assert.ok(!outsideData.includes('hips.hedera.com'), 'the page itself carries no dynamic text outside the data block');
});

test('helpers: cookie parsing, cookie naming, authorize URL and error-code sanitising', async () => {
  assert.deepEqual(parseCookies('a=1; b=2=3 ;  c=; __Host-x=y'), { a: '1', b: '2=3', c: '', '__Host-x': 'y' });
  assert.deepEqual(parseCookies(null), {});
  assert.equal(cookieName('n'.repeat(43), 'https://hips-auth.example.com'), `__Host-hips_oauth_${'n'.repeat(16)}`);
  assert.equal(cookieName('n'.repeat(43), 'http://localhost:8787'), `hips_oauth_${'n'.repeat(16)}`);
  const url = new URL(buildAuthorizeUrl({ clientId: 'id', brokerOrigin: BROKER, state: 'T', codeChallenge: 'C' }));
  assert.equal(url.origin + url.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(url.searchParams.get('redirect_uri'), `${BROKER}/callback`);
  assert.equal(sanitizeErrorCode('access_denied'), 'access_denied');
  assert.equal(sanitizeErrorCode('Access Denied'), 'invalid_request');
  assert.equal(sanitizeErrorCode('a'.repeat(65)), 'invalid_request');
  assert.equal(sanitizeErrorCode(undefined), 'invalid_request');
  assert.ok(STATE_RE.test(crypto.randomUUID()));
});

/* ---------- contract with the site ---------- */

test('the site client still speaks the contract the broker implements', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /'hips:github-token'/);
  assert.match(main, /data\.state !== state/);
  assert.match(main, /event\.source !== popup/);
  assert.match(main, /event\.origin !== allowedOrigin/);
  assert.match(main, /if \(event\.source !== popup \|\| event\.origin !== allowedOrigin\) return;/);
  assert.match(main, /authUrl\.searchParams\.set\('state', state\)/);
  assert.match(main, /typeof runtime === 'string' \? runtime : GITHUB_AUTH_START_URL/);
  assert.match(main, /const allowedOrigin = authUrl\.origin;/, 'messages are accepted only from the broker origin');
  assert.match(main, /must be an absolute https URL/, 'relative or plain-http start URLs are refused before opening a popup');
  assert.match(main, /GITHUB_AUTH_TIMEOUT_MS = 10 \* 60 \* 1000/, 'client waits as long as the broker state lives');
  assert.match(main, /authUrl\.searchParams\.set\('origin', window\.location\.origin\)/);
  assert.match(main, /data\.token \|\| value\?\.access_token|value\?\.token \|\| value\?\.access_token/);
});
