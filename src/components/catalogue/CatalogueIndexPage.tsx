import type { CSSProperties } from 'react'
import { catalogueCategories } from './categories'
import './OpeningPages.css'

const featuredIds = ['harry-potter', 'star-wars', 'jurassic-world', 'vehicles']
const featuredCategories = catalogueCategories.filter(({ id }) => featuredIds.includes(id))

/** The opening page previews the catalogue; subsequent spreads own navigation. */
export function CatalogueIndexPage() {
  return (
    <div className="opening-page catalogue-index">
      <div className="catalogue-index__layout">
        <div className="catalogue-index__heading">
          <h2>Our Catalogue</h2>
          <p>Build. Play. Collect. Bloom.</p>
        </div>
        <ul className="catalogue-preview" aria-label="Featured worlds">
          {featuredCategories.map((category) => (
            <li key={category.id} style={{ '--preview-colour': category.colour } as CSSProperties}>
              <figure>
                <img
                  src={category.image}
                  alt=""
                  width={category.imageWidth}
                  height={category.imageHeight}
                  decoding="async"
                />
                <figcaption>{category.label}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
        <p className="catalogue-preview__invitation">So many little worlds to discover.</p>
      </div>
    </div>
  )
}
