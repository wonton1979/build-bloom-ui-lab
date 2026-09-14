import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { BookShell } from './BookShell'

describe('BookShell', () => {
  it('provides a named book and two named pages in reading order', () => {
    const markup = renderToStaticMarkup(<BookShell />)
    const labels = [...markup.matchAll(/<section[^>]*aria-label="([^"]+)"/g)]
      .map((match) => match[1])

    expect(labels).toEqual(['Open catalogue book', 'Left page', 'Right page'])
  })

  it('renders each content slot inside its corresponding page', () => {
    const markup = renderToStaticMarkup(
      <BookShell leftPage={<h2>Left fixture</h2>} rightPage={<h2>Right fixture</h2>} />,
    )
    const left = markup.match(/<section[^>]*aria-label="Left page">([\s\S]*?)<\/section>/)?.[1]
    const right = markup.match(/<section[^>]*aria-label="Right page">([\s\S]*?)<\/section>/)?.[1]

    expect(left).toContain('<h2>Left fixture</h2>')
    expect(left).not.toContain('Right fixture')
    expect(right).toContain('<h2>Right fixture</h2>')
    expect(right).not.toContain('Left fixture')
  })

  it('accepts a custom accessible name', () => {
    const markup = renderToStaticMarkup(<BookShell label="Sample spread" />)

    expect(markup).toContain('aria-label="Sample spread"')
    expect(markup).not.toContain('aria-label="Open catalogue book"')
  })

  it('hides the empty decorative layers from assistive technology', () => {
    const markup = renderToStaticMarkup(<BookShell />)
    const decorations = markup.match(/<div[^>]*aria-hidden="true"><\/div>/g)

    expect(decorations).toHaveLength(2)
    expect(markup).not.toMatch(/tabindex|<button|<a\s/)
  })

  it('composes an empty shell inside the application main landmark', () => {
    const markup = renderToStaticMarkup(<App />)
    const main = markup.match(/<main[^>]*aria-label="Catalogue">([\s\S]*?)<\/main>/)?.[1]

    expect(main).toBeDefined()
    expect(main).toContain('aria-label="Open catalogue book"')
    expect(main?.replace(/<[^>]*>/g, '')).toBe('')
  })
})
