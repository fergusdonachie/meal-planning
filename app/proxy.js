import { next } from '@vercel/functions';
import { protectRequest } from './server/auth.js';
import { plannerRequest } from './server/planner.js';

export default async function proxy(request) {
  if (new URL(request.url).pathname === '/api/planner') return plannerRequest(request);
  const denied = await protectRequest(request);
  if (denied) return denied;
  return next({ headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}
