import { useEffect, useRef } from 'react'
import { useCart } from './CartContext'
import { isConfirmed } from '../checkout/state'
import type { Order } from '../checkout/api'

// GET only: backend owns eventual cleanup, including legacy no-op behavior.
export function useConfirmedCartRefresh(order: Order | null) {
  const { refreshCart } = useCart()
  const refreshed = useRef<number | null>(null)
  useEffect(() => {
    if (!order || !isConfirmed(order) || refreshed.current === order.id) return
    refreshed.current = order.id
    void refreshCart()
  }, [order, refreshCart])
}
