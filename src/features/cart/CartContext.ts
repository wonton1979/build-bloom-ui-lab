import { createContext, useContext } from 'react'
import type { ProductListing } from '../catalogue/api'

export interface CartItem {
  productListingId: ProductListing['id']
  listing: ProductListing
  quantity: number
}

export interface CartContextValue {
  items: CartItem[]
  addListing: (listing: ProductListing) => Promise<void>
  isLoading: boolean
  error: string | null
}

/** Parse backend decimal strings without using floating-point arithmetic. */
export function priceToPence(value: string): number {
  const normalized = value.trim()
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) throw new Error(`Invalid price: ${value}`)
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

export function listingUnitPricePence(item: Pick<CartItem, 'listing'>): number {
  return priceToPence(item.listing.salePrice ?? item.listing.originalPrice)
}

export function lineAmountPence(item: Pick<CartItem, 'listing' | 'quantity'>): number {
  return listingUnitPricePence(item) * item.quantity
}

export function cartTotalPence(items: readonly CartItem[]): number {
  return items.reduce((total, item) => total + lineAmountPence(item), 0)
}

export function formatGbp(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)
}

export const CartContext = createContext<CartContextValue>({ items: [], addListing: async () => {}, isLoading: false, error: null })

export function addListingOnce(items: readonly CartItem[], listing: ProductListing): CartItem[] {
  if (listing.availableStock <= 0) return [...items]
  const existing = items.find(item => item.productListingId === listing.id)
  if (existing) {
    if (existing.quantity >= listing.availableStock) return [...items]
    return items.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item)
  }
  return [...items, { productListingId: listing.id, listing, quantity: 1 }]
}

export function useCart(): CartContextValue {
  return useContext(CartContext)
}
