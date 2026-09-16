export type CatalogueSpread = 'opening' | 'categories-primary' | 'categories-more'

export function spreadAfterAction(spread: CatalogueSpread, action: 'forward' | 'backward'): CatalogueSpread {
  if (action === 'forward') {
    return spread === 'opening' ? 'categories-primary' : 'categories-more'
  }
  return spread === 'categories-more' ? 'categories-primary' : 'opening'
}
