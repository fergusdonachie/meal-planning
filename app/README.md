# The Weekly Table — app

React + Vite frontend for the meal-planning recipe bank. Shows recipe photos and a detail page per recipe, on top of the same filtering and shopping-list features as `site/index.html`.

## How data flows

There's no backend and no build-time data fetch. On page load, the app fetches `data/recipes.json` straight from GitHub (`raw.githubusercontent.com/<owner>/<repo>/<branch>/data/recipes.json`, see `src/lib/github.js`), and each recipe's photo the same way from its `image` path. That means:

- Editing `data/recipes.json` (or adding a photo to `images/`) on GitHub and pushing is enough — no redeploy of the Vercel app required.
- The GitHub repo must be **public**, since the fetch is unauthenticated client-side (no token can safely live in the browser bundle).
- A recipe with no matching file at its `image` path just shows a cuisine-colored placeholder (see `src/components/RecipeImage.jsx`) — photos can be added gradually.

## Local development

```bash
npm install
npm run dev
```

By default this points at `fergusdonachie/meal-planning@main`. To point at a fork or a branch (e.g. to preview data changes before merging), copy `.env.example` to `.env` and set `VITE_GITHUB_OWNER` / `VITE_GITHUB_REPO` / `VITE_GITHUB_BRANCH`.

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
