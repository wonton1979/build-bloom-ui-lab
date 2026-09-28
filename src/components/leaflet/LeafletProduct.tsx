import { defaultProductOffer, sellableOffers, type CatalogueProduct } from '../../features/catalogue/api'
import { effectivePricePence, formatGbp } from '../../features/cart/CartContext'
import { ProductPrintImage } from '../catalogue/CategoryOpeningSpread'

export function LeafletProduct({ product, featured = false, showDescription = featured, titleId, showCategory = false, linkedArtwork = false, linkedTitle = false, browseOnly = false, onDetails }: {
  product: CatalogueProduct; featured?: boolean; showDescription?: boolean; titleId?: string; showCategory?: boolean; linkedArtwork?: boolean; linkedTitle?: boolean; browseOnly?: boolean; onDetails: (id: number) => void
}) {
  const openDetails = () => { const offer = defaultProductOffer(product); if (offer) onDetails(offer.id) }
  const availableOffers = sellableOffers(product)
  const leastExpensiveOffer = availableOffers.reduce<(typeof product.offers)[number] | undefined>((best, offer) =>
    !best || effectivePricePence(offer) < effectivePricePence(best) ? offer : best, undefined)
  return <article className={`leaflet-product${featured ? ' leaflet-product--featured' : ''}${browseOnly ? ' leaflet-product--browse' : ''}`} data-leaflet-product={product.id}>
    {linkedArtwork ? <button type="button" className="leaflet-product__art leaflet-product__art-button" onClick={openDetails} aria-label={`View details for ${product.title}`}><ProductPrintImage product={product} className="leaflet-product__art-image" /></button>
      : <ProductPrintImage product={product} className="leaflet-product__art" />}
    <div className="leaflet-product__copy">
      <p className="leaflet-product__set">{browseOnly ? product.setNumber : `LEGO ${product.theme} · ${product.setNumber}`}</p>
      {showCategory && product.category && <p className="search-leaflet__product-category">{product.category.name}</p>}
      <h3 id={titleId}>{linkedTitle ? <button type="button" className="leaflet-product__title-button" onClick={openDetails} aria-label={`View details for ${product.title}`}>{product.title}</button> : product.title}</h3>
      {!browseOnly && <p className="leaflet-product__facts">{[product.pieceCount != null ? `${product.pieceCount} pieces` : '', product.ageRecommendation ? `Ages ${product.ageRecommendation}${/^\d+$/.test(product.ageRecommendation) ? '+' : ''}` : ''].filter(Boolean).join(' · ')}</p>}
      {featured && showDescription && product.description && <p className="leaflet-product__description">{product.description}</p>}
      <div className={`leaflet-product__purchase${browseOnly ? ' leaflet-product__purchase--browse' : ''}`}>
        <p className="leaflet-product__price">{leastExpensiveOffer && <>{!browseOnly && <small>From </small>}<strong>{formatGbp(effectivePricePence(leastExpensiveOffer))}</strong></>}</p>
        {browseOnly ? product.offers.length > 0 && <span className="leaflet-product__stock">{leastExpensiveOffer ? 'Available' : 'Out of stock'}</span>
          : <span className="leaflet-product__stock">{leastExpensiveOffer ? `${availableOffers.reduce((sum, offer) => sum + offer.availableStock, 0)} available` : 'Out of stock'}</span>}
      </div>
      {!browseOnly && <button type="button" onClick={openDetails} aria-label={`View details for ${product.title}`}>Take a closer look <span aria-hidden="true">→</span></button>}
    </div>
  </article>
}
