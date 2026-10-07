import { orderInput } from '../checkout/state'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CartItems } from '../../components/cart/CartItems'
import { cartListing, damaged10759, offer } from '../catalogue/catalogueFixtures'
import { checkoutQuantity, addListingOnce, cartTotalPence, formatGbp, lineAmountPence, listingUnitPricePence, priceToPence, quantityWithinStock } from './CartContext'
import { mapCart } from './CartProvider'

describe('frontend cart listing identity and quantity', () => {
  it('maps a refreshed backend cart response without losing its selected offer identity', () => {
    const newDamageOffer = cartListing(offer(26, { legoProductId: 700, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', damageDescription: 'Crushed outer corner', effectivePrice: '18.75', availableStock: 1 }))
    const items = mapCart({ items: [{ productListingId: newDamageOffer.id, quantity: 1, productListing: newDamageOffer }] })
    expect(items).toEqual([{ productListingId: 26, quantity: 1, listing: newDamageOffer }])
    expect(items[0].listing.condition).toBe('USED_LIKE_NEW')
    expect(items[0].listing.damageDescription).toBe('Crushed outer corner')
    expect(renderToStaticMarkup(<CartItems items={items} />)).toContain('New – Outer Box Damage')
  })

  it('stores distinct ProductListing IDs independently and increments normal NEW stock', () => {
    const first = cartListing(offer(21, { legoProductId: 900 }))
    const sameProductDifferentListing = cartListing(offer(22, { legoProductId: 900 }))
    const once = addListingOnce([], first)
    expect(once).toHaveLength(1)
    expect(once[0].productListingId).toBe(21)
    expect(addListingOnce(once, first)[0].quantity).toBe(2)
    expect(addListingOnce(once, sameProductDifferentListing)).toHaveLength(2)
  })

  it('caps a USED_LIKE_NEW physical offer at one even if reported stock is larger', () => {
    const damaged = cartListing(offer(23, { condition: 'USED_LIKE_NEW', availableStock: 4 }))
    const once = addListingOnce([], damaged)
    expect(addListingOnce(once, damaged)[0].quantity).toBe(1)
    expect(quantityWithinStock({ listing: damaged }, 1)).toBe(true)
    expect(quantityWithinStock({ listing: damaged }, 2)).toBe(false)
    expect(addListingOnce([], cartListing(offer(24, { condition: 'USED_LIKE_NEW', availableStock: 0 })))).toHaveLength(0)
  })

  it('keeps the damaged 10759 cart row keyed to listing 16901 and uses shared product images', () => {
    const usedOffer = damaged10759.offers.find(item => item.id === 16901)!
    const listing = cartListing(usedOffer, damaged10759)
    const items = addListingOnce([], listing)
    expect(items[0].productListingId).toBe(16901)
    expect(items[0].listing.id).toBe(16901)
    expect(items[0].listing.legoProduct.id).toBe(14947)
    expect(items[0].listing.effectivePrice).toBe('18.75')
    expect(addListingOnce(items, listing)[0].quantity).toBe(1)
    const markup = renderToStaticMarkup(<CartItems items={items} />)
    expect(markup).toContain('data-cart-listing-id="16901"')
    expect(markup).toContain('New – Outer Box Damage')
    expect(markup).toContain('Unit price £18.75')
    expect(markup).toContain('/product-image-380.jpg')
  })

  it('guards normal NEW quantities by availableStock and rejects zero', () => {
    const normal = cartListing(offer(25, { availableStock: 3 }))
    expect(quantityWithinStock({ listing: normal }, 1)).toBe(true)
    expect(quantityWithinStock({ listing: normal }, 3)).toBe(true)
    expect(quantityWithinStock({ listing: normal }, 4)).toBe(false)
    expect(quantityWithinStock({ listing: normal }, 0)).toBe(false)
  })

  it('calculates decimal GBP values deterministically in integer pence', () => {
    expect(priceToPence('44.99')).toBe(4499)
    expect(priceToPence('12.5')).toBe(1250)
    expect(formatGbp(4499)).toBe('£44.99')
  })

  it('renders effective unit prices and totals from exact cart listings', () => {
    const first = cartListing(offer(31, { originalPrice: '44.99', effectivePrice: '44.99' }))
    const second = cartListing(offer(32, { originalPrice: '10.01', salePrice: '8.01', effectivePrice: '8.01' }))
    const items = addListingOnce(addListingOnce(addListingOnce([], first), first), second)
    expect(items[0].quantity).toBe(2)
    expect(listingUnitPricePence(items[0])).toBe(4499)
    expect(lineAmountPence(items[0])).toBe(8998)
    expect(listingUnitPricePence(items[1])).toBe(801)
    expect(cartTotalPence(items)).toBe(9799)
    const markup = renderToStaticMarkup(<CartItems items={items} />)
    expect(markup).toContain('Quantity: 2')
    expect(markup).toContain('Unit price £44.99')
    expect(markup).toContain('£89.98')
    expect(markup).toContain('Unit price £8.01')
    expect(markup).toContain('£97.99')
  })
})

describe('old and new cart allocation contracts', () => {
  const listing = cartListing(offer(41))
  const address = { id: 1, recipientName: 'Customer', line1: '1 Street', line2: null, city: 'Bath', postcode: 'BA1', country: 'GB', phone: null, isDefaultBilling: true, isDefaultShipping: true }
  it('retains authoritative metadata while showing total quantity and available intent', () => {
    const items = mapCart({ items: [{ productListingId: 41, productListing: listing, quantity: 2, allocatedQuantity: 1, unallocatedQuantity: 1 }] })
    expect(items[0]).toMatchObject({ quantity: 2, allocatedQuantity: 1, unallocatedQuantity: 1 })
    const html = renderToStaticMarkup(<CartItems items={items} />)
    expect(html).toContain('Quantity: 2'); expect(html).toContain('1 in pending order'); expect(html).toContain('1 available')
    expect(orderInput(items, address).items).toEqual([{ productListingId: 41, quantity: 1 }])
  })
  it('preserves old totals and omits allocation wording when there are none', () => {
    const old = mapCart({ items: [{ productListingId: 41, productListing: listing, quantity: 2 }] })
    expect(checkoutQuantity(old[0])).toBe(2); expect(orderInput(old, address).items[0].quantity).toBe(2)
    expect(renderToStaticMarkup(<CartItems items={old} />)).not.toContain('pending order')
    expect(renderToStaticMarkup(<CartItems items={[{ ...old[0], allocatedQuantity: 0, unallocatedQuantity: 2 }]} />)).not.toContain('pending order')
  })
  it('excludes fully allocated lines and keeps exact listing identities', () => {
    const items = [{ productListingId: 41, listing, quantity: 2, allocatedQuantity: 2, unallocatedQuantity: 0 }, { productListingId: 42, listing, quantity: 3, allocatedQuantity: 1, unallocatedQuantity: 2 }]
    expect(orderInput(items, address).items).toEqual([{ productListingId: 42, quantity: 2 }])
  })
  it.each([
    { allocatedQuantity: 1 }, { unallocatedQuantity: 1 },
    { allocatedQuantity: -1, unallocatedQuantity: 3 },
    { allocatedQuantity: 0.5, unallocatedQuantity: 1.5 },
    { allocatedQuantity: 1, unallocatedQuantity: 2 },
    { allocatedQuantity: NaN, unallocatedQuantity: 2 },
  ])('rejects malformed allocation data safely: %j', fields => {
    expect(() => mapCart({ items: [{ productListingId: 41, productListing: listing, quantity: 2, ...fields }] })).toThrow('cart quantities')
    expect(checkoutQuantity({ quantity: 2, ...fields })).toBeNull()
  })
  it('stock limits apply to new intent while quantity targets stay total', () => {
    const item = { listing: cartListing(offer(41, { availableStock: 2 })), allocatedQuantity: 1 }
    expect(quantityWithinStock(item, 3)).toBe(true)
    expect(quantityWithinStock(item, 4)).toBe(false)
  })
})
