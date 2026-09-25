import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CategoryLeaflet, LeafletContent } from './CategoryLeaflet'
import { categoryProducts } from '../../features/catalogue/useCategoryCatalogue'
import { fixtureCategory as category, offer, product } from '../../features/catalogue/catalogueFixtures'

const feature = product(9, [offer(9, { effectivePrice: '12.99', availableStock: 1 })], { isFeatureProduct: true, catalogueArtworkUrl: '/feature.png' })
const others = [product(1), product(2)]
const printedIds = (markup: string) => [...markup.matchAll(/data-leaflet-product="(\d+)"/g)].map(match => Number(match[1]))

describe('Category advertising leaflet', () => {
  it('selects one product feature and preserves each product once', () => {
    const products = [others[0], feature, others[1], others[0]]
    expect(categoryProducts(products)).toEqual({ feature, others })
    expect(categoryProducts(others)).toEqual({ feature: undefined, others })
    expect(products).toHaveLength(4)
  })
  it('prints one product card with the lowest offer price and available total', () => {
    const withOffers = product(1, [offer(101, { legoProductId: 1, effectivePrice: '5.00', currentStock: 0, availableStock: 0 }), offer(102, { legoProductId: 1, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', effectivePrice: '18.50', availableStock: 1 })])
    const markup = renderToStaticMarkup(<LeafletContent category={category} products={[feature, withOffers, others[1]]} side="front" onDetails={() => {}} />)
    expect(printedIds(markup)).toEqual([9, 1, 2])
    expect(markup).toContain('£12.99')
    expect(markup).toContain('£18.50')
    expect(markup).toContain('1 available')
    expect(markup).toContain('123 pieces')
    expect(markup).not.toContain('Used')
  })
  it('prints only remaining LegoProducts on the back', () => {
    const products = [feature, ...others, product(3), product(4)]
    const markup = renderToStaticMarkup(<LeafletContent category={category} products={products} side="back" onDetails={() => {}} />)
    expect(markup).not.toContain('API product 1')
    expect(markup).not.toContain('API product 2')
    expect(printedIds(markup)).toEqual([3, 4])
    expect(markup).not.toContain('API product 9')
    expect(markup).toContain('5 available')
    expect(markup.match(/data-leaflet-product=/g)).toHaveLength(2)
    expect(markup).not.toMatch(/BookShell|Next page|Page \d/)
  })
  it('keeps every product represented once across both sides', () => {
    const products = [product(4), feature, product(2), product(3), product(1), product(5)]
    const front = renderToStaticMarkup(<LeafletContent category={category} products={products} side="front" onDetails={() => {}} />)
    expect(printedIds(front)).toEqual([9, 4, 2])
    const back = renderToStaticMarkup(<LeafletContent category={category} products={products} side="back" onDetails={() => {}} />)
    expect(printedIds(back)).toEqual([3, 1, 5])
    const allIds = [...printedIds(front), ...printedIds(back)]
    expect(new Set(allIds).size).toBe(allIds.length)
  })
  it('handles empty and unfeatured product arrays without placeholder cards', () => {
    const solo = renderToStaticMarkup(<LeafletContent category={category} products={[feature]} side="front" onDetails={() => {}} />)
    expect(solo).not.toContain('leaflet__teasers')
    const empty = renderToStaticMarkup(<LeafletContent category={category} products={[]} side="front" onDetails={() => {}} />)
    expect(empty).not.toContain('data-leaflet-product=')
  })
  it('has a named dialog, return control and one whole-sheet turnover control', () => {
    const markup = renderToStaticMarkup(<CategoryLeaflet category={category} products={[feature]} onClose={() => {}} onDetails={() => {}} />)
    expect(markup).toContain('<dialog')
    expect(markup).toContain('aria-labelledby="leaflet-title"')
    expect(markup).toContain('Close leaflet')
    expect(markup).toContain('Turn over →')
    expect(markup).not.toContain('book-shell')
  })
})
