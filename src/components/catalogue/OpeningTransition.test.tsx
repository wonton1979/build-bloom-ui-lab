import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { OpeningTransition } from './OpeningTransition'
import { ClosedCatalogue } from './ClosedCatalogue'

describe('Opening cover overlay', () => {
  it('reuses the approved closed presentation, including its artwork fit and physical layers', () => {
    const closed = renderToStaticMarkup(<ClosedCatalogue onOpen={() => {}} showCityBookmark={false} />)
    const overlay = renderToStaticMarkup(
      <OpeningTransition closedRect={{} as DOMRect} onAnimationEnd={() => {}} />,
    )
    // React emits an image preload ahead of the component markup.
    expect(overlay).toContain(closed.slice(closed.indexOf('<button')))
    expect(overlay).not.toContain('book-shell__page')
    expect(overlay).not.toContain('/categories/harry-potter')
  })

  it('keeps the temporary cover inert without a replacement inside panel', () => {
    const markup = renderToStaticMarkup(
      <OpeningTransition closedRect={{} as DOMRect} onAnimationEnd={() => {}} />,
    )
    expect(markup).toContain('aria-hidden="true" inert=""')
    expect(markup).not.toContain('opening-transition__inside')
    expect(markup.match(/<img /g)).toHaveLength(1)
  })
})
