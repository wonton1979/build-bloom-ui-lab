import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import welcomeIllustration from '../../assets/illustrations/opening-welcome-illustration.png'
import { ArtworkSlot } from './ArtworkSlot'
import { CatalogueIndexPage } from './CatalogueIndexPage'
import { OpeningWelcomePage } from './OpeningWelcomePage'
import { resolveCatalogueCategories } from './categories'
import { curatedBackendCategories } from './catalogueData.test-utils'

const categories = resolveCatalogueCategories(curatedBackendCategories)

describe('Opening catalogue content', () => {
  it('uses the approved welcome illustration by default instead of the placeholder', () => {
    const markup = renderToStaticMarkup(<OpeningWelcomePage />)
    expect(markup).toContain(`src="${welcomeIllustration}"`)
    expect(markup).toContain('alt="Build &amp; Bloom cottage garden with a puppy, cat and colourful building pieces"')
    expect(markup).not.toContain('Main illustration')
  })

  it('previews only curated featured worlds present in the backend category set', () => {
    const markup = renderToStaticMarkup(<CatalogueIndexPage categories={categories} />)
    const labels = [...markup.matchAll(/<figcaption>([^<]+)<\/figcaption>/g)].map(match => match[1])
    expect(labels).toEqual(['Harry Potter', 'Star Wars', 'Jurassic World', 'Vehicles'])
    expect(markup).toContain('Our Catalogue')
    expect(markup).toContain('Build. Play. Collect. Bloom.')
    expect(markup).not.toMatch(/<a\b|<button\b/)
  })

  it('omits a curated preview category when that backend category is absent', () => {
    const markup = renderToStaticMarkup(<CatalogueIndexPage categories={categories.filter(({ id }) => id !== 'vehicles')} />)
    expect(markup).not.toContain('<figcaption>Vehicles</figcaption>')
  })

  it('keeps welcome copy as HTML when main artwork is supplied', () => {
    const markup = renderToStaticMarkup(<OpeningWelcomePage artwork={{ src: '/fixture-scene.png', alt: 'A cottage beside a river' }} />)
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
    const artwork = renderToStaticMarkup(<ArtworkSlot artwork={{ src: '/fixture-art.png', alt: 'Illustrated cottage' }} />)
    expect(placeholder).toContain('aria-hidden="true"')
    expect(artwork).toContain('src="/fixture-art.png"')
    expect(artwork).toContain('alt="Illustrated cottage"')
    expect(artwork).not.toContain('aria-hidden="true"')
  })
})