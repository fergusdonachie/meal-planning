# The Weekly Table — app

React + Vite frontend for the meal-planning recipe bank. Shows recipe photos and a detail page per recipe, on top of the same filtering and shopping-list features as `site/index.html`.

## How data flows

There's no backend. Local development serves `../data/recipes.json` and `../images/` directly, so unpublished changes are visible. Builds bundle a snapshot of both. In production, on page load, the app fetches `data/recipes.json` straight from GitHub (`raw.githubusercontent.com/<owner>/<repo>/<branch>/data/recipes.json`, see `src/lib/github.js`), and each recipe's photo the same way from its `image` path. That means:

- Editing `data/recipes.json` (or adding a photo to `images/`) on GitHub and pushing is enough — no redeploy of the Vercel app required.
- The GitHub repo must be **public**, since the fetch is unauthenticated client-side (no token can safely live in the browser bundle).
- If GitHub cannot serve the recipe data or photo, the app tries its bundled snapshot. A recipe with no matching file at its `image` path then shows a cuisine-colored placeholder (see `src/components/RecipeImage.jsx`) — photos can be added gradually.

## Local development

```bash
npm install
npm run dev
```

Production points at `fergusdonachie/meal-planning@main`. To point production at a fork or a branch, copy `.env.example` to `.env` and set `VITE_GITHUB_OWNER` / `VITE_GITHUB_REPO` / `VITE_GITHUB_BRANCH`.

## Weekly cooking and private household access

`/week` shows your selected recipe cards, cooked ticks, cooking progress, and a
new-week reset. Plans are saved locally in each browser; shared passwords do not
sync a household menu between devices.

Production is gated by server-side shared-password authentication. Before
deploying, configure `APP_PASSWORD` and `APP_SESSION_SECRET` in Vercel for both
Production and Preview. See `../docs/private-access.md` for the full setup and
verification steps. Missing configuration blocks access. Local Vite development
does not run the Vercel password gate. Pepesto is not connected yet.

## Morrisons desktop browser companion

The shopping modal can send its combined, pantry-filtered ingredient list to the
Chrome/Edge companion in `../extension/`. It reads current Morrisons product cards,
saves preferred products and offers both a reviewed one-pack Add action and a
whole-list batch. The batch uses saved products and reviewed pack targets, accounts
for existing basket quantities, and pauses on missing products or uncertain updates. It does not
perform checkout or require Pepesto. The ZIP and guide are served under
`/downloads/`, behind the app password. See `../extension/README.md` for install
steps and current limitations. Package changes with
`python3 scripts/package_extension.py` before building or deploying.

## Shopping and photos

The shopping modal saves pantry exclusions and offers copy/share controls plus a link to Morrisons. It does not add products to a retailer basket. See `../docs/morrisons.md` for the integration research. The shopping list opens in a combined view, adding repeated ingredients and converting compatible metric/spoon units. It groups items into supermarket sections (produce, meat, fish, dairy, bakery, frozen and cupboard staples); copy/share includes the same section headings. This is a general supermarket order, not the exact layout of a particular Morrisons store. A By recipe view preserves the original breakdown. Different measures are shown together without converting weight to volume; alternatives and unclear quantities remain explicit. Copy/share follows the selected view, and pantry exclusions apply to both.

All current photos are generated illustrations labelled in the UI. Their prompts are in `../images/prompts.json`. Calories are estimates.

Checks: `npm run lint`, `npm test`, `npm run build`, and from the repository root `python3 scripts/sync_recipes.py --check`.

## Deploying to Vercel

1. New Project → import the `meal-planning` repo.
2. Set **Root Directory** to `app`.
3. Leave the framework preset on Vite (build command `npm run build`, output directory `dist`) — Vercel auto-detects this.
4. Deploy. `vercel.json` in this folder adds the SPA rewrite so direct links to `/recipe/<id>` work.

No environment variables are required unless you've forked the repo (see above).

## Structure

```
src/
  lib/github.js          Raw GitHub URL builders
  lib/constants.js        Cuisine colors, filter option lists
  hooks/useRecipes.js      Fetches & holds the recipe list
  context/ShoppingContext.jsx   Selected-meals state, persisted to localStorage
  components/              RecipeCard, RecipeImage (with placeholder fallback), FilterBar, ShoppingBar, ShoppingListModal, SpiceDots
  pages/Home.jsx            Grid + filters
  pages/RecipeDetail.jsx    Full recipe view at /recipe/:id
```
