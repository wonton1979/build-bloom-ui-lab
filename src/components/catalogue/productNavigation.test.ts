import { describe, expect, it } from 'vitest'
import { productLocation, sameSpread, spreadAfterAction } from './catalogueSpread'

describe('product navigation within catalogue state', () => {
  it('returns to Categories only from the first spread', () => {
    expect(spreadAfterAction(productLocation(), 'backward', 3)).toBe('categories-more')
    expect(spreadAfterAction(productLocation(2), 'backward', 3)).toEqual(productLocation(1))
  })
  it('advances within bounds and has no forward destination on the final spread', () => {
    expect(spreadAfterAction(productLocation(), 'forward', 3)).toEqual(productLocation(1))
    expect(sameSpread(spreadAfterAction(productLocation(2), 'forward', 3), productLocation(2))).toBe(true)
    expect(sameSpread(spreadAfterAction(productLocation(), 'forward', 1), productLocation())).toBe(true)
  })
  it('returns from details to the originating product spread', () => {
    expect(spreadAfterAction({ kind: 'details', listingId: 123, returnTo: productLocation(5) }, 'backward', 6)).toEqual(productLocation(5))
  })
})
