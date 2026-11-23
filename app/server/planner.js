import { isAuthenticated } from './auth.js';
import { applyOperation, validOperation, validPlan } from '../src/lib/householdPlan.js';

const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
export async function plannerRequest(request, env = process.env, fetcher = fetch) {
  if (!isAuthenticated(request, env)) return reply({ error: 'Sign in required' }, 401);
  if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'Method not allowed' }, 405);
  if (request.method === 'POST' && request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: 'Request origin rejected' }, 403);
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !env.SUPABASE_URL) return reply({ error: 'Shared menus are not configured yet' }, 503);
  const url = new URL('/rest/v1/household_weeks', env.SUPABASE_URL);
  const headers = { apikey: key, ...(!key.startsWith('sb_secret_') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json' };
  async function db(query, method = 'GET', data) {
    const result = await fetcher(`${url}?${query}`, { method, headers: { ...headers, Prefer: method === 'POST' ? 'resolution=ignore-duplicates,return=representation' : 'return=representation' }, ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!result.ok) throw new Error('Shared storage unavailable');
    const rows = await result.json();
    if (!Array.isArray(rows)) throw new Error('Invalid storage response');
    return rows;
  }
  try {
    if (request.method === 'GET') {
      const rows = await db('select=week,plan&order=week.asc&limit=1000');
      if (rows.some((row) => !validPlan(row.plan))) throw new Error('Invalid saved plan');
      return reply({ version: 1, weeks: Object.fromEntries(rows.map((row) => [row.week, row.plan])) });
    }
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'JSON required' }, 415);
    if (Number(request.headers.get('content-length') || 0) > 32768) return reply({ error: 'Menu update too large' }, 413);
    const body = await request.text();
    if (Buffer.byteLength(body) > 32768) return reply({ error: 'Menu update too large' }, 413);
    let op;
    try { op = JSON.parse(body); } catch { return reply({ error: 'Invalid menu update' }, 400); }
    if (!validOperation(op)) return reply({ error: 'Invalid menu update' }, 400);
    for (let attempt = 0; attempt < 5; attempt++) {
      const [row] = await db(`week=eq.${op.week}&select=week,plan,revision,operations`);
      if (row && !validPlan(row.plan)) throw new Error('Invalid saved plan');
      if (row && (op.type === 'import' || row.operations.includes(op.operationId))) return reply({ week: op.week, plan: row.plan });
      const plan = applyOperation(row?.plan, op);
      if (!validPlan(plan)) return reply({ error: 'Menu limit reached' }, 400);
      const update = { plan, revision: (row?.revision || 0) + 1, operations: [...(row?.operations || []), op.operationId].slice(-200), updated_at: new Date().toISOString() };
      const saved = row
        ? await db(`week=eq.${op.week}&revision=eq.${row.revision}`, 'PATCH', update)
        : await db('on_conflict=week', 'POST', { week: op.week, ...update });
      if (saved.length) return reply({ week: op.week, plan: saved[0].plan });
      // Another device saved first. Reapply this change to its latest menu.
    }
    return reply({ error: 'Another device is saving. Please retry.' }, 409);
  } catch { return reply({ error: 'Shared menus are temporarily unavailable. Your changes are kept on this device.' }, 503); }
}
