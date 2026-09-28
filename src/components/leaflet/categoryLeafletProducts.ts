import type { CatalogueProduct } from '../../features/catalogue/api'

export const MAX_COLLECTION_LEAFLET_PRODUCTS = 11

export function selectCollectionLeafletProducts(products: readonly CatalogueProduct[], random: () => number = Math.random): CatalogueProduct[] {
  if (products.length <= MAX_COLLECTION_LEAFLET_PRODUCTS) return [...products]
  const shuffled = [...products]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
  }
  return shuffled.slice(0, MAX_COLLECTION_LEAFLET_PRODUCTS)
}

/** @deprecated Kept as a compatibility alias for existing Harry Potter callers. */
export const selectHarryPotterLeafletProducts = selectCollectionLeafletProducts
