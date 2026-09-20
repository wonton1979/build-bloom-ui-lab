import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../../App'
import { CategoryCatalogue } from './CategoryCatalogue'
import { cataloguePages } from './cataloguePages'
import type { CatalogueSpread } from './catalogueSpread'
import { spreadAfterAction } from './catalogueSpread'
import { catalogueCategories } from './categories'

const expectedCategories = [
  ['harry-potter', 'Harry Potter'],
  ['star-wars', 'Star Wars'],
  ['friends', 'Friends'],
  ['city', 'City'],
  ['disney', 'Disney'],
  ['marvel', 'Marvel'],
  ['jurassic-world', 'Jurassic World'],
  ['flowers-botanicals', 'Flowers & Botanicals'],
  ['ninjago', 'NINJAGO'],
  ['dc-batman', 'DC & Batman'],
  ['vehicles', 'Vehicles'],
  ['creator', 'Creator'],
  ['others', 'Others'],
] as const

const categorySpreads = ['categories-primary', 'categories-more'] as const
const renderSpread = (spread: CatalogueSpread) => renderToStaticMarkup(
  <CategoryCatalogue spread={spread} onSpreadChange={() => {}} onClose={() => {}} />,
)
const destinationIds = (markup: string) => [...markup.matchAll(/class="category-entry"[^>]*href="\/categories\/([^" ]+)"/g)]
  .map((match) => match[1])

describe('Category catalogue', () => {
  it('associates all thirteen ordered categories with their supplied assets and destinations', () => {
    expect(catalogueCategories.map(({ id, label }) => [id, label])).toEqual(expectedCategories)
    expect(new Set(catalogueCategories.map(({ id }) => id)).size).toBe(13)
    catalogueCategories.forEach((category, index) => {
      const [id] = expectedCategories[index]
      expect(category.href).toBe(`/categories/${id}`)
      expect(category.image).toContain(`/category-${id}.png`)
    })
  })

  it('keeps the legacy opening spread available as an explicit catalogue spread', () => {
    const markup = renderToStaticMarkup(<App />)
    expect(markup).toContain('Open Build &amp; Bloom catalogue')
    expect(markup).toContain('categories/cover/build-bloom-cover')
    expect(destinationIds(markup)).toEqual([])
    expect(markup).not.toMatch(/href="#|id="opening-spread"|id="category-catalogue"/)
  })

  it.each([
    ['categories-primary', [3, 4], expectedCategories.slice(0, 7).map(([id]) => id)],
    ['categories-more', [3, 3], expectedCategories.slice(7).map(([id]) => id)],
  ] as const)('renders the correct ordered pages for %s in one book', (spread, counts, ids) => {
    const markup = renderSpread(spread)
    const lists = [...markup.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/g)]
    expect(lists).toHaveLength(2)
    expect(lists[0][1].match(/<li>/g)).toHaveLength(counts[0])
    expect(lists[1][1].match(/<li>/g)).toHaveLength(counts[1])
    expect(destinationIds(markup)).toEqual(ids)
    expect(markup.match(/<section[^>]*aria-label="Open catalogue book"/g)).toHaveLength(1)
    expect(markup).not.toContain('href="#')
  })

  it('keeps all approved images and live labels in native destination links across both spreads', () => {
    const markup = categorySpreads.map(renderSpread).join('')
    const links = [...markup.matchAll(/<a\b[^>]*class="category-entry"[^>]*href="(\/categories\/[^" ]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    expect(links).toHaveLength(13)
    links.forEach(([, href, content], index) => {
      const [id, label] = expectedCategories[index]
      expect(href).toBe(`/categories/${id}`)
      expect(content).toContain(`src="${catalogueCategories[index].image}"`)
      expect(content).toContain('alt=""')
      expect(content.replace(/<[^>]*>/g, '')).toContain(label.replaceAll('&', '&amp;'))
    })
  })

  it('maps forward and backward actions across the category spread sequence', () => {
    expect(spreadAfterAction('categories-primary', 'forward')).toBe('categories-more')
    expect(spreadAfterAction('categories-more', 'backward')).toBe('categories-primary')
    expect(spreadAfterAction('categories-primary', 'backward')).toBe('front-matter')
    expect(spreadAfterAction('front-matter', 'forward')).toBe('categories-primary')
    expect(spreadAfterAction('front-matter', 'backward')).toBe('front-matter')
    expect(spreadAfterAction('opening', 'forward')).toBe('categories-primary')
    expect(renderSpread('front-matter')).toContain('← Close Book')
    expect(renderSpread('categories-primary')).toContain('← Back to Contents')
    expect(renderSpread('categories-more')).toContain('← Back')
  })

  it('models the two category spreads as four reusable physical pages', () => {
    expect(cataloguePages.map((page) => page.map(({ label }) => label))).toEqual([
      ['Harry Potter', 'Star Wars', 'Friends'],
      ['City', 'Disney', 'Marvel', 'Jurassic World'],
      ['Flowers & Botanicals', 'NINJAGO', 'DC & Batman'],
      ['Vehicles', 'Creator', 'Others'],
    ])
  })
})
