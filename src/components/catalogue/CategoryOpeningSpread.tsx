import { useState } from 'react'
import type { ProductListing } from '../../features/catalogue/api'
import { categoryProducts, type CategoryState } from '../../features/catalogue/useCategoryCatalogue'
import { CatalogueProduct } from './VehiclesProductPage'
import './CategoryOpeningSpread.css'

export function CategoryOpeningPage({ side, state, onRetry, onLeaflet, onDetails }: {
  side: 'left' | 'right'; state: CategoryState; onRetry: () => void; onLeaflet: () => void; onDetails: (id: number) => void
}) {
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null)
  if (state.status !== 'ready') return <section className="category-opening">
    {state.status === 'loading' ? <p role="status">Finding your little world…</p> : <div role="alert"><p>We couldn’t open this collection.</p><button type="button" onClick={onRetry}>Try again</button></div>}
  </section>
  const { category, listings } = state
  const { feature } = categoryProducts(listings)
  return side === 'left' ? <section className="category-opening category-opening--editorial" aria-label={`${category.name} introduction`}>
    <p className="category-opening__eyebrow">A little world of possibility</p>
    <h1>{category.name}</h1>
    {category.subtitle && <p className="category-opening__subtitle">{category.subtitle}</p>}
    {category.description && <p className="category-opening__description">{category.description}</p>}
    <div className="category-opening__art-space" aria-hidden="true">
      {category.imageUrl && failedArtwork !== category.imageUrl && <img src={category.imageUrl} alt="" onError={() => setFailedArtwork(category.imageUrl)} />}
    </div>
    <div className="category-opening__invitation"><span>A collection to unfold</span><button type="button" onClick={onLeaflet}>Browse the leaflet <span aria-hidden="true">→</span></button></div>
  </section> : <section className="vehicles-page vehicles-page--feature category-opening-feature" aria-label={`${category.name} featured product`}>
    <header className="vehicles-page__heading"><h2>{feature ? 'Featured build' : 'A build to begin with'}</h2>{category.subtitle && <p>{category.subtitle}</p>}</header>
    {feature ? <div className="vehicles-feature-product"><CatalogueProduct listing={feature} feature onViewDetails={onDetails} /></div>
      : <div className="category-opening category-opening__no-feature"><p>{listings.length ? 'More little discoveries await in the leaflet.' : 'New discoveries are on their way.'}</p><button type="button" onClick={onLeaflet}>Explore the collection →</button></div>}
  </section>
}

/** Real listing art/photography only. Missing images leave quiet paper, not a broken icon. */
export function ProductPrintImage({ listing, className }: { listing: ProductListing; className: string }) {
  const [failed, setFailed] = useState<string[]>([])
  const url = [listing.catalogueArtworkUrl, ...listing.listingImages.map(image => image.url)].find(value => value && !failed.includes(value))
  return <div className={className}>{url && <img src={url} alt={listing.legoProduct.title} onError={() => setFailed(previous => [...previous, url])} />}</div>
}
