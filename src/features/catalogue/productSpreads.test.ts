import { describe, expect, it } from 'vitest'
import { listing } from './catalogueFixtures'
import { planProductSpreads } from './productSpreads'

describe('category product spread planner', () => {
  it.each([
    [0, 1], [1, 1], [2, 1], [3, 2], [6, 2], [7, 3], [10, 3], [11, 4], [103, 27],
  ])('plans a feature and %i standards across %i spreads without duplication/loss', (count, expected) => {
    const feature = listing(900, { isFeatureProduct: true })
    const standards = Array.from({ length: count }, (_, i) => listing(i + 1))
    const input = [feature, ...standards].reverse()
    const before = JSON.stringify(input)
    const spreads = planProductSpreads(input)
    expect(spreads).toHaveLength(expected)
    expect(spreads[0].feature).toBe(feature)
    expect(spreads[0].left).toEqual([])
    expect(spreads[0].right).toEqual(standards.slice(0, 2))
    expect(spreads.slice(1).every(s => !s.feature && s.left.length <= 2 && s.right.length <= 2)).toBe(true)
    const flattened = spreads.flatMap(s => [...s.left, ...s.right])
    expect(flattened).toEqual(standards)
    expect(new Set(flattened.map(p => p.id)).size).toBe(count)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('orders by createdAt ASC, then listing id ASC; feature can be newest', () => {
    const early = listing(80, { createdAt: '2020-01-01T00:00:00Z' })
    const feature = listing(99, { isFeatureProduct: true, createdAt: '2030-01-01T00:00:00Z' })
    const spreads = planProductSpreads([listing(8), feature, listing(2), early])
    expect(spreads[0].feature).toBe(feature)
    expect(spreads.flatMap(s => [...s.left, ...s.right]).map(p => p.id)).toEqual([80, 2, 8])
  })

  it('uses four standard slots from the first spread when no feature is selected', () => {
    const spreads = planProductSpreads(Array.from({ length: 5 }, (_, i) => listing(i)))
    expect(spreads.map(s => [s.feature, s.left.length, s.right.length])).toEqual([[undefined, 2, 2], [undefined, 1, 0]])
    expect(planProductSpreads([])).toEqual([])
  })

  it('handles multiple features deterministically without discarding any listing', () => {
    const input = [listing(8, { isFeatureProduct: true }), listing(2, { isFeatureProduct: true }), listing(7)]
    const spreads = planProductSpreads(input)
    expect(spreads[0].feature?.id).toBe(2)
    expect(spreads[0].right.map(p => p.id)).toEqual([7, 8])
    expect(planProductSpreads([...input].reverse())).toEqual(spreads)
  })

  it('does not depend on artwork availability, product numbers, or returned array order', () => {
    const input = [listing(3), listing(1, { isFeatureProduct: true }), listing(2), listing(4)]
    const membership = (products: typeof input) => planProductSpreads(products).map(s => [s.feature?.id, ...s.left.map(p => p.id), ...s.right.map(p => p.id)])
    expect(membership(input)).toEqual(membership(input.map(p => ({ ...p, catalogueArtworkUrl: `https://delivery.example/${p.id}.png` })).reverse()))
  })

  it('deduplicates repeated listing IDs across API pages without collapsing distinct listings of one set', () => {
    const a = listing(1)
    const b = listing(2, { legoProduct: a.legoProduct })
    expect(planProductSpreads([a, a, b])[0].left.map(p => p.id)).toEqual([1, 2])
  })
})
