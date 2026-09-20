import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CatalogueProduct, CatalogueProductDetails, VehiclesProductPage } from './VehiclesProductPage'
import { listing } from '../../features/catalogue/catalogueFixtures'
import { planProductSpreads } from '../../features/catalogue/productSpreads'
import { CartContext } from '../../features/cart/CartContext'

const renderPage = (products: ReturnType<typeof listing>[], index = 0, side: 'left' | 'right' = 'left') =>
  renderToStaticMarkup(<VehiclesProductPage side={side} spread={planProductSpreads(products)[index]} categoryName="Vehicles" status="ready" onRetry={vi.fn()} onViewDetails={vi.fn()} />)

describe('dynamic catalogue products and dedicated artwork', () => {
  it('starts normal browsing with the first non-featured products without an empty hero slot', () => {
    const products = [listing(1, { isFeatureProduct: true }), listing(2), listing(3), listing(4)]
    expect(renderPage(products)).not.toContain('vehicle-product--feature')
    expect(renderPage(products)).not.toContain('API product 1')
    expect(renderPage(products)).toContain('API product 2')
    expect(renderPage(products)).toContain('API product 3')
    const right = renderPage(products, 0, 'right')
    expect(right.match(/<article /g)).toHaveLength(1)
    expect(right).toContain('API product 4')
    expect(right).not.toContain('API product 1')
  })

  it('renders the exact backend artwork URL and naturally consumes a replacement URL', () => {
    for (const url of ['https://delivery.example/art-v1.png', 'https://delivery.example/replacement.png']) {
      const markup = renderToStaticMarkup(<CatalogueProduct listing={listing(1, { isFeatureProduct: true, catalogueArtworkUrl: url })} feature onViewDetails={vi.fn()} />)
      expect(markup).toContain(`src="${url}"`)
      expect(markup).not.toContain('/assets/categories/vehicles')
      expect(markup).not.toContain('/photograph-')
      expect(markup).toContain('vehicle-product__art-button')
      expect(markup).toContain(`aria-label="View details for API product 1"`)
    }
  })

  it.each([true, false])('keeps a product, metadata and working Details button with missing artwork (feature=%s)', isFeatureProduct => {
    const markup = renderToStaticMarkup(<CatalogueProduct listing={listing(77, { isFeatureProduct })} feature={isFeatureProduct} onViewDetails={vi.fn()} />)
    expect(markup).toContain('API product 77')
    expect(markup).toContain('123 pieces')
    expect(markup).toContain('Ages 9+')
    expect(markup).toContain('£25.99')
    expect(markup).toContain('data-artwork-state="empty"')
    expect(markup).not.toContain('<img')
    expect(markup).toContain('aria-label="View details for API product 77"')
    expect(markup).not.toContain('disabled')
  })

  it('renders later standards and their Details actions without artwork or a known set number', () => {
    const products = [listing(1, { isFeatureProduct: true }), ...Array.from({ length: 6 }, (_, i) => listing(i + 2))]
    const markup = renderPage(products, 1) + renderPage(products, 1, 'right')
    expect(markup.match(/<article /g)).toHaveLength(2)
    expect(markup.match(/View Details →/g)).toHaveLength(2)
    for (const id of [6, 7]) expect(markup).toContain(`data-listing-id="${id}"`)
  })

  it('keeps photography separate in the in-book details view and preserves image order', () => {
    const product = listing(8, { catalogueArtworkUrl: 'https://delivery.example/catalogue.png', listingImages: [
      { url: '/photo-second.png', altText: 'Second in storage, first in response', sortOrder: 2 },
      { url: '/photo-first.png', altText: 'First in storage, second in response', sortOrder: 1 },
    ] })
    const before = JSON.stringify(product.listingImages)
    const markup = renderToStaticMarkup(<CatalogueProductDetails listing={product} side="left" />)
    expect(markup.indexOf('/photo-second.png')).toBeLessThan(markup.indexOf('/photo-first.png'))
    expect(markup).not.toContain('catalogue.png')
    expect(JSON.stringify(product.listingImages)).toBe(before)
    expect(renderToStaticMarkup(<CatalogueProductDetails listing={product} side="right" />)).toContain('Description 8')
  })

  it('adds a restrained listing-specific Add to cart control to the details page', () => {
    const product = listing(18)
    const markup = renderToStaticMarkup(<CatalogueProductDetails listing={product} side="right" onAddToCart={vi.fn()} />)
    expect(markup).toContain('Add to cart')
    expect(markup).toContain('product-details__add')
    expect(markup).toContain('viewBox="0 0 24 24"')
    expect(markup).toContain('Condition: New')
  })

  it('renders available stock beside Condition and derives In cart from shared CartContext', () => {
    const product = listing(19, { availableStock: 4 })
    const markup = renderToStaticMarkup(<CartContext.Provider value={{
      items: [{ productListingId: product.id, listing: product, quantity: 2 }], addListing: vi.fn(),
      updateQuantity: vi.fn(), removeItem: vi.fn(), pendingItemIds: [],
      isLoading: false, error: null,
    }}><CatalogueProductDetails listing={product} side="right" onAddToCart={vi.fn()} /></CartContext.Provider>)
    expect(markup).toContain('Condition: New · Stock: 4')
    expect(markup).toContain('In cart: 2')
    expect(markup).not.toContain('>Stock: 4</')
  })

  it('renders out-of-stock and disables the add control without adding another stock row', () => {
    const product = listing(20, { availableStock: 0 })
    const markup = renderToStaticMarkup(<CatalogueProductDetails listing={product} side="right" onAddToCart={vi.fn()} />)
    expect(markup).toContain('Condition: New · Out of stock')
    expect(markup).toContain('class="product-details__add" disabled')
    expect(markup).not.toContain('>Stock: 0</')
  })

  it('starts with the first API image and renders compact thumbnails in API order', () => {
    const product = listing(9, { catalogueArtworkUrl: 'https://delivery.example/catalogue.png', listingImages: [
      { url: '/first.png', altText: 'First photograph', sortOrder: 9 },
      { url: '/second.png', altText: null, sortOrder: 1 },
      { url: '/third.png', altText: 'Third photograph', sortOrder: 4 },
    ] })
    const markup = renderToStaticMarkup(<CatalogueProductDetails listing={product} side="left" />)
    expect(markup).toContain('<div class="product-details__main-image"><img src="/first.png" alt="First photograph"')
    expect(markup.match(/class="product-details__thumbnail(?: |")/g)).toHaveLength(3)
    expect(markup.indexOf('src="/first.png"')).toBeLessThan(markup.indexOf('src="/second.png"'))
    expect(markup.indexOf('src="/second.png"')).toBeLessThan(markup.indexOf('src="/third.png"'))
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(markup).toContain('aria-label="Show product image 2" aria-pressed="false"')
    expect(markup).toContain('class="product-details__thumbnail is-selected"')
    expect(markup).not.toContain('catalogue.png')
  })

  it('renders empty, loading and error states without manufactured product data', () => {
    expect(renderPage([])).toContain('No more builds')
    for (const status of ['loading', 'error'] as const) {
      const markup = renderToStaticMarkup(<VehiclesProductPage side="left" categoryName="Vehicles" status={status} onRetry={vi.fn()} onViewDetails={vi.fn()} />)
      expect(markup).toContain(status === 'loading' ? 'Opening the collection' : 'Try again')
      expect(markup).not.toContain('£25.99')
    }
  })
})
