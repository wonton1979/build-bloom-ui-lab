import type { ProductListing } from './api'

export interface ProductSpread {
  feature?: ProductListing
  left: ProductListing[]
  right: ProductListing[]
}

function chronological(a: ProductListing, b: ProductListing) {
  const timestamp = (value: string) => {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : Infinity
  }
  const difference = timestamp(a.createdAt) - timestamp(b.createdAt)
  return (Number.isNaN(difference) ? 0 : difference) || a.id - b.id
}

/** Presentation only: input is already category-filtered. Never infer feature
 * status from artwork, set number, or any merchandising attribute. */
export function planProductSpreads(products: readonly ProductListing[]): ProductSpread[] {
  const ordered = [...new Map(products.map(product => [product.id, product])).values()].sort(chronological)
  // Malformed multiple features: show the earliest flagged listing as feature;
  // retain every other listing in standard slots rather than losing products.
  const feature = ordered.find(product => product.isFeatureProduct)
  const standards = ordered.filter(product => product !== feature)
  const spreads: ProductSpread[] = []
  if (feature) spreads.push({ feature, left: [], right: standards.splice(0, 2) })
  for (let start = 0; start < standards.length; start += 4) {
    spreads.push({ left: standards.slice(start, start + 2), right: standards.slice(start + 2, start + 4) })
  }
  return spreads
}
