import { describe, expect, it } from 'vitest'
import { categoryLocation, productLocation, sameSpread, spreadAfterAction } from './catalogueSpread'
import { resolveCatalogueCategories } from './categories'
import { curatedBackendCategories } from './catalogueData.test-utils'

const categories = resolveCatalogueCategories(curatedBackendCategories)
const categorySpreadCount = Math.ceil(Math.ceil(categories.length / 3) / 2)

describe('product navigation within catalogue state', () => {
  it.each(categories)('connects $label opening, normal spreads and details without changing category', ({ id }) => {
    const category = categoryLocation(id, categories)
    expect(spreadAfterAction(category, 'forward', 3, categorySpreadCount, categories)).toEqual(productLocation(id))
    expect(spreadAfterAction(category, 'forward', 0, categorySpreadCount, categories)).toEqual(category)
    expect(spreadAfterAction(productLocation(id), 'backward', 3, categorySpreadCount, categories)).toEqual(category)
    expect(spreadAfterAction(productLocation(id, 2), 'backward', 3, categorySpreadCount, categories)).toEqual(productLocation(id, 1))
    expect(spreadAfterAction({ kind: 'details', listingId: 123, returnTo: productLocation(id, 1) }, 'backward', 3, categorySpreadCount, categories)).toEqual(productLocation(id, 1))
  })
  it('advances within bounds and has no forward destination on the final spread', () => {
    expect(spreadAfterAction(productLocation('vehicles'), 'forward', 3, categorySpreadCount, categories)).toEqual(productLocation('vehicles', 1))
    expect(sameSpread(spreadAfterAction(productLocation('vehicles', 2), 'forward', 3, categorySpreadCount, categories), productLocation('vehicles', 2))).toBe(true)
    expect(sameSpread(spreadAfterAction(productLocation('vehicles'), 'forward', 1, categorySpreadCount, categories), productLocation('vehicles'))).toBe(true)
  })
  it('returns from details to the originating product spread', () => {
    expect(spreadAfterAction({ kind: 'details', listingId: 123, returnTo: productLocation('vehicles', 5) }, 'backward', 6, categorySpreadCount, categories)).toEqual(productLocation('vehicles', 5))
  })
})