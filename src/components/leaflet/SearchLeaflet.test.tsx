// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { listing } from '../../features/catalogue/catalogueFixtures'
import type { SearchState } from '../../features/catalogue/useCatalogueSearch'
import { LeafletActions } from './LeafletActions'
import { SearchLeafletContent } from './SearchLeaflet'
import { afterEach } from 'vitest'

function render(state: SearchState, input = '') {
  return renderToStaticMarkup(<LeafletActions.Provider value={{ closing: false, leave: async complete => complete() }}>
    <SearchLeafletContent search={{ state, input, changeInput: vi.fn(), submit: vi.fn(), changePage: vi.fn(), retry: vi.fn(), reset: vi.fn() }} onDetails={vi.fn()} />
  </LeafletActions.Provider>)
}
const results = (page = 1, totalItems = 25): SearchState => ({ status: 'results', query: 'car', data: {
  items: [listing(9), listing(12, { category: { id: 2, name: 'City', subtitle: null, description: null, imageUrl: null } })],
  pagination: { page, pageSize: 12, totalItems, totalPages: Math.ceil(totalItems / 12) },
} })

describe('Search Leaflet presentation', () => {
  it('has a labelled real search control and illustrated invitation, not zero results', () => {
    const html = render({ status: 'initial' })
    expect(html).toContain('role="search"')
    expect(html).toContain('for="catalogue-search"')
    expect(html).toContain('search-empty.png')
    expect(html).toContain('Find a Set')
    expect(html).not.toContain('No matching sets')
    expect(html).not.toContain('Search result pages')
    expect(html).not.toContain('data-leaflet-listing')
  })
  it('loading retains the query, announces progress, and never flashes zero results', () => {
    const html = render({ status: 'loading', query: '77240', page: 1 }, '77240')
    expect(html).toContain('value="77240"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('search-loading.png')
    expect(html).toContain('Searching…')
    expect(html).not.toContain('No matching sets')
    expect(html).not.toContain('Search result pages')
  })
  it('completed empty search has its own banner/art and editable query', () => {
    const html = render({ status: 'empty', query: 'unknown' }, 'unknown')
    expect(html).toContain('No Results Found')
    expect(html).toContain('search-no-results.png')
    expect(html).toContain('value="unknown"')
    expect(html).toContain('aria-label="Clear search"')
    expect(html).not.toContain('Search result pages')
  })
  it('error offers retry without pretending no products matched', () => {
    const html = render({ status: 'error', query: 'car', page: 2, message: 'Please try again.' }, 'car')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Try again')
    expect(html).not.toContain('No Results Found')
    expect(html).not.toContain('Search result pages')
  })
  it('reuses real listing presentation with category identity and no category filter', () => {
    const html = render(results())
    expect(html).toContain('data-leaflet-listing="9"')
    expect(html).toContain('data-leaflet-listing="12"')
    expect(html).toContain('search-leaflet__product-category">City')
    expect(html).toContain('25 matches found')
    expect(html.match(/View details/g)).toHaveLength(6)
  })
  it.each([1, 2, 3])('uses Previous / Page X of Y / Next with correct page %s boundaries', page => {
    const html = render(results(page))
    expect(html).toContain(`Page ${page} of 3`)
    const previous = html.match(/<button([^>]*)>← Previous<\/button>/)!
    const next = html.match(/<button([^>]*)>Next →<\/button>/)!
    expect(previous[1].includes('disabled')).toBe(page === 1)
    expect(next[1].includes('disabled')).toBe(page === 3)
  })
  it('hides unnecessary pagination for a single result page', () => {
    expect(render(results(1, 2))).not.toContain('Search result pages')
  })
})

afterEach(() => { document.body.innerHTML = '' })

describe('Search Leaflet product details interaction', () => {
  async function mountResults() {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const onDetails = vi.fn()
    await act(async () => {
      root.render(<LeafletActions.Provider value={{ closing: false, leave: async complete => complete() }}>
        <SearchLeafletContent search={{ state: results(1, 2), input: 'car', changeInput: vi.fn(), submit: vi.fn(), changePage: vi.fn(), retry: vi.fn(), reset: vi.fn() }} onDetails={onDetails} />
      </LeafletActions.Provider>)
    })
    return { container, root, onDetails }
  }

  it('opens the correct product details when its image is clicked', async () => {
    const { container, root, onDetails } = await mountResults()
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-leaflet-listing="9"] .leaflet-product__art-button')!.click() })
    expect(onDetails).toHaveBeenCalledWith(9, 0)
    await act(async () => root.unmount())
  })

  it('opens the correct product details when its title is clicked', async () => {
    const { container, root, onDetails } = await mountResults()
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-leaflet-listing="12"] .leaflet-product__title-button')!.click() })
    expect(onDetails).toHaveBeenCalledWith(12, 0)
    await act(async () => root.unmount())
  })

  it('keeps the Take a closer look action opening the same product details', async () => {
    const { container, root, onDetails } = await mountResults()
    const cta = [...container.querySelectorAll<HTMLButtonElement>('[data-leaflet-listing="9"] button')].find(button => button.textContent?.includes('Take a closer look'))!
    await act(async () => { cta.click() })
    expect(onDetails).toHaveBeenCalledWith(9, 0)
    await act(async () => root.unmount())
  })
})