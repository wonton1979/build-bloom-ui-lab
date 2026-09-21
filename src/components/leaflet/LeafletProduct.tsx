import type { ProductListing } from '../../features/catalogue/api'
import { formatGbp, listingUnitPricePence, priceToPence } from '../../features/cart/CartContext'
import { ProductPrintImage } from '../catalogue/CategoryOpeningSpread'

export function LeafletProduct({ listing, featured = false, showCategory = false, onDetails }: { listing: ProductListing; featured?: boolean; showCategory?: boolean; onDetails: (id: number) => void }) {
  const product = listing.legoProduct
  return <article className={`leaflet-product${featured ? ' leaflet-product--featured' : ''}`} data-leaflet-listing={listing.id}>
    <ProductPrintImage listing={listing} className="leaflet-product__art" />
    <div className="leaflet-product__copy">
      <p className="leaflet-product__set">LEGO {product.theme} · {product.setNumber}</p>
      {showCategory && listing.category && <p className="search-leaflet__product-category">{listing.category.name}</p>}
      <h3>{product.title}</h3>
      <p className="leaflet-product__facts">{[product.pieceCount != null ? `${product.pieceCount} pieces` : '', product.ageRecommendation ? `Ages ${product.ageRecommendation}${/^\d+$/.test(product.ageRecommendation) ? '+' : ''}` : '', listing.condition === 'NEW' ? 'New' : 'Used, like new'].filter(Boolean).join(' · ')}</p>
      {featured && product.description && <p className="leaflet-product__description">{product.description}</p>}
      <div className="leaflet-product__purchase">
        <p className="leaflet-product__price">{listing.salePrice !== null && <del>{formatGbp(priceToPence(listing.originalPrice))}</del>}<strong>{formatGbp(listingUnitPricePence({ listing }))}</strong></p>
        <span className="leaflet-product__stock">{listing.availableStock > 0 ? `${listing.availableStock} available` : 'Out of stock'}</span>
      </div>
      <button type="button" onClick={() => onDetails(listing.id)} aria-label={`View details for ${product.title}`}>Take a closer look <span aria-hidden="true">→</span></button>
    </div>
  </article>
}
