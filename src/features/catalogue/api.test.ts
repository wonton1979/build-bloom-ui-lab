import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCategories, getProducts } from './api'
import { getVehicles } from './vehicles'
import { damaged10759, fixtureCategory, offer, product } from './catalogueFixtures'

afterEach(() => vi.unstubAllGlobals())

const productPage = (items: ReturnType<typeof product>[], page = 1, totalPages = 1, totalItems = totalPages * 100) => ({ items, pagination: { page, pageSize: 100, totalItems, totalPages } })

describe('product-level public catalogue API', () => {
  it('parses managed category thumbnails and accepts a null thumbnail URL', async () => {
    const managed = { ...fixtureCategory, id: 42, thumbnailUrl: '/managed-category-thumbnail.png' }
    const legacyOnly = { ...fixtureCategory, id: 43, thumbnailUrl: null }
    const legacyContract = { id: 44, name: 'Legacy Theme', subtitle: null, description: null, imageUrl: null }
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => [managed, legacyOnly, legacyContract] })
    vi.stubGlobal('fetch', fetcher)

    await expect(getCategories()).resolves.toEqual([managed, legacyOnly, { ...legacyContract, thumbnailUrl: null }])
    expect(fetcher).toHaveBeenCalledWith('/api/categories', { signal: undefined })
  })

  it('loads category products by backend category ID and keeps nested offers', async () => {
    const item = product(1, [offer(11, { legoProductId: 1 }), offer(12, { legoProductId: 1, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', effectivePrice: '18.00', damageDescription: 'Corner crushed' })], { category: { ...fixtureCategory, id: 42 } })
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [{ ...fixtureCategory, id: 42 }] }).mockResolvedValueOnce({ ok: true, json: async () => productPage([item]) })
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()
    expect(await getVehicles(controller.signal)).toEqual([item])
    expect(fetcher).toHaveBeenCalledWith('/api/categories', { signal: controller.signal })
    expect(fetcher).toHaveBeenCalledWith('/api/products?categoryId=42&page=1&pageSize=100', { signal: controller.signal })
    expect(item.offers.map(entry => entry.id)).toEqual([11, 12])
  })

  it('reads all product-level pages and never flattens nested offers', async () => {
    const first = product(1, [offer(11, { legoProductId: 1 }), offer(12, { legoProductId: 1, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE' })])
    const second = product(2)
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => productPage([first], 1, 2, 101) }).mockResolvedValueOnce({ ok: true, json: async () => productPage([second], 2, 2, 101) })
    vi.stubGlobal('fetch', fetcher)
    const items = await getProducts({ categoryId: 11 })
    expect(items).toEqual([first, second])
    expect(items[0].offers).toHaveLength(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1][0]).toContain('page=2')
  })

  it('parses 10759 presentation from LegoProduct while keeping condition photos on listing 16901', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => productPage([damaged10759]) }))
    const [parsed] = await getProducts({ categoryId: 11 })
    expect(parsed.id).toBe(14947)
    expect(parsed.setNumber).toBe('10759')
    expect(parsed.productImages.map(image => image.id)).toEqual([380, 381, 382])
    expect(parsed.catalogueArtworkUrl).toBe('/catalogue-artwork-10759.png')
    expect(parsed.isFeatureProduct).toBe(true)
    expect(parsed.offers.map(item => item.id)).toEqual([16900, 16901])
    expect(parsed.offers.every(item => !('productImages' in item) && !('catalogueArtworkUrl' in item) && !('isFeatureProduct' in item))).toBe(true)
    expect(parsed.offers[1].usedConditionPhotos.map(photo => photo.id)).toEqual([1, 2, 3])
    expect(parsed.offers[1].usedConditionPhotos.every(photo => photo.listingId === 16901)).toBe(true)
  })

  it('preserves true and false LegoProduct retirement metadata and rejects a missing or invalid value', async () => {
    const retired = product(8, [offer(81, { legoProductId: 8 }), offer(82, { legoProductId: 8, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE' })], { isRetired: true })
    const active = product(9, [offer(91, { legoProductId: 9 })], { isRetired: false })
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => productPage([retired, active]) }))
    const products = await getProducts({ categoryId: 11 })
    expect(products.map(item => item.isRetired)).toEqual([true, false])
    expect(products[0].offers.every(item => !('isRetired' in item))).toBe(true)

    for (const value of [undefined, 'true']) {
      const malformed = { ...active, isRetired: value }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => productPage([malformed as unknown as ReturnType<typeof product>]) }))
      await expect(getProducts({ categoryId: 11 })).rejects.toThrow('Invalid catalogue response')
    }
  })

  it('rejects malformed old listing-level responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: 7, legoProduct: {} }], pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 } }) }))
    await expect(getProducts({ categoryId: 11 })).rejects.toThrow('Invalid catalogue response')
  })

  it('propagates public API failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(getProducts({ categoryId: 11 })).rejects.toThrow('Unable to load catalogue')
    await expect(getCategories()).rejects.toThrow('Unable to load categories')
  })

  it('filters other categories if the server unexpectedly ignores the filter', async () => {
    const valid = product(1)
    const other = product(2, [offer(2)], { category: { ...fixtureCategory, id: 13, name: 'Others' } })
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [fixtureCategory] })
      .mockResolvedValueOnce({ ok: true, json: async () => productPage([valid, other]) }))
    expect(await getVehicles()).toEqual([valid])
  })
})
