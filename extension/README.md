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
4. Click Find products for the whole list. Keep the new Morrisons tab selected.
   The companion searches every unchecked ingredient, scrolls the results, and
   retains products even if the website removes cards that move off screen.
5. Review the proposed basket once. Each ingredient has a proposed product,
   pack count and alternative matches in a dropdown. Saved choices are preferred
   when still compatible and available. Otherwise the matcher favours measurable
   packs and economical totals, excluding obvious prepared-food mismatches.
6. Check any estimated pack counts: counts versus weights, bunches and other
   unclear measures cannot always be converted. Missing matches require a manual
   choice or adjusted search. This is a rule-based matcher, not a guarantee of
   dietary suitability; inspect product details when necessary.
7. Click Add the reviewed proposed basket. A dedicated Morrisons tab searches
   each chosen product and adds enough packs to meet the reviewed totals.
8. Check the full Morrisons trolley, quantities and total, then complete your
   delivery order yourself. The extension does not book slots or handle payment.

## Batch behaviour (version 0.3)

- Products are found automatically; saving a choice for every ingredient first is
  no longer required. Review saved choices only remains an optional shortcut.
- Duplicate choices become one product line. Comparable quantities are combined
  before rounding up (600g plus 300g of the same 1kg product needs one pack).
  Manually edited pack counts are respected and summed.
- Existing basket packs count towards the reviewed total. Extra existing packs
  stay in place. The companion never removes products.
- Each Add or increment click must be confirmed by the product counter settling
  before the next pack is requested. Missing products, changed sizes, disabled
  controls and uncertain updates pause the batch. An uncertain click is never
  automatically repeated: inspect the trolley, acknowledge the check, and Resume.
- Pause stops before the next click after any current quantity check finishes.
  Switching tabs requests a pause. Closing/reloading the panel preserves an
  approved batch, but never auto-resumes. Unapproved matching proposals are not
  saved; run matching again if you close the panel before approving them.
- A search scan is bounded to 30 scrolls or 20 seconds, with a notice when that
  limit is reached. It does not guarantee discovery of every catalogue result.
  Product lookup for adding also scrolls until the chosen card is found.
- For a manual choice, select an ingredient, Search, then Read products on this
  page. This reader now scrolls too. Use this product saves a preference; rerun
  whole-list matching to include that choice. Add 1 pack still requests a single
  click and requires checking Morrisons for confirmation.

The sequential workflow has local tests, but the new automatic matching and
scrolling flow still needs an end-to-end trial in your logged-in delivery basket.
Morrisons errors, login prompts, stock limits and substitutions may need attention.

## What has been tested

The product reader is tested against a small fixture captured from Morrisons'
public search-results HTML on 12 October 2026. Import/export, quantity guides,
unknown/unavailable states, exact-product targeting, batch interruption/recovery, existing basket quantities
scrolling with virtualised cards, automatic matching, combined pack counts
and one-click acknowledgement are
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
cards and Product JSON-LD during a requested read, matching pass or approved basket batch. It does not read
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

The package script copies only the ten runtime files and these instructions
into the ZIP. Development dependencies and test fixtures are not included.

References:
- https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar
