import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, isAuthenticated, protectRequest } from './auth.js';

const env = { APP_PASSWORD: 'test-household-password-only', APP_SESSION_SECRET: 'test-session-secret-at-least-32-characters' };
const origin = 'https://meal.example';
const request = (path, options = {}) => new Request(origin + path, options);
const cookie = (token) => `__Host-weeklyTable=${token}`;
function login(password, target = '/week') {
  return request('/auth/login', { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password, returnTo: target }) });
}

test('unconfigured deployments deny access rather than becoming public', async () => {
  assert.equal((await protectRequest(request('/week'), {})).status, 503);
  assert.equal((await protectRequest(request('/api/basket'), {})).status, 503);
});

test('pages, recipes and assets require login; API calls receive an unauthorised status', async () => {
  for (const path of ['/week', '/recipe/fish', '/data/recipes.json', '/assets/app.js', '/images/fish.webp']) {
    const result = await protectRequest(request(path), env);
    assert.equal(result.status, 303);
    assert.ok(result.headers.get('location').startsWith('/auth/login'));
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal((await protectRequest(request('/api/basket'), env)).status, 401);
});

test('passwords are checked on the server and never reflected in the form', async () => {
  const result = await protectRequest(login('wrong-password'), env);
  assert.equal(result.status, 401);
  assert.doesNotMatch(await result.text(), /wrong-password|test-household-password-only/);
  assert.equal(result.headers.get('set-cookie'), null);
});

test('successful login sets a secure HttpOnly session and returns to the chosen recipe page', async () => {
  const result = await protectRequest(login(env.APP_PASSWORD), env);
  assert.equal(result.status, 303);
  assert.equal(result.headers.get('location'), '/week');
  const setCookie = result.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly; Secure; SameSite=Strict/);
  assert.doesNotMatch(setCookie, /test-household-password-only/);
  assert.equal(await protectRequest(request('/week', { headers: { cookie: setCookie.split(';')[0] } }), env), null);
});

test('forged, expired sessions and sessions from before a password rotation are rejected', () => {
  const token = createSession(env);
  assert.equal(isAuthenticated(request('/week', { headers: { cookie: cookie(token + 'bad') } }), env), false);
  const expired = createSession(env, Date.now() - 31 * 24 * 60 * 60 * 1000);
  assert.equal(isAuthenticated(request('/week', { headers: { cookie: cookie(expired) } }), env), false);
  assert.equal(isAuthenticated(request('/week', { headers: { cookie: cookie(token) } }), { ...env, APP_PASSWORD: 'changed-test-password-1234' }), false);
});

test('login redirects stay on this app and cross-origin submissions are refused', async () => {
  for (const target of ['https://evil.example', '//evil.example', '/\\evil.example', '/auth/logout']) {
    const result = await protectRequest(login(env.APP_PASSWORD, target), env);
    assert.equal(result.headers.get('location'), '/');
  }
  assert.equal((await protectRequest(request('/auth/login', { method: 'POST', headers: { origin: 'https://evil.example' } }), env)).status, 403);
  const token = createSession(env);
  assert.equal((await protectRequest(request('/api/basket', { method: 'POST', headers: { origin: 'https://evil.example', cookie: cookie(token) } }), env)).status, 403);
});

test('signing out clears the session cookie', async () => {
  const result = await protectRequest(request('/auth/logout', { method: 'POST', headers: { origin } }), env);
  assert.equal(result.status, 303);
  assert.match(result.headers.get('set-cookie'), /Max-Age=0/);
});
