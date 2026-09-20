import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CartItems } from '../../components/cart/CartItems'
import { listing } from '../catalogue/catalogueFixtures'
import { addListingOnce, cartTotalPence, formatGbp, lineAmountPence, listingUnitPricePence, priceToPence, quantityWithinStock } from './CartContext'
import { mapCart } from './CartProvider'

describe('frontend cart listing identity', () => {
  it('maps an authoritative backend cart response to the shared filled-cart state', () => {
    const product = listing(26)
    const items = mapCart({ items: [{ productListingId: product.id, quantity: 2, productListing: product }] })
    expect(items).toEqual([{ productListingId: product.id, quantity: 2, listing: product }])
    expect(renderToStaticMarkup(<CartItems items={items} />)).toContain('Quantity: 2')
  })
  it('stores a listing by ProductListing id and increments supported quantity', () => {
    const first = listing(21, { legoProductId: 900 })
    const sameProductDifferentListing = listing(22, { legoProductId: 900 })
    const once = addListingOnce([], first)
    expect(once).toHaveLength(1)
    expect(once[0].productListingId).toBe(21)
    expect(addListingOnce(once, first)[0].quantity).toBe(2)
    expect(addListingOnce(once, sameProductDifferentListing)).toHaveLength(2)
  })

  it('never adds or increments beyond availableStock', () => {
    const product = listing(23, { availableStock: 2 })
    const once = addListingOnce([], product)
    const twice = addListingOnce(once, product)
    const capped = addListingOnce(twice, product)
    expect(twice[0].quantity).toBe(2)
    expect(capped[0].quantity).toBe(2)
    expect(addListingOnce([], listing(24, { availableStock: 0 }))).toHaveLength(0)
  })

  it('guards exact quantity mutations against stock limits and zero', () => {
    const product = listing(25, { availableStock: 3 })
    expect(quantityWithinStock({ listing: product }, 1)).toBe(true)
    expect(quantityWithinStock({ listing: product }, 3)).toBe(true)
    expect(quantityWithinStock({ listing: product }, 4)).toBe(false)
    expect(quantityWithinStock({ listing: product }, 0)).toBe(false)
  })

  it('calculates decimal GBP values deterministically in integer pence', () => {
    expect(priceToPence('44.99')).toBe(4499)
    expect(priceToPence('12.5')).toBe(1250)
    expect(formatGbp(4499)).toBe('£44.99')
  })

  it('renders quantity, unit price, line amount and total from the live cart item shape', () => {
    const first = listing(31, { originalPrice: '44.99', salePrice: null })
    const second = listing(32, { originalPrice: '10.01', salePrice: '8.01' })
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
