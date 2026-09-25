/** Public catalogue identity shared by a product and its offers. */
export interface BackendCategory {
  id: number
  name: string
  subtitle: string | null
  description: string | null
  imageUrl: string | null
}

/** Shared presentation image owned by the LegoProduct, not an offer. */
export interface ProductImage {
  id: number
  url: string
  altText: string | null
  sortOrder: number
}

export interface UsedConditionPhoto {
  id: number
  listingId: number
  url: string
  altText?: string | null
  publicId: string
  sortOrder: number
  createdAt: string
}

/** One sellable ProductListing offer for a single physical listing. */
export interface ProductListingOffer {
  id: number
  legoProductId: number
  condition: 'NEW' | 'USED_LIKE_NEW'
  usedLifecycle: 'AVAILABLE' | 'SOLD' | 'RETIRED' | null
  damageDescription: string | null
  originalPrice: string
  salePrice: string | null
  effectivePrice: string
  currentStock: number
  availableStock: number
  active: boolean
  usedConditionPhotos: UsedConditionPhoto[]
}

/** One LegoProduct per catalogue result. Offers never become separate cards. */
export interface CatalogueProduct {
  id: number
  /** LegoProduct metadata shared by all offers for this set. */
  isRetired: boolean
  setNumber: string
  title: string
  description: string | null
  theme: string
  ageRecommendation: string | null
  pieceCount: number | null
  category: BackendCategory | null
  catalogueArtworkUrl: string | null
  catalogueArtworkPublicId: string | null
  productImages: ProductImage[]
  isFeatureProduct: boolean
  offers: ProductListingOffer[]
}


/** Cart response projection for one selected ProductListing, distinct from catalogue offers. */
export interface CartProductListing extends ProductListingOffer {
  legoProduct: Pick<CatalogueProduct, 'id' | 'setNumber' | 'title' | 'description' | 'theme' | 'ageRecommendation' | 'pieceCount' | 'category' | 'catalogueArtworkUrl' | 'catalogueArtworkPublicId' | 'productImages' | 'isFeatureProduct' | 'isRetired'>
}

/** Customer-visible offers must be active, in stock, and in an available lifecycle. */
export function isSellableOffer(offer: ProductListingOffer): boolean {
  return offer.active && offer.availableStock > 0 && (offer.condition === 'NEW' || offer.usedLifecycle === 'AVAILABLE')
}

export function sellableOffers(product: Pick<CatalogueProduct, 'offers'>): ProductListingOffer[] {
  return product.offers.filter(isSellableOffer)
}

export function isSellableProduct(product: Pick<CatalogueProduct, 'offers'>): boolean {
  return sellableOffers(product).length > 0
}

export const defaultProductOffer = (product: CatalogueProduct): ProductListingOffer | undefined => {
  const available = sellableOffers(product)
  return available.find(offer => offer.condition === 'NEW') ?? available[0]
}

export interface CataloguePagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface ProductsResponse {
  items: CatalogueProduct[]
  pagination: CataloguePagination
}

export class CatalogueApiError extends Error {
  readonly status: number
  constructor(status: number) {
    super(status === 400 ? 'We couldn’t use that search. Please check it and try again.' : 'We couldn’t search the catalogue. Please try again.')
    this.name = 'CatalogueApiError'
    this.status = status
  }
}

function isProductImage(value: unknown): value is ProductImage {
  if (!value || typeof value !== 'object') return false
  const image = value as Partial<ProductImage>
  return Number.isSafeInteger(image.id) && image.id! > 0 && typeof image.url === 'string' && Boolean(image.url.trim()) &&
    (image.altText === null || typeof image.altText === 'string') && Number.isInteger(image.sortOrder)
}

function isUsedConditionPhoto(value: unknown): value is UsedConditionPhoto {
  if (!value || typeof value !== 'object') return false
  const photo = value as Partial<UsedConditionPhoto>
  return Number.isSafeInteger(photo.id) && photo.id! > 0 && Number.isSafeInteger(photo.listingId) && photo.listingId! > 0 &&
    typeof photo.url === 'string' && Boolean(photo.url.trim()) && typeof photo.publicId === 'string' &&
    (photo.altText === undefined || photo.altText === null || typeof photo.altText === 'string') &&
    Number.isInteger(photo.sortOrder) && typeof photo.createdAt === 'string'
}

