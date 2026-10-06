import { requestJson } from '../auth/api'
import type { Order } from '../checkout/api'

// The list projection deliberately has no payment or address fields.
export type OrderSummary = Pick<Order, 'id' | 'status' | 'totalAmount' | 'orderItems'> & {
  createdAt: string
  updatedAt: string
  shippingCarrier: string | null
  trackingNumber: string | null
  dispatchedAt: string | null
  completedAt: string | null
}
export type OrderDetail = Order & OrderSummary & {
  billingCounty: string | null
  billingPhone: string | null
  deliveryCounty: string | null
  deliveryPhone: string | null
}
export const listOrders = (token: string) => requestJson<OrderSummary[]>('/orders', { method: 'GET' }, token)
export const readOrder = (token: string, id: number) => requestJson<OrderDetail>(`/orders/${id}`, { method: 'GET' }, token)
