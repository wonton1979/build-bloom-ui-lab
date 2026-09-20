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

interface ProductsResponse {
  items: ProductListing[]
  pagination: { page: number; totalPages: number }
}

// The UI lab has no existing HTTP client. Keep the public GET contract and
// VITE_API_BASE_URL convention of the main frontend, without adding axios.
export async function getCategories(signal?: AbortSignal): Promise<BackendCategory[]> {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const response = await fetch(`${base}/categories`, { signal })
  if (!response.ok) throw new Error('Unable to load categories')
  return response.json()
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
