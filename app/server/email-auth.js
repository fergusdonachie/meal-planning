import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE = '__Host-weeklyTable';
const SESSION_SECONDS = 90 * 24 * 60 * 60;
// Keep token-bearing paths out of referrers without making form POST Origins null.
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'strict-origin', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
const normalize = (email) => typeof email === 'string' ? email.trim().toLowerCase() : '';
const allowlist = (env) => [...new Set((env.APP_ALLOWED_EMAILS || '').split(',').map(normalize).filter(Boolean))].sort();
const authKey = (env) => env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
const allowed = (email, env) => allowlist(env).includes(normalize(email));
function configured(env) {
  try {
    const url = new URL(env.SUPABASE_URL);
    return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash
      && typeof authKey(env) === 'string' && authKey(env).length >= 20
      && typeof env.APP_SESSION_SECRET === 'string' && env.APP_SESSION_SECRET.length >= 32
      && allowlist(env).length > 0 && allowlist(env).every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  } catch { return false; }
}
const reply = (body, status = 200, extra = {}) => new Response(body, { status, headers: { ...headers, ...extra } });
const escape = (value) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function signature(payload, env) {
  return createHmac('sha256', env.APP_SESSION_SECRET).update(`email-v1:${env.SUPABASE_URL}:${allowlist(env).join(',')}:${payload}`).digest('base64url');
}
function equal(a, b) {
  const first = Buffer.from(a), second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
export function createEmailSession(email, env, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ email: normalize(email), expires: now + SESSION_SECONDS * 1000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${payload}.${signature(payload, env)}`;
}
export function emailAuthenticated(request, env, now = Date.now()) {
  if (!configured(env)) return false;
  const cookie = (request.headers.get('cookie') || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE}=`));
  if (!cookie || cookie.length > 2048) return false;
  const [payload, supplied, extra] = cookie.slice(COOKIE.length + 1).split('.');
  if (!payload || !supplied || extra || !equal(signature(payload, env), supplied)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return allowed(session.email, env) && Number.isFinite(session.expires) && session.expires > now && session.expires <= now + SESSION_SECONDS * 1000;
  } catch { return false; }
}
function page(content, status = 200) {
  return reply(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your household · The Weekly Table</title><style>
  *{box-sizing:border-box}body{margin:0;background:#faf3e8;color:#2a2420;font:17px system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center;padding:24px}main{width:100%;max-width:440px;background:white;padding:32px;border-radius:20px;box-shadow:0 12px 40px #2a242015}h1{font:600 32px Georgia,serif;margin:0 0 12px}p{color:#6b5f54;line-height:1.6}label{display:block;font-weight:600;margin-top:24px}input{width:100%;padding:13px;margin:8px 0 16px;border:1px solid #b5baa8;border-radius:8px;font:inherit}button{width:100%;padding:14px;border:0;border-radius:8px;background:#6e7a47;color:white;font:600 17px system-ui;cursor:pointer}a{color:#576237}small{display:block;color:#6b5f54;margin-top:20px;line-height:1.5}
  </style></head><body><main><h1>The Weekly Table</h1>${content}</main></body></html>`, status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" });
}
function loginPage() {
  return page(`<p>Your recipes. Your week. Just your household.</p><form action="/auth/login" method="post"><label for="email">Your email address</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="254" autofocus><button type="submit">Email me a sign-in link</button></form><small>Only approved household addresses can sign in. No password to remember. You'll stay signed in on this device for up to 90 days.</small>`);
}
async function provider(path, body, env, fetcher) {
  return fetcher(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/${path}`, { method: 'POST', headers: { apikey: authKey(env), 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000), redirect: 'error' });
}
const validLinkType = (value) => ['email', 'invite'].includes(value);
const validToken = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{20,256}$/.test(value);

export async function protectEmailRequest(request, env, fetcher = fetch) {
  if (!configured(env)) return reply('Private email access is not configured. Complete the server-only household email settings before activating email sign-in.', 503);
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/auth/login' && request.method === 'GET') return loginPage();
  if (path === '/auth/confirm' && request.method === 'GET') {
    const token = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type');
    if (!validToken(token) || !validLinkType(type)) return page('<p>This sign-in link is incomplete. Request a fresh link.</p><a href="/auth/login">Get a new link</a>', 400);
    // Email scanners can visit this page without consuming the one-time link.
    return page(`<p>Open your private household table on this device.</p><form action="/auth/confirm" method="post"><input type="hidden" name="token_hash" value="${escape(token)}"><input type="hidden" name="type" value="${type}"><button type="submit">Continue to our table</button></form><small>Continue only if you requested this sign-in link.</small>`);
  }
  if (['/auth/login', '/auth/confirm', '/auth/logout'].includes(path)) {
    if (request.method !== 'POST') return reply('Method not allowed', 405, { Allow: path === '/auth/logout' ? 'POST' : 'GET, POST' });
    if (request.headers.get('origin') !== url.origin) return reply('Request origin rejected', 403);
    if (path === '/auth/logout') return reply(null, 303, { Location: '/auth/login', 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return reply('Unsupported sign-in form', 415);
    if (Number(request.headers.get('content-length') || 0) > 4096) return reply('Sign-in form too large', 413);
    const body = await request.text();
    if (Buffer.byteLength(body) > 4096) return reply('Sign-in form too large', 413);
    const form = new URLSearchParams(body);
    if (path === '/auth/login') {
      const email = normalize(form.get('email'));
      if (allowed(email, env)) {
        try { await provider('otp', { email, create_user: false }, env, fetcher); } catch { /* Same response for missing accounts, rate limits and service failures. */ }
      }
      return page('<p role="status">If this is an approved household address, a sign-in link should arrive shortly. Check your inbox and junk folder.</p><p>Use the newest email. If it does not arrive, wait a minute before trying again.</p><a href="/auth/login">Request another link</a>');
    }
    const token = form.get('token_hash');
    const type = form.get('type') || 'email';
    if (!validToken(token) || !validLinkType(type)) return page('<p>This sign-in link is invalid.</p><a href="/auth/login">Get a new link</a>', 400);
    try {
      const result = await provider('verify', { token_hash: token, type }, env, fetcher);
      const data = result.ok ? await result.json() : null;
      if (!data?.user?.email_confirmed_at || !allowed(data.user.email, env)) return page('<p>This link has expired, has already been used, or is not for this household.</p><a href="/auth/login">Get a new link</a>', 401);
      return reply(null, 303, { Location: '/week', 'Set-Cookie': `${COOKIE}=${createEmailSession(data.user.email, env)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}` });
    } catch { return page('<p>Sign-in is temporarily unavailable. Please try again shortly.</p><a href="/auth/login">Back to sign-in</a>', 503); }
  }
  if (emailAuthenticated(request, env)) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('origin') !== url.origin) return reply('Request origin rejected', 403);
    return null;
  }
  if (path.startsWith('/api/')) return reply(JSON.stringify({ error: 'Sign in required' }), 401, { 'Content-Type': 'application/json' });
  return reply(null, 303, { Location: '/auth/login' });
}
