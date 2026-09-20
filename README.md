# Meal Planning

A recipe bank for weekly menu and grocery planning: fresh, from-scratch dinners across Mediterranean, Persian, Asian and Mexican cooking. Built to avoid ultra-processed ingredients, work fish into the week, and keep meals from being overly calorific.

**Artifact version:** https://claude.ai/artifact/4ejpna7hWbZWaiNzRhCRAj

## Contents

- `app/` — a React + Vite app with recipe photos, a detail page per recipe, and the same filtering/shopping-list features. Fetches `data/recipes.json` (and images) directly from GitHub at runtime — see `app/README.md`. Deploy this to Vercel.
- `site/index.html` — the original self-contained interactive recipe bank (no photos): filter by cuisine, protein, and time; expand any card for ingredients and method; select meals to build a shopping list. No build step — open it directly in a browser, or it's what's published as the Claude Artifact above.
- `data/recipes.json` — the source of truth for all 24 recipes as structured data (see schema below).
- `images/` — recipe photos, one per recipe named after its `id` (e.g. `med-chicken-traybake.jpg`). Used by `app/`; the static `site/` page doesn't show photos.

## Recipe mix

- 24 recipes: 8 fish, 7 chicken, 4 red meat, 5 vegetarian
- Mostly 15–45 minutes, 380–600 kcal per serving, serves 2 — each recipe is a full plate (protein + carb/starch + vegetables), not just the protein component
- No ultra-processed ingredients — tinned beans/tomatoes/tuna and good pantry staples only, no jarred sauces or stock cubes

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
| `image` | string | Relative path under the repo root, e.g. `images/med-chicken-traybake.jpg` — doesn't need to exist yet; the app falls back to a styled placeholder |
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
3. Push to GitHub. `app/` (once deployed) picks up the change on next page load, no redeploy needed. `site/index.html` embeds its data inline, so mirror ingredient/method/etc. changes into the `RECIPES` array there too if you want the static page to match — the `image` and `servings` fields aren't used by `site/` and don't need mirroring.

## Deploying `app/` to Vercel

The repo must be **public** — `app/` fetches `data/recipes.json` and images from `raw.githubusercontent.com` client-side, which only works unauthenticated for public repos.

In Vercel: New Project → import this repo → set **Root Directory** to `app` → deploy (Vite is auto-detected; build command `npm run build`, output `dist`). See `app/README.md` for local dev and configuration (e.g. pointing at a fork).
