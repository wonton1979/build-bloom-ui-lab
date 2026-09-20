import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CategoryLeaflet, LeafletContent } from './CategoryLeaflet'
import { categoryProducts } from '../../features/catalogue/useCategoryCatalogue'
import { listing } from '../../features/catalogue/catalogueFixtures'

const category = listing(1).category!
const feature = listing(9, { isFeatureProduct: true, salePrice: '12.99', availableStock: 0 })
const others = [listing(1), listing(2)]
const printedIds = (markup: string) => [...markup.matchAll(/data-leaflet-listing="(\d+)"/g)].map(match => Number(match[1]))

describe('Category advertising leaflet', () => {
  it('uses the established feature selection, stable order and deduplication', () => {
    const products = [others[1], feature, others[0], others[0]]
    expect(categoryProducts(products)).toEqual({ feature, others })
    expect(categoryProducts(others)).toEqual({ feature: undefined, others })
    expect(products).toHaveLength(4)
  })
  it('prints the featured listing, current price and availability on the front', () => {
    const markup = renderToStaticMarkup(<LeafletContent category={category} listings={[feature, ...others]} side="front" onDetails={() => {}} />)
    expect(markup).toContain('Featured build')
    expect(markup).toContain('API product 9')
    expect(markup).toContain('£12.99')
    expect(markup).toContain('£25.99')
    expect(markup).toContain('Out of stock')
    expect(markup).toContain('123 pieces')
    expect(markup).toContain('/photograph-9.png')
    expect(markup).toContain('API product 1')
    expect(markup).toContain('API product 2')
  })
  it('prints only remaining listings on the back without front products or physical pagination', () => {
    const markup = renderToStaticMarkup(<LeafletContent category={category} listings={[feature, ...others, listing(3), listing(4)]} side="back" onDetails={() => {}} />)
    expect(markup).not.toContain('API product 1')
    expect(markup).not.toContain('API product 2')
    expect(printedIds(markup)).toEqual([3, 4])
    expect(markup).not.toContain('API product 9')
    expect(markup).toContain('5 available')
    expect(markup.match(/data-leaflet-listing=/g)).toHaveLength(2)
    expect(markup).not.toMatch(/BookShell|Next page|Page \d/)
  })
  it('partitions every distinct listing exactly once across both sides in stable existing order', () => {
    const listings = [listing(4), feature, listing(2), listing(3), listing(1), listing(1), listing(5, { createdAt: '2025-01-01T00:00:00.000Z' })]
    const front = renderToStaticMarkup(<LeafletContent category={category} listings={listings} side="front" onDetails={() => {}} />)
    expect(printedIds(front)).toEqual([9, 5, 1])
    expect(front).toContain('A little more to love')
    const back = renderToStaticMarkup(<LeafletContent category={category} listings={listings} side="back" onDetails={() => {}} />)
    expect(printedIds(back)).toEqual([2, 3, 4])
    const allIds = [...printedIds(front), ...printedIds(back)]
    expect(new Set(allIds).size).toBe(allIds.length)
    expect([...allIds].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 9])
    expect(back).not.toContain('leaflet__teasers')
  })
  it.each([
    { listings: [], frontIds: [], backIds: [] },
    { listings: [feature], frontIds: [9], backIds: [] },
    { listings: [feature, ...others], frontIds: [9, 1, 2], backIds: [] },
    { listings: [listing(1)], frontIds: [1], backIds: [] },
    { listings: [...others, listing(3)], frontIds: [1, 2], backIds: [3] },
  ])('handles sparse or unfeatured collections: $frontIds / $backIds', ({ listings, frontIds, backIds }) => {
    const front = renderToStaticMarkup(<LeafletContent category={category} listings={listings} side="front" onDetails={() => {}} />)
    const back = renderToStaticMarkup(<LeafletContent category={category} listings={listings} side="back" onDetails={() => {}} />)
    expect(printedIds(front)).toEqual(frontIds)
    expect(printedIds(back)).toEqual(backIds)
    if (!backIds.length) {
      expect(back).toContain('leaflet__empty')
      expect(back).toContain(listings.length ? 'You’ve seen every build' : 'More discoveries are on their way.')
      expect(back).not.toContain('0 more builds')
    }
  })
  it('handles sparse categories without inventing promotions', () => {
    const solo = renderToStaticMarkup(<LeafletContent category={category} listings={[feature]} side="front" onDetails={() => {}} />)
    expect(solo).not.toContain('leaflet__teasers')
    const empty = renderToStaticMarkup(<LeafletContent category={category} listings={[]} side="front" onDetails={() => {}} />)
    expect(empty).not.toContain('data-leaflet-listing=')
    const one = renderToStaticMarkup(<LeafletContent category={category} listings={[feature, listing(1)]} side="front" onDetails={() => {}} />)
    expect(one.match(/data-leaflet-listing=/g)).toHaveLength(2)
  })
  it('keeps a large result collection on one back side', () => {
    const markup = renderToStaticMarkup(<LeafletContent category={category} listings={Array.from({ length: 37 }, (_, index) => listing(index))} side="back" onDetails={() => {}} />)
    expect(printedIds(markup)).toEqual(Array.from({ length: 35 }, (_, index) => index + 2))
  })
  it('has a named dialog, return control and one whole-sheet turnover control', () => {
    const markup = renderToStaticMarkup(<CategoryLeaflet category={category} listings={[feature]} onClose={() => {}} onDetails={() => {}} />)
    expect(markup).toContain('<dialog')
    expect(markup).toContain('aria-labelledby="leaflet-title"')
    expect(markup).toContain('Close leaflet')
    expect(markup).toContain('Turn over →')
    expect(markup).not.toContain('book-shell')
  })
})
