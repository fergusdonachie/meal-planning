# Meal Planning

A recipe bank for weekly menu and grocery planning: fresh, from-scratch dinners across Mediterranean, Persian, Asian and Mexican cooking. Built to avoid ultra-processed ingredients, work fish into the week, and keep meals from being overly calorific.

**Artifact version:** https://claude.ai/artifact/4ejpna7hWbZWaiNzRhCRAj

## Contents

- `app/` — a React + Vite app with recipe photos, a detail page per recipe, and the same filtering/shopping-list features. Fetches `data/recipes.json` (and images) directly from GitHub at runtime — see `app/README.md`. Deploy this to Vercel.
- `site/index.html` — the original self-contained interactive recipe bank (no photos): filter by cuisine, protein, and time; expand any card for ingredients and method; select meals to build a shopping list. No build step — open it directly in a browser, or it's what's published as the Claude Artifact above.
- `data/recipes.json` — the source of truth for all 36 recipes as structured data (see schema below).
- `images/` — 36 compressed WebP recipe photos, one per recipe named after its `id`. Final generation prompts are in `images/prompts.json`. Used by `app/`; the static `site/` page does not show photos.
- `scripts/sync_recipes.py` — validates recipe data and updates the standalone page.
- `docs/morrisons.md` — basket integration research and next prototype requirements.

## Recipe mix

- 36 recipes: 12 fish, 11 chicken, 4 red meat, 9 vegetarian
- Mostly 20–40 minutes (one existing traybake takes 55 minutes), 380–600 kcal per serving, serves 2 — each recipe is a full plate (protein + carb/starch + vegetables), not just the protein component
- Fresh aromatics and homemade curry bases, with plain tinned beans/tomatoes/tuna and simple pantry staples. Choose products with short ingredient lists; no stock cubes or ready-made Thai curry paste.
- Every recipe has an AI-generated illustrative photo, labelled in the app. Calories are approximate per serving.
- Morrisons shopping handoff: combine recipe ingredients into an overall list, exclude ingredients already in your kitchen, copy/share the list, then open the shop. Automatic basket transfer is not connected; see `docs/morrisons.md`.

## Recipe data schema (`data/recipes.json`)

Each recipe is an object with:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, also used for the recipe's URL in `app/` and its image filename |
| `cuisine` | string | `Mediterranean` \| `Persian` \| `Asian` \| `Mexican` |
| `protein` | string | `Chicken` \| `Fish` \| `Red meat` \| `Vegetarian` |
| `fish` | boolean | Redundant with `protein` but kept for fast filtering |
| `title` | string | |
| `blurb` | string | One-line description shown on cards |
| `image` | string | Relative path under the repo root, e.g. `images/med-chicken-traybake.webp`; the app falls back to a styled placeholder if missing |
| `imageSource` | string | `ai` labels generated illustrations; omit for real photos |
| `time` | number | Minutes |
| `kcal` | number | Per serving |
| `servings` | number | Currently `2` for every recipe |
| `spice` | number | `0`–`2` |
| `tags` | string[] | e.g. `["One-pan"]` |
| `ingredients` | string[] | Quantities for `servings` people |
| `method` | string[] | Ordered steps |

## Adding or updating recipes

1. Edit `data/recipes.json` (add a new object to the array, or change an existing one — it must stay valid JSON).
2. Optionally drop a photo into `images/<id>.jpg` (jpg/png/webp all work — just match the `image` field's extension).
3. Run `python3 scripts/sync_recipes.py` to update the standalone page; `python3 scripts/sync_recipes.py --check` verifies alignment and the data.
4. Push to GitHub. The deployed app checks GitHub for published updates on page load. Local development reads the working tree, and each build also includes a fallback copy of recipes and photos. App code changes require a redeploy.

## Deploying `app/` to Vercel

The repo must be **public** — `app/` fetches `data/recipes.json` and images from `raw.githubusercontent.com` client-side, which only works unauthenticated for public repos.

In Vercel: New Project → import this repo → set **Root Directory** to `app` → deploy (Vite is auto-detected; build command `npm run build`, output `dist`). See `app/README.md` for local dev and configuration (e.g. pointing at a fork).
