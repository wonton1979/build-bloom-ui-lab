# Colorful Life catalogue UI

One persistent BookShell stays on the existing tabletop. Local React state swaps
content slots between opening, category, product and minimal product-detail
spreads. Category and product pagination share PageTurn, transition locking,
reduced-motion handling and focus/scroll reset. No router is added.

Category labels, order, artwork and provisional same-origin destinations live in
`src/components/catalogue/categories.ts`. Vehicles opens products inside the
book; other category destinations await integration. Physical book geometry,
category artwork and opening/closing mechanics remain unchanged.

## Development

`npm install`, then `npm run dev`.

Vite proxies /api to http://localhost:3000. Deployments can set
VITE_API_BASE_URL or provide a reverse proxy for /api.

## Storefront catalogue contract

The storefront consumes one catalogue item per LegoProduct from
`GET /products?categoryId=<id>&page=<page>&pageSize=100` and search results from
`GET /products?q=<query>&page=<page>&pageSize=<size>`. It reads every category
page independently of visual spread capacity.

Backend Issue #118 moved shared presentation to the LegoProduct root. The
response is `{ items, pagination }`; each product contains:

- product identity, category, `isRetired`, `isFeatureProduct`,
  `catalogueArtworkUrl`, `catalogueArtworkPublicId`, and `productImages`;
- an `offers` array containing ProductListing IDs, condition, lifecycle, price,
  stock, active state, `damageDescription`, and listing-specific
  `usedConditionPhotos`.

Product Images, Catalogue Artwork, Feature state, and retirement state are never
copied into offers. A product is customer-visible when it has an active,
in-stock offer in an available lifecycle. Card and leaflet pricing use only
those sellable offers. Storage public IDs never construct delivery URLs.

### Catalogue and product details

`src/features/catalogue/productSpreads.ts` plans one card per LegoProduct in API
order. Sibling NEW and damaged-box offers never become separate cards.

- With a Feature: spread 0 has that Feature left and up to two Standards right.
- Subsequent spreads have up to four Standards: two left, then two right.
- With no Feature: Standard-only spreads of up to four start at spread 0;
  a Standard is never promoted to Feature.
- Malformed multiple Features: the first flagged listing in deterministic order
  occupies the Feature slot; others remain reachable in Standard slots.
- An empty category shows an in-book empty state.

There is no artificial spread limit. More Vehicles appears only when another
spread exists. Later-spread Back turns to the previous spread; spread-0 Back
returns to Categories. The Feature never repeats. Internal locations retain
category and spread index; the same BookShell remains mounted.

### Artwork and product details

Catalogue Artwork uses only the product-root `catalogueArtworkUrl`. Native
transparency reveals actual paper: no card, frame, background, mask or blending
substitute. Null, empty or failed artwork leaves a blank artwork slot, not a
broken image. Information, membership, Feature status, ordering and View
Details remain intact. Product Details always uses root `productImages`, even
when the selected offer is used and NEW stock is zero.

These source files remain untouched for manual Admin uploads, but have no
runtime imports or product-specific resolver:

- src/assets/categories/vehicles/vehicle-77256-feature.png
- src/assets/categories/vehicles/vehicle-77245-standard.png
- src/assets/categories/vehicles/vehicle-42226-standard.png

Product Images are not substituted for Catalogue Artwork. View Details opens a
minimal in-book view keyed by ProductListing ID, showing shared product
information and the root Product Images in API order. Back returns to its
original product spread. A damaged-box offer requires the existing condition
confirmation, which reads only that listing's description, effective price, and
Used Condition Photos. There is no fallback from condition photos to Product
Images. Cart entries retain the exact selected ProductListing ID and display
the shared product image plus the customer wording “New – Outer Box Damage.”

Approved first-spread modules and typography are retained. Later spreads reuse
supporting modules. Narrow layouts use existing internal book scrolling; product
footer spacing accommodates navigation without changing the shell.

No product-specific frontend changes are needed when Backend/Admin presentation
records change or products are added.

## Finite verification

