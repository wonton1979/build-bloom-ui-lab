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

## Issue #7: dynamic Vehicles spreads

Open catalogue → More → Vehicles. The public request is
`GET /products?category=VEHICLES&page=<page>&pageSize=100`.
The adapter reads every API page, independently of visual spread capacity.
Only listings with colorfulLifeCategory === 'VEHICLES' are included.

The authoritative contract for this development pass is local Backend #92
(issue-92-catalogue-presentation), inspected read-only at
/home/yejun_guan/projects/colorful-life-backend in WSL, and the running
localhost:3000 API—not the older Windows checkout or GitHub main.
The response is { items, pagination }. Each listing provides:

- id, legoProductId, createdAt, colorfulLifeCategory;
- isFeatureProduct, catalogueArtworkUrl, catalogueArtworkPublicId;
- pricing, condition, nested legoProduct specifications and listingImages.

Missing required presentation fields produce a retryable contract error, not a
set-number fallback. Storage public IDs never construct delivery URLs.
No Cloudinary credentials, SDK, uploads or data writes are used.

### Planning and navigation

`src/features/catalogue/productSpreads.ts` is a pure category-independent planner.
Listings are ordered by createdAt ASC, then numeric listing id ASC.
Duplicate listing IDs are deduplicated; distinct listings for the same LEGO set
remain distinct. No set numbers, titles, stock, prices or artwork determine slots.

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

Catalogue artwork uses only the exact backend catalogueArtworkUrl.
Native transparency reveals actual paper: no card, frame, background, mask or
blending substitute. Null, empty or failed artwork leaves a blank artwork slot,
not a broken image. Information, membership, Feature status, ordering and
View Details remain intact. Replacement delivery URLs are consumed on the
next data refresh/reload without a frontend change.

These source files remain untouched for manual Admin uploads, but have no
runtime imports or product-specific resolver:

- src/assets/categories/vehicles/vehicle-77256-feature.png
- src/assets/categories/vehicles/vehicle-77245-standard.png
- src/assets/categories/vehicles/vehicle-42226-standard.png

Listing images are never substituted for catalogue artwork. View Details opens
a minimal in-book view keyed by listing ID, showing API information and listing
photographs in existing API order. Back returns to its original product spread.
No checkout/cart or full commerce detail workflow is introduced.

Approved first-spread modules and typography are retained. Later spreads reuse
supporting modules. Narrow layouts use existing internal book scrolling; product
footer spacing accommodates navigation without changing the shell.

Current live migration state: three Vehicles listings, all with
isFeatureProduct false and null artwork. Standard-only slots with blank art are
expected until Admin selects the Feature and uploads artwork. No product-specific
frontend changes are needed when those records change or products are added.

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

Tests cover planner capacity/order/no-loss, category filtering and API pagination,
navigation boundaries, product rendering and artwork/photo separation. The finite
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