function isProductListingOffer(value: unknown, productId: number): value is ProductListingOffer {
  if (!value || typeof value !== 'object') return false
  const offer = value as Partial<ProductListingOffer>
  return Number.isSafeInteger(offer.id) && offer.id! > 0 && offer.legoProductId === productId &&
    (offer.condition === 'NEW' || offer.condition === 'USED_LIKE_NEW') &&
    (offer.usedLifecycle === null || offer.usedLifecycle === 'AVAILABLE' || offer.usedLifecycle === 'SOLD' || offer.usedLifecycle === 'RETIRED') &&
    (offer.damageDescription === null || typeof offer.damageDescription === 'string') &&
    typeof offer.originalPrice === 'string' && (offer.salePrice === null || typeof offer.salePrice === 'string') && typeof offer.effectivePrice === 'string' &&
    Number.isInteger(offer.currentStock) && offer.currentStock! >= 0 && Number.isInteger(offer.availableStock) && offer.availableStock! >= 0 &&
    typeof offer.active === 'boolean' && Array.isArray(offer.usedConditionPhotos) && offer.usedConditionPhotos.every(isUsedConditionPhoto)
}

function isCatalogueProduct(value: unknown): value is CatalogueProduct {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CatalogueProduct>
  return Number.isSafeInteger(item.id) && item.id! > 0 && typeof item.setNumber === 'string' && typeof item.title === 'string' &&
    (item.description === null || typeof item.description === 'string') && typeof item.theme === 'string' &&
    (item.ageRecommendation === null || typeof item.ageRecommendation === 'string') &&
    (item.pieceCount === null || Number.isInteger(item.pieceCount)) && (item.category === null || Boolean(item.category && Number.isSafeInteger(item.category.id))) &&
    typeof item.isRetired === 'boolean' && typeof item.isFeatureProduct === 'boolean' &&
    (item.catalogueArtworkUrl === null || typeof item.catalogueArtworkUrl === 'string') &&
    (item.catalogueArtworkPublicId === null || typeof item.catalogueArtworkPublicId === 'string') &&
    Array.isArray(item.productImages) && item.productImages.every(isProductImage) &&
    Array.isArray(item.offers) && item.offers.every(offer => isProductListingOffer(offer, item.id!))
}

function isProductsResponse(value: unknown, page: number, pageSize: number): value is ProductsResponse {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<ProductsResponse>
  const pagination = data.pagination
  return Array.isArray(data.items) && data.items.every(isCatalogueProduct) &&
    Boolean(pagination) && pagination!.page === page && pagination!.pageSize === pageSize && Number.isInteger(pagination!.totalItems) && pagination!.totalItems >= 0 &&
    Number.isInteger(pagination!.totalPages) && pagination!.totalPages === Math.ceil(pagination!.totalItems / pageSize)
}
/** One server-ordered result page. Never use the category all-pages loader for search. */
export async function searchProducts(query: string, page = 1, pageSize = 12, signal?: AbortSignal): Promise<ProductsResponse> {
  const q = query.trim()
  if (!q || !Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new CatalogueApiError(400)
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const params = new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) })
  const response = await fetch(`${base}/products?${params}`, { signal })
  if (!response.ok) throw new CatalogueApiError(response.status)
  const data: unknown = await response.json()
  if (!isProductsResponse(data, page, pageSize)) throw new Error('Invalid search response')
  return data
}

// The UI lab has no existing HTTP client. Keep the public GET contract and
// VITE_API_BASE_URL convention of the main frontend, without adding axios.
export async function getCategories(signal?: AbortSignal): Promise<BackendCategory[]> {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const response = await fetch(`${base}/categories`, { signal })
  if (!response.ok) throw new Error('Unable to load categories')
  const data: unknown = await response.json()
  if (!Array.isArray(data) || data.some(category => !category || !Number.isSafeInteger(category.id) || category.id <= 0 ||
    typeof category.name !== 'string' || !category.name.trim() ||
    ![category.subtitle, category.description, category.imageUrl].every(value => value === null || typeof value === 'string'))) {
    throw new Error('Invalid categories response')
  }
  return data as BackendCategory[]
}

export async function getProducts(filters: { categoryId: number }, signal?: AbortSignal): Promise<CatalogueProduct[]> {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const items: CatalogueProduct[] = []
  let page = 1
  let totalPages: number
  do {
    const pageSize = 100
    const params = new URLSearchParams({ categoryId: String(filters.categoryId), page: String(page), pageSize: String(pageSize) })
    const response = await fetch(`${base}/products?${params}`, { signal })
    if (!response.ok) throw new Error('Unable to load catalogue')
    const data: unknown = await response.json()
    if (!isProductsResponse(data, page, pageSize)) throw new Error('Invalid catalogue response')
    items.push(...data.items)
    totalPages = data.pagination.totalPages
    page += 1
  } while (page <= totalPages)
  return items
}
