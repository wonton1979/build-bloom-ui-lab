import type { ProductListing } from '../catalogue/api'

export type PersistentCartItem = {
  productListingId: number
  quantity: number
  productListing: ProductListing
}

export type PersistentCart = { items: PersistentCartItem[] }

const apiBase = () => (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

async function requestJson<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${apiBase()}${path}`, { ...init, headers })
  let body: unknown = null
  try { body = await response.json() } catch { /* Error response may have no JSON body. */ }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
      ? body.error : 'Unable to update your cart'
    throw new Error(message)
  }
  return body as T
}

export function getCart(token: string) {
  return requestJson<PersistentCart>('/cart', token, { method: 'GET' })
}

export function addCartItem(token: string, productListingId: number, quantity = 1) {
  return requestJson<PersistentCart>('/cart/items', token, {
    method: 'POST', body: JSON.stringify({ productListingId, quantity }),
  })
}

export function updateCartItem(token: string, productListingId: number, quantity: number) {
  return requestJson<PersistentCart>(`/cart/items/${productListingId}`, token, {
    method: 'PATCH', body: JSON.stringify({ quantity }),
  })
}

export function deleteCartItem(token: string, productListingId: number) {
  return requestJson<PersistentCart>(`/cart/items/${productListingId}`, token, { method: 'DELETE' })
}
