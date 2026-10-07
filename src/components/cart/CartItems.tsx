import { useState } from 'react'
import { cartTotalPence, formatGbp, lineAmountPence, listingUnitPricePence, cartQuantityLimit, useCart, type CartItem } from '../../features/cart/CartContext'
import { RemoveItemDialog } from './RemoveItemDialog'
import './CartItems.css'

export function CartItems({ items, onConfirmRemove }: {
  items: CartItem[]
  // Visual-task integration seam. No local deletion or backend write is implied.
  onConfirmRemove?: (item: CartItem) => void
}) {
  const [removalId, setRemovalId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const { updateQuantity, removeItem, pendingItemIds, error } = useCart()
  const removalItem = items.find(item => item.productListingId === removalId)
  return <div className="cart-items" aria-label="Selected cart listings">
    {items.map(({ productListingId, listing, quantity, allocatedQuantity, unallocatedQuantity }) => {
      const image = listing.legoProduct.productImages[0]
      return <article className="cart-item" key={productListingId} data-cart-listing-id={productListingId}>
        <div className="cart-item__image">
          {image ? <img src={image.url} alt={image.altText ?? listing.legoProduct.title} /> : <span aria-hidden="true" />}
        </div>
        <div className="cart-item__copy">
          <h2>{listing.legoProduct.title}</h2>
          <p>{listing.condition === 'NEW' ? 'New' : 'New – Outer Box Damage'} · Unit price {formatGbp(listingUnitPricePence({ listing }))}</p>
          {(allocatedQuantity ?? 0) > 0 && <p>{allocatedQuantity} in pending order · {unallocatedQuantity} available for a new checkout</p>}
          <div className="cart-item__amounts">
            <div className="cart-item__quantity" aria-label={`Quantity ${quantity}`}>
              <button type="button" aria-label={`Decrease ${listing.legoProduct.title} quantity`} disabled={quantity <= 1 || pendingItemIds.includes(productListingId)}
                onClick={() => void updateQuantity(productListingId, quantity - 1)}>−</button>
              <span>Quantity: {quantity}</span>
              <button type="button" aria-label={`Increase ${listing.legoProduct.title} quantity`} disabled={quantity >= cartQuantityLimit({ listing, allocatedQuantity }) || pendingItemIds.includes(productListingId)}
                onClick={() => void updateQuantity(productListingId, quantity + 1)}>+</button>
            </div>
            <strong>{formatGbp(lineAmountPence({ listing, quantity }))}</strong>
          </div>
          <button className="cart-item__remove" type="button" aria-label={`Remove ${listing.legoProduct.title}`}
            onClick={() => setRemovalId(productListingId)}>Remove</button>
        </div>
      </article>
    })}
    {error && <p className="cart-items__error" role="alert">{error}</p>}
    <div className="cart-items__total" aria-label={`Cart total ${formatGbp(cartTotalPence(items))}`}>
      <span>Total</span>
      <strong>{formatGbp(cartTotalPence(items))}</strong>
    </div>
    {removalItem && <RemoveItemDialog item={removalItem} isConfirming={confirmingId === removalItem.productListingId}
      onCancel={() => { if (confirmingId === null) setRemovalId(null) }}
      onConfirm={item => {
        setConfirmingId(item.productListingId)
        void removeItem(item.productListingId).then(success => {
          setConfirmingId(null)
          if (success) { setRemovalId(null); onConfirmRemove?.(item) }
        })
      }} />}
  </div>
}
