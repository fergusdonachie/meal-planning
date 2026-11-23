# Household access and weekly recipe cards

The home page opens the weekly menu at `/week`; the bank lives at `/recipes`.
Plans use Monday–Sunday weeks in Europe/London, offer four or five varied suggested
dinners, and allow individual uncooked meals to be swapped. Suggestions avoid the
previous week's chosen recipes when possible. Each week is stored separately;
clearing or replacing a menu does not change other weeks. Existing selections
migrate into the current week on first use.

Recipe cards offer a focused cooking mode (`?cook=1`), ingredient preparation
ticks, one step at a time, previous/next controls and a cooked button on the final
step. Cooking progress is saved per recipe and week. Screen wake lock is optional
and browser-dependent; it is released when leaving the cooking card. Full recipe
cards can also be printed.

Menus, cooked ticks and cooking progress are stored locally per browser. They do
not yet sync across phones or computers. Signing into the same household does
not itself provide data synchronisation.

## Password-free household access (ready to configure)

The app supports email sign-in links with Supabase Auth. Activation is deliberately
separate from deployment: until `APP_AUTH_MODE=email` is configured, the existing
password gate remains active. Email mode never falls back to a password or public
access when its settings are missing. Existing password cookies are rejected
once email mode is enabled.

The household allowlist lives only in server environment variables. Both sending
a link and creating a session require an approved address; a confirmed provider
identity is required at verification. Links are verified and consumed by Supabase,
not by trusting an email supplied by the browser. The app stores only its own
signed HttpOnly session cookie, valid for up to 90 days. Provider access and refresh
tokens are not stored in browser storage. Removing an allowed email or rotating
`APP_SESSION_SECRET` revokes existing email sessions on the next request.

### Setup before activation

1. Create a Supabase project. Enable its email authentication provider. Set its
   **Site URL** to `https://fd-meal-planner.vercel.app` (no trailing slash).
2. Add the two household users as confirmed users in Supabase Auth. The app sends
   OTP requests with `create_user: false`, so it never signs up new people.
   Disable public user sign-ups in Supabase. Use the dashboard's Add User flow or
   its server-only admin API; the household will never type a password into this app.
3. Configure a working SMTP sender in Supabase, and verify delivery to both
   approved addresses. Supabase's default email sender restricts recipients and
   is unsuitable as a general production delivery service. Never put SMTP secrets
   in this repository or the frontend.
4. In **Authentication → Email Templates → Magic Link**, use this link:

   ```html
   <h2>Your household table</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Open The Weekly Table</a></p>
   ```

   Set an appropriate short OTP expiry, such as 15 minutes. Disable email-provider
   click tracking, which can rewrite sign-in links. The app displays a confirmation
   button before consuming the link, so a mail scanner's GET does not sign anyone in.
5. Configure these server-only Vercel variables for the intended deployment:

   | Variable | Value |
   | --- | --- |
   | `APP_ALLOWED_EMAILS` | The two approved addresses, separated by a comma. No addresses are committed to GitHub. |
   | `SUPABASE_URL` | The project's HTTPS base URL. |
   | `SUPABASE_ANON_KEY` | Its public legacy anon key, used by the server for Auth requests. A service-role key is not needed by the app. |
   | `APP_SESSION_SECRET` | Keep the existing independent secret of at least 32 characters, or rotate it to revoke all sessions. |
   | `APP_AUTH_MODE` | Set to `email` only when the provider and delivery tests are ready. |

6. Add Vercel Firewall rate limits to POST `/auth/login` and `/auth/confirm` to
   complement Supabase's Auth rate limits. The app does not use an in-memory rate
   limiter that would reset across Vercel instances. Unknown addresses receive
   the same response and trigger no outbound email. Login responses do not reveal
   household membership, provider errors or secrets.
7. Redeploy and verify an email can sign in on each phone. Confirm that a reused
   link is rejected, unknown addresses cannot sign in, private pages and images
   redirect without a session, and Sign out clears access. Keep the old password
   settings until the migration succeeds; they are ignored in email mode.

Live email delivery cannot be tested until this project and its sender are
configured. Local tests mock provider responses and cover verification, allowlist
checks, sessions, revocation, CSRF, expired links and fail-closed behaviour.
Local Vite development does not run this production access middleware.

Sources checked 23 November 2026:

- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/rate-limits

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
