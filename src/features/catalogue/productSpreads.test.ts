import { describe, expect, it } from 'vitest'
import { offer, product } from './catalogueFixtures'
import { planProductSpreads, selectCategoryFeaturedProducts, selectCategoryProducts } from './productSpreads'

describe('product-level category spread planner', () => {
  it.each([[0, 0], [1, 1], [2, 1], [3, 1], [6, 2], [7, 2], [10, 3], [11, 3], [103, 26]])('keeps the product feature in the opening and flows %i products across %i normal spreads', (count, expected) => {
    const feature = product(900, [offer(900)], { isFeatureProduct: true })
    const standards = Array.from({ length: count }, (_, i) => product(i + 1))
    const input = [feature, ...standards]
    const before = JSON.stringify(input)
    const spreads = planProductSpreads(input)
    expect(spreads).toHaveLength(expected)
    expect(selectCategoryProducts(input).feature).toBe(feature)
    if (count) expect(spreads[0].left).toEqual(standards.slice(0, 2))
    const flattened = spreads.flatMap(s => [...s.left, ...s.right])
    expect(flattened).toEqual(standards)
    expect(new Set(flattened.map(item => item.id)).size).toBe(count)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('preserves backend product order and extracts its product-level feature', () => {
    const feature = product(99, [offer(990)], { isFeatureProduct: true })
    const items = [product(8), feature, product(2), product(80)]
    expect(selectCategoryProducts(items).feature).toBe(feature)
    expect(planProductSpreads(items).flatMap(s => [...s.left, ...s.right]).map(item => item.id)).toEqual([8, 2, 80])
  })

  it('selects up to three sellable featured products in stable API order', () => {
    const featureA = product(101, [offer(1101)], { isFeatureProduct: true })
    const standard = product(102)
    const featureB = product(103, [offer(1103)], { isFeatureProduct: true })
    const featureC = product(104, [offer(1104)], { isFeatureProduct: true })
    const featureD = product(105, [offer(1105)], { isFeatureProduct: true })
    const items = [standard, featureA, featureB, featureC, featureD, featureA]

    expect(selectCategoryFeaturedProducts(items, 3).map(item => item.id)).toEqual([101, 103, 104])
    expect(selectCategoryFeaturedProducts(items).map(item => item.id)).toEqual([101, 103, 104, 105])
    expect(items).toHaveLength(6)
  })

  it('uses four standard slots from the first spread when no feature is selected', () => {
    const spreads = planProductSpreads(Array.from({ length: 5 }, (_, i) => product(i)))
    expect(spreads.map(s => [s.left.length, s.right.length])).toEqual([[2, 2], [1, 0]])
    expect(planProductSpreads([])).toEqual([])
  })

  it('renders a product once even when it contains both NEW and damaged-box offers', () => {
    const item = product(3, [offer(31, { legoProductId: 3 }), offer(32, { legoProductId: 3, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE' })])
    expect(planProductSpreads([item])[0].left).toEqual([item])
    expect(item.offers).toHaveLength(2)
  })

  it('deduplicates repeated product IDs without collapsing distinct LegoProducts', () => {
    const a = product(1), b = product(2)
    expect(planProductSpreads([a, a, b])[0].left.map(item => item.id)).toEqual([1, 2])
  })
})
