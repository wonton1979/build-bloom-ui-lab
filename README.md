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
The UI Lab does not add a router, implement destination pages, or intercept these
links; destination pages will be supplied by the future ecommerce frontend.

The existing Vitest/React server-rendering suite now includes category order,
asset/destination association, live labels, native links, all 13 entries including
Others, and the Discover/More/Back callbacks and their resulting spread contents.

Issue #1: a static desktop book shell, designed for a 1440 × 900 viewport.

## Development

```sh
npm install
npm run dev
```

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
