import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { addCartItem, getCart, type PersistentCart } from './api'
import { CartContext, type CartContextValue, type CartItem } from './CartContext'

function mapCart(cart: PersistentCart): CartItem[] {
  return cart.items.map(item => ({ productListingId: item.productListingId, quantity: item.quantity, listing: item.productListing }))
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { state: authState } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const hydration = useRef<Promise<void>>(Promise.resolve())
  const writes = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    const currentGeneration = ++generation.current
    if (authState.status !== 'authenticated') {
      hydration.current = Promise.resolve()
      void Promise.resolve().then(() => {
        if (generation.current !== currentGeneration) return
        setItems([])
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
    const currentGeneration = generation.current
    const operation = writes.current.then(async () => {
      await hydration.current
      if (generation.current !== currentGeneration) return
      const cart = await addCartItem(authState.token, listing.id, 1)
      if (generation.current !== currentGeneration) return
      setItems(mapCart(cart))
      setError(null)
    }).catch((reason: unknown) => {
      if (generation.current === currentGeneration) setError(reason instanceof Error ? reason.message : 'Unable to update your cart')
    })
    writes.current = operation.catch(() => undefined)
    return operation
  }, [authState])

  const value = useMemo<CartContextValue>(() => ({
    items,
    addListing,
    isLoading,
    error,
  }), [addListing, error, isLoading, items])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
