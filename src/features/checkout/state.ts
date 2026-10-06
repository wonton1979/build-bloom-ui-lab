import type { Address } from '../account/addressApi'
import type { CartItem } from '../cart/CartContext'
import type { DeliveryAddress, Order, OrderInput } from './api'

export function deliverySnapshot(address: Address): DeliveryAddress {
  const country = address.country.trim().toUpperCase()
  const countryCode = ['UK', 'UNITED KINGDOM', 'GREAT BRITAIN'].includes(country) ? 'GB' : country
  // Saved addresses support country codes; never truncate arbitrary country names.
  const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
  if (!codes.includes(countryCode)) throw new Error('Please edit this saved address to use a valid two-letter country code, such as GB.')
  for (const field of ['recipientName', 'line1', 'city', 'postcode'] as const) if (!address[field].trim()) throw new Error('Please complete the required fields in your saved delivery address.')
  return { recipientName: address.recipientName.trim(), line1: address.line1.trim(), city: address.city.trim(), postcode: address.postcode.trim(), countryCode, ...(address.line2?.trim() ? { line2: address.line2.trim() } : {}), ...(address.phone?.trim() ? { phone: address.phone.trim() } : {}) }
}
export const orderInput = (items: CartItem[], address: Address): OrderInput => ({ items: items.map(({ productListingId, quantity }) => ({ productListingId, quantity })), deliveryAddress: deliverySnapshot(address) })
export const isConfirmed = (order: Order) => order.payment?.status === 'SUCCEEDED' && ['CONFIRMED', 'DISPATCHED', 'COMPLETED'].includes(order.status)
export function isExpired(order: Order, now = Date.now()) {
  return order.status === 'EXPIRED' || (order.payment?.status !== 'SUCCEEDED' && order.reservationExpiresAt !== null && Date.parse(order.reservationExpiresAt) <= now)
}
export const isTerminal = (order: Order) => isExpired(order) || ['CANCELLED', 'RETURNED'].includes(order.status) || order.payment?.status === 'CANCELED'
export function checkoutOrderId(path: string): number | null {
  const match = path.match(/^\/checkout\/orders\/([1-9]\d*)\/?$/)
  const id = match ? Number(match[1]) : null
  return id !== null && Number.isSafeInteger(id) ? id : null
}
export function navigateCheckout(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export type CreationAttempt = { key: string; input: OrderInput }
const storageKey = (userId: number) => `colorful-life:checkout-attempt:${userId}`
export function readAttempt(userId: number): CreationAttempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(userId)) ?? 'null') as CreationAttempt | null
    return value && typeof value.key === 'string' && Array.isArray(value.input?.items) ? value : null
  } catch { return null }
}
export function saveAttempt(userId: number, attempt: CreationAttempt) {
  // The exact request snapshot is necessary to safely retry an ambiguous creation after refresh.
  try { sessionStorage.setItem(storageKey(userId), JSON.stringify(attempt)) }
  catch { throw new Error('Your browser cannot save checkout recovery information. Enable session storage before continuing.') }
}
export function clearAttempt(userId: number) { try { sessionStorage.removeItem(storageKey(userId)) } catch { /* The durable order URL still allows recovery. */ } }
