import { describe, expect, it } from 'vitest'
import { catalogueLocationFromUrl, catalogueLocationHref, categoryLocation, normalizeProductLocation, productLocation } from './catalogueSpread'

describe('refresh-safe Catalogue location', () => {
  it('round-trips category opening and later product pages through the URL', () => {
    const harryPotter = categoryLocation('harry-potter')
    expect(catalogueLocationFromUrl('/categories/harry-potter', '')).toEqual({ spread: harryPotter, open: true, leafletSide: null })

    const laterPage = productLocation('harry-potter', 2)
    const href = catalogueLocationHref(laterPage, { open: true })
    expect(href).toBe('/categories/harry-potter?page=3')
    expect(catalogueLocationFromUrl('/categories/harry-potter', '?page=3')).toEqual({ spread: laterPage, open: true, leafletSide: null })
  })

  it('restores the open category Leaflet on either physical side', () => {
    for (const side of ['front', 'back'] as const) {
      const href = catalogueLocationHref(categoryLocation('creator'), { open: true, leafletSide: side })
      expect(catalogueLocationFromUrl('/categories/creator', new URL(href, 'https://buildandbloom.test').search)).toEqual({
        spread: categoryLocation('creator'), open: true, leafletSide: side,
      })
    }
  })

  it('restores a product-details location and its category page return context', () => {
    const details = { kind: 'details' as const, listingId: 75446, returnTo: productLocation('vehicles', 1) }
    const href = catalogueLocationHref(details, { open: true })
    expect(href).toBe('/categories/vehicles?details=75446&page=2')
    expect(catalogueLocationFromUrl('/categories/vehicles', '?details=75446&page=2')).toEqual({
      spread: details, open: true, leafletSide: null,
    })
  })

  it('restores non-category book spreads and keeps the default book closed', () => {
    expect(catalogueLocationFromUrl('/', '')).toEqual({ spread: 'front-matter', open: false, leafletSide: null })
    const href = catalogueLocationHref('categories-more', { open: true })
    expect(catalogueLocationFromUrl('/', new URL(href, 'https://buildandbloom.test').search)).toEqual({
      spread: 'categories-more', open: true, leafletSide: null,
    })
  })

  it('falls back safely for stale categories and malformed or non-positive pages', () => {
    expect(catalogueLocationFromUrl('/categories/no-longer-listed', '?page=4')).toEqual({
      spread: 'front-matter', open: false, leafletSide: null,
    })
    for (const query of ['?page=0', '?page=-2', '?page=abc']) {
      expect(catalogueLocationFromUrl('/categories/harry-potter', query)).toEqual({
        spread: categoryLocation('harry-potter'), open: true, leafletSide: null,
      })
    }
  })

  it('normalizes stale/out-of-range page indexes against current category data', () => {
    expect(normalizeProductLocation(productLocation('vehicles', 50), 3)).toEqual(productLocation('vehicles', 2))
    expect(normalizeProductLocation(productLocation('vehicles', 0), 0)).toEqual(categoryLocation('vehicles'))
    expect(normalizeProductLocation(productLocation('vehicles', -4), 3)).toEqual(productLocation('vehicles', 0))
  })
})
