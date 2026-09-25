import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { cartListing, offer } from '../../features/catalogue/catalogueFixtures'
import { CartItems } from './CartItems'
import { RemoveItemDialog } from './RemoveItemDialog'

describe('Remove Item confirmation content', () => {
  const item = { productListingId: 42, quantity: 2, listing: cartListing(offer(42, { salePrice: '19.99', effectivePrice: '19.99' })) }

  it('labels a native modal dialog and uses the selected listing, image and effective unit price', () => {
    const confirm = vi.fn(), cancel = vi.fn()
    const markup = renderToStaticMarkup(<RemoveItemDialog item={item} onCancel={cancel} onConfirm={confirm} />)
    expect(markup).toContain('<dialog')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-labelledby=')
    expect(markup).toContain('aria-describedby=')
    expect(markup).toContain('Remove this item?')
    expect(markup).toContain(item.listing.legoProduct.title)
    expect(markup).toContain('/product-image-42.jpg')
    expect(markup).toContain('£19.99')
    expect(markup).toContain('Are you sure you want to take this out of your cart?')
    expect(markup).toContain('Keep it')
    expect(confirm).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
  })

  it('does not open a confirmation or mutate the cart when rendering the row trigger', () => {
    const confirm = vi.fn()
    const markup = renderToStaticMarkup(<CartItems items={[item]} onConfirmRemove={confirm} />)
    expect(markup).toContain(`aria-label="Remove ${item.listing.legoProduct.title}"`)
    expect(markup).toContain('Quantity: 2')
    expect(markup).toContain('£39.98')
    expect(markup).toContain('Increase API product 42 quantity')
    expect(markup).toContain('Decrease API product 42 quantity')
    expect(markup).not.toContain('<dialog')
    expect(confirm).not.toHaveBeenCalled()
    expect(item.quantity).toBe(2)
  })

  it('disables decrease at the minimum quantity', () => {
    const markup = renderToStaticMarkup(<CartItems items={[{ ...item, quantity: 1 }]} />)
    expect(markup).toContain('Decrease API product 42 quantity" disabled')
    expect(markup).not.toContain('Increase API product 42 quantity" disabled')
  })

  it('keeps the product identity readable without a photograph', () => {
    const withoutImage = { ...item, listing: { ...item.listing, legoProduct: { ...item.listing.legoProduct, productImages: [] } } }
    const markup = renderToStaticMarkup(<RemoveItemDialog item={withoutImage} onCancel={() => {}} onConfirm={() => {}} />)
    expect(markup).toContain(item.listing.legoProduct.title)
    expect(markup).not.toContain('remove-item-dialog__image')
  })
})
