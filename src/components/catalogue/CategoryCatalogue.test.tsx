import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CategoryCatalogue, CataloguePageContent } from './CategoryCatalogue'
import { CatalogueIndexPage } from './CatalogueIndexPage'
import { paginateCatalogueCategories, pairCataloguePages } from './cataloguePages'
import { categoryPresentation, resolveCatalogueCategories } from './categories'
import type { CatalogueSpread } from './catalogueSpread'
import { categoryLocation, spreadAfterAction } from './catalogueSpread'
import { backendCategory, curatedBackendCategories } from './catalogueData.test-utils'

const resolve = (backend = curatedBackendCategories) => resolveCatalogueCategories(backend)
const renderSpread = (spread: CatalogueSpread, backend = curatedBackendCategories) => renderToStaticMarkup(
  <CategoryCatalogue spread={spread} onSpreadChange={() => {}} onClose={() => {}}
    backendCategoriesState={{ status: 'ready', categories: backend }} onRetryCategories={vi.fn()} />,
)

describe('Category catalogue data and pagination', () => {
  it('keeps configured categories in curated order and sorts backend-only categories deterministically', () => {
    const backend = [backendCategory(900, 'Zelda'), ...curatedBackendCategories.slice().reverse(), backendCategory(901, 'Minecraft'), backendCategory(902, 'Animal Crossing')]
    const resolved = resolve(backend)
    expect(resolved.slice(0, 13).map(({ id }) => id)).toEqual(resolve().map(({ id }) => id))
    expect(resolved.slice(13).map(({ label }) => label)).toEqual(['Animal Crossing', 'Minecraft', 'Zelda'])
    expect(resolve([...backend].reverse()).map(({ id }) => id)).toEqual(resolved.map(({ id }) => id))
  })

  it('shows a backend-only Minecraft category without frontend category-specific configuration', () => {
    const minecraft = backendCategory(701, 'Minecraft')
    const resolved = resolve([minecraft])
    const markup = renderToStaticMarkup(<CataloguePageContent categories={resolved} start={1} />)
    expect(markup).toContain('href="/categories/minecraft"')
    expect(markup).toContain('Minecraft')
    expect(markup).not.toContain('<img')
    expect(resolved[0].backendCategory.id).toBe(701)
  })

  it('uses managed thumbnails before legacy art and keeps category navigation unchanged', () => {
    const category = backendCategory(702, 'Star Wars', { thumbnailUrl: '/managed-star-wars.png', imageUrl: '/opening-star-wars.png' })
    const [resolved] = resolve([category])
    const cardMarkup = renderToStaticMarkup(<CataloguePageContent categories={[resolved]} start={1} onCategory={() => {}} />)
    const previewMarkup = renderToStaticMarkup(<CatalogueIndexPage categories={[resolved]} />)

    expect(resolved.image).toBe('/managed-star-wars.png')
    expect(cardMarkup).toContain('src="/managed-star-wars.png"')
    expect(cardMarkup).toContain('href="/categories/star-wars"')
    expect(previewMarkup).toContain('src="/managed-star-wars.png"')
    expect(previewMarkup).not.toContain('/opening-star-wars.png')
  })

  it('uses bundled legacy art when a managed thumbnail is null or empty', () => {
    const legacy = categoryPresentation.find(item => item.label === 'Star Wars')!.image
    for (const thumbnailUrl of [null, '', '   ']) {
      const [resolved] = resolve([backendCategory(703, 'Star Wars', { thumbnailUrl })])
      expect(resolved.image).toBe(legacy)
    }
  })

  it('uses a managed thumbnail for a dynamic category without a legacy mapping', () => {
    const dynamic = backendCategory(704, 'New Theme', { thumbnailUrl: '/new-theme.png', imageUrl: '/opening-art.png' })
    const [resolved] = resolve([dynamic])
    const markup = renderToStaticMarkup(<CataloguePageContent categories={[resolved]} start={1} />)

    expect(resolved.image).toBe('/new-theme.png')
    expect(markup).toContain('src="/new-theme.png"')
    expect(markup).toContain('href="/categories/new-theme"')
  })

  it('preserves the existing imageUrl fallback after managed and legacy artwork are absent', () => {
    const [resolved] = resolve([backendCategory(705, 'New Theme', { imageUrl: '/existing-final-fallback.png' })])
    expect(resolved.image).toBe('/existing-final-fallback.png')
  })

  it('continues rendering bundled thumbnails for existing categories without managed artwork', () => {
    const resolved = resolve()
    expect(resolved.every(category => category.backendCategory.thumbnailUrl === null && Boolean(category.image))).toBe(true)
    const markup = renderToStaticMarkup(<CataloguePageContent categories={resolved.slice(0, 1)} start={1} />)
    expect(markup).toContain(`src="${resolved[0].image}"`)
  })

  it('generates deterministic safe slugs and resolves absent artwork without removing the category', () => {
    const categories = [backendCategory(1, 'Minecraft: Dungeons & Dragons'), backendCategory(2, '!!!')]
    const first = resolve(categories)
    expect(first.find(({ backendId }) => backendId === 1)?.id).toBe('minecraft-dungeons-dragons')
    expect(first.find(({ backendId }) => backendId === 2)?.id).toBe('category-2')
    expect(resolve([...categories].reverse()).find(({ backendId }) => backendId === 1)?.id).toBe('minecraft-dungeons-dragons')
    expect(first.every(({ image }) => image === undefined)).toBe(true)
    expect(renderToStaticMarkup(<CataloguePageContent categories={first} start={1} />)).toContain('Minecraft: Dungeons &amp; Dragons')
  })

  it.each([
    [13, [3, 3, 3, 3, 1]],
    [14, [3, 3, 3, 3, 2]],
    [15, [3, 3, 3, 3, 3]],
    [16, [3, 3, 3, 3, 3, 1]],
  ])('chunks %i categories into pages of at most three: %j', (count, expected) => {
    const input = [...curatedBackendCategories]
    for (let index = input.length; index < count; index++) input.push(backendCategory(1000 + index, `New World ${index + 1}`))
    const categories = resolve(input)
    const pages = paginateCatalogueCategories(categories)
    expect(pages.map(page => page.length)).toEqual(expected)
    expect(pages.every(page => page.length <= 3)).toBe(true)
    expect(pages.flat().map(({ id }) => id)).toEqual(categories.map(({ id }) => id))
    expect(new Set(pages.flat().map(({ id }) => id)).size).toBe(count)
  })

  it('pairs physical pages and leaves an odd final facing page intentionally empty', () => {
    const pages = paginateCatalogueCategories(resolve())
    const spreads = pairCataloguePages(pages)
    expect(pages.map(page => page.length)).toEqual([3, 3, 3, 3, 1])
    expect(spreads.at(-1)?.[0]).toHaveLength(1)
    expect(spreads.at(-1)?.[1]).toBeUndefined()
    const markup = renderSpread('categories-page-2')
    expect(markup).toContain('More little worlds are coming...')
    expect(markup).toContain('href="/categories/others"')
  })

  it('preserves legacy category slugs and derives the opening count from backend categories', () => {
    const resolved = resolve()
    expect(resolved.find(({ label }) => label === 'DC & Batman')?.href).toBe('/categories/dc-batman')
    expect(resolved.find(({ label }) => label === 'Flowers & Botanicals')?.href).toBe('/categories/flowers-botanicals')
    const backend = [...curatedBackendCategories, backendCategory(999, 'Minecraft')]
    expect(renderSpread('opening', backend)).toContain('Discover all 14 worlds →')
    expect(renderSpread('categories-page-2', backend)).toContain('href="/categories/minecraft"')
  })

  it('uses the same category → product → details → product → category navigation path', () => {
    const resolved = resolve()
    const category = categoryLocation('vehicles', resolved)
    const product = spreadAfterAction(category, 'forward', 1, Math.ceil(Math.ceil(resolved.length / 3) / 2), resolved)
    expect(product).toEqual({ kind: 'products', slug: 'vehicles', index: 0 })
    expect(spreadAfterAction(product, 'backward', 1, 3, resolved)).toEqual(category)
  })

  it('shows small category-list loading and retryable error states', () => {
    const loading = renderToStaticMarkup(<CategoryCatalogue spread="categories-primary" onSpreadChange={() => {}} onClose={() => {}}
      backendCategoriesState={{ status: 'loading' }} onRetryCategories={() => {}} />)
    const error = renderToStaticMarkup(<CategoryCatalogue spread="categories-primary" onSpreadChange={() => {}} onClose={() => {}}
      backendCategoriesState={{ status: 'error' }} onRetryCategories={() => {}} />)
    expect(loading).toContain('Finding little worlds…')
    expect(error).toContain('We couldn’t open the catalogue categories.')
    expect(error).toContain('Try again')
  })
})
