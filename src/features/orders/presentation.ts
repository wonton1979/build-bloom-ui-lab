import type { OrderDetail } from './api'
import { isExpired } from '../checkout/state'

const orderLabels: Record<string, string> = { PENDING: 'Pending', CONFIRMED: 'Confirmed', DISPATCHED: 'Dispatched', COMPLETED: 'Completed', CANCELLED: 'Cancelled', EXPIRED: 'Expired', RETURNED: 'Returned' }
const paymentLabels: Record<string, string> = { PENDING: 'Pending', PROCESSING: 'Processing', SUCCEEDED: 'Succeeded', FAILED: 'Failed', CANCELED: 'Cancelled' }
export const orderStatusLabel = (status: string) => Object.hasOwn(orderLabels, status) ? orderLabels[status] : 'Status unavailable'
export const paymentStatusLabel = (status: string | undefined) => status === undefined ? 'Not yet recorded' : Object.hasOwn(paymentLabels, status) ? paymentLabels[status] : 'Status unavailable'
export function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}
// This only controls navigation; checkout rereads and makes all payment decisions.
export const canResumeCheckout = (order: OrderDetail) => order.status === 'PENDING' && !isExpired(order)
  && (!order.payment || ['PENDING', 'PROCESSING', 'FAILED'].includes(order.payment.status))
export function orderDetailId(path: string): number | null {
  const match = /^\/account\/orders\/([1-9]\d*)\/?$/.exec(path)
  const id = match ? Number(match[1]) : null
  return id !== null && Number.isSafeInteger(id) ? id : null
}

// Stripe initialization records PROCESSING; expiry alone does not rule out a charge.
export const canCheckPayment = (order: OrderDetail) => order.status === 'PENDING' && order.payment?.status === 'PROCESSING'
