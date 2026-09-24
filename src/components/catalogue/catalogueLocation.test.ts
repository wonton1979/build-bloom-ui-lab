import { describe, expect, it } from 'vitest'
import { catalogueLocationFromUrl, catalogueLocationHref, categoryLocation, normalizeProductLocation, productLocation, spreadAfterAction, categorySpreadAt } from './catalogueSpread'
import type { ProductLocation } from './catalogueSpread'
import { resolveCatalogueCategories } from './categories'
import { backendCategory, curatedBackendCategories } from './catalogueData.test-utils'

const categories = resolveCatalogueCategories(curatedBackendCategories)
const dynamicCategories = resolveCatalogueCategories([...curatedBackendCategories, backendCategory(999, 'Minecraft')])

describe('refresh-safe Catalogue location', () => {
  it('round-trips category opening and later product pages through legacy URLs', () => {
    const harryPotter = categoryLocation('harry-potter', categories)
    expect(catalogueLocationFromUrl('/categories/harry-potter', '', categories)).toEqual({ spread: harryPotter, open: true, leafletSide: null })
    const laterPage = productLocation('harry-potter', 2)
    const href = catalogueLocationHref(laterPage, { open: true })
    expect(href).toBe('/categories/harry-potter?page=3')
    expect(catalogueLocationFromUrl('/categories/harry-potter', '?page=3', categories)).toEqual({ spread: laterPage, open: true, leafletSide: null })
  })

  it('preserves exceptional legacy slugs and generates a stable slug for backend-only categories', () => {
    expect(categoryLocation('dc-batman', categories)).toMatchObject({ slug: 'dc-batman' })
    expect(catalogueLocationFromUrl('/categories/flowers-botanicals', '', categories).spread).toEqual(categoryLocation('flowers-botanicals', categories))
    const minecraft = dynamicCategories.find(({ backendId }) => backendId === 999)!
    expect(minecraft.id).toBe('minecraft')
    expect(catalogueLocationFromUrl(minecraft.href, '', dynamicCategories).spread).toEqual(categoryLocation('minecraft', dynamicCategories))
  })

  it('restores the open category Leaflet on either physical side', () => {
    for (const side of ['front', 'back'] as const) {
      const href = catalogueLocationHref(categoryLocation('creator', categories), { open: true, leafletSide: side })
      expect(catalogueLocationFromUrl('/categories/creator', new URL(href, 'https://buildandbloom.test').search, categories)).toEqual({
        spread: categoryLocation('creator', categories), open: true, leafletSide: side,
      })
    }
  })

  it('round-trips category → product → details → product → category for runtime categories', () => {
    const category = categoryLocation('minecraft', dynamicCategories)
    const product = spreadAfterAction(category, 'forward', 1, 3, dynamicCategories) as ProductLocation
    const details = { kind: 'details' as const, listingId: 75446, returnTo: product }
    const href = catalogueLocationHref(details, { open: true })
    expect(href).toBe('/categories/minecraft?details=75446&page=1')
    const restored = catalogueLocationFromUrl('/categories/minecraft', '?details=75446&page=1', dynamicCategories).spread
    expect(restored).toEqual(details)
    expect(spreadAfterAction(restored, 'backward', 1, 3, dynamicCategories)).toEqual(product)
    expect(spreadAfterAction(product, 'backward', 1, 3, dynamicCategories)).toEqual(category)
  })

  it('serializes and restores additional category spreads using the existing More navigation model', () => {
    const final = categorySpreadAt(2)
    const href = catalogueLocationHref(final, { open: true })
    expect(href).toBe('/?spread=categories-page-2')
    expect(catalogueLocationFromUrl('/', '?spread=categories-page-2', dynamicCategories).spread).toBe(final)
    expect(spreadAfterAction('categories-more', 'forward', 0, 3, dynamicCategories)).toBe(final)
    expect(spreadAfterAction(final, 'backward', 0, 3, dynamicCategories)).toBe('categories-more')
  })

  it('restores non-category book spreads and keeps the default book closed', () => {
    expect(catalogueLocationFromUrl('/', '', categories)).toEqual({ spread: 'front-matter', open: false, leafletSide: null })
    const href = catalogueLocationHref('categories-more', { open: true })
    expect(catalogueLocationFromUrl('/', new URL(href, 'https://buildandbloom.test').search, categories)).toEqual({ spread: 'categories-more', open: true, leafletSide: null })
  })

  it('falls back safely for stale categories and malformed or non-positive pages', () => {
    expect(catalogueLocationFromUrl('/categories/no-longer-listed', '?page=4', categories)).toEqual({ spread: 'front-matter', open: false, leafletSide: null })
    for (const query of ['?page=0', '?page=-2', '?page=abc']) {
      expect(catalogueLocationFromUrl('/categories/harry-potter', query, categories)).toEqual({ spread: categoryLocation('harry-potter', categories), open: true, leafletSide: null })
    }
  })

  it('normalizes stale/out-of-range product page indexes against current category listings', () => {
    expect(normalizeProductLocation(productLocation('vehicles', 50), 3, categories)).toEqual(productLocation('vehicles', 2))
    expect(normalizeProductLocation(productLocation('vehicles', 0), 0, categories)).toEqual(categoryLocation('vehicles', categories))
    expect(normalizeProductLocation(productLocation('vehicles', -4), 3, categories)).toEqual(productLocation('vehicles', 0))
  })
})