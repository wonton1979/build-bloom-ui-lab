import { useState } from 'react'
import { defaultProductOffer, isSellableOffer, sellableOffers, type CatalogueProduct, type ProductListingOffer } from '../../features/catalogue/api'
import type { ProductSpread } from '../../features/catalogue/productSpreads'
import type { VehiclesState } from '../../features/catalogue/useVehicles'
import { effectivePricePence, formatGbp, useCart } from '../../features/cart/CartContext'
import './VehiclesProductPage.css'

function ProductCopy({ product, onViewDetails }: { product: CatalogueProduct; onViewDetails?: (id: number) => void }) {
  const age = product.ageRecommendation?.trim()
  const representativeOffer = defaultProductOffer(product)
  const price = sellableOffers(product).reduce((lowest, offer) => Math.min(lowest, effectivePricePence(offer)), Infinity)
  return <div className="vehicle-product__copy">
    <p className="vehicle-product__number">LEGO {product.setNumber}</p>
    <h3>{product.title}</h3>
    <ul className="vehicle-product__facts" aria-label="Product information">
      {product.theme && <li>{product.theme}</li>}
      {product.pieceCount != null && <li>{product.pieceCount} pieces</li>}
      {age && <li>{/^ages?\b/i.test(age) ? age : `Ages ${age}${/^\d+$/.test(age) ? '+' : ''}`}</li>}
    </ul>
    <div className="vehicle-product__footer">
      <p className="vehicle-product__price">{Number.isFinite(price) && <><span className="vehicle-product__from">From </span><span>{formatGbp(price)}</span></>}</p>
      {onViewDetails && representativeOffer && <button type="button" className="vehicle-product__details"
        aria-label={`View details for ${product.title}`} onClick={() => onViewDetails(representativeOffer.id)}>View Details →</button>}
    </div>
  </div>
}

function CatalogueArtwork({ product, feature, onViewDetails }: { product: CatalogueProduct; feature: boolean; onViewDetails: (id: number) => void }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = product.catalogueArtworkUrl?.trim() || null
  const representativeOffer = defaultProductOffer(product)
  const className = `vehicle-product__art vehicle-product__art--${feature ? 'feature' : 'supporting'}`
  if (!url || failedUrl === url) return <span className={className} aria-hidden="true" data-artwork-state="empty" />
  const image = <img src={url} alt={`Illustrated ${product.title}`} onError={() => setFailedUrl(url)} />
  return representativeOffer
    ? <button type="button" className={`${className} vehicle-product__art-button`} aria-label={`View details for ${product.title}`}
      onClick={() => onViewDetails(representativeOffer.id)}>{image}</button>
    : <span className={className}>{image}</span>
}

/** A single printed card represents the LegoProduct, regardless of offer count. */
export function CatalogueProduct({ product, feature = false, onViewDetails }: { product: CatalogueProduct; feature?: boolean; onViewDetails: (id: number) => void }) {
  return <article data-product-id={product.id} className={`vehicle-product vehicle-product--${feature ? 'feature' : 'supporting'}`} aria-label={product.title}>
    <CatalogueArtwork product={product} feature={feature} onViewDetails={onViewDetails} />
    <ProductCopy product={product} onViewDetails={onViewDetails} />
  </article>
}

export function VehiclesProductPage({ side, spread, status, categoryName, onRetry, onViewDetails }: {
  side: 'left' | 'right'
  spread?: ProductSpread
  status: VehiclesState['status']
  categoryName: string
  onRetry: () => void
  onViewDetails: (id: number) => void
}) {
  const products = spread?.[side] ?? []
  if (status === 'ready' && !products.length) return null
  return <section className="vehicles-page vehicles-page--supporting" aria-labelledby={`vehicles-${side}-heading`}>
    <header className="vehicles-page__heading"><h2 id={`vehicles-${side}-heading`}>{side === 'left' ? categoryName : `More amazing ${categoryName.toLowerCase()}`}</h2></header>
    {status === 'loading' && <p className="vehicles-page__message" role="status">Opening the collection…</p>}
    {status === 'error' && <div className="vehicles-page__message" role="alert"><p>We couldn’t load this collection.</p><button type="button" onClick={onRetry}>Try again</button></div>}
    {status === 'ready' && <div className="vehicles-supporting-products">{products.map(item => <CatalogueProduct key={item.id} product={item} onViewDetails={onViewDetails} />)}</div>}
  </section>
}

