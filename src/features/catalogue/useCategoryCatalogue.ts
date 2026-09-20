import { useEffect, useState } from 'react'
import { getCategories, getProducts, type BackendCategory, type ProductListing } from './api'
import { selectCategoryProducts } from './productSpreads'

export type CategoryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; category: BackendCategory; listings: ProductListing[] }

/** One category snapshot. A late request can never paint a different category. */
export function useCategoryCatalogue(name: string | undefined) {
  const [result, setResult] = useState<{ name: string; state: CategoryState }>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!name) return
    const controller = new AbortController()
    async function load() {
      try {
        const categories = await getCategories(controller.signal)
        const category = categories.find(item => item.name === name)
        if (!category) throw new Error('Category unavailable')
        const listings = await getProducts({ categoryId: category.id }, controller.signal)
        if (!controller.signal.aborted) setResult({ name: name!, state: {
          status: 'ready', category, listings: listings.filter(item => item.category?.id === category.id),
        } })
      } catch {
        if (!controller.signal.aborted) setResult({ name: name!, state: { status: 'error' } })
      }
    }
    void load()
    return () => controller.abort()
  }, [name, attempt])
  return {
    state: result && result.name === name ? result.state : { status: 'loading' } as CategoryState,
    retry: () => { setResult(undefined); setAttempt(value => value + 1) },
  }
}

/** Reuse the established feature/deduplication/order rules; never invent a feature. */
export function categoryProducts(listings: readonly ProductListing[]) {
  return selectCategoryProducts(listings)
}
