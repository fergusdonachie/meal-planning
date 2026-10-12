# Morrisons delivery integration

Research checked 12 October 2026.

The app currently lets you exclude pantry ingredients, copy or share the remaining
list, and open https://groceries.morrisons.com/. It does not transfer ingredients
to a basket. The combined view totals repeated ingredients and converts compatible units.
Different measures remain visible together, alternatives and unclear amounts remain
explicit, and a By recipe view retains the original breakdown. Choose suitable
pack sizes in Morrisons.

An iOS or desktop app would not automatically gain access to the Morrisons app's
basket. Keep the React web app while testing an integration route.

## Routes worth validating

- Samsung Food's published UK store list includes Tesco and Sainsbury's but not
  Morrisons: https://support.samsungfood.com/hc/en-us/articles/360042706091-Integrated-Stores
- Whisk's API introduction says it is not accepting new API clients:
  https://docs.whisk.com/api-overview/introduction
- Pepesto advertises Morrisons product data and a `/oneshot` basket-creation flow:
  https://www.pepesto.com/supermarkets/morrisons/ and
  https://www.pepesto.com/built-with-pepesto/morrisons/
  These are the provider's claims, not an integration verified by this project.
  Its product-data page describes using publicly listed pages rather than a
  special retailer agreement. API access requires an account/key and may cost money.

## Next prototype

Validate one small ingredient list through the provider before building an app
integration. Confirm that the resulting link opens a real Morrisons delivery basket,
how login works, which products are matched, pack quantities, availability for the
delivery address, pricing, charges and whether the flow supports an existing basket.

If successful, use a server endpoint for provider calls, with credentials held only
on the server. Let users review matched products and quantities before transferring
them; leave delivery-slot selection and checkout in Morrisons.

Structured ingredients (name, amount, unit, preparation and pantry status) would
make aggregation more comprehensive and support product matching. The current ingredient strings
include alternatives, tins and approximate measures that should not be merged
blindly. A browser extension is another possible personal-use route, but would
depend on Morrisons' changing website and need continuing maintenance.
