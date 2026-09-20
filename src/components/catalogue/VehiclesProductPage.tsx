import { useState } from 'react'
import type { ProductListing } from '../../features/catalogue/api'
import type { ProductSpread } from '../../features/catalogue/productSpreads'
import type { VehiclesState } from '../../features/catalogue/useVehicles'
import { useCart } from '../../features/cart/CartContext'
import './VehiclesProductPage.css'

const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

function ProductCopy({ listing, onViewDetails }: { listing: ProductListing; onViewDetails?: (id: number) => void }) {
  const { legoProduct: product } = listing
  const age = product.ageRecommendation?.trim()
  return (
    <div className="vehicle-product__copy">
      <p className="vehicle-product__number">LEGO {product.setNumber}</p>
      <h3>{product.title}</h3>
      <ul className="vehicle-product__facts" aria-label="Product information">
        {product.theme && <li>{product.theme}</li>}
        {product.pieceCount != null && <li>{product.pieceCount} pieces</li>}
        {age && <li>{/^ages?\b/i.test(age) ? age : `Ages ${age}${/^\d+$/.test(age) ? '+' : ''}`}</li>}
      </ul>
      <div className="vehicle-product__footer">
        <p className="vehicle-product__price">
          {listing.salePrice !== null && <del aria-label="Original price">{pounds.format(Number(listing.originalPrice))}</del>}
          <span aria-label={listing.salePrice !== null ? 'Sale price' : 'Price'}>{pounds.format(Number(listing.salePrice ?? listing.originalPrice))}</span>
        </p>
        {onViewDetails && <button type="button" className="vehicle-product__details"
          aria-label={`View details for ${product.title}`} onClick={() => onViewDetails(listing.id)}>View Details →</button>}
      </div>
    </div>
  )
}

function CatalogueArtwork({ listing, feature, onViewDetails }: { listing: ProductListing; feature: boolean; onViewDetails: (id: number) => void }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = listing.catalogueArtworkUrl
  const className = `vehicle-product__art vehicle-product__art--${feature ? 'feature' : 'supporting'}`
  // Photography and local migration assets are not fallbacks. A replaced
  // backend URL gets a fresh load attempt, independently of a previous failure.
  return url?.trim() && failedUrl !== url ? (
    <button type="button" className={`${className} vehicle-product__art-button`} aria-label={`View details for ${listing.legoProduct.title}`}
      onClick={() => onViewDetails(listing.id)}>
      <img src={url} alt={`Illustrated ${listing.legoProduct.title}`} onError={() => setFailedUrl(url)} />
    </button>
  ) : <span className={className} aria-hidden="true" data-artwork-state="empty" />
}

export function VehiclesProductPage({ side, spread, status, onRetry, onViewDetails }: {
  side: 'left' | 'right'
  spread?: ProductSpread
  status: VehiclesState['status']
  onRetry: () => void
  onViewDetails: (id: number) => void
}) {
  const feature = side === 'left' ? spread?.feature : undefined
  const products = feature ? [feature] : (spread?.[side] ?? [])
  return (
    <section className={`vehicles-page vehicles-page--${feature ? 'feature' : 'supporting'}`} aria-labelledby={`vehicles-${side}-heading`}>
      <header className="vehicles-page__heading">
        <h2 id={`vehicles-${side}-heading`}>{side === 'left' ? 'Vehicles' : 'More amazing vehicles'}</h2>
        {feature && <p>Built for the thrill</p>}
      </header>
      {status === 'loading' && <p className="vehicles-page__message" role="status">Opening the garage…</p>}
      {status === 'error' && <div className="vehicles-page__message" role="alert">
        <p>We couldn’t load the vehicles.</p>
        <button type="button" onClick={onRetry}>Try again</button>
      </div>}
      {status === 'ready' && !spread && side === 'left' && <p className="vehicles-page__message">No vehicles are available at the moment.</p>}
      {status === 'ready' && <div className={feature ? 'vehicles-feature-product' : 'vehicles-supporting-products'}>
        {products.map(listing => <article key={listing.id} data-listing-id={listing.id}
          className={`vehicle-product vehicle-product--${feature ? 'feature' : 'supporting'}`} aria-label={listing.legoProduct.title}>
          <CatalogueArtwork listing={listing} feature={Boolean(feature)} onViewDetails={onViewDetails} />
          <ProductCopy listing={listing} onViewDetails={onViewDetails} />
        </article>)}
      </div>}
    </section>
  )
}

/** Minimal in-book details. Listing photography retains its API ordering and
 * remains separate from catalogue artwork; no commerce workflow is added. */
export function CatalogueProductDetails({ listing, side, onAddToCart }: { listing?: ProductListing; side: 'left' | 'right'; onAddToCart?: (listing: ProductListing) => void }) {
  if (!listing) return <p className="vehicles-page__message">This product is currently unavailable.</p>
  return side === 'left' ? (
    <section className="product-details" aria-label="Product photographs">
      <h2>Take a closer look</h2>
      <ProductGallery listing={listing} />
    </section>
  ) : (
    <ProductDetailsContent listing={listing} onAddToCart={onAddToCart} />
  )
}

function ProductDetailsContent({ listing, onAddToCart }: { listing: ProductListing; onAddToCart?: (listing: ProductListing) => void }) {
  const { items } = useCart()
  const cartQuantity = items.find(item => item.productListingId === listing.id)?.quantity ?? 0
  const atLimit = listing.availableStock === 0 || cartQuantity >= listing.availableStock
  return <article className="product-details" data-detail-listing-id={listing.id} aria-label={listing.legoProduct.title}>
      <h2>Product details</h2>
      <ProductCopy listing={listing} />
      <p className="product-details__description">{listing.legoProduct.description ?? 'No description available.'}</p>
      <p>Condition: {listing.condition === 'NEW' ? 'New' : 'Used, like new'} · {listing.availableStock > 0 ? `Stock: ${listing.availableStock}` : 'Out of stock'}</p>
      {onAddToCart && <button type="button" className="product-details__add" disabled={atLimit} onClick={() => onAddToCart(listing)}>
        <span>Add to cart</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M4 5h2l1.5 10h10L20 8H7M10 19.5h.01M17 19.5h.01" /></svg>
        {cartQuantity > 0 && <span className="product-details__cart-quantity">In cart: {cartQuantity}{atLimit && ' · Maximum available'}</span>}
      </button>}
    </article>
}

function ProductGallery({ listing }: { listing: ProductListing }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selected = listing.listingImages[selectedIndex]

  if (!listing.listingImages.length) {
    return <p className="product-details__empty">No product photographs available.</p>
  }

  return (
    <div className="product-details__gallery" aria-label="Product image gallery">
      <div className="product-details__main-image">
        <img src={selected.url} alt={selected.altText ?? listing.legoProduct.title} />
      </div>
      <div className="product-details__thumbnails" role="group" aria-label="Choose product image">
        {listing.listingImages.map((image, index) => (
          <button
            key={`${image.url}-${index}`}
            type="button"
            className={`product-details__thumbnail${index === selectedIndex ? ' is-selected' : ''}`}
            aria-label={`Show product image ${index + 1}`}
            aria-pressed={index === selectedIndex}
            onClick={() => setSelectedIndex(index)}
          >
            <img src={image.url} alt="" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}
