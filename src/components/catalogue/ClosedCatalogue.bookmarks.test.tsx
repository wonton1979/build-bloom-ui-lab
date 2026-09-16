import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClosedCatalogue } from './ClosedCatalogue'

describe('closed catalogue bookmarks', () => {
  it('renders every completed category bookmark except Others', () => {
    const markup = renderToStaticMarkup(<ClosedCatalogue onOpen={() => {}} />)
    expect((markup.match(/class="city-bookmark/g) ?? [])).toHaveLength(6)
    expect(markup).not.toContain('catalogue-bookmark--jurassic-world')
    expect(markup).not.toContain('catalogue-bookmark--star-wars')
    expect(markup).not.toContain('catalogue-bookmark--flowers-botanicals')
    expect(markup).not.toContain('catalogue-bookmark--others')
  })
})