```sh
npm run test:run
node node_modules/typescript/bin/tsc --project tsconfig.app.json --noEmit --strict
npm run lint
npm run build
node scripts/inspect-vehicles.mjs --fixtures
node scripts/inspect-vehicles.mjs
git diff --check
```

On Windows PowerShell 5 npm script shells, use
`npm --script-shell=cmd.exe run build` for the existing tsc -b && vite build.

Tests cover product-root parsing, sellable-offer filtering, planner capacity,
category filtering and API pagination, navigation boundaries, product rendering,
the 10759 gallery/modal ownership split, cart listing identity, and artwork/photo separation. The finite
inspection script temporarily serves the production build, starts installed
Chrome headless and closes both when finished. Override CHROME_PATH if needed.

Default inspection reads the real API (override CATALOGUE_API_URL if needed).
--fixtures uses isolated HTTP fixtures, never backend/database writes, to test
Feature/Standard pagination, fourth-product access, transition locking, keyboard
details, reduced motion, URL replacement and failed artwork delivery. CDN download
availability is not required. Cloudinary delivery is not blocked; live artwork
checks are conditional on backend URLs. Local product artwork is not required.

Both modes check persistent book identity, navigation, responsive containment,
Back, Close and reopen. Screenshots at 1440×900, 820×900 and 390×844 are saved under
ignored node_modules/.tmp/vehicles-inspection/{live,fixtures}/.

## Storefront checkout (Issue #41)

Set `VITE_STRIPE_PUBLISHABLE_KEY` to the Stripe account's publishable test/live
key before starting Vite or building. Never put a secret key in a `VITE_`
variable. Missing/invalid configuration leaves checkout usable for order review
and shows a payment configuration message. Stripe.js loads the secure Payment
Element; card details never enter the storefront API or browser storage.

Cart's Checkout action opens `/checkout`. Delivery is selected from existing
saved addresses. Country codes are validated against ISO two-letter codes; the
existing UK/United Kingdom/Great Britain values map explicitly to GB. Other
country names must be corrected in My Account. The saved default billing address
is shown and never changed by checkout.

Each logical creation attempt uses `crypto.randomUUID()` as its `Idempotency-Key`.
The key and exact request snapshot (listing IDs, quantities, delivery address)
are stored per user in **sessionStorage before sending**. This minimal temporary
snapshot permits an identical retry after a lost response, rerender, or refresh;
retry never substitutes a changed cart/address or creates a fresh key. Session
storage must be available to create an order. Once its ID is known, the URL is
replaced with `/checkout/orders/:orderId` and the temporary snapshot is removed.
Explicitly leaving a saved checkout abandons that recovery attempt; retry it
first if the outcome was uncertain.

The order-specific URL reads `GET /orders/:orderId` to reconstruct server totals,
address snapshots, reservation expiry, and safe payment state. Configure hosting
with SPA fallback for `/checkout` and `/checkout/orders/*`. Stripe authentication
returns to the order URL, and returned query parameters are removed after use.
Client secrets remain in memory and are reacquired through the existing Stripe
initialization endpoint when needed.

Browser confirmation starts bounded backend verification (seven reads over
approximately 29 seconds). Only Payment SUCCEEDED plus Order CONFIRMED,
DISPATCHED, or COMPLETED shows confirmation. Pending verification preserves the
order URL and provides Recheck; it never creates another order. Expired and
terminal orders stop payment. A recorded payment on an expired/canceled order
requires support/reconciliation and is not displayed as a normal success.

**Cart cleanup limitation:** cart PATCH/DELETE have no conditional revision or
atomic subtract-purchased-quantity operation. Even reading first cannot prevent
another tab changing that listing before the mutation. Checkout therefore keeps
all cart contents after authoritative success and explains this on confirmation.
This protects unrelated/new quantities, but customers must review purchased
items before another checkout. No cart is cleared on order creation, intent
creation, browser payment success, or backend confirmation.

Checkout tests mock Stripe and HTTP; normal tests never contact Stripe. Run
`npm run test:run`, `npx tsc -b`, `npm run build`, and `npm run lint`. A real test-mode
end-to-end checkout additionally needs the Backend #144 contract, matching Stripe
keys, and delivery of verified payment webhooks to that backend. It is not part
of the automated frontend suite.
