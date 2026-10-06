import { useEffect, useState } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import { AuthApiError, isVerificationRequired } from '../../features/auth/api'
import { listOrders, readOrder, type OrderSummary, type OrderDetail } from '../../features/orders/api'
import { canResumeCheckout, displayDate, orderDetailId, orderStatusLabel, paymentStatusLabel } from '../../features/orders/presentation'
import { navigateCheckout } from '../../features/checkout/state'
import { formatGbp, priceToPence } from '../../features/cart/CartContext'
import { VerificationNotice } from './VerificationNotice'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import '../checkout/Checkout.css'

type Props = { path: string; onAccount: () => void; onAuthenticate: () => void }
export function CustomerOrders({ path, onAccount, onAuthenticate }: Props) {
  const { state } = useAuth()
  const list = /^\/account\/orders\/?$/.test(path)
  const id = orderDetailId(path)
  return <main className="checkout customer-orders" tabIndex={-1}><div className="checkout__paper">
    <p className="checkout__eyebrow">Build &amp; Bloom · Your account</p>
    <h1>{list ? 'My Orders' : id ? `Order #${id}` : 'Order unavailable'}</h1>
    {state.status === 'authenticated' ? list || id ? <VerifiedOrders key={`${state.token}:${path}`} token={state.token} id={id} onAuthenticate={onAuthenticate} /> : <p role="alert">This order cannot be opened. Please return to My Orders.</p>
      : state.status === 'verificationRequired' ? <VerificationNotice token={state.token} message="Please verify your email to view your orders." />
      : state.status === 'resolving' ? <p role="status">Restoring your account…</p> : <><p>Please sign in to view your orders.</p><button onClick={onAccount}>Sign in</button></>}
    {!list && <button className="checkout__secondary" onClick={() => navigateCheckout('/account/orders')}>Back to My Orders</button>}
    <BotanicalDivider /><button className="checkout__secondary" onClick={() => navigateCheckout('/')}>Back to storefront</button>
  </div></main>
}

type ReadState = { phase: 'loading' } | { phase: 'ready'; orders: OrderSummary[]; detail: OrderDetail | null } | { phase: 'error' } | { phase: 'auth' } | { phase: 'verification' } | { phase: 'unavailable' }
function VerifiedOrders({ token, id, onAuthenticate }: { token: string; id: number | null; onAuthenticate: () => void }) {
  const [state, setState] = useState<ReadState>({ phase: 'loading' })
  const [revision, setRevision] = useState(0)
  const reload = () => { setState({ phase: 'loading' }); setRevision(value => value + 1) }
  useEffect(() => {
    let active = true
    const request = id === null ? listOrders(token).then(orders => ({ orders, detail: null })) : readOrder(token, id).then(detail => ({ orders: [], detail }))
    void request.then(result => { if (active) setState({ phase: 'ready', ...result }) }, reason => {
      if (!active) return
      setState({ phase: isVerificationRequired(reason) ? 'verification' : reason instanceof AuthApiError && reason.status === 401 ? 'auth' : reason instanceof AuthApiError && [403, 404].includes(reason.status) ? 'unavailable' : 'error' })
    })
    return () => { active = false }
  }, [token, id, revision])
  if (state.phase === 'loading') return <p role="status">{id === null ? 'Loading your orders…' : 'Loading your order…'}</p>
  if (state.phase === 'verification') return <VerificationNotice token={token} message="Please verify your email to view your orders." onVerified={reload} />
  if (state.phase === 'auth') return <><p role="alert">Please sign in again to view your orders.</p><button onClick={onAuthenticate}>Sign in</button></>
  if (state.phase === 'unavailable') return <p role="alert">We cannot display this order information for your account.</p>
  if (state.phase === 'error') return <><p role="alert">Unable to load your orders. Please try again.</p><button onClick={reload}>Retry</button></>
  return <>
    {state.detail ? <Detail order={state.detail} /> : state.orders.length ? <ul className="checkout__items">{state.orders.map(order => <li key={order.id}>
      <h2>Order #{order.id}</h2><p>Placed {displayDate(order.createdAt)}</p>
      <p>Order status: {orderStatusLabel(order.status)}</p>
      <p>{order.orderItems.reduce((sum, item) => sum + item.quantity, 0)} items · {order.orderItems.map(item => item.productListing.legoProduct.title).join(', ')}</p>
      <p className="checkout__total">Order total <strong>{formatGbp(priceToPence(order.totalAmount))}</strong></p>
      <button onClick={() => navigateCheckout(`/account/orders/${order.id}`)}>View order #{order.id}</button>
    </li>)}</ul> : <p>You haven’t placed any orders yet.</p>}
    <button className="checkout__secondary" onClick={reload}>Refresh {id === null ? 'orders' : 'order'}</button>
  </>
}

function Address({ order, kind }: { order: OrderDetail; kind: 'delivery' | 'billing' }) {
  return <address>{order[`${kind}RecipientName`]}<br />{order[`${kind}Line1`]}<br />
    {order[`${kind}Line2`] && <>{order[`${kind}Line2`]}<br /></>}
    {order[`${kind}City`]}<br />{order[`${kind}County`] && <>{order[`${kind}County`]}<br /></>}
    {order[`${kind}Postcode`]}<br />{order[`${kind}CountryCode`]}
    {order[`${kind}Phone`] && <><br />{order[`${kind}Phone`]}</>}
  </address>
}
function Detail({ order }: { order: OrderDetail }) {
  return <>
    <p>Placed {displayDate(order.createdAt)}</p><p>Order status: {orderStatusLabel(order.status)}</p>
    <p>Payment status: {paymentStatusLabel(order.payment?.status)}</p>
    {order.payment?.status === 'SUCCEEDED' && order.payment.paidAt && <p>Paid {displayDate(order.payment.paidAt)}</p>}
    <section aria-labelledby="order-items"><h2 id="order-items">Items</h2><ul className="checkout__items">{order.orderItems.map(item => <li key={item.id}>
      <strong>{item.productListing.legoProduct.title}</strong><span>Set {item.productListing.legoProduct.setNumber} · Quantity {item.quantity}</span>
      <span>{item.conditionSnapshot === 'USED_LIKE_NEW' ? 'New – Outer Box Damage' : item.conditionSnapshot === 'NEW' ? 'New' : 'Condition unavailable'}</span>
      <span>{formatGbp(priceToPence(item.unitPrice))} each · {formatGbp(priceToPence(item.lineTotal))}</span>
    </li>)}</ul><p className="checkout__total">Order total <strong>{formatGbp(priceToPence(order.totalAmount))}</strong></p></section>
    <div className="checkout__columns"><section aria-labelledby="order-delivery"><h2 id="order-delivery">Delivery address</h2><Address order={order} kind="delivery" /></section>
      <section aria-labelledby="order-billing"><h2 id="order-billing">Billing address</h2><Address order={order} kind="billing" /></section></div>
    {order.status === 'PENDING' && order.payment?.status !== 'SUCCEEDED' && order.reservationExpiresAt && <p>Reservation expires {displayDate(order.reservationExpiresAt)}.</p>}
    {order.status === 'DISPATCHED' && <p>{order.dispatchedAt && <>Dispatched {displayDate(order.dispatchedAt)}. </>}{order.shippingCarrier}{order.trackingNumber && <> · Tracking {order.trackingNumber}</>}</p>}
    {order.status === 'COMPLETED' && order.completedAt && <p>Completed {displayDate(order.completedAt)}.</p>}
    {canResumeCheckout(order) && <button onClick={() => navigateCheckout(`/checkout/orders/${order.id}`)}>Resume checkout</button>}
  </>
}
