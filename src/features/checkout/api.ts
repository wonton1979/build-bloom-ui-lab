import { apiBase } from '../auth/api'

export type DeliveryAddress = { recipientName: string; line1: string; line2?: string; city: string; county?: string; postcode: string; countryCode: string; phone?: string }
export type OrderInput = { items: { productListingId: number; quantity: number }[]; deliveryAddress?: DeliveryAddress }
export type Order = {
  id: number; status: string; totalAmount: string; reservationExpiresAt: string | null
  payment: { status: string; paidAt: string | null } | null
  billingRecipientName: string; billingLine1: string; billingLine2: string | null; billingCity: string; billingPostcode: string; billingCountryCode: string
  deliveryRecipientName: string; deliveryLine1: string; deliveryLine2: string | null; deliveryCity: string; deliveryPostcode: string; deliveryCountryCode: string
  orderItems: { id: number; quantity: number; unitPrice: string; lineTotal: string; conditionSnapshot: string; productListing: { id: number; legoProduct: { title: string; setNumber: string } } }[]
}

export class CheckoutApiError extends Error {
  readonly status: number
  readonly code?: string
  constructor(status: number, code?: string, detail?: string) {
    const messages: Record<string, string> = {
      ORDER_IDEMPOTENCY_MISMATCH: 'This checkout request changed. Please return to your cart to start a new checkout.',
      INVALID_IDEMPOTENCY_KEY: 'This checkout request could not be accepted. Please start a new checkout.',
      ORDER_EXPIRED: 'Your inventory reservation has expired. Return to your cart to start again.',
      ORDER_NOT_PAYABLE: 'This order is no longer available for payment.',
      PAYMENT_ALREADY_COMPLETED: 'Payment has already been recorded. Check your order status.',
      EMAIL_VERIFICATION_REQUIRED: 'Please verify your email before checking out.',
    }
    super(code && messages[code] || (status === 401 ? 'Please sign in again to continue.' : status === 403 ? 'Please verify your email before checking out.' : status === 404 ? 'This order could not be found in your account.' : status === 400 && detail?.includes('stock') ? 'Some items are no longer available in the requested quantity. Please review your cart.' : status === 400 && detail?.includes('billing') ? 'Please add a default billing address in My Account.' : status === 400 ? 'Please check your items and delivery address.' : 'We could not complete this request. Please try again.'))
    this.status = status; this.code = code
  }
}

async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase()}${path}`, { ...init, signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } })
  } catch { throw new Error('Connection interrupted. Please retry this saved checkout or recheck your order.') }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new CheckoutApiError(response.status, body?.error?.code, typeof body?.error === 'string' ? body.error : body?.error?.message)
  return body as T
}
export const createOrder = (token: string, input: OrderInput, key: string) => request<{ id: number }>(token, '/orders', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(input) })
export const getOrder = (token: string, id: number) => request<Order>(token, `/orders/${id}`)
export async function preparePayment(token: string, id: number) {
  const result = await request<{ clientSecret: string | null }>(token, `/orders/${id}/payments/stripe`, { method: 'POST' })
  if (!result?.clientSecret || typeof result.clientSecret !== 'string') throw new Error('Payment setup is unavailable. Please try again.')
  return result.clientSecret
}

export const recoverPayment = (token: string, id: number) => request<Order>(token, `/orders/${id}/payments/stripe/reconcile`, { method: 'POST' })
