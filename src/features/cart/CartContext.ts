import { createContext, useContext } from 'react'
import type { CartProductListing, ProductListingOffer } from '../catalogue/api'

export interface CartItem {
  productListingId: CartProductListing['id']
  listing: CartProductListing
  quantity: number
}

export interface CartContextValue {
  items: CartItem[]
  addListing: (listing: ProductListingOffer) => Promise<void>
  updateQuantity: (productListingId: number, quantity: number) => Promise<boolean>
  removeItem: (productListingId: number) => Promise<boolean>
  pendingItemIds: readonly number[]
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

export function effectivePricePence(listing: Pick<ProductListingOffer, 'effectivePrice'>): number {
  return priceToPence(listing.effectivePrice)
}

export function listingUnitPricePence(item: Pick<CartItem, 'listing'>): number {
  return effectivePricePence(item.listing)
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

export const CartContext = createContext<CartContextValue>({ items: [], addListing: async () => {}, updateQuantity: async () => false, removeItem: async () => false, pendingItemIds: [], isLoading: false, error: null })

export function offerQuantityLimit(listing: Pick<ProductListingOffer, 'condition' | 'availableStock'>): number {
  return listing.condition === 'USED_LIKE_NEW' ? Math.min(1, listing.availableStock) : listing.availableStock
}

export function addListingOnce(items: readonly CartItem[], listing: CartProductListing): CartItem[] {
  const limit = offerQuantityLimit(listing)
  if (limit <= 0) return [...items]
  const existing = items.find(item => item.productListingId === listing.id)
  if (existing) {
    if (existing.quantity >= limit) return [...items]
    return items.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item)
  }
  return [...items, { productListingId: listing.id, listing, quantity: 1 }]
}

export function quantityWithinStock(item: Pick<CartItem, 'listing'>, quantity: number): boolean {
  return quantity >= 1 && quantity <= offerQuantityLimit(item.listing)
}

export function useCart(): CartContextValue {
  return useContext(CartContext)
}
