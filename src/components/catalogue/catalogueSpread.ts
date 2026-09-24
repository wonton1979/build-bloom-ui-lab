import type { CatalogueCategory } from './categories'

export type ProductLocation = { kind: 'products'; slug: string; index: number }
export type CategoryIndexSpread = 'categories-primary' | 'categories-more' | `categories-page-${number}`
export type CategoryLocation = { kind: 'category'; slug: string; returnTo: CategoryIndexSpread }
export type CatalogueSpread = 'front-matter' | 'opening' | CategoryIndexSpread
  | ProductLocation | CategoryLocation
  | { kind: 'details'; listingId: number; returnTo: ProductLocation | CategoryLocation }

export type CatalogueLeafletSide = 'front' | 'back'
export type CatalogueUrlLocation = {
  spread: CatalogueSpread
  open: boolean
  leafletSide: CatalogueLeafletSide | null
}

export function categorySpreadAt(index: number): CategoryIndexSpread {
  if (index <= 0) return 'categories-primary'
  if (index === 1) return 'categories-more'
  return `categories-page-${index}`
}

export function categorySpreadIndex(spread: CategoryIndexSpread): number {
  if (spread === 'categories-primary') return 0
  if (spread === 'categories-more') return 1
  return Number(spread.slice('categories-page-'.length))
}

export const isCategoryIndexSpread = (spread: CatalogueSpread): spread is CategoryIndexSpread =>
  typeof spread === 'string' && (spread === 'categories-primary' || spread === 'categories-more' || /^categories-page-\d+$/.test(spread))

export function categoryLocation(slug: string, categories: readonly CatalogueCategory[] = []): CategoryLocation {
  const index = categories.findIndex(category => category.id === slug)
  const physicalPage = Math.floor(Math.max(index, 0) / 3)
  return { kind: 'category', slug, returnTo: categorySpreadAt(Math.floor(physicalPage / 2)) }
}

export function categoryFromPath(path: string, categories?: readonly CatalogueCategory[]): CategoryLocation | undefined {
  const cleanPath = path.replace(/\/$/, '')
  const slug = cleanPath.match(/^\/categories\/([^/]+)$/)?.[1]
  if (!slug) return undefined
  const category = categories?.find(item => item.href === cleanPath || item.id === decodeURIComponent(slug))
  if (categories && !category) return undefined
  return categoryLocation(category?.id ?? decodeURIComponent(slug), categories)
}

function parseCategorySpread(raw: string, count?: number): CategoryIndexSpread | undefined {
  const spread: CategoryIndexSpread | undefined = raw === 'categories-primary' || raw === 'categories-more'
    ? raw
    : /^categories-page-\d+$/.test(raw) ? raw as CategoryIndexSpread : undefined
  if (!spread) return undefined
  return count === undefined || categorySpreadIndex(spread) < count ? spread : undefined
}

/** Reads durable catalogue location state; dynamic category slugs resolve against the current runtime categories when supplied. */
export function catalogueLocationFromUrl(pathname: string, search: string, categories?: readonly CatalogueCategory[]): CatalogueUrlLocation {
  const params = new URLSearchParams(search)
  const category = categoryFromPath(pathname, categories)
  if (category) {
    const rawPage = params.get('page')
    const page = rawPage === null ? null : Number(rawPage)
    const detailsId = Number(params.get('details'))
    if (params.has('details') && Number.isSafeInteger(detailsId) && detailsId > 0) {
      const returnTo = Number.isSafeInteger(page) && page !== null && page > 0
        ? productLocation(category.slug, page - 1)
        : category
      return { spread: { kind: 'details', listingId: detailsId, returnTo }, open: true, leafletSide: null }
    }
    const leaflet = params.get('leaflet')
    if (leaflet === 'front' || leaflet === 'back') return { spread: category, open: true, leafletSide: leaflet }
    if (rawPage !== null && Number.isSafeInteger(page) && page !== null && page > 0) {
      return { spread: productLocation(category.slug, page - 1), open: true, leafletSide: null }
    }
    return { spread: category, open: true, leafletSide: null }
  }

  const rawSpread = params.get('spread')
  const categorySpreadCount = categories === undefined ? undefined : Math.ceil(Math.ceil(categories.length / 3) / 2)
  const dynamicCategorySpread = rawSpread ? parseCategorySpread(rawSpread, categorySpreadCount) : undefined
  if (rawSpread === 'opening' || rawSpread === 'front-matter' || dynamicCategorySpread) {
    return { spread: dynamicCategorySpread ?? rawSpread as 'opening' | 'front-matter', open: true, leafletSide: null }
  }
  return { spread: 'front-matter', open: false, leafletSide: null }
}

/** Encodes a settled spread. Product pages are one-based in the public URL. */
export function catalogueLocationHref(spread: CatalogueSpread, options: {
  open?: boolean
  leafletSide?: CatalogueLeafletSide | null
} = {}): string {
  if (typeof spread !== 'string') {
    const slug = spread.kind === 'details' ? spread.returnTo.slug : spread.slug
    const params = new URLSearchParams()
    if (spread.kind === 'products') params.set('page', String(spread.index + 1))
    if (spread.kind === 'details') {
      params.set('details', String(spread.listingId))
      if (spread.returnTo.kind === 'products') params.set('page', String(spread.returnTo.index + 1))
    }
    if (options.leafletSide && spread.kind === 'category') params.set('leaflet', options.leafletSide)
    const query = params.toString()
    return `/categories/${slug}${query ? `?${query}` : ''}`
  }

  if (options.open || spread !== 'front-matter') return `/?spread=${encodeURIComponent(spread)}`
  return '/'
}

export function sameSpread(a: CatalogueSpread, b: CatalogueSpread) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function productLocation(slug: string, index = 0): ProductLocation {
  return { kind: 'products', slug, index }
}

export function normalizeProductLocation(location: ProductLocation, spreadCount: number, categories: readonly CatalogueCategory[] = []): CatalogueSpread {
  if (spreadCount <= 0) return categoryLocation(location.slug, categories)
  return { ...location, index: Math.max(0, Math.min(location.index, spreadCount - 1)) }
}

export function spreadAfterAction(spread: CatalogueSpread, action: 'forward' | 'backward', productSpreadCount = 0, categorySpreadCount = 2, categories: readonly CatalogueCategory[] = []): CatalogueSpread {
  if (typeof spread !== 'string') {
    if (spread.kind === 'details') return action === 'backward' ? spread.returnTo : spread
    if (spread.kind === 'category') return action === 'backward' ? spread.returnTo : productSpreadCount > 0 ? productLocation(spread.slug) : spread
    if (action === 'backward') return spread.index > 0 ? { ...spread, index: spread.index - 1 } : categoryLocation(spread.slug, categories)
    return spread.index + 1 < productSpreadCount ? { ...spread, index: spread.index + 1 } : spread
  }
  if (isCategoryIndexSpread(spread)) {
    const index = categorySpreadIndex(spread)
    if (action === 'backward') return index > 0 ? categorySpreadAt(index - 1) : 'front-matter'
    return index + 1 < categorySpreadCount ? categorySpreadAt(index + 1) : spread
  }
  if (action === 'forward') return spread === 'front-matter' || spread === 'opening' ? categorySpreadAt(0) : categorySpreadAt(1)
  if (spread === 'front-matter') return spread
  return 'front-matter'
}