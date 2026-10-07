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

export const UK_COUNTRY = 'United Kingdom'
export const isUkCountry = (country: string) => ['GB', 'UK', 'UNITED KINGDOM', 'GREAT BRITAIN'].includes(country.trim().toUpperCase())
export const countryLabel = (country: string) => isUkCountry(country) ? UK_COUNTRY : country
export const profileRecipient = (profile: { firstName: string | null; lastName: string | null }) => [profile.firstName?.trim(), profile.lastName?.trim()].filter(Boolean).join(' ')
export const isUsableUkAddress = (address: Address) => isUkCountry(address.country)
  && (['recipientName', 'line1', 'city', 'postcode'] as const).every(field => address[field].trim().length > 0)
export function deliverySelection(addresses: Address[], previous: number | null, deliberate: boolean): number | null {
  const usable = addresses.filter(isUsableUkAddress)
  if (deliberate && usable.some(address => address.id === previous)) return previous
  return (usable.find(address => address.isDefaultShipping) ?? usable[0])?.id ?? null
}
