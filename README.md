# Catalogue UI lab

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
1120 × 688 desktop spread, with two labelled page sections and decorative cover
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

The stage has a desktop minimum width of 1280px and minimum height of 900px.
Smaller viewports overflow intentionally; mobile and tablet layouts are outside
this issue. There is no catalogue content, navigation, animation or application
logic. The subtle paper curvature is illustrated with shading, rather than 3D
geometry.
