import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_SECONDS = 30 * 24 * 60 * 60;
const COOKIE = '__Host-weeklyTable';
const HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
};

function configured(env) {
  return typeof env.APP_PASSWORD === 'string' && env.APP_PASSWORD.length >= 16
    && typeof env.APP_SESSION_SECRET === 'string' && env.APP_SESSION_SECRET.length >= 32;
}

function equal(a, b) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

function signature(payload, env) {
  // Rotating either the password or session secret invalidates existing sessions.
  const key = createHmac('sha256', env.APP_SESSION_SECRET).update(env.APP_PASSWORD).digest();
  return createHmac('sha256', key).update(payload).digest('base64url');
}

export function createSession(env, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ expires: now + SESSION_SECONDS * 1000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${payload}.${signature(payload, env)}`;
}

export function isAuthenticated(request, env, now = Date.now()) {
  if (!configured(env)) return false;
  const cookie = (request.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
  if (!cookie) return false;
  const token = cookie.slice(COOKIE.length + 1);
  if (token.length > 512) return false;
  const [payload, supplied, extra] = token.split('.');
  if (!payload || !supplied || extra || !equal(signature(payload, env), supplied)) return false;
  try {
    const { expires } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Number.isFinite(expires) && expires > now && expires <= now + SESSION_SECONDS * 1000;
  } catch { return false; }
}

function escape(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function returnPath(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
  const parsed = new URL(value, 'https://household.invalid');
  if (parsed.origin !== 'https://household.invalid' || parsed.pathname.startsWith('/auth/')) return '/';
  return parsed.pathname + parsed.search;
}

function response(body, status, headers = {}) {
  return new Response(body, { status, headers: { ...HEADERS, ...headers } });
}

function loginPage(path, error = false) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · The Weekly Table</title><style>
  *{box-sizing:border-box}body{margin:0;background:#faf3e8;color:#2a2420;font:16px system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center;padding:24px}main{width:100%;max-width:420px;background:white;padding:32px;border-radius:20px;box-shadow:0 12px 40px #2a242015}h1{font:600 32px Georgia,serif;margin:0 0 12px}p{color:#6b5f54;line-height:1.5}label{display:block;font-weight:600;margin-top:24px}input{width:100%;padding:13px;margin:8px 0 16px;border:1px solid #b5baa8;border-radius:8px;font:inherit}button{width:100%;padding:13px;border:0;border-radius:8px;background:#6e7a47;color:white;font:600 16px system-ui;cursor:pointer}.error{color:#a23222}small{display:block;color:#6b5f54;margin-top:16px}
  </style></head><body><main><h1>The Weekly Table</h1><p>Your household's recipes and weekly dinners. Enter your shared password to continue.</p>
  ${error ? '<p class="error" role="alert">That password wasn’t recognised. Try again.</p>' : ''}
  <form action="/auth/login" method="post"><input type="hidden" name="returnTo" value="${escape(path)}"><label for="password">Household password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024" autofocus><button type="submit">Sign in</button></form><small>You’ll stay signed in on this device for up to 30 days.</small></main></body></html>`;
  return response(html, error ? 401 : 200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  });
}

// null means the request may proceed. This also protects API routes and assets.
export async function protectRequest(request, env = process.env) {
  if (!configured(env)) return response('Private access is not configured. Set the household password and session secret before deploying.', 503);
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/auth/login' && request.method === 'GET') return loginPage(returnPath(url.searchParams.get('returnTo')));
  if (path === '/auth/login' || path === '/auth/logout') {
    if (request.method !== 'POST') return response('Method not allowed', 405, { Allow: 'POST' });
    if (request.headers.get('origin') !== url.origin) return response('Request origin rejected', 403);
    if (path === '/auth/logout') return response(null, 303, {
      Location: '/auth/login', 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    });
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return response('Unsupported login form', 415);
    if (Number(request.headers.get('content-length') || 0) > 4096) return response('Login form too large', 413);
    const body = await request.text();
    if (Buffer.byteLength(body) > 4096) return response('Login form too large', 413);
    const form = new URLSearchParams(body);
    const target = returnPath(form.get('returnTo'));
    const hash = (value) => createHash('sha256').update(value).digest('hex');
    if (!equal(hash(form.get('password') || ''), hash(env.APP_PASSWORD))) return loginPage(target, true);
    return response(null, 303, {
      Location: target,
      'Set-Cookie': `${COOKIE}=${createSession(env)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`,
    });
  }
  if (isAuthenticated(request, env)) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('origin') !== url.origin) return response('Request origin rejected', 403);
    return null;
  }
  if (path.startsWith('/api/')) return response(JSON.stringify({ error: 'Sign in required' }), 401, { 'Content-Type': 'application/json' });
  return response(null, 303, { Location: `/auth/login?returnTo=${encodeURIComponent(returnPath(path + url.search))}` });
}
