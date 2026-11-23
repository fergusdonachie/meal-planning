# The Weekly Table — Morrisons companion v0.4

A Chrome/Edge side panel for shopping one ingredient at a time.

## Install or update

1. Download the extension ZIP from The Weekly Table shopping list and extract it.
2. In Chrome, open chrome://extensions (Edge: edge://extensions).
3. Turn on Developer mode, choose Load unpacked, and select the folder containing
   manifest.json. Keep this folder; the browser loads the extension from it.
4. Pin The Weekly Table from the browser's Extensions menu and click its icon.

To update an existing installation, replace the files in its original folder with
those from the new ZIP, then click Reload on its card on the extensions page.
Reload the meal-planner and Morrisons tabs too. Version 0.4 should appear on the
extension card. Imported progress stays in this browser; old batch jobs do not run.

Use Chrome 116 or newer, or an up-to-date Edge on a laptop or desktop.
This package is not an iPhone or Safari extension.

## Shop your week

1. In https://fd-meal-planner.vercel.app/ choose your meals and open Shopping list.
2. Tick ingredients you already have. Select Morrisons as your supermarket and
   click Send to Morrisons extension. Only the ingredients still needed are sent.
   If sending is unavailable, use Download list instead and import the JSON file
   through List tools & help in the extension.
3. Open the extension from its toolbar icon. Your full list and progress appear.
   Sign into Morrisons normally and choose your delivery details.
4. The first ingredient has a suggested search term. Edit it if needed and click
   Search Morrisons. Only that search opens; its currently loaded products appear
   in the panel automatically. There is no whole-list scan or waiting for a
   proposed basket.
5. Choose a product and check its pack size. Use Add 1 pack in the extension or
   add it directly on the open Morrisons page. Each extension click adds just one
   pack. Where quantities can be compared, a pack-count guide is shown.
6. Check the basket quantity, then click Added it — next item. The previous
   ingredient is checked off, and the next unfinished ingredient is searched
   automatically. You can edit its search and search again for alternatives.
7. Skip for now moves on without checking an ingredient off. Skipped ingredients
   come round again before the list can be complete. Click an ingredient in the
   list to return to it; clicking a finished ingredient reopens it for shopping.
8. When the list is complete, review the Morrisons basket, quantities, delivery
   details and total before completing your order yourself.

## Products and progress

- The panel reads products already loaded on the current Morrisons page. Scroll
  Morrisons and choose Refresh products from the open page to see more options.
  It does not scroll through or preload the entire catalogue.
- A basket click is checked against the exact product's on-page quantity counter.
  If Morrisons does not confirm the change, the extension asks you to check; it
  never automatically retries an uncertain click or checks an ingredient off.
- Next is your confirmation that you have finished shopping for that ingredient,
  whether you added it in the panel or on Morrisons. Pack guides are estimates;
  they do not account for products you already have in the basket.
- List progress and edited search terms survive closing the panel. Reopening
  does not start searches or basket actions. Importing a new list resets progress.
- If a page changes, old product actions are cleared. Search again or refresh
  from the page you want to use. Sign-in, cookie prompts and delivery-specific
  availability may need attention in Morrisons itself.

## Privacy and permissions

The imported ingredients, checklist and search terms stay in chrome.storage.local
in this browser. They do not sync between devices. The extension never asks for
or stores your Morrisons password or cookies.

Access is limited to groceries.morrisons.com and fd-meal-planner.vercel.app.
The extension receives only the list deliberately sent from the meal planner,
reads product cards/public Product structured data, and uses visible basket
controls following your clicks. It does not use private grocery APIs or handle
checkout or payment. Website product text is rendered as text, not executable HTML.

## Development and verification

- npm ci --prefix extension
- npm test --prefix extension
- python3 scripts/package_extension.py

Tests cover import/export, one-ingredient searches, edited queries, Next/Skip,
completion/resume, stale results after a new import, exact product controls,
uncertain basket updates and unavailable products. The reader uses a fixture of
Morrisons search-results HTML. A logged-in delivery basket still needs a manual
trial after installation; live Morrisons selector changes may need updates.

The package contains only the extension's runtime files and this guide.
