import { catalogueCategories } from './categories'

export type ProductLocation = { kind: 'products'; slug: string; index: number }
export type CategoryLocation = { kind: 'category'; slug: string; returnTo: 'categories-primary' | 'categories-more' }
export type CatalogueSpread = 'front-matter' | 'opening' | 'categories-primary' | 'categories-more'
  | ProductLocation | CategoryLocation
  | { kind: 'details'; listingId: number; returnTo: ProductLocation | CategoryLocation }

export function categoryLocation(slug: string): CategoryLocation {
  const index = catalogueCategories.findIndex(category => category.id === slug)
  return { kind: 'category', slug, returnTo: index < 7 ? 'categories-primary' : 'categories-more' }
}

export function categoryFromPath(path: string): CategoryLocation | undefined {
  const category = catalogueCategories.find(item => item.href === path.replace(/\/$/, ''))
  return category ? categoryLocation(category.id) : undefined
}

export function sameSpread(a: CatalogueSpread, b: CatalogueSpread) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function productLocation(slug: string, index = 0): ProductLocation {
  return { kind: 'products', slug, index }
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
