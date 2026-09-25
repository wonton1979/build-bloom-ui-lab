import { useCallback, useState } from 'react'
import type { ProductListingOffer } from './api'
export interface PendingConditionOffer {
  offer: ProductListingOffer
  productTitle: string
}

export function useConditionConfirmation(onConfirm: (offer: ProductListingOffer) => void) {
  const [pending, setPending] = useState<PendingConditionOffer | null>(null)
  const request = useCallback((offer: ProductListingOffer, productTitle: string) => setPending({ offer, productTitle }), [])
  const cancel = useCallback(() => setPending(null), [])
  const confirm = useCallback((offer: ProductListingOffer) => {
    if (pending?.offer.id !== offer.id || pending.offer.condition !== 'USED_LIKE_NEW') return
    onConfirm(pending.offer)
    setPending(null)
  }, [onConfirm, pending])
  return { pending, request, cancel, confirm }
}
