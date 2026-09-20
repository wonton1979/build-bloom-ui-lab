export type ProductLocation = { kind: 'products'; category: 'VEHICLES'; index: number }
export type CatalogueSpread = 'front-matter' | 'opening' | 'categories-primary' | 'categories-more'
  | ProductLocation
  | { kind: 'details'; listingId: number; returnTo: ProductLocation }

export function sameSpread(a: CatalogueSpread, b: CatalogueSpread) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function productLocation(index = 0): ProductLocation {
  return { kind: 'products', category: 'VEHICLES', index }
}

export function spreadAfterAction(spread: CatalogueSpread, action: 'forward' | 'backward', productSpreadCount = 0): CatalogueSpread {
  if (typeof spread !== 'string') {
    if (spread.kind === 'details') return action === 'backward' ? spread.returnTo : spread
    if (action === 'backward') return spread.index > 0 ? { ...spread, index: spread.index - 1 } : 'categories-more'
    return spread.index + 1 < productSpreadCount ? { ...spread, index: spread.index + 1 } : spread
  }
  if (action === 'forward') {
    return spread === 'front-matter' || spread === 'opening' ? 'categories-primary' : 'categories-more'
  }
  if (spread === 'front-matter') return spread
  return spread === 'categories-more' ? 'categories-primary' : 'front-matter'
}
