import { useEffect, useState } from 'react'
import { getProducts, type BackendCategory, type CatalogueProduct } from './api'
import { selectCategoryProducts } from './productSpreads'

export type CategoryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; category: BackendCategory; products: CatalogueProduct[] }

/** Load products by the already-resolved backend category ID. */
export function useCategoryCatalogue(category: BackendCategory | undefined, categoriesResolved = true) {
  const [result, setResult] = useState<{ id: number; state: CategoryState }>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!category) return
    const controller = new AbortController()
    getProducts({ categoryId: category.id }, controller.signal).then(products => {
      if (!controller.signal.aborted) setResult({ id: category.id, state: {
        status: 'ready', category, products: products.filter(item => item.category?.id === category.id),
      } })
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ id: category.id, state: { status: 'error' } })
    })
    return () => controller.abort()
  }, [category, attempt])
  const retry = () => { setResult(undefined); setAttempt(value => value + 1) }
  const state: CategoryState = result && result.id === category?.id
    ? result.state
    : category ? { status: 'loading' } : categoriesResolved ? { status: 'error' } : { status: 'loading' }
  return { state, retry }
}

export function categoryProducts(products: readonly CatalogueProduct[]) {
  return selectCategoryProducts(products)
}
