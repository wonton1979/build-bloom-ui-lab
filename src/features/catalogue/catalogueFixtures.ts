// Test data only; never imported by storefront runtime modules.
import type { ProductListing } from './api'

export function listing(id: number, overrides: Partial<ProductListing> = {}): ProductListing {
  return {
    id, legoProductId: id + 1000, category: { id: 11, name: 'Vehicles', subtitle: 'Built for the thrill', description: 'Test editorial copy', imageUrl: null },
    isFeatureProduct: false, catalogueArtworkUrl: null, catalogueArtworkPublicId: null,
    createdAt: '2026-01-01T00:00:00.000Z', condition: 'NEW', originalPrice: '25.99', salePrice: null,
    availableStock: 5,
    legoProduct: { id: id + 1000, setNumber: `test-${id}`, title: `API product ${id}`, description: `Description ${id}`, theme: 'API theme', pieceCount: 123, ageRecommendation: '9' },
    listingImages: [{ url: `/photograph-${id}.png`, altText: `Photograph ${id}`, sortOrder: 0 }],
    ...overrides,
  }
}
