import { catalogueCategories } from './categories'

export type ProductLocation = { kind: 'products'; slug: string; index: number }
export type CategoryLocation = { kind: 'category'; slug: string; returnTo: 'categories-primary' | 'categories-more' }
export type CatalogueSpread = 'front-matter' | 'opening' | 'categories-primary' | 'categories-more'
  | ProductLocation | CategoryLocation
  | { kind: 'details'; listingId: number; returnTo: ProductLocation | CategoryLocation }

export type CatalogueLeafletSide = 'front' | 'back'
export type CatalogueUrlLocation = {
  spread: CatalogueSpread
  open: boolean
  leafletSide: CatalogueLeafletSide | null
}

export function categoryLocation(slug: string): CategoryLocation {
  const index = catalogueCategories.findIndex(category => category.id === slug)
  return { kind: 'category', slug, returnTo: index < 7 ? 'categories-primary' : 'categories-more' }
}

export function categoryFromPath(path: string): CategoryLocation | undefined {
  const category = catalogueCategories.find(item => item.href === path.replace(/\/$/, ''))
  return category ? categoryLocation(category.id) : undefined
}

/** Reads only durable catalogue location state; animation frames and transient overlays stay in memory. */
export function catalogueLocationFromUrl(pathname: string, search: string): CatalogueUrlLocation {
  const params = new URLSearchParams(search)
  const category = categoryFromPath(pathname)
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
    if (leaflet === 'front' || leaflet === 'back') {
      return { spread: category, open: true, leafletSide: leaflet }
    }
    if (rawPage !== null && Number.isSafeInteger(page) && page !== null && page > 0) {
      return { spread: productLocation(category.slug, page - 1), open: true, leafletSide: null }
    }
    return { spread: category, open: true, leafletSide: null }
  }

  const rawSpread = params.get('spread')
  if (rawSpread === 'opening' || rawSpread === 'categories-primary' || rawSpread === 'categories-more' || rawSpread === 'front-matter') {
    return { spread: rawSpread, open: true, leafletSide: null }
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
    const category = catalogueCategories.find(item => item.id === slug)
    if (!category) return '/'
    const params = new URLSearchParams()
    if (spread.kind === 'products') params.set('page', String(spread.index + 1))
    if (spread.kind === 'details') {
      params.set('details', String(spread.listingId))
      if (spread.returnTo.kind === 'products') params.set('page', String(spread.returnTo.index + 1))
    }
    if (options.leafletSide && spread.kind === 'category') params.set('leaflet', options.leafletSide)
    const query = params.toString()
    return `${category.href}${query ? `?${query}` : ''}`
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

export function normalizeProductLocation(location: ProductLocation, spreadCount: number): CatalogueSpread {
  if (spreadCount <= 0) return categoryLocation(location.slug)
  return { ...location, index: Math.max(0, Math.min(location.index, spreadCount - 1)) }
}

export function spreadAfterAction(spread: CatalogueSpread, action: 'forward' | 'backward', productSpreadCount = 0): CatalogueSpread {
  if (typeof spread !== 'string') {
    if (spread.kind === 'details') return action === 'backward' ? spread.returnTo : spread
    if (spread.kind === 'category') return action === 'backward' ? spread.returnTo : productSpreadCount > 0 ? productLocation(spread.slug) : spread
    if (action === 'backward') return spread.index > 0 ? { ...spread, index: spread.index - 1 } : categoryLocation(spread.slug)
    return spread.index + 1 < productSpreadCount ? { ...spread, index: spread.index + 1 } : spread
  }
  if (action === 'forward') {
    return spread === 'front-matter' || spread === 'opening' ? 'categories-primary' : 'categories-more'
  }
  if (spread === 'front-matter') return spread
  return spread === 'categories-more' ? 'categories-primary' : 'front-matter'
}
