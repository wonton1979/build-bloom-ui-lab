import { afterEach, describe, expect, it, vi } from 'vitest'
import { CatalogueApiError, searchProducts } from './api'
import { offer, product } from './catalogueFixtures'

afterEach(() => vi.unstubAllGlobals())

describe('server-paginated public search', () => {
  it.each(['Ferrari', '77240', '  City & car  '])('sends %s as q without a category restriction', async query => {
    const items = [product(1), product(2, [offer(22, { legoProductId: 2 })], { category: { id: 13, name: 'Others', subtitle: null, description: null, imageUrl: null, thumbnailUrl: null } })]
    const data = { items, pagination: { page: 2, pageSize: 12, totalItems: 26, totalPages: 3 } }
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => data })
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()
    expect(await searchProducts(query, 2, 12, controller.signal)).toEqual(data)
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`/api/products?${new URLSearchParams({ q: query.trim(), page: '2', pageSize: '12' })}`, { signal: controller.signal })
  })

  it('returns genuine zero results without inventing a page', async () => {
    const data = { items: [], pagination: { page: 1, pageSize: 12, totalItems: 0, totalPages: 0 } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
    expect(await searchProducts('no match')).toEqual(data)
  })

  it.each([400, 500])('keeps HTTP %s distinct from zero matches', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }))
    await expect(searchProducts('test')).rejects.toMatchObject({ status, name: 'CatalogueApiError' })
  })

  it('does not request blank queries or invalid page bounds', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    for (const [q, page, size] of [[' ', 1, 12], ['x', 0, 12], ['x', 1.5, 12], ['x', 1, 101]] as const) {
      await expect(searchProducts(q, page, size)).rejects.toBeInstanceOf(CatalogueApiError)
    }
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects malformed metadata instead of creating phantom pagination', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], pagination: { page: 1, pageSize: 12, totalItems: 25, totalPages: 1 } }) }))
    await expect(searchProducts('test')).rejects.toThrow('Invalid search response')
  })

  it('propagates cancellation rather than manufacturing empty results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    await expect(searchProducts('test')).rejects.toMatchObject({ name: 'AbortError' })
  })
})
