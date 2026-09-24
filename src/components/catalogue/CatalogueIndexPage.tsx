import type { CSSProperties } from 'react'
import type { CatalogueCategory } from './categories'
import './OpeningPages.css'

/** The opening page previews only backend categories with curated featured presentation. */
export function CatalogueIndexPage({ categories }: { categories: readonly CatalogueCategory[] }) {
  const featuredCategories = categories.filter(category => category.featured)
  return (
    <div className="opening-page catalogue-index">
      <div className="catalogue-index__layout">
        <div className="catalogue-index__heading">
          <h2>Our Catalogue</h2>
          <p>Build. Play. Collect. Bloom.</p>
        </div>
        <ul className="catalogue-preview" aria-label="Featured worlds">
          {featuredCategories.map((category) => (
            <li key={category.id} style={{ '--preview-colour': category.colour ?? '#dfdbc2' } as CSSProperties}>
              <figure>
                {category.image && <img src={category.image} alt="" width={category.imageWidth} height={category.imageHeight} decoding="async" />}
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