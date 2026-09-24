import { useEffect, useState } from 'react'
import { getCategories, type BackendCategory } from './api'

export type CatalogueCategoriesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; categories: BackendCategory[] }

export function useCatalogueCategories() {
  const [state, setState] = useState<CatalogueCategoriesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    getCategories(controller.signal).then(categories => {
      if (!controller.signal.aborted) setState({ status: 'ready', categories })
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: 'error' })
    })
    return () => controller.abort()
  }, [attempt])
  return { state, retry: () => { setState({ status: 'loading' }); setAttempt(value => value + 1) } }
}