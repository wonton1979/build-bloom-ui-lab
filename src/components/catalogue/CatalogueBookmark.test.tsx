import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CatalogueBookmark } from './CatalogueBookmark'

describe('CatalogueBookmark reveal configuration', () => {
  it('keeps extra reveal data on the bookmark without changing its base interaction', () => {
    const markup = renderToStaticMarkup(<CatalogueBookmark definition={{
      id: 'ninjago',
      label: 'NINJAGO',
      href: '/categories/ninjago',
      asset: '/bookmark-ninjago.png',
      width: 2121,
      height: 504,
      top: '20%',
      extraReveal: 12,
    }} />)
    expect(markup).toContain('--bookmark-extra-reveal:12px')
    expect(markup).toContain('catalogue-bookmark--ninjago')
  })
})
