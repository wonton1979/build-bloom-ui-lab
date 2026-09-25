import { isSellableProduct, type CatalogueProduct } from './api'

export interface ProductSpread {
  left: CatalogueProduct[]
  right: CatalogueProduct[]
}

/** Product-level API order is authoritative; offers never become extra cards. */
export function selectCategoryProducts(products: readonly CatalogueProduct[]) {
  const ordered = [...new Map(products.map(product => [product.id, product])).values()].filter(isSellableProduct)
  const feature = ordered.find(product => product.isFeatureProduct)
  return { feature, others: ordered.filter(product => product !== feature) }
}

/** The opening owns the product-level feature; later spreads contain products. */
export function planProductSpreads(products: readonly CatalogueProduct[]): ProductSpread[] {
  const { others: standards } = selectCategoryProducts(products)
  const spreads: ProductSpread[] = []
  for (let start = 0; start < standards.length; start += 4) {
    spreads.push({ left: standards.slice(start, start + 2), right: standards.slice(start + 2, start + 4) })
  }
  return spreads
}
