# The Weekly Table — Morrisons browser companion

A private-use Chrome/Edge Manifest V3 side-panel extension. It works alongside
Morrisons in your own browser, with no Pepesto account or grocery API charges.

## Install on your laptop or PC

1. Download the extension ZIP from the shopping list in The Weekly Table and
   extract it. Keep the extracted folder; the browser loads files from it.
2. In Chrome, open chrome://extensions (in Edge, edge://extensions).
3. Turn on Developer mode. Choose Load unpacked and select the extracted folder
   that contains manifest.json.
4. Pin The Weekly Table companion from your browser's Extensions menu. Click its
   toolbar icon to open the shopping side panel.

Use an up-to-date Chrome or Edge browser. Chrome requires version 116 or newer.
This package is for a desktop browser; it is not an iPhone extension.

## Shop a week

1. Sign into https://fd-meal-planner.vercel.app/ on the same browser. Choose meals,
   open the shopping list, and untick ingredients already in your kitchen.
2. Click Send to Morrisons extension. If the extension was just installed or
   updated, reload the meal-planner page first. Alternatively, download the
   shopping-list JSON file and use Import shopping-list file in the side panel.
3. Log into Morrisons as usual and select your delivery address and slot. The
   companion never asks for or stores your Morrisons password or session cookies.
4. Select an ingredient in the companion, edit the search words if necessary,
   and click Search. Morrisons opens its normal results page.
5. Click Read products on this page after the results have loaded. You will see
   product names (including brands when present in the name), pack sizes, prices,
   offers and whether a supported Add button is available on that page.
6. Click Use this product to remember a preferred product for that ingredient.
   The saved choice is a dated snapshot. Find saved product opens a new search;
   refresh to read its current price and availability.
7. Review the product and quantity. Add 1 pack in Morrisons requests exactly one
   click on that product's enabled Add button. Check the Morrisons page/basket for
   login prompts and confirmation. Choose any additional quantity using Morrisons'
   own controls, then tick the ingredient off in the companion.
8. Complete your delivery order directly in Morrisons. The extension does not
   book slots, place orders, handle payment or run a bulk add/checkout loop.

## What has been tested

The product reader is tested against a small fixture captured from Morrisons'
public search-results HTML on 12 October 2026. Import/export, quantity guides,
unknown/unavailable states, exact-product targeting and one-click behaviour are
also covered by local tests. It has not yet been tested end-to-end in an installed
browser extension against a logged-in household delivery basket.

Product detail pages may expose public Product structured data, which the reader
can also read. Their Add buttons are not automated in this first version. If no
supported cards are found, use a search-results page or Morrisons' own controls.

“Add available” is a signal from the current page, not a guarantee of stock for a
future delivery. A disabled or missing Add button is shown as unknown, unless
Morrisons explicitly shows an unavailable message. Select your address/slot in
Morrisons before relying on its results. It may still substitute items at delivery.

## Storage and permissions

The imported ingredient list, chosen product snapshots and checklist are stored
in chrome.storage.local on this browser. Imports reset the checklist, but keep
product preferences. Nothing syncs between devices.

Access is limited to groceries.morrisons.com and fd-meal-planner.vercel.app. The
extension imports only the ingredient list you deliberately send. It reads product
cards and Product JSON-LD on a page when you press Read products. It does not read
account details, intercept requests, query undocumented APIs, export cookies or
send data to a third-party API. The side panel renders website text as text rather
than executable markup.

Site changes may require a selector update. To update an unpacked extension,
replace its files, press Reload on the browser's extensions page, and reload the
meal-planner and Morrisons tabs. Keep a manual shopping-list fallback available.

## Development

- npm ci --prefix extension
- npm test --prefix extension
- python3 scripts/package_extension.py

The package script copies only the eight runtime files and these instructions
into the ZIP. Development dependencies and test fixtures are not included.

References:
- https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar
