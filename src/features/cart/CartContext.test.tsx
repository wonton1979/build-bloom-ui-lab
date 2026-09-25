import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CartItems } from '../../components/cart/CartItems'
import { cartListing, damaged10759, offer } from '../catalogue/catalogueFixtures'
import { addListingOnce, cartTotalPence, formatGbp, lineAmountPence, listingUnitPricePence, priceToPence, quantityWithinStock } from './CartContext'
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
