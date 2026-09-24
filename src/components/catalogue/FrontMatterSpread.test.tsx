import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CategoryCatalogue } from './CategoryCatalogue'
import { curatedBackendCategories } from './catalogueData.test-utils'
import { FrontMatterContentsPage, FrontMatterWelcomePage } from './FrontMatterSpread'

describe('Catalogue front matter', () => {
  it('preserves the complete welcome copy as real text', () => {
    const markup = renderToStaticMarkup(<FrontMatterWelcomePage />)
    const text = markup.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&')
    expect(text).toContain('Welcome to Build & Bloom')
    expect(text).toContain('Every great build begins with a little imagination.')
    expect(text).toContain('Here at Build & Bloom, we believe the joy is not only in what you build, but in the stories, adventures and memories you create along the way.')
    expect(text).toContain('So take your time, turn the pages, and see what catches your eye.')
    expect(text).toContain('There’s always something wonderful waiting to be built.')
  })

  it('offers Catalogue then Find a Set, with future chapters unavailable and legal copy quiet', () => {
    const markup = renderToStaticMarkup(<FrontMatterContentsPage onCatalogue={() => {}} onSearch={() => {}} />)
    const buttons = [...markup.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)]
    expect(buttons).toHaveLength(5)
    expect(buttons[0][1]).not.toContain('disabled')
    expect(buttons[0][2]).toContain('Our Catalogue')
    expect(buttons[0][2]).toContain('Explore the Build &amp; Bloom collections')
    expect(buttons[1][1]).not.toContain('disabled')
    expect(buttons[1][2]).toContain('Find a Set')
    expect(buttons[1][2]).toContain('Search by name or set number')
    for (const button of buttons.slice(2)) expect(button[1]).toContain('disabled')
    for (const copy of ['Delivery &amp; Returns', 'Everything about getting your order home', 'Contact Us', 'Come and say hello', 'Help &amp; FAQs', 'A little help when you need it', 'Privacy · Cookies · Terms &amp; Conditions']) {
      expect(markup).toContain(copy)
    }
    expect(markup).not.toMatch(/<a\b|category-entry/)
  })

  it('disables the contents action while a page is turning', () => {
    const markup = renderToStaticMarkup(<FrontMatterContentsPage onCatalogue={() => {}} onSearch={() => {}} turning />)
    expect(markup.match(/disabled=""/g)).toHaveLength(5)
  })

  it('mounts welcome and contents in the existing physical book without category duplication', () => {
    const markup = renderToStaticMarkup(<CategoryCatalogue spread="front-matter" onSpreadChange={() => {}} onClose={() => {}} backendCategoriesState={{ status: "ready", categories: curatedBackendCategories }} onRetryCategories={() => {}} />)
    expect(markup.match(/aria-label="Open catalogue book"/g)).toHaveLength(1)
    expect(markup).toContain('front-matter--welcome')
    expect(markup).toContain('front-matter--contents')
    expect(markup).toContain('← Close Book')
    expect(markup).not.toContain('class="category-entry"')
  })
})
