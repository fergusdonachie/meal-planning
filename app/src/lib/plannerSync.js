import { applyOperation, validOperation, validPlan } from './householdPlan.js';
import { restorePlanner, serializePlanner, PLANNER_KEY } from './weeklyPlanner.js';
import { PLAN_STORAGE_KEY } from './weekPlan.js';
import { currentWeek, validWeek } from './weeklyMenu.js';

export const SYNC_KEY = 'weeklyTableHouseholdSync';
export function createPlannerSync({ storage, fetcher = fetch, makeId = () => crypto.randomUUID(), today = currentWeek() }) {
  const read = (key) => { try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; } };
  const cached = read(SYNC_KEY);
  let base = cached?.base?.version === 1 ? serializePlanner(restorePlanner(cached.base, null, today))
    : serializePlanner(restorePlanner(read(PLANNER_KEY), read(PLAN_STORAGE_KEY) || { selected: read('weeklyTableSelected') || [] }, today));
  let pending = Array.isArray(cached?.pending) ? cached.pending.filter(validOperation) : [];
  if (!cached) {
    // Import only missing weeks. Never let a stale phone replace a shared menu.
    pending = Object.entries(base.weeks).filter(([, plan]) => plan.selected.length).map(([week, plan]) => ({ type: 'import', week, plan, operationId: makeId() }));
  }
  let week = today, status = 'loading', storageFailed = false, busy = false, active = false;
  const listeners = new Set();
  let snapshot;
  function publish() {
    const weeks = { ...base.weeks };
    for (const op of pending) weeks[op.week] = applyOperation(weeks[op.week], op);
    snapshot = { planner: { ...restorePlanner({ version: 1, weeks }, null, today), week }, status, storageFailed, pending: pending.length };
    for (const listener of listeners) listener();
  }
  function persist() {
    try { storage.setItem(SYNC_KEY, JSON.stringify({ base, pending })); storageFailed = false; }
    catch { storageFailed = true; }
  }
  async function call(method, data) {
    const response = await fetcher('/api/planner', { method, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(15000) });
    if (!response.ok) { const error = new Error('Sync unavailable'); error.status = response.status; throw error; }
    const result = await response.json();
    if (method === 'GET') {
      if (result?.version !== 1 || !result.weeks || Object.entries(result.weeks).some(([key, plan]) => !validWeek(key) || !validPlan(plan))) throw new Error('Invalid shared menu');
    } else if (result.week !== data.week || !validPlan(result.plan)) throw new Error('Invalid shared menu');
    return result;
  }
  async function refresh() {
    if (busy || !active) return;
    busy = true;
    status = pending.length ? 'saving' : status;
    publish();
    try {
      base = await call('GET');
      persist(); publish();
      while (pending.length && active) {
        const op = pending[0];
        const result = await call('POST', op);
        base = { version: 1, weeks: { ...base.weeks, [result.week]: result.plan } };
        pending = pending.filter((item) => item.operationId !== op.operationId);
        persist(); publish();
      }
      status = pending.length ? 'saving' : 'synced';
    } catch (error) { status = error.status === 401 ? 'signed-out' : 'offline'; }
    finally { busy = false; persist(); publish(); }
  }
  persist(); publish();
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    start() { active = true; void refresh(); },
    stop() { active = false; },
    refresh,
    changeWeek(value) { if (validWeek(value)) { week = value; publish(); } },
    dispatch(action) {
      const plan = snapshot.planner.weeks[week] || { selected: new Set(), completed: new Set() };
      let op = { ...action, week, operationId: makeId() };
      if (action.type === 'toggle') op = { ...op, type: 'select', value: !plan.selected.has(action.id) };
      if (action.type === 'complete' && typeof action.value !== 'boolean') op.value = !plan.completed.has(action.id);
      if (!validOperation(op)) return;
      pending = [...pending, op];
      status = status === 'offline' || status === 'signed-out' ? status : 'saving';
      persist(); publish(); void refresh();
    },
  };
}
