import type { Address } from './addressApi'

/** Applies one authoritative address response while reflecting backend default exclusivity. */
export function reconcileAddress(current: Address[], changed: Address): Address[] {
  const next = current.map(address => ({
    ...address,
    isDefaultShipping: changed.isDefaultShipping ? false : address.isDefaultShipping,
    isDefaultBilling: changed.isDefaultBilling ? false : address.isDefaultBilling,
  }))
  const index = next.findIndex(address => address.id === changed.id)
  if (index === -1) return [...next, changed]
  next[index] = changed
  return next
}
