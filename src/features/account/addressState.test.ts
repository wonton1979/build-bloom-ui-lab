import { describe, expect, it } from 'vitest'
import { reconcileAddress } from './addressState'
import type { Address } from './addressApi'

const address = (id: number, shipping = false, billing = false): Address => ({
  id, recipientName: `Person ${id}`, line1: '1 Main Street', line2: null, city: 'Bath', postcode: 'BA1', country: 'GB', phone: null,
  isDefaultShipping: shipping, isDefaultBilling: billing,
})

describe('address state reconciliation', () => {
  it('adds the first backend address with both defaults', () => {
    expect(reconcileAddress([], address(1, true, true))).toEqual([address(1, true, true)])
  })

  it('keeps one address eligible for both independent defaults', () => {
    expect(reconcileAddress([address(1, true, false)], address(1, true, true))[0]).toMatchObject({ isDefaultShipping: true, isDefaultBilling: true })
  })

  it('clears the previous matching default when another address becomes default', () => {
    expect(reconcileAddress([address(1, true, true), address(2)], address(2, true, false))).toEqual([address(1, false, true), address(2, true, false)])
  })
})
