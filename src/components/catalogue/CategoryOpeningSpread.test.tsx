import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CategoryOpeningPage } from './CategoryOpeningSpread'
import { catalogueCategories } from './categories'
import { categoryFromPath, categoryLocation, spreadAfterAction } from './catalogueSpread'
import { listing } from '../../features/catalogue/catalogueFixtures'
import type { BackendCategory } from '../../features/catalogue/api'
import { CatalogueProduct, VehiclesProductPage } from './VehiclesProductPage'
import { planProductSpreads } from '../../features/catalogue/productSpreads'

const category: BackendCategory = { id: 52, name: 'Vehicles', subtitle: 'Server subtitle', description: 'Editorial words from the backend.', imageUrl: null }
const callbacks = { onRetry: () => {}, onLeaflet: () => {}, onDetails: () => {} }

describe('Shared category opening spread', () => {
  it.each(catalogueCategories)('opens $label using the same category location and returns to its index spread', category => {
    const location = categoryFromPath(category.href)
    expect(location).toEqual(categoryLocation(category.id))
    expect(spreadAfterAction(location!, 'backward')).toBe(catalogueCategories.indexOf(category) < 7 ? 'categories-primary' : 'categories-more')
    expect(spreadAfterAction(location!, 'forward')).toEqual(location)
    expect(spreadAfterAction({ kind: 'details', listingId: 7, returnTo: location! }, 'backward')).toEqual(location)
  })
  it('uses backend name, subtitle and description, with quiet reserved space for nullable art', () => {
    const markup = renderToStaticMarkup(<CategoryOpeningPage side="left" state={{ status: 'ready', category, listings: [] }} {...callbacks} />)
    for (const text of [category.name, category.subtitle!, category.description!, 'Browse the leaflet']) expect(markup).toContain(text)
    expect(markup).toContain('category-opening__art-space')
    expect(markup).not.toContain('<img')
    expect(markup).not.toContain('placeholder')
  })
  it('adds future backend art without changing the page structure', () => {
    const markup = renderToStaticMarkup(<CategoryOpeningPage side="left" state={{ status: 'ready', category: { ...category, imageUrl: '/future-category.png' }, listings: [] }} {...callbacks} />)
    expect(markup).toContain('src="/future-category.png"')
    expect(markup).toContain('alt=""')
  })
  it('shows only the actual featured listing on the right', () => {
    const markup = renderToStaticMarkup(<CategoryOpeningPage side="right" state={{ status: 'ready', category, listings: [listing(2), listing(3, { isFeatureProduct: true, salePrice: '19.95' })] }} {...callbacks} />)
    expect(markup).toContain('API product 3')
    expect(markup).toContain('£19.95')
    expect(markup).not.toContain('API product 2')
    expect(markup).toContain('vehicle-product--feature')
    expect(markup).toContain('123 pieces')
    expect(markup).toContain('Ages 9+')
    expect(markup).toContain('aria-label="View details for API product 3"')
  })
  it.each(catalogueCategories)('reuses the established printed feature exactly once for $label', ({ label }) => {
    const featured = listing(99, { isFeatureProduct: true, catalogueArtworkUrl: '/feature.png' })
    const listings = [listing(4), featured, listing(2), listing(3), listing(1), listing(2)]
    const opening = renderToStaticMarkup(<CategoryOpeningPage side="right" state={{ status: 'ready', category: { ...category, name: label }, listings }} {...callbacks} />)
    const shared = renderToStaticMarkup(<CatalogueProduct listing={featured} feature onViewDetails={callbacks.onDetails} />)
    expect(opening).toContain(shared.slice(shared.indexOf('<article')))
    const later = planProductSpreads(listings).flatMap(spread => (['left', 'right'] as const).map(side => renderToStaticMarkup(<VehiclesProductPage side={side} spread={spread} categoryName={label} status="ready" onRetry={callbacks.onRetry} onViewDetails={callbacks.onDetails} />))).join('')
    expect(later).not.toContain('data-listing-id="99"')
    expect([...later.matchAll(/data-listing-id="(\d+)"/g)].map(match => Number(match[1]))).toEqual([1, 2, 3, 4])
  })
  it('does not promote an arbitrary listing if no feature is assigned', () => {
    const markup = renderToStaticMarkup(<CategoryOpeningPage side="right" state={{ status: 'ready', category, listings: [listing(2)] }} {...callbacks} />)
    expect(markup).toContain('More little discoveries await')
    expect(markup).not.toContain('API product 2')
  })
  it('handles empty, loading and failed categories without invented products', () => {
    expect(renderToStaticMarkup(<CategoryOpeningPage side="right" state={{ status: 'ready', category, listings: [] }} {...callbacks} />)).toContain('New discoveries are on their way')
    expect(renderToStaticMarkup(<CategoryOpeningPage side="left" state={{ status: 'loading' }} {...callbacks} />)).toContain('role="status"')
    expect(renderToStaticMarkup(<CategoryOpeningPage side="left" state={{ status: 'error' }} {...callbacks} />)).toContain('Try again')
  })
})
