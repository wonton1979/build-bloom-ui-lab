import { useMemo, useState, type ReactNode } from 'react'
import { addListingOnce, CartContext, type CartContextValue, type CartItem } from './CartContext'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const value = useMemo<CartContextValue>(() => ({
    items,
    addListing: listing => setItems(current => addListingOnce(current, listing)),
  }), [items])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
