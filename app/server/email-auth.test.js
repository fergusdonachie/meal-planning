import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailSession, emailAuthenticated, protectEmailRequest } from './email-auth.js';
import { protectRequest, isAuthenticated, createSession } from './auth.js';
const env = { APP_AUTH_MODE: 'email', SUPABASE_URL: 'https://household.supabase.co', SUPABASE_ANON_KEY: 'test-public-anon-key-at-least-20', APP_SESSION_SECRET: 'test-session-secret-at-least-32-characters', APP_ALLOWED_EMAILS: 'one@example.com,two@example.com' };
const origin = 'https://meal.example';
const request = (path, options = {}) => new Request(origin + path, options);
const post = (path, data) => request(path, { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) });
const token = 'a'.repeat(64);

test('email mode fails closed when any required setting is missing and rejects unknown modes', async () => {
  for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'APP_SESSION_SECRET', 'APP_ALLOWED_EMAILS']) {
    assert.equal((await protectRequest(request('/week'), { ...env, [key]: '' })).status, 503);
  }
  assert.equal((await protectRequest(request('/week'), { ...env, APP_AUTH_MODE: 'typo' })).status, 503);
  assert.equal((await protectRequest(request('/auth/login'), env)).status, 200);
});

test('only approved addresses reach the email provider, with the same public response', async () => {
  const calls = [];
  const fetcher = async (...args) => { calls.push(args); return new Response('{}'); };
  const denied = await protectEmailRequest(post('/auth/login', { email: 'stranger@example.com' }), env, fetcher);
  assert.equal(calls.length, 0);
  const sent = await protectEmailRequest(post('/auth/login', { email: ' ONE@example.com ' }), env, fetcher);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], env.SUPABASE_URL + '/auth/v1/otp');
  assert.deepEqual(JSON.parse(calls[0][1].body), { email: 'one@example.com', create_user: false });
  assert.equal(await denied.text(), await sent.text());
  assert.equal(sent.headers.get('set-cookie'), null);
});

test('GET confirmation does not consume the link; verification is same-origin POST only', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return new Response('{}'); };
  const result = await protectEmailRequest(request('/auth/confirm?type=email&token_hash=' + token), env, fetcher);
  assert.equal(calls, 0);
  assert.match(await result.text(), /Continue to our table/);
  assert.equal(result.headers.get('referrer-policy'), 'strict-origin');
  const crossSite = new Request(origin + '/auth/confirm', { method: 'POST', headers: { origin: 'https://elsewhere.example' } });
  assert.equal((await protectEmailRequest(crossSite, env, fetcher)).status, 403);
  assert.equal(calls, 0);
});

test('sign-in forms preserve browser POST origins while rejecting missing and opaque origins', async () => {
  const login = await protectEmailRequest(request('/auth/login'), env);
  assert.equal(login.headers.get('referrer-policy'), 'strict-origin');
  for (const path of ['/auth/login', '/auth/confirm', '/auth/logout']) {
    for (const headers of [{}, { origin: 'null' }, { origin: 'https://elsewhere.example' }]) {
      const result = await protectEmailRequest(request(path, { method: 'POST', headers }), env, async () => {
        assert.fail('untrusted origin must not reach the provider');
      });
      assert.equal(result.status, 403);
    }
  }
});

test('confirmed household identity earns a private session; invalid or unapproved identities do not', async () => {
  const identity = { email: 'one@example.com', email_confirmed_at: '2026-11-23T12:00:00Z' };
  for (const user of [identity, { ...identity, email: 'stranger@example.com' }, { ...identity, email_confirmed_at: null }]) {
    const result = await protectEmailRequest(post('/auth/confirm', { token_hash: token }), env, async (url, options) => {
      assert.equal(url, env.SUPABASE_URL + '/auth/v1/verify');
      assert.deepEqual(JSON.parse(options.body), { token_hash: token, type: 'email' });
      return Response.json({ user });
    });
    if (user === identity) {
      assert.equal(result.status, 303);
      assert.equal(result.headers.get('location'), '/week');
      const cookie = result.headers.get('set-cookie');
      assert.match(cookie, /HttpOnly; Secure; SameSite=Strict; Max-Age=7776000/);
      assert.equal(await protectRequest(request('/week', { headers: { cookie: cookie.split(';')[0] } }), env), null);
    } else { assert.equal(result.status, 401); assert.equal(result.headers.get('set-cookie'), null); }
  }
  const expired = await protectEmailRequest(post('/auth/confirm', { token_hash: token }), env, async () => new Response('{}', { status: 403 }));
  assert.equal(expired.status, 401);
});

test('forgery, expiry, removed members and old password sessions are rejected in email mode', () => {
  const token = createEmailSession('one@example.com', env);
  const authenticated = (value, settings = env) => emailAuthenticated(request('/week', { headers: { cookie: '__Host-weeklyTable=' + value } }), settings);
  assert.equal(authenticated(token), true);
  assert.equal(authenticated(token + 'bad'), false);
  assert.equal(authenticated(createEmailSession('one@example.com', env, Date.now() - 91 * 86400000)), false);
  assert.equal(authenticated(token, { ...env, APP_ALLOWED_EMAILS: 'two@example.com' }), false);
  assert.equal(authenticated(token, { ...env, APP_SESSION_SECRET: env.APP_SESSION_SECRET + 'rotated' }), false);
  const old = createSession({ ...env, APP_PASSWORD: 'old-household-password' });
  assert.equal(isAuthenticated(request('/week', { headers: { cookie: '__Host-weeklyTable=' + old } }), env), false);
});

test('all assets remain protected, provider failures stay private, and logout clears the cookie', async () => {
  for (const path of ['/week', '/recipes', '/data/recipes.json', '/images/fish.webp']) {
    assert.equal((await protectEmailRequest(request(path), env)).status, 303);
  }
  assert.equal((await protectEmailRequest(request('/api/basket'), env)).status, 401);
  const failed = await protectEmailRequest(post('/auth/confirm', { token_hash: token }), env, async () => { throw new Error('private provider details'); });
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private provider details/);
  const logout = await protectEmailRequest(post('/auth/logout', {}), env);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});


test('one-time invitations use the same household checks without a user password', async () => {
  const landing = await protectEmailRequest(request('/auth/confirm?type=invite&token_hash=' + token), env, async () => { throw new Error('GET must not verify'); });
  assert.equal(landing.status, 200);
  assert.match(await landing.text(), /name="type" value="invite"/);
  const verify = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { token_hash: token, type: 'invite' });
    return Response.json({ user: { email: 'two@example.com', email_confirmed_at: '2026-11-23T12:00:00Z' } });
  };
  assert.equal((await protectEmailRequest(post('/auth/confirm', { token_hash: token, type: 'invite' }), env, verify)).status, 303);
  for (const type of ['recovery', 'signup', '<script>']) {
    assert.equal((await protectEmailRequest(post('/auth/confirm', { token_hash: token, type }), env, async () => { throw new Error('invalid type must not verify'); })).status, 400);
  }
});


test('modern publishable keys work without legacy anon keys', async () => {
  const modern = { ...env, SUPABASE_ANON_KEY: undefined, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-key-for-household' };
  let called = false;
  const result = await protectEmailRequest(post('/auth/login', { email: 'one@example.com' }), modern, async (_url, options) => {
    called = true;
    assert.equal(options.headers.apikey, modern.SUPABASE_PUBLISHABLE_KEY);
    return new Response('{}');
  });
  assert.equal(result.status, 200);
  assert.equal(called, true);
});
