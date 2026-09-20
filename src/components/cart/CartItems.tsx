import { cartTotalPence, formatGbp, lineAmountPence, listingUnitPricePence, type CartItem } from '../../features/cart/CartContext'
import './CartItems.css'

export function CartItems({ items }: { items: CartItem[] }) {
  return <div className="cart-items" aria-label="Selected cart listings">
    {items.map(({ productListingId, listing, quantity }) => {
      const image = listing.listingImages[0]
      return <article className="cart-item" key={productListingId} data-cart-listing-id={productListingId}>
        <div className="cart-item__image">
          {image ? <img src={image.url} alt={image.altText ?? listing.legoProduct.title} /> : <span aria-hidden="true" />}
        </div>
        <div className="cart-item__copy">
          <h2>{listing.legoProduct.title}</h2>
          <p>{listing.condition === 'NEW' ? 'New' : 'Used, like new'} · Unit price {formatGbp(listingUnitPricePence({ listing }))}</p>
          <div className="cart-item__amounts">
            <span>Quantity: {quantity}</span>
            <strong>{formatGbp(lineAmountPence({ listing, quantity }))}</strong>
          </div>
        </div>
      </article>
    })}
    <div className="cart-items__total" aria-label={`Cart total ${formatGbp(cartTotalPence(items))}`}>
      <span>Total</span>
      <strong>{formatGbp(cartTotalPence(items))}</strong>
    </div>
  </div>
}
