import { renderToStaticMarkup } from 'react-dom/server'
import welcomeIllustration from '../../assets/illustrations/opening-welcome-illustration.png'
import { describe, expect, it } from 'vitest'
import { ArtworkSlot } from './ArtworkSlot'
import { CatalogueIndexPage } from './CatalogueIndexPage'
import { OpeningWelcomePage } from './OpeningWelcomePage'
import { catalogueCategories } from './categories'

describe('Opening catalogue content', () => {
  it('uses the approved welcome illustration by default instead of the placeholder', () => {
    const markup = renderToStaticMarkup(<OpeningWelcomePage />)

    expect(markup).toContain(`src="${welcomeIllustration}"`)
    expect(markup).toContain('alt="Build &amp; Bloom cottage garden with a puppy, cat and colourful building pieces"')
    expect(markup).not.toContain('Main illustration')
  })

  it('previews exactly four featured worlds with live labels and their approved artwork', () => {
    const markup = renderToStaticMarkup(<CatalogueIndexPage />)
    const labels = [...markup.matchAll(/<figcaption>([^<]+)<\/figcaption>/g)].map((match) => match[1])

    expect(labels).toEqual(['Harry Potter', 'Star Wars', 'Jurassic World', 'Vehicles'])
    for (const id of ['harry-potter', 'star-wars', 'jurassic-world', 'vehicles']) {
      const category = catalogueCategories.find((item) => item.id === id)
      expect(category).toBeDefined()
      expect(markup).toContain(`src="${category?.image}"`)
    }
    expect(markup).toContain('Our Catalogue')
    expect(markup).toContain('Build. Play. Collect. Bloom.')
    expect(markup).not.toMatch(/<a\b|<button\b/)
  })

  it('omits the obsolete conceptual index and page numbers from the opening preview', () => {
    const markup = renderToStaticMarkup(<CatalogueIndexPage />)

    for (const label of ['Space', 'City &amp; Town', 'Castles &amp; Adventure', 'Animals', 'Flowers &amp; Nature', 'Pre-Loved Treasures', 'New Arrivals']) {
      expect(markup).not.toContain(label)
    }
    expect(markup).not.toMatch(/aria-label="Page \d+"/)
  })

  it('keeps welcome copy as HTML when main artwork is supplied', () => {
    const markup = renderToStaticMarkup(
      <OpeningWelcomePage artwork={{ src: '/fixture-scene.png', alt: 'A cottage beside a river' }} />,
    )

    expect(markup).toContain('<h1 aria-label="Build &amp; Bloom">')
    expect(markup).toContain('Small Pieces,')
    expect(markup).toContain('Big Stories.')
    expect(markup).toContain('Build a brighter,')
    expect(markup).toContain('more colourful tomorrow.')
    expect(markup).toContain('alt="A cottage beside a river"')
    expect(markup).not.toContain('Main illustration')
  })

  it('replaces a decorative placeholder with an independently described artwork asset', () => {
    const placeholder = renderToStaticMarkup(<ArtworkSlot />)
    const artwork = renderToStaticMarkup(
      <ArtworkSlot artwork={{ src: '/fixture-art.png', alt: 'Illustrated cottage' }} />,
    )

    expect(placeholder).toContain('aria-hidden="true"')
    expect(artwork).toContain('src="/fixture-art.png"')
    expect(artwork).toContain('alt="Illustrated cottage"')
    expect(artwork).not.toContain('aria-hidden="true"')
  })
})
