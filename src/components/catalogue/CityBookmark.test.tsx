import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CityBookmark } from './CityBookmark'

describe('City bookmark', () => {
  it('uses the supplied asset and existing City category route', () => {
    const markup = renderToStaticMarkup(<CityBookmark />)
    expect(markup).toContain('city')
    expect(markup).toContain('Open City category')
    expect(markup).toContain('bookmark-city')
    expect(markup).toContain('href="/categories/city"')
    expect(markup).toContain('width="1746"')
    expect(markup).toContain('height="435"')
  })
})
