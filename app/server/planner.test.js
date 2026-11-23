import test from 'node:test';
import assert from 'node:assert/strict';
import { plannerRequest } from './planner.js';
import { createEmailSession } from './email-auth.js';
const env = { APP_AUTH_MODE: 'email', APP_ALLOWED_EMAILS: 'one@example.com', APP_SESSION_SECRET: 'test-session-secret-at-least-32-characters', SUPABASE_URL: 'https://household.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test-public-key-at-least-20-characters', SUPABASE_SERVICE_ROLE_KEY: 'server-test-key' };
const week = '2026-11-23';
const op = (changes = {}) => ({ week, operationId: 'operation-0000000001', type: 'select', id: 'fish-pie', value: true, ...changes });
function request(method = 'GET', data, overrides = {}) {
  return new Request('https://meal.example/api/planner', { method, headers: { cookie: '__Host-weeklyTable=' + createEmailSession('one@example.com', env), origin: 'https://meal.example', 'content-type': 'application/json', ...overrides }, ...(data ? { body: JSON.stringify(data) } : {}) });
}
function database(initial) {
  let row = initial;
  return { row: () => row, fetch: async (value, options) => {
    const url = new URL(value);
    assert.equal(options.headers.apikey, env.SUPABASE_SERVICE_ROLE_KEY);
    if (options.method === 'GET') return Response.json(row ? [structuredClone(row)] : []);
    const body = JSON.parse(options.body);
    if (options.method === 'POST') { if (row) return Response.json([]); row = body; }
    else { if (url.searchParams.get('revision') !== 'eq.' + row.revision) return Response.json([]); row = { ...row, ...body }; }
    return Response.json([row]);
  } };
}
test('shared storage requires a household session and same-origin writes before database access', async () => {
  const fail = async () => assert.fail('must not call database');
  assert.equal((await plannerRequest(request('GET', null, { cookie: '' }), env, fail)).status, 401);
  assert.equal((await plannerRequest(request('POST', op(), { origin: 'https://evil.example' }), env, fail)).status, 403);
  assert.equal((await plannerRequest(request(), { ...env, SUPABASE_SERVICE_ROLE_KEY: '' }, fail)).status, 503);
  assert.equal((await plannerRequest(request('POST', op({ week: '2026-11-24' })), env, fail)).status, 400);
});
test('saves, loads, and deduplicates a retried update without exposing the database key', async () => {
  const db = database();
  const result = await plannerRequest(request('POST', op()), env, db.fetch);
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).plan.selected, ['fish-pie']);
  await plannerRequest(request('POST', op()), env, db.fetch);
  assert.equal(db.row().revision, 1);
  const saved = await plannerRequest(request(), env, db.fetch);
  assert.equal(saved.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await saved.json(), { version: 1, weeks: { [week]: { selected: ['fish-pie'], completed: [] } } });
});
test('concurrent devices reapply changes to the latest revision instead of losing a meal', async () => {
  const db = database({ week, plan: { selected: ['fish-pie'], completed: [] }, revision: 1, operations: [] });
  let contested = false;
  const fetcher = async (url, options) => {
    if (options.method === 'PATCH' && !contested) {
      contested = true;
      await db.fetch(url, { ...options, body: JSON.stringify({ plan: { selected: ['fish-pie', 'tofu-curry'], completed: [] }, revision: 2, operations: ['another-device-00001'] }) });
      return Response.json([]);
    }
    return db.fetch(url, options);
  };
  assert.equal((await plannerRequest(request('POST', op({ id: 'chicken-soup' })), env, fetcher)).status, 200);
  assert.deepEqual(db.row().plan.selected, ['fish-pie', 'tofu-curry', 'chicken-soup']);
});
test('a stale local import never overwrites an existing shared menu, even an intentionally empty one', async () => {
  const db = database({ week, plan: { selected: [], completed: [] }, revision: 3, operations: [] });
  await plannerRequest(request('POST', op({ type: 'import', plan: { selected: ['old-meal'], completed: [] } })), env, db.fetch);
  assert.deepEqual(db.row().plan.selected, []);
  assert.equal(db.row().revision, 3);
});
test('database failures do not expose credentials or provider details', async () => {
  const result = await plannerRequest(request(), env, async () => { throw new Error('private key and provider details'); });
  assert.equal(result.status, 503);
  assert.doesNotMatch(await result.text(), /private key|provider details|server-test-key/);
});

test('modern secret keys use only the API-key header rather than treating them as JWTs', async () => {
  const result = await plannerRequest(request(), { ...env, SUPABASE_SECRET_KEY: 'sb_secret_server-test-only' }, async (_url, options) => {
    assert.equal(options.headers.apikey, 'sb_secret_server-test-only');
    assert.equal(options.headers.Authorization, undefined);
    return Response.json([]);
  });
  assert.equal(result.status, 200);
});
