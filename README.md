# Catalogue UI lab

## Category catalogue

One BookShell stays on one tabletop. Local React state swaps its content slots
between the opening spread, a first category spread (3 + 4 entries), and a second
category spread (3 + 3 entries). Discover, Back and More are native buttons inside
the pages. There are no section-scroll links, routes or page-turn effects.

`src/components/catalogue/categories.ts` owns category order, labels, taglines,
asset associations, destination URLs, intrinsic image sizes, and small optical
scale adjustments. `CategoryCatalogue.tsx` renders the shared entry/page layouts.
Source artwork is unchanged. Empty image alt text avoids repeating the adjacent
live category link label. Images retain their intrinsic dimensions and transparency.

All spreads share the same physical dimensions. At 1200px and above, the desktop
book limits are reduced by 10% to leave more tabletop visible. Narrow layouts up
to 760px stack pages inside one fixed-height, internally scrollable book frame.
Spread changes reset internal page scrolling and move focus without scrolling
the browser viewport. Taglines yield to image/label space in narrow page containers.

**Agreed provisional route contract:** Category anchors use same-origin
`/categories/<slug>` URLs, centralized in `categories.ts` for future integration
into the Colorful Life frontend. They do not point to a separate external site.
Vehicles is the first exception: its category link opens a product spread through
the existing local spread state. Other destinations await integration into the
main frontend. No router is added.

The existing Vitest/React server-rendering suite now includes category order,
asset/destination association, live labels, native links, all 13 entries including
Others, and the Discover/More/Back callbacks and their resulting spread contents.

Issue #1: a static desktop book shell, designed for a 1440 × 900 viewport.

## Development

```sh
npm install
npm run dev
```

## Vehicles product spread

Open the catalogue → More → Vehicles. The same mounted BookShell receives new
left/right content. Back to Categories returns to the second category spread;
its existing Back → Close Book sequence is unchanged. BookShell, tabletop,
category styling, and opening/closing mechanics have not been modified.

`src/features/catalogue/api.ts` uses the existing main frontend's public
`GET /products?colorfulLifeCategory=VEHICLES&page=<page>&pageSize=100` contract and
`VITE_API_BASE_URL` convention. This lab previously had no API layer; a small
native-fetch adapter avoids introducing axios. Vite proxies `/api` to the local
backend at `http://localhost:3000`. For a deployment, set `VITE_API_BASE_URL` or
serve `/api` through the deployment's reverse proxy. No product data is bundled.

`vehicles.ts` requires Issue #90's official `colorfulLifeCategory === 'VEHICLES'`.
The previous absent-field/set-number fallback has been removed. Missing fields
cause a contract error; null and other categories are excluded. Set numbers
only assign editorial positions within the official category: 77256 feature,
77245 upper supporting product, and 42226 lower supporting product. LEGO theme
never determines category. New condition listings take precedence, then listing
ID breaks ties. Requests read every page of the category response.

`VehiclesProductPage.tsx` renders titles, set numbers, theme, pieces, ages, and
GBP original/sale prices as live DOM text. Loading, retry, and unavailable-product
states stay inside the book. View Details is intentionally
disabled with a small TODO until an in-book detail interaction exists. There
is no fake pagination or fabricated product data. An absent supporting listing
gets an unavailable message, not an invented title, price, or specification.

The feature imports exactly
`src/assets/categories/vehicles/vehicle-77256-feature.png`. The source is
unchanged; native alpha is retained, with no crop, frame, background, mask,
blend mode, or simulated paper panel. Supporting artwork imports exactly
`src/assets/categories/vehicles/vehicle-77245-standard.png` and
`src/assets/categories/vehicles/vehicle-42226-standard.png`, preserving the same
native-alpha treatment. The temporary catalogue photograph is no longer used;
this spread makes no Cloudinary requests. All three source PNGs are unchanged.

The approved left page is unchanged. The right page reserves two equal editorial
slots separated by whitespace, with the same supporting typography and Details
placement. Its unused navigation-footer space allows larger artwork without
changing BookShell. Narrow pages use existing internal scrolling.

The supplied Vehicles reference image was not attached or present in this
checkout; composition follows the written hierarchy. The existing opening
reference is not used as a substitute.

### Verification

`npm run test:run` includes API pagination/failure and product-selection/rendering
tests. `node scripts/inspect-vehicles.mjs` runs installed Chrome against the actual
Vite frontend (default `http://127.0.0.1:5175`, overridable with
`VEHICLES_REVIEW_URL`). It checks navigation, persistent book identity/dimensions,
real data, exact feature path, PNG alpha, transparent CSS ancestors, responsive
overflow, back, close, and reopen. Screenshots are saved under ignored
`node_modules/.tmp/vehicles-inspection/` at 1440×900, 820×900, and 390×844.

The inspection script always blocks Cloudinary. It checks every rendered local
artwork for transparent/partial-alpha pixels and transparent CSS ancestors. It
verifies 42226's lower position and artwork when the real API returns it, or its
unavailable state otherwise; it does not inject mock catalogue responses.

Supporting-artwork inspection: the refreshed localhost:3000 API exposes the
official VEHICLES field for 77256 and 77245, but 42226 is not currently returned
(including a direct search). The live book was inspected at all three viewport
sizes. The larger 77245 standard artwork blends into the paper with no visible
rectangle, while the approved 77256 remains dominant. Desktop content fits both
physical pages; narrower layouts retain internal scrolling. Back, Close Book,
reopen, book identity/geometry, and horizontal-overflow checks pass. The complete
two-product visual balance still needs live verification once 42226 is available;
unit tests cover both supporting products, order, assets, and strict membership.

On machines where npm's script shell is Windows PowerShell 5, run
`npm --script-shell=cmd.exe run build` so the existing `tsc -b && vite build`
script is parsed correctly, without changing global npm settings.

## Checks

```sh
npm run lint
npm run test:run
npm run build
```

The five focused tests use Vitest and React server rendering to check labelled
structure, reading order, independent content slots, hidden decoration, and the
empty application composition. They do not assert CSS classes or pixel values.

## Component structure

`App` owns the pastel environment and the main landmark. `BookShell` owns a
desktop spread with a 1120:688 aspect ratio, two labelled page sections and decorative cover
and spine layers. Each page has generous padding and an overflow container.

```tsx
import { BookShell } from './components/BookShell'

<BookShell
  label="Catalogue spread"
  leftPage={<YourLeftPage />}
  rightPage={<YourRightPage />}
/>
```

Both slots are optional; the lab deliberately renders blank pages. Page content
owns its headings and interactions. The shell uses plain CSS grid, gradients,
border radii and layered shadows, with no image assets or runtime dependencies
beyond React. The surrounding environment is separate from the reusable shell.

The desktop stage fills the viewport and sizes the spread to the smaller of
88% of viewport width and 85% of viewport height, preserving its aspect ratio.
An additional height cap leaves at least 112px of total vertical breathing room
for the cover, page edges and shadow on shorter desktop viewports. The shell
accepts this sizing through `--book-width`, retaining a standalone default.
The development-only comparison toolbar is fixed at the top-left viewport edge;
neither preview reserves layout space for it. Mobile and tablet layouts remain
outside this issue. There is no catalogue content, navigation, animation or application
logic. The subtle paper curvature is illustrated with shading, rather than 3D
geometry.
