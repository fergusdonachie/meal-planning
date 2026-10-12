import { next } from '@vercel/functions';
import { protectRequest } from './server/auth.js';

export default async function proxy(request) {
  const denied = await protectRequest(request);
  if (denied) return denied;
  return next({ headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}
