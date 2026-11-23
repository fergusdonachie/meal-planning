import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlannerSync, SYNC_KEY } from './plannerSync.js';
import { applyOperation } from './householdPlan.js';
const week = '2026-11-23';
const storage = (initial = {}) => { const values = new Map(Object.entries(initial)); return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }; };
let serial = 0;
const makeId = () => 'operation-' + String(++serial).padStart(16, '0');
const wait = async (store) => { for (let i = 0; i < 100 && ['loading', 'saving'].includes(store.getSnapshot().status); i++) await new Promise((resolve) => setTimeout(resolve, 1)); };
function server() {
  const weeks = {};
  let offline = false;
  return { weeks, offline(value) { offline = value; }, fetch: async (_url, options) => {
    if (offline) throw new Error('offline');
    if (options.method === 'GET') return Response.json({ version: 1, weeks });
    const op = JSON.parse(options.body);
    weeks[op.week] = applyOperation(weeks[op.week], op);
    return Response.json({ week: op.week, plan: weeks[op.week] });
  } };
}
const create = (db, local = storage()) => createPlannerSync({ storage: local, fetcher: db.fetch, makeId, today: week });
test('a menu chosen on one device appears on another, including swaps and cooked ticks', async () => {
  const db = server(), phone = create(db), mac = create(db);
  phone.start(); mac.start(); await wait(phone); await wait(mac);
  phone.dispatch({ type: 'replace', ids: ['fish-pie', 'chicken-soup'] }); await wait(phone);
  await mac.refresh();
  assert.deepEqual([...mac.getSnapshot().planner.weeks[week].selected], ['fish-pie', 'chicken-soup']);
  mac.dispatch({ type: 'swap', id: 'chicken-soup', replacement: 'tofu-curry' }); await wait(mac);
  mac.dispatch({ type: 'complete', id: 'fish-pie' }); await wait(mac);
  await phone.refresh();
  assert.deepEqual([...phone.getSnapshot().planner.weeks[week].selected], ['fish-pie', 'tofu-curry']);
  assert.deepEqual([...phone.getSnapshot().planner.weeks[week].completed], ['fish-pie']);
});
test('offline changes survive closing and reopening then merge with the other device', async () => {
  const db = server(), local = storage();
  const phone = create(db, local); phone.start(); await wait(phone);
  db.offline(true); phone.dispatch({ type: 'toggle', id: 'fish-pie' }); await wait(phone); phone.stop();
  assert.equal(phone.getSnapshot().status, 'offline');
  db.weeks[week] = { selected: ['tofu-curry'], completed: [] };
  const reopened = create(db, local);
  assert.equal(reopened.getSnapshot().planner.weeks[week].selected.has('fish-pie'), true);
  db.offline(false); reopened.start(); await wait(reopened);
  assert.deepEqual(db.weeks[week].selected, ['tofu-curry', 'fish-pie']);
  assert.equal(JSON.parse(local.getItem(SYNC_KEY)).pending.length, 0);
});
test('imports existing browser meals once without stale copies replacing the household menu', async () => {
  const db = server();
  const old = JSON.stringify({ version: 1, weeks: { [week]: { selected: ['fish-pie'], completed: ['fish-pie'] } } });
  const phone = create(db, storage({ weeklyTableWeeks: old })); phone.start(); await wait(phone);
  assert.deepEqual(db.weeks[week].completed, ['fish-pie']);
  db.weeks[week] = { selected: [], completed: [] };
  const stale = create(db, storage({ weeklyTableWeeks: old })); stale.start(); await wait(stale);
  assert.deepEqual([...stale.getSnapshot().planner.weeks[week].selected], []);
  assert.deepEqual(db.weeks[week].selected, []);
});
test('an expired login keeps unsent work and signals sign-in rather than claiming sync succeeded', async () => {
  const local = storage();
  const store = createPlannerSync({ storage: local, today: week, makeId, fetcher: async () => new Response('{}', { status: 401 }) });
  store.start(); await wait(store);
  store.dispatch({ type: 'toggle', id: 'fish-pie' }); await wait(store);
  assert.equal(store.getSnapshot().status, 'signed-out');
  assert.equal(JSON.parse(local.getItem(SYNC_KEY)).pending.length, 1);
});
