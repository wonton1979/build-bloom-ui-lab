import { useCallback, useEffect, useRef, useState } from 'react'
import { CatalogueApiError, searchProducts } from './api'
import type { ProductsResponse } from './api'

export type SearchState =
  | { status: 'initial' }
  | { status: 'loading'; query: string; page: number }
  | { status: 'results'; query: string; data: ProductsResponse }
  | { status: 'empty'; query: string }
  | { status: 'error'; query: string; page: number; message: string }

/** Mounted with the book, not the disposable dialog: Details cannot erase a search. */
export function useCatalogueSearch() {
  const [input, setInput] = useState('')
  const [state, setState] = useState<SearchState>({ status: 'initial' })
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const request = useRef<AbortController | null>(null)
  const pending = useRef(false)
  const cancel = useCallback(() => {
    generation.current += 1
    clearTimeout(timer.current)
    request.current?.abort()
    pending.current = false
  }, [])
  useEffect(() => cancel, [cancel])

  const search = useCallback((value: string, page = 1, delay = 0) => {
    cancel()
    const query = value.trim()
    if (!query) { setState({ status: 'initial' }); return }
    const run = generation.current
    pending.current = true
    setState({ status: 'loading', query, page })
    timer.current = setTimeout(() => {
      const controller = new AbortController()
      request.current = controller
      const valid = () => run === generation.current && !controller.signal.aborted
      const load = async () => {
        try {
          let data = await searchProducts(query, page, 12, controller.signal)
          // A catalogue change can remove the last page between requests.
          if (valid() && data.pagination.totalPages > 0 && page > data.pagination.totalPages) {
            data = await searchProducts(query, data.pagination.totalPages, 12, controller.signal)
          }
          if (!valid()) return
          if (data.pagination.totalItems > 0 && !data.items.length) throw new Error('Search results changed; please retry')
          setState(data.pagination.totalItems === 0 ? { status: 'empty', query } : { status: 'results', query, data })
        } catch (error) {
          if (valid()) setState({ status: 'error', query, page, message: error instanceof CatalogueApiError ? error.message : 'We couldn’t search the catalogue. Please try again.' })
        } finally { if (valid()) pending.current = false }
      }
      void load()
    }, delay)
  }, [cancel])

  const changeInput = (value: string) => { setInput(value); search(value, 1, 300) }
  const reset = () => { cancel(); setInput(''); setState({ status: 'initial' }) }
  const changePage = (page: number) => {
    if (pending.current || state.status !== 'results' || !Number.isInteger(page) || page < 1 || page > state.data.pagination.totalPages || page === state.data.pagination.page) return
    search(state.query, page)
  }
  const retry = () => { if (state.status === 'error') search(state.query, state.page) }
  return { input, state, changeInput, submit: () => search(input), changePage, retry, reset }
}

export type CatalogueSearch = ReturnType<typeof useCatalogueSearch>
