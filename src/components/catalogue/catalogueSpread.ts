export type CatalogueSpread = 'opening' | 'categories-primary' | 'categories-more' | 'vehicles'

export function spreadAfterAction(spread: CatalogueSpread, action: 'forward' | 'backward'): CatalogueSpread {
  if (spread === 'vehicles') return action === 'backward' ? 'categories-more' : 'vehicles'
  if (action === 'forward') {
    return spread === 'opening' ? 'categories-primary' : 'categories-more'
  }
  return spread === 'categories-more' ? 'categories-primary' : 'opening'
}
