// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CatalogueProduct, CatalogueProductDetails, VehiclesProductPage } from './VehiclesProductPage'
import { ConditionConfirmationDialog } from './ConditionConfirmationDialog'
import { useConditionConfirmation } from '../../features/catalogue/useConditionConfirmation'
import { damaged10759, offer, product, cartListing } from '../../features/catalogue/catalogueFixtures'
import { planProductSpreads } from '../../features/catalogue/productSpreads'
import { addListingOnce, CartContext } from '../../features/cart/CartContext'

const newOnly = product(1, [offer(11, { legoProductId: 1, effectivePrice: '25.99' })])
const damagedOnly = product(2, [offer(22, { legoProductId: 2, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', damageDescription: 'Creased corner', effectivePrice: '19.50', availableStock: 1 })])
const twoOffers = product(3, [offer(31, { legoProductId: 3, effectivePrice: '29.99' }), offer(32, { legoProductId: 3, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', damageDescription: 'Small dent on one edge', effectivePrice: '21.25', availableStock: 1 })])
const renderPage = (products: ReturnType<typeof product>[], index = 0, side: 'left' | 'right' = 'left') =>
  renderToStaticMarkup(<VehiclesProductPage side={side} spread={planProductSpreads(products)[index]} categoryName="Vehicles" status="ready" onRetry={vi.fn()} onViewDetails={vi.fn()} />)

function mount(element: React.ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => root.render(element))
  return { container, root }
}

afterEach(() => { document.body.innerHTML = '' })

describe('product-level Catalogue cards and Product Details offers', () => {
  it('renders one card for a LegoProduct with NEW and damaged-box offers', () => {
    const markup = renderToStaticMarkup(<CatalogueProduct product={twoOffers} onViewDetails={() => {}} />)
    expect(markup.match(/<article /g)).toHaveLength(1)
    expect(markup).toContain('data-product-id="3"')
    expect(markup).not.toContain('New – Outer Box Damage')
    expect(markup).not.toContain('Used')
  })

  it('keeps a damaged-box-only product purchasable as one product card', () => {
    const markup = renderToStaticMarkup(<CatalogueProduct product={damagedOnly} onViewDetails={() => {}} />)
    expect(markup).toContain('API product 2')
    expect(markup).toContain('data-product-id="2"')
    expect(markup).toContain('£19.50')
  })

  it('renders shared root Product Images for damaged-only sellable 10759, independent of its selected offer', () => {
    const usedOffer = damaged10759.offers.find(item => item.id === 16901)!
    expect(usedOffer).not.toHaveProperty('productImages')
    expect(usedOffer).not.toHaveProperty('listingImages')
    const markup = renderToStaticMarkup(<CatalogueProductDetails product={damaged10759} selectedOfferId={16901} side="left" />)
    for (const imageId of [380, 381, 382]) expect(markup).toContain(`/product-image-${imageId}.jpg`)
    expect(markup).not.toContain('No product photographs available')
    expect(markup).not.toContain('/used-condition-10759-')
  })

  it('reads shared Catalogue Artwork and Feature state from LegoProduct #14947', () => {
    const markup = renderToStaticMarkup(<CatalogueProduct product={damaged10759} feature onViewDetails={() => {}} />)
    expect(markup).toContain('src="/catalogue-artwork-10759.png"')
    expect(markup).toContain('From ')
    expect(markup).toContain('£18.75')
    expect(markup).toContain('data-product-id="14947"')
    expect(markup.match(/<article /g)).toHaveLength(1)
    expect(markup).not.toContain('£29.99')
    expect(damaged10759.isFeatureProduct).toBe(true)
    expect(damaged10759.offers.every(item => !('isFeatureProduct' in item) && !('catalogueArtworkUrl' in item))).toBe(true)
  })

  it('preserves artwork rules and displays a product once with missing artwork', () => {
    const markup = renderToStaticMarkup(<CatalogueProduct product={newOnly} onViewDetails={() => {}} />)
    expect(markup).toContain('data-artwork-state="empty"')
    expect(markup).toContain('API product 1')
    expect(markup).toContain('vehicle-product__from'); expect(markup).toContain('£25.99')
    expect(markup).toContain('123 pieces')
  })

  it('keeps normal NEW details and its Add to Cart action direct with effectivePrice', () => {
    const add = vi.fn()
    const mounted = mount(<CatalogueProductDetails product={newOnly} selectedOfferId={11} side="right" onAddToCart={add} />)
    expect(mounted.container.textContent).toContain('New')
    expect(mounted.container.textContent).toContain('£25.99')
    expect(mounted.container.querySelector('fieldset')).toBeNull()
    act(() => mounted.container.querySelector<HTMLButtonElement>('.product-details__add')!.click())
    expect(add).toHaveBeenCalledWith(newOnly.offers[0], newOnly.title)
    act(() => mounted.root.unmount())
  })

  it('shows two offers with independent effective prices and passes the selected listing ID', () => {
    const add = vi.fn()
    const mounted = mount(<CatalogueProductDetails product={twoOffers} selectedOfferId={31} side="right" onAddToCart={add} />)
    expect(mounted.container.textContent).toContain('£29.99')
    expect(mounted.container.textContent).toContain('£21.25')
    expect(mounted.container.textContent).toContain('New – Outer Box Damage')
    const damageChoice = [...mounted.container.querySelectorAll<HTMLInputElement>('input[type=radio]')].find(input => input.value === '32')!
    act(() => { damageChoice.click(); damageChoice.dispatchEvent(new Event('change', { bubbles: true })) })
    act(() => mounted.container.querySelector<HTMLButtonElement>('.product-details__add')!.click())
    expect(add).toHaveBeenCalledWith(twoOffers.offers[1], twoOffers.title)
    expect(mounted.container.querySelector('[data-detail-listing-id="32"]')).not.toBeNull()
    act(() => mounted.root.unmount())
  })

  it('shows no selector for a damaged-box-only offer and keeps its exact backend price', () => {
    const markup = renderToStaticMarkup(<CatalogueProductDetails product={damagedOnly} side="right" onAddToCart={() => {}} />)
    expect(markup).toContain('New – Outer Box Damage')
    expect(markup).toContain('£19.50')
    expect(markup).not.toContain('<fieldset')
    expect(markup).not.toContain('Used')
  })

  it('adds the exact selected Used listing 16901 with its effective price and LegoProduct identity', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    const add = vi.fn()
    function Flow() {
      const confirmation = useConditionConfirmation(add)
      return <>
        <CatalogueProductDetails product={damaged10759} selectedOfferId={16901} side="right"
          onAddToCart={(selected, title) => confirmation.request(selected, title)} />
        {confirmation.pending && <ConditionConfirmationDialog offer={confirmation.pending.offer} productTitle={confirmation.pending.productTitle}
          onCancel={confirmation.cancel} onConfirm={confirmation.confirm} />}
      </>
    }
    const mounted = mount(<Flow />)
    expect(mounted.container.querySelector('[data-detail-listing-id="16901"]')).not.toBeNull()
    expect(mounted.container.textContent).toContain('£18.75')
    await act(async () => mounted.container.querySelector<HTMLButtonElement>('.product-details__add')!.click())
    const dialogMarkup = mounted.container.querySelector('dialog')!.innerHTML
    for (const photoId of [1, 2, 3]) expect(dialogMarkup).toContain(`/used-condition-10759-${photoId}.jpg`)
    for (const imageId of [380, 381, 382]) expect(dialogMarkup).not.toContain(`/product-image-${imageId}.jpg`)
    expect(mounted.container.textContent).toContain('This does not affect your statutory rights.')
    expect(mounted.container.textContent).toContain("I've checked the condition — Add to Cart")
    await act(async () => mounted.container.querySelector<HTMLButtonElement>('.condition-confirmation__confirm')!.click())
    expect(add).toHaveBeenCalledExactlyOnceWith(damaged10759.offers[1])
    const cart = addListingOnce([], cartListing(add.mock.calls[0][0], damaged10759))
    expect(cart[0].productListingId).toBe(16901)
    expect(cart[0].listing.id).toBe(16901)
    expect(cart[0].listing.legoProductId).toBe(14947)
    expect(cart[0].listing.effectivePrice).toBe('18.75')
    expect(cart[0].listing.legoProduct.productImages.map(image => image.id)).toEqual([380, 381, 382])
    expect(addListingOnce(cart, cart[0].listing)[0].quantity).toBe(1)
    await act(async () => mounted.root.unmount())
  })

  it('shows product retirement metadata independently of the selected NEW offer', () => {
    const retired = product(4, [offer(41, { legoProductId: 4, effectivePrice: '26.50' })], { isRetired: true })
    const markup = renderToStaticMarkup(<CatalogueProductDetails product={retired} selectedOfferId={41} side="right" onAddToCart={() => {}} />)
    expect(markup).toContain('Retired Set')
    expect(markup).toContain('New')
    expect(markup).toContain('£26.50')
    expect(markup).toContain('data-detail-listing-id="41"')
    expect(retired.offers[0]).not.toHaveProperty('isRetired')
    const add = vi.fn()
    const mounted = mount(<CatalogueProductDetails product={retired} selectedOfferId={41} side="right" onAddToCart={add} />)
    act(() => mounted.container.querySelector<HTMLButtonElement>('.product-details__add')!.click())
    expect(add).toHaveBeenCalledWith(retired.offers[0], retired.title)
    act(() => mounted.root.unmount())
  })

  it('does not show retirement metadata for an active product', () => {
    const markup = renderToStaticMarkup(<CatalogueProductDetails product={newOnly} selectedOfferId={11} side="right" />)
    expect(markup).not.toContain('Retired Set')
  })

  it('keeps retired damaged-box offer selection, exact price, Add to Cart offer and confirmation unchanged', () => {
    const retired = product(5, [offer(51, { legoProductId: 5, effectivePrice: '30.00' }), offer(52, {
      legoProductId: 5, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', damageDescription: 'Creased corner',
      effectivePrice: '20.00', availableStock: 1,
      usedConditionPhotos: [{ id: 1, listingId: 52, url: '/damage.jpg', publicId: 'damage', sortOrder: 0, createdAt: '' }],
    })], { isRetired: true })
    const add = vi.fn()
    const mounted = mount(<CatalogueProductDetails product={retired} selectedOfferId={51} side="right" onAddToCart={add} />)
    expect(mounted.container.textContent).toContain('Retired Set')
    expect(mounted.container.textContent).toContain('New – Outer Box Damage')
    expect(mounted.container.textContent).toContain('£30.00')
    expect(mounted.container.textContent).toContain('£20.00')
    const damageChoice = [...mounted.container.querySelectorAll<HTMLInputElement>('input[type=radio]')].find(input => input.value === '52')!
    act(() => { damageChoice.click(); damageChoice.dispatchEvent(new Event('change', { bubbles: true })) })
    act(() => mounted.container.querySelector<HTMLButtonElement>('.product-details__add')!.click())
    expect(add).toHaveBeenCalledWith(retired.offers[1], retired.title)
    expect(mounted.container.querySelector('[data-detail-listing-id="52"]')).not.toBeNull()
    act(() => mounted.root.unmount())
  })

  it('still requires the existing outer-box condition confirmation for a retired damaged-box offer', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    const retired = product(6, [offer(62, {
      legoProductId: 6, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', damageDescription: 'Small dent',
      usedConditionPhotos: [{ id: 1, listingId: 62, url: '/damage.jpg', publicId: 'damage', sortOrder: 0, createdAt: '' }],
    })], { isRetired: true })
    const add = vi.fn()
    function Flow() {
      const confirmation = useConditionConfirmation(add)
      return <>
        <CatalogueProductDetails product={retired} selectedOfferId={62} side="right" onAddToCart={(selected, title) => confirmation.request(selected, title)} />
        {confirmation.pending && <ConditionConfirmationDialog offer={confirmation.pending.offer} productTitle={confirmation.pending.productTitle}
          onCancel={confirmation.cancel} onConfirm={confirmation.confirm} />}
      </>
    }
    const mounted = mount(<Flow />)
    expect(mounted.container.textContent).toContain('Retired Set')
    expect(mounted.container.textContent).toContain('New – Outer Box Damage')
    await act(async () => mounted.container.querySelector<HTMLButtonElement>('.product-details__add')!.click())
    expect(mounted.container.querySelector('dialog')).not.toBeNull()
    expect(mounted.container.textContent).toContain('Small dent')
    expect(mounted.container.textContent).not.toContain('retired')
    expect(add).not.toHaveBeenCalled()
    await act(async () => mounted.container.querySelector<HTMLButtonElement>('.condition-confirmation__confirm')!.click())
    expect(add).toHaveBeenCalledExactlyOnceWith(retired.offers[0])
    await act(async () => mounted.root.unmount())
  })

  it('shows stock for the selected offer and cart quantity by listing ID', () => {
    const selected = cartListing(twoOffers.offers[1], twoOffers)
    const markup = renderToStaticMarkup(<CartContext.Provider value={{
      items: [{ productListingId: 32, listing: selected, quantity: 1 }], refreshCart: vi.fn().mockResolvedValue(undefined), addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn(), pendingItemIds: [], isLoading: false, error: null,
    }}><CatalogueProductDetails product={twoOffers} selectedOfferId={32} side="right" onAddToCart={vi.fn()} /></CartContext.Provider>)
    expect(markup).toContain('Stock: 1')
    expect(markup).toContain('In cart: 1 · Maximum available')
    expect(markup).toContain('disabled')
  })

  it('uses the single product feature and leaves later spreads product-level', () => {
    const feature = product(9, [offer(90, { legoProductId: 9 })], { isFeatureProduct: true })
    const items = [feature, product(2), product(3)]
    expect(planProductSpreads(items)[0].left.map(item => item.id)).toEqual([2, 3])
    expect(feature.isFeatureProduct).toBe(true)
    expect(feature.offers[0]).not.toHaveProperty('isFeatureProduct')
    expect(renderPage(items, 0, 'left')).toContain('data-product-id="2"')
    expect(renderPage(items, 0, 'left')).not.toContain('data-product-id="9"')
  })

  it('does not print a product that has no sellable offer', () => {
    const unavailable = product(10, [offer(100, { legoProductId: 10, currentStock: 0, availableStock: 0 })])
    expect(planProductSpreads([unavailable])).toEqual([])
  })
})
