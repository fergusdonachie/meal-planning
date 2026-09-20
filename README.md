# Meal Planning

A recipe bank for weekly menu and grocery planning: fresh, from-scratch dinners across Mediterranean, Persian, Asian and Mexican cooking. Built to avoid ultra-processed ingredients, work fish into the week, and keep meals from being overly calorific.

**Live version:** https://claude.ai/artifact/4ejpna7hWbZWaiNzRhCRAj

## Contents

- `site/index.html` — the interactive recipe bank: filter by cuisine, protein, and time; expand any card for ingredients and method; select meals to build an aggregated shopping list (saved in the browser). Self-contained, no build step — open it directly in a browser.
- `data/recipes.json` — the same 24 recipes as structured data (title, cuisine, protein, fish flag, time, calories, spice level, ingredients, method), for reuse outside the HTML page (scripts, other tools, future additions).

## Recipe mix

- 24 recipes: 8 fish, 7 chicken, 4 red meat, 5 vegetarian
- Mostly 20–35 minutes, 320–520 kcal per serving (serves 2)
- No ultra-processed ingredients — tinned beans/tomatoes/tuna and good pantry staples only, no jarred sauces or stock cubes

## Updating recipes

Edit `data/recipes.json` as the source of truth, then mirror any change into the `RECIPES` array in `site/index.html` (the page embeds its data inline so it works as a standalone file/artifact).
