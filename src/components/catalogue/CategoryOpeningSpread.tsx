import { useState } from 'react'
import type { CatalogueProduct } from '../../features/catalogue/api'
import { categoryProducts, type CategoryState } from '../../features/catalogue/useCategoryCatalogue'
import { CatalogueProduct as CatalogueProductCard } from './VehiclesProductPage'
import './CategoryOpeningSpread.css'

export function CategoryOpeningPage({ side, state, onRetry, onLeaflet, onDetails }: {
  side: 'left' | 'right'; state: CategoryState; onRetry: () => void; onLeaflet: () => void; onDetails: (id: number) => void
}) {
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null)
  if (state.status !== 'ready') return <section className="category-opening">
    {state.status === 'loading' ? <p role="status">Finding your little world…</p> : <div role="alert"><p>We couldn’t open this collection.</p><button type="button" onClick={onRetry}>Try again</button></div>}
  </section>
  const { category, products } = state
  const { feature } = categoryProducts(products)
  return side === 'left' ? <section className="category-opening category-opening--editorial" aria-label={`${category.name} introduction`}>
    <p className="category-opening__eyebrow">A little world of possibility</p><h1>{category.name}</h1>
    {category.subtitle && <p className="category-opening__subtitle">{category.subtitle}</p>}
    {category.description && <p className="category-opening__description">{category.description}</p>}
    <div className="category-opening__art-space" aria-hidden="true">{category.imageUrl && failedArtwork !== category.imageUrl && <img src={category.imageUrl} alt="" onError={() => setFailedArtwork(category.imageUrl)} />}</div>
    <div className="category-opening__invitation"><span>A collection to unfold</span><button type="button" onClick={onLeaflet}>Browse the leaflet <span aria-hidden="true">→</span></button></div>
  </section> : <section className="vehicles-page vehicles-page--feature category-opening-feature" aria-label={`${category.name} featured product`}>
    <header className="vehicles-page__heading"><h2>{feature ? 'Featured build' : 'A build to begin with'}</h2>{category.subtitle && <p>{category.subtitle}</p>}</header>
    {feature ? <div className="vehicles-feature-product"><CatalogueProductCard product={feature} feature onViewDetails={onDetails} /></div>
      : <div className="category-opening category-opening__no-feature"><p>{products.length ? 'More little discoveries await in the leaflet.' : 'New discoveries are on their way.'}</p><button type="button" onClick={onLeaflet}>Explore the collection →</button></div>}
  </section>
}

/** Leaflet artwork is the shared Catalogue Artwork owned by the LegoProduct. */
export function ProductPrintImage({ product, className }: { product: CatalogueProduct; className: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  const url = product.catalogueArtworkUrl?.trim() || null
  return <div className={className}>{url && failed !== url && <img src={url} alt={product.title} onError={() => setFailed(url)} />}</div>
}
