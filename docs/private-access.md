# Household password and weekly recipe cards

The new `/week` page keeps selected recipe cards together, separates meals still
to cook from completed meals, and offers cooked ticks and an explicit new-week reset.
Existing selections migrate automatically. Menus and completion are stored in
each browser's local storage; they do not sync across phones or computers.

## Enable shared-password access on Vercel

Before deploying this version, open the **fd-meal-planner** project in Vercel,
then **Settings → Environment Variables**. Add both variables to **Production**
and **Preview**:

| Variable | Value |
| --- | --- |
| `APP_PASSWORD` | A new shared household password, at least 16 characters. Prefer a password-manager-generated random password or a long random-word passphrase. |
| `APP_SESSION_SECRET` | A separate password-manager-generated random secret, at least 32 characters. This signs login sessions; you do not type it when signing in. |

Do not prefix either variable with `VITE_`. Do not put real values in GitHub or
send them through chat. Store the shared password in your household password manager.
Deploy the latest commit after adding the variables; environment changes require
a new deployment. This version intentionally returns 503 when either variable is
missing or too short, rather than accidentally leaving the app public.

The gate runs as Vercel Routing Middleware (`app/proxy.js`, configured in
`app/vercel.json`) before pages, assets and API routes. A signed session cookie
is Secure, HttpOnly, SameSite=Strict and expires after 30 days. Sign out clears
the cookie. Rotating either server variable invalidates all existing sessions.
This provides shared-password access: anyone who knows the password has access;
there are no separate user identities.

Local `npm run dev` and Vite's standalone preview do not run Vercel middleware.
They are for development, not private production hosting. Do not expose those
servers publicly. The production gate requires Vercel.

## Verify the deployment before adding grocery credentials

1. In a private browser window, confirm `/`, `/week`, `/recipe/asi-tofu-curry`,
   `/data/recipes.json` and an `/images/*.webp` URL require sign-in.
2. Try a wrong password, then the correct password; check that the weekly page
   loads. Sign out and confirm it requires the password again.
3. Confirm unauthenticated `/api/basket` requests return 401. Apply this check
   to every real API endpoint when those are added.
4. Add a Vercel Firewall rate-limit rule for POST `/auth/login` to limit password
   guessing. The code does not claim to provide a distributed rate limiter.

## Pepesto

Keep a future `PEPESTO_API_KEY` only in Vercel server environment variables. The
browser should call an authenticated app endpoint such as `/api/basket`; that
endpoint calls Pepesto on the server. It must verify the session itself with
`isAuthenticated`/`protectRequest`, validate the ingredient payload and enforce
same-origin requests, even though the routing middleware also gates it. Never
accept arbitrary provider URLs or expose the key in browser code or responses.

No Pepesto credentials or live grocery endpoint have been added in this change.
The GitHub repository and its raw recipe/photo URLs remain public independently
of the app's password. Making the repository private is a separate change; if
done later, serve the bundled recipes/photos rather than fetching unauthenticated
GitHub raw URLs. A private repository is not required to keep server-only secrets
private.

Vercel's built-in password protection is a paid option on Pro and unavailable on
Hobby; this application gate uses Routing Middleware, which is available on all
plans. Sources checked 12 October 2026:

- https://vercel.com/docs/routing-middleware
- https://vercel.com/docs/deployment-protection
