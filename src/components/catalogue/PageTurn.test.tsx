import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PageTurn } from './PageTurn'
import { CataloguePageContent } from './CategoryCatalogue'
import { paginateCatalogueCategories } from './cataloguePages'
import { resolveCatalogueCategories } from './categories'
import { curatedBackendCategories } from './catalogueData.test-utils'

describe('Physical internal page sheet', () => {
  it.each(['forward', 'backward'] as const)('renders both real faces in reading orientation for %s', direction => {
    const pages = paginateCatalogueCategories(resolveCatalogueCategories(curatedBackendCategories))
    const front = direction === 'forward' ? pages[1] : pages[2]
    const back = direction === 'forward' ? pages[2] : pages[1]
    const markup = renderToStaticMarkup(
      <PageTurn direction={direction} onComplete={() => {}}
        front={<div className="spread-page"><CataloguePageContent categories={front} start={1} /></div>}
        back={<div className="spread-page"><CataloguePageContent categories={back} start={1} /></div>}
      />,
    )
    const destinations = [...markup.matchAll(/href="(\/categories\/[^" ]+)"/g)].map(match => match[1])
    expect(destinations).toEqual([...front, ...back].map(category => category.href))
    expect(markup).toContain('aria-hidden="true" inert=""')
    // Both faces use the same page/content nesting as a stationary physical page.
    expect(markup.match(/class="book-shell__content"/g)).toHaveLength(2)
    expect(markup).not.toContain('aria-label="Open catalogue book"')
  })
})
