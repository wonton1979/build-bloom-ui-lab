// Test data only; never imported by storefront runtime modules.
import type { BackendCategory, CartProductListing, CatalogueProduct, ProductImage, ProductListingOffer } from './api'

export const fixtureCategory: BackendCategory = { id: 11, name: 'Vehicles', subtitle: 'Built for the thrill', description: 'Test editorial copy', imageUrl: null }

export function productImage(id: number, sortOrder = Math.max(0, id - 380)): ProductImage {
  return { id, url: '/product-image-' + id + '.jpg', altText: 'Product image ' + id, sortOrder }
}

export function offer(id: number, overrides: Partial<ProductListingOffer> = {}): ProductListingOffer {
  return {
    id, legoProductId: id, condition: 'NEW', usedLifecycle: null, damageDescription: null,
    originalPrice: '25.99', salePrice: null, effectivePrice: '25.99', currentStock: 5, availableStock: 5,
    active: true, usedConditionPhotos: [],
    ...overrides,
  }
}

export function product(id: number, offers: ProductListingOffer[] = [offer(id)], overrides: Partial<CatalogueProduct> = {}): CatalogueProduct {
  return {
    id, isRetired: false, setNumber: `test-${id}`, title: `API product ${id}`, description: `Description ${id}`,
    theme: 'API theme', pieceCount: 123, ageRecommendation: '9', category: fixtureCategory,
    catalogueArtworkUrl: null, catalogueArtworkPublicId: null, productImages: [productImage(id)],
    isFeatureProduct: false, offers, ...overrides,
  }
}

export function cartListing(item: ProductListingOffer, productData?: CatalogueProduct): CartProductListing {
  const owner = productData ?? product(item.legoProductId, [item])
  return { ...item, legoProduct: {
    id: owner.id, setNumber: owner.setNumber, title: owner.title, description: owner.description,
    theme: owner.theme, ageRecommendation: owner.ageRecommendation, pieceCount: owner.pieceCount,
    category: owner.category, catalogueArtworkUrl: owner.catalogueArtworkUrl, catalogueArtworkPublicId: owner.catalogueArtworkPublicId,
    productImages: owner.productImages, isFeatureProduct: owner.isFeatureProduct, isRetired: owner.isRetired,
  } }
}

/** Regression shape for the migrated LegoProduct #14947 / set 10759 contract. */
export const damaged10759 = product(14947, [
  offer(16900, { legoProductId: 14947, condition: 'NEW', active: true, currentStock: 0, availableStock: 0, effectivePrice: '29.99' }),
  offer(16901, {
    legoProductId: 14947, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', active: true,
    damageDescription: 'A crease and small dent on the outer box.', originalPrice: '25.99', effectivePrice: '18.75', currentStock: 1, availableStock: 1,
    usedConditionPhotos: [1, 2, 3].map(id => ({ id, listingId: 16901, url: `/used-condition-10759-${id}.jpg`, publicId: `condition-10759-${id}`, sortOrder: id, createdAt: '' })),
  }),
], {
  setNumber: '10759', title: 'Elastigirl’s Rooftop Pursuit', catalogueArtworkUrl: '/catalogue-artwork-10759.png',
  catalogueArtworkPublicId: 'catalogue-10759', productImages: [380, 381, 382].map((id, index) => productImage(id, index)), isFeatureProduct: true,
})

/** Temporary fixture alias while the existing tests migrate to explicit product/offer helpers. */
export const listing = offer
