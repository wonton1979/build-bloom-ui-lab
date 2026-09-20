/* eslint-disable react-refresh/only-export-components */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { addCartItem, deleteCartItem, getCart, updateCartItem, type PersistentCart } from './api'
import { CartContext, quantityWithinStock, type CartContextValue, type CartItem } from './CartContext'

export function mapCart(cart: PersistentCart): CartItem[] {
  return cart.items.map(item => ({ productListingId: item.productListingId, quantity: item.quantity, listing: item.productListing }))
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { state: authState } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingItemIds, setPendingItemIds] = useState<number[]>([])
  const generation = useRef(0)
  const hydration = useRef<Promise<void>>(Promise.resolve())
  const writes = useRef<Promise<void>>(Promise.resolve())
  const pendingIds = useRef(new Set<number>())
  const activeToken = useRef<string | null>(null)

  const markPending = (id: number) => {
    pendingIds.current.add(id)
    setPendingItemIds([...pendingIds.current])
  }
  const clearPending = (id: number) => {
    pendingIds.current.delete(id)
    setPendingItemIds([...pendingIds.current])
  }

  useLayoutEffect(() => {
    activeToken.current = authState.status === 'authenticated' ? authState.token : null
  }, [authState])

  // Register the authenticated hydration promise during commit, before the
  // authenticated catalogue can receive an Add-to-cart click. A passive
  // effect leaves a small but real render-to-effect gap where a write could
  // capture the pre-auth generation and be discarded.
  useLayoutEffect(() => {
    const currentGeneration = ++generation.current
    if (authState.status !== 'authenticated') {
      hydration.current = Promise.resolve()
      pendingIds.current.clear()
      void Promise.resolve().then(() => {
        if (generation.current !== currentGeneration) return
        setItems([])
        setPendingItemIds([])
        setIsLoading(false)
        setError(null)
      })
      return
    }
    void Promise.resolve().then(() => {
      if (generation.current === currentGeneration) {
        setIsLoading(true)
        setError(null)
      }
    })
    const restore = getCart(authState.token).then(cart => {
      if (generation.current !== currentGeneration) return
      setItems(mapCart(cart))
    }).catch((reason: unknown) => {
      if (generation.current !== currentGeneration) return
      setError(reason instanceof Error ? reason.message : 'Unable to restore your cart')
    }).finally(() => {
      if (generation.current === currentGeneration) setIsLoading(false)
    })
    hydration.current = restore
  }, [authState])

  const addListing = useCallback((listing: CartItem['listing']) => {
    if (authState.status !== 'authenticated') return Promise.resolve()
    const operation = writes.current.then(async () => {
      // Let the authentication effect establish the current hydration promise
      // before taking the generation snapshot. A click can arrive in the
      // render-to-effect gap immediately after authentication resolves.
      await Promise.resolve()
      await hydration.current
      // The auth generation changes when its hydration effect is installed;
      // that normal transition must not discard this valid write. The token
      // ref still prevents a request from committing after sign-out/account
      // replacement.
      if (activeToken.current !== authState.token) return
      const cart = await addCartItem(authState.token, listing.id, 1)
      if (activeToken.current !== authState.token) return
      setItems(mapCart(cart))
      setError(null)
    }).catch((reason: unknown) => {
      if (activeToken.current === authState.token) setError(reason instanceof Error ? reason.message : 'Unable to update your cart')
    })
    writes.current = operation.catch(() => undefined)
    return operation
  }, [authState])

  const updateQuantity = useCallback((productListingId: number, quantity: number) => {
    if (authState.status !== 'authenticated' || quantity < 1) return Promise.resolve(false)
    const current = items.find(item => item.productListingId === productListingId)
    if (!current || !quantityWithinStock(current, quantity) || pendingIds.current.has(productListingId)) return Promise.resolve(false)
    markPending(productListingId)
    const currentGeneration = generation.current
    const operation = writes.current.then(async () => {
      await hydration.current
      if (generation.current !== currentGeneration) return false
      const cart = await updateCartItem(authState.token, productListingId, quantity)
      if (generation.current !== currentGeneration) return false
      setItems(mapCart(cart)); setError(null)
      return true
    }).catch((reason: unknown) => {
      if (activeToken.current === authState.token) setError(reason instanceof Error ? reason.message : 'Unable to update your cart')
      return false
    }).finally(() => clearPending(productListingId))
    writes.current = operation.then(() => undefined)
    return operation
  }, [authState, items])

  const removeItem = useCallback((productListingId: number) => {
    if (authState.status !== 'authenticated' || pendingIds.current.has(productListingId)) return Promise.resolve(false)
    if (!items.some(item => item.productListingId === productListingId)) return Promise.resolve(false)
    markPending(productListingId)
    const currentGeneration = generation.current
    const operation = writes.current.then(async () => {
      await hydration.current
      if (generation.current !== currentGeneration) return false
      const cart = await deleteCartItem(authState.token, productListingId)
      if (generation.current !== currentGeneration) return false
      setItems(mapCart(cart)); setError(null)
      return true
    }).catch((reason: unknown) => {
      if (generation.current === currentGeneration) setError(reason instanceof Error ? reason.message : 'Unable to remove that item')
      return false
    }).finally(() => clearPending(productListingId))
    writes.current = operation.then(() => undefined)
    return operation
  }, [authState, items])

  const value = useMemo<CartContextValue>(() => ({
    items,
    addListing,
    updateQuantity,
    removeItem,
    pendingItemIds,
    isLoading,
    error,
  }), [addListing, error, isLoading, items, pendingItemIds, removeItem, updateQuantity])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
