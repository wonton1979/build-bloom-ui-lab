import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CategoryOpeningPage } from './CategoryOpeningSpread'
import { categoryPresentation, resolveCatalogueCategories } from './categories'
import { curatedBackendCategories } from './catalogueData.test-utils'
import { categoryFromPath, categoryLocation, spreadAfterAction } from './catalogueSpread'
import { offer, product, fixtureCategory as category } from '../../features/catalogue/catalogueFixtures'
import { CatalogueProduct, VehiclesProductPage } from './VehiclesProductPage'
import { planProductSpreads } from '../../features/catalogue/productSpreads'

const callbacks = { onRetry: () => {}, onLeaflet: () => {}, onDetails: () => {} }
const categories = resolveCatalogueCategories(curatedBackendCategories)

describe('Shared category opening spread', () => {
  it.each(categories)('opens $label using its runtime category location and returns to its index spread', item => {
    const location = categoryFromPath(item.href, categories)
    expect(location).toEqual(categoryLocation(item.id, categories))
    expect(spreadAfterAction(location!, 'backward')).toBe(location?.returnTo)
    expect(spreadAfterAction(location!, 'forward')).toEqual(location)
    expect(spreadAfterAction({ kind: 'details', listingId: 7, returnTo: location! }, 'backward')).toEqual(location)
  })
  it('uses backend name, subtitle and description, with quiet reserved space for nullable art', () => {
    const markup = renderToStaticMarkup(<CategoryOpeningPage side="left" state={{ status: 'ready', category, products: [] }} {...callbacks} />)
    for (const text of [category.name, category.subtitle!, category.description!, 'Browse the leaflet']) expect(markup).toContain(text)
    expect(markup).toContain('category-opening__art-space')
    expect(markup).not.toContain('<img')
    expect(markup).not.toContain('placeholder')
  })
  it('adds future backend art without changing the page structure', () => {
    const markup = renderToStaticMarkup(<CategoryOpeningPage side="left" state={{ status: 'ready', category: { ...category, imageUrl: '/future-category.png' }, products: [] }} {...callbacks} />)
    expect(markup).toContain('src="/future-category.png"')
    expect(markup).toContain('alt=""')
  })
  it('continues using imageUrl for Category Opening Artwork when a managed thumbnail exists', () => {
    const markup = renderToStaticMarkup(<CategoryOpeningPage side="left" state={{ status: 'ready', category: {
      ...category, imageUrl: '/opening-art.png', thumbnailUrl: '/catalogue-thumbnail.png',
    }, products: [] }} {...callbacks} />)
    expect(markup).toContain('src="/opening-art.png"')
    expect(markup).not.toContain('/catalogue-thumbnail.png')
  })
  it('shows only the actual featured LegoProduct on the right', () => {
    const feature = product(3, [offer(3, { effectivePrice: '19.95' })], { isFeatureProduct: true })
    const markup = renderToStaticMarkup(<CategoryOpeningPage side="right" state={{ status: 'ready', category, products: [product(2), feature] }} {...callbacks} />)
    expect(markup).toContain('API product 3')
    expect(markup).toContain('£19.95')
    expect(markup).not.toContain('API product 2')
    expect(markup).toContain('vehicle-product--feature')
    expect(markup).toContain('123 pieces')
    expect(markup).toContain('Ages 9+')
    expect(markup).toContain('aria-label="View details for API product 3"')
  })
  it.each(categoryPresentation)('prints each curated feature product once for $label', ({ label }) => {
    const featured = product(99, [offer(99)], { catalogueArtworkUrl: '/feature.png', isFeatureProduct: true })
    const products = [product(4), featured, product(2), product(3), product(1), product(2)]
    const opening = renderToStaticMarkup(<CategoryOpeningPage side="right" state={{ status: 'ready', category: { ...category, name: label }, products }} {...callbacks} />)
    const shared = renderToStaticMarkup(<CatalogueProduct product={featured} feature onViewDetails={callbacks.onDetails} />)
    expect(opening).toContain(shared.slice(shared.indexOf('<article')))
    expect(shared).toContain('src="/feature.png"')
    const later = planProductSpreads(products).flatMap(spread => (['left', 'right'] as const).map(side => renderToStaticMarkup(<VehiclesProductPage side={side} spread={spread} categoryName={label} status="ready" onRetry={callbacks.onRetry} onViewDetails={callbacks.onDetails} />))).join('')
    expect(later).not.toContain('data-product-id="99"')
    expect([...later.matchAll(/data-product-id="(\d+)"/g)].map(match => Number(match[1]))).toEqual([4, 2, 3, 1])
  })
  it('does not promote an arbitrary product if no feature is assigned', () => {
    const markup = renderToStaticMarkup(<CategoryOpeningPage side="right" state={{ status: 'ready', category, products: [product(2)] }} {...callbacks} />)
    expect(markup).toContain('More little discoveries await')
    expect(markup).not.toContain('API product 2')
  })
  it('handles empty, loading and failed categories without invented products', () => {
    expect(renderToStaticMarkup(<CategoryOpeningPage side="right" state={{ status: 'ready', category, products: [] }} {...callbacks} />)).toContain('New discoveries are on their way')
    expect(renderToStaticMarkup(<CategoryOpeningPage side="left" state={{ status: 'loading' }} {...callbacks} />)).toContain('role="status"')
    expect(renderToStaticMarkup(<CategoryOpeningPage side="left" state={{ status: 'error' }} {...callbacks} />)).toContain('Try again')
  })
})