export function CatalogueProductDetails({ product, selectedOfferId, side, onAddToCart }: {
  product?: CatalogueProduct
  selectedOfferId?: number
  side: 'left' | 'right'
  onAddToCart?: (offer: ProductListingOffer, productTitle: string) => void
}) {
  if (!product) return <p className="vehicles-page__message">This product is currently unavailable.</p>
  const initialOffer = product.offers.find(offer => offer.id === selectedOfferId) ?? defaultProductOffer(product)
  if (!initialOffer) return <p className="vehicles-page__message">This product is currently unavailable.</p>
  return side === 'left'
    ? <section className="product-details" aria-label="Product photographs"><h2>Take a closer look</h2><ProductGallery product={product} /></section>
    : <ProductDetailsContent key={`${product.id}:${selectedOfferId ?? ''}`} product={product} initialOffer={initialOffer} onAddToCart={onAddToCart} />
}

const damageCopy = 'Never built or played with. Contents and internal packaging are complete. Only the outer box has cosmetic damage.'

function ProductDetailsContent({ product, initialOffer, onAddToCart }: { product: CatalogueProduct; initialOffer: ProductListingOffer; onAddToCart?: (offer: ProductListingOffer, productTitle: string) => void }) {
  const [selectedOfferId, setSelectedOfferId] = useState(initialOffer.id)
  const offer = product.offers.find(item => item.id === selectedOfferId) ?? initialOffer
  const { items } = useCart()
  const cartQuantity = items.find(item => item.productListingId === offer.id)?.quantity ?? 0
  const stockLimit = isSellableOffer(offer) ? (offer.condition === 'USED_LIKE_NEW' ? Math.min(1, offer.availableStock) : offer.availableStock) : 0
  const atLimit = stockLimit === 0 || cartQuantity >= stockLimit
  const options = sellableOffers(product)
  return <article className="product-details" data-detail-product-id={product.id} data-detail-listing-id={offer.id} aria-label={product.title}>
    <h2>Product details</h2>
    <p className="product-details__number">LEGO {product.setNumber}</p><h3 className="product-details__title">{product.title}</h3>
    {product.isRetired && <p className="product-details__retired">Retired Set</p>}
    <p className="product-details__price">{formatGbp(effectivePricePence(offer))}</p>
    {options.length > 1 ? <fieldset className="product-details__offers"><legend>Choose an offer</legend>
      {options.map(option => <label className="product-details__offer" key={option.id}>
        <input type="radio" name={`offer-${product.id}`} value={option.id} checked={offer.id === option.id} onChange={() => setSelectedOfferId(option.id)} />
        <span><strong>{option.condition === 'NEW' ? 'New' : 'New – Outer Box Damage'}</strong><span className="product-details__offer-price">{formatGbp(effectivePricePence(option))}</span>
          {option.condition === 'USED_LIKE_NEW' && <span className="product-details__damage-copy">{damageCopy}</span>}</span>
      </label>)}
    </fieldset> : <div className="product-details__selected-offer"><strong>{offer.condition === 'NEW' ? 'New' : 'New – Outer Box Damage'}</strong>
      {offer.condition === 'USED_LIKE_NEW' && <p className="product-details__damage-copy">{damageCopy}</p>}</div>}
    <p className="product-details__stock">{isSellableOffer(offer) ? `Stock: ${offer.availableStock}` : 'Out of stock'}</p>
    <p className="product-details__description">{product.description ?? 'No description available.'}</p>
    {onAddToCart && <button type="button" className="product-details__add" disabled={atLimit} onClick={() => onAddToCart(offer, product.title)}>
      <span>Add to cart</span><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M4 5h2l1.5 10h10L20 8H7M10 19.5h.01M17 19.5h.01" /></svg>
      {cartQuantity > 0 && <span className="product-details__cart-quantity">In cart: {cartQuantity}{atLimit && ' · Maximum available'}</span>}
    </button>}
  </article>
}

function ProductGallery({ product }: { product: CatalogueProduct }) {
  const uniqueImages = [...new Map(product.productImages.map(image => [image.url, image])).values()]
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selected = uniqueImages[selectedIndex]
  if (!selected) return <p className="product-details__empty">No product photographs available.</p>
  return <div className="product-details__gallery" aria-label="Product image gallery">
    <div className="product-details__main-image"><img src={selected.url} alt={selected.altText ?? product.title} /></div>
    <div className="product-details__thumbnails" role="group" aria-label="Choose product image">
      {uniqueImages.map((image, index) => <button key={`${image.url}-${index}`} type="button" className={`product-details__thumbnail${index === selectedIndex ? ' is-selected' : ''}`}
        aria-label={`Show product image ${index + 1}`} aria-pressed={index === selectedIndex} onClick={() => setSelectedIndex(index)}><img src={image.url} alt="" aria-hidden="true" /></button>)}
    </div>
  </div>
}
