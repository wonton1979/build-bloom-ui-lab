import { afterEach, describe, expect, it, vi } from 'vitest'
import { getProducts } from './api'
import { getVehicles } from './vehicles'
import { listing } from './catalogueFixtures'

afterEach(() => vi.unstubAllGlobals())

describe('public catalogue API', () => {
  it('requests the official VEHICLES category, never set-number searches, and passes cancellation', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], pagination: { page: 1, totalPages: 1 } }) })
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()
    await getVehicles(controller.signal)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith('/api/products?category=VEHICLES&page=1&pageSize=100', { signal: controller.signal })
  })

  it('reads all result pages instead of assuming the first page contains the set', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 1 }], pagination: { page: 1, totalPages: 2 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 2 }], pagination: { page: 2, totalPages: 2 } }) })
    vi.stubGlobal('fetch', fetcher)
    expect(await getProducts({ category: 'VEHICLES' })).toEqual([{ id: 1 }, { id: 2 }])
    expect(fetcher.mock.calls[1][0]).toContain('page=2')
  })

  it('propagates API failures instead of displaying invented product data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(getProducts({ category: 'VEHICLES' })).rejects.toThrow('Unable to load catalogue')
  })

  it('rejects the old runtime contract instead of using set numbers as categories', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: 1, legoProduct: { setNumber: 'legacy-set' } }], pagination: { page: 1, totalPages: 1 } }) }))
    await expect(getVehicles()).rejects.toThrow('Catalogue API contract mismatch')
  })

  it('excludes other categories even if the server ignores the filter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [
      listing(1),
      listing(2, { colorfulLifeCategory: 'OTHERS' }),
      listing(3, { colorfulLifeCategory: null }),
    ], pagination: { page: 1, totalPages: 1 } }) }))
    expect(await getVehicles()).toEqual([listing(1)])
  })
})
