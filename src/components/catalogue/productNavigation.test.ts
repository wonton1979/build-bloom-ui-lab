import { describe, expect, it } from 'vitest'
import { categoryLocation, productLocation, sameSpread, spreadAfterAction } from './catalogueSpread'
import { catalogueCategories } from './categories'

describe('product navigation within catalogue state', () => {
  it.each(catalogueCategories)('connects $label opening, normal spreads and details without changing category', ({ id }) => {
    expect(spreadAfterAction(categoryLocation(id), 'forward', 3)).toEqual(productLocation(id))
    expect(spreadAfterAction(categoryLocation(id), 'forward', 0)).toEqual(categoryLocation(id))
    expect(spreadAfterAction(productLocation(id), 'backward', 3)).toEqual(categoryLocation(id))
    expect(spreadAfterAction(productLocation(id, 2), 'backward', 3)).toEqual(productLocation(id, 1))
    expect(spreadAfterAction({ kind: 'details', listingId: 123, returnTo: productLocation(id, 1) }, 'backward', 3)).toEqual(productLocation(id, 1))
  })
  it('advances within bounds and has no forward destination on the final spread', () => {
    expect(spreadAfterAction(productLocation('vehicles'), 'forward', 3)).toEqual(productLocation('vehicles', 1))
    expect(sameSpread(spreadAfterAction(productLocation('vehicles', 2), 'forward', 3), productLocation('vehicles', 2))).toBe(true)
    expect(sameSpread(spreadAfterAction(productLocation('vehicles'), 'forward', 1), productLocation('vehicles'))).toBe(true)
  })
  it('returns from details to the originating product spread', () => {
    expect(spreadAfterAction({ kind: 'details', listingId: 123, returnTo: productLocation('vehicles', 5) }, 'backward', 6)).toEqual(productLocation('vehicles', 5))
  })
})
