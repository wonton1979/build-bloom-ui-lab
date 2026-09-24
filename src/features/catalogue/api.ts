/** Public category and listing contracts from /categories and /products. */
export interface BackendCategory {
  id: number
  name: string
  subtitle: string | null
  description: string | null
  imageUrl: string | null
}

export interface ProductListing {
  id: number
  legoProductId: number
  createdAt: string
  isFeatureProduct: boolean
  catalogueArtworkUrl: string | null
  catalogueArtworkPublicId: string | null
  condition: 'NEW' | 'USED_LIKE_NEW'
  originalPrice: string
  salePrice: string | null
  availableStock: number
  category: BackendCategory | null
  legoProduct: {
    id: number
    setNumber: string
    title: string
    description: string | null
    theme: string
    pieceCount: number | null
    ageRecommendation: string | null
  }
  listingImages: { url: string; altText: string | null; sortOrder: number }[]
}

export interface ProductsResponse {
  items: ProductListing[]
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number }
}

export class CatalogueApiError extends Error {
  readonly status: number
  constructor(status: number) {
    super(status === 400 ? 'We couldn’t use that search. Please check it and try again.' : 'We couldn’t search the catalogue. Please try again.')
    this.name = 'CatalogueApiError'
    this.status = status
  }
}

/** One server-ordered result page. Never use the category all-pages loader for search. */
export async function searchProducts(query: string, page = 1, pageSize = 12, signal?: AbortSignal): Promise<ProductsResponse> {
  const q = query.trim()
  if (!q || !Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new CatalogueApiError(400)
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const params = new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) })
  const response = await fetch(`${base}/products?${params}`, { signal })
  if (!response.ok) throw new CatalogueApiError(response.status)
  const data: ProductsResponse = await response.json()
  const p = data.pagination
  if (!Array.isArray(data.items) || !p || p.page !== page || p.pageSize !== pageSize ||
    !Number.isInteger(p.totalItems) || p.totalItems < 0 || p.totalPages !== Math.ceil(p.totalItems / pageSize)) throw new Error('Invalid search response')
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

export async function getProducts(filters: { categoryId: number }, signal?: AbortSignal): Promise<ProductListing[]> {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const items: ProductListing[] = []
  let page = 1
  let totalPages: number
  do {
    const params = new URLSearchParams({ categoryId: String(filters.categoryId), page: String(page), pageSize: '100' })
    const response = await fetch(`${base}/products?${params}`, { signal })
    if (!response.ok) throw new Error('Unable to load catalogue')
    const data: ProductsResponse = await response.json()
    items.push(...data.items)
    totalPages = data.pagination.totalPages
    page += 1
  } while (page <= totalPages)
  return items
}
