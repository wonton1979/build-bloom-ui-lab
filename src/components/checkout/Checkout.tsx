import { useEffect, useState } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import { AuthApiError } from '../../features/auth/api'
import { getAddresses, type Address } from '../../features/account/addressApi'
import { cartTotalPence, formatGbp, lineAmountPence, priceToPence, useCart } from '../../features/cart/CartContext'
import { checkoutOrderId, isExpired, navigateCheckout, orderInput } from '../../features/checkout/state'
import { useCheckout } from '../../features/checkout/useCheckout'
import { StripePaymentForm } from './StripePaymentForm'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import './Checkout.css'
import { VerificationNotice } from '../account/VerificationNotice'

export function Checkout({ onAccount }: { onAccount: () => void }) {
  const { state, logout } = useAuth()
  const validLocation = /^\/checkout\/?$/.test(window.location.pathname) || checkoutOrderId(window.location.pathname) !== null
  return <main className="checkout" tabIndex={-1}>
    <div className="checkout__paper">
      {!validLocation ? <><h1>Checkout</h1><p role="alert">This order link is invalid. Please return to the storefront.</p></> : state.status === 'authenticated' ? <AuthenticatedCheckout token={state.token} userId={state.user.id} onAccount={onAccount} onAuthenticate={() => { logout(); onAccount() }} /> : <>
        <h1>Checkout</h1>
        {state.status === 'verificationRequired' ? <VerificationNotice token={state.token} message="Verify your email before an order can be created. Your saved checkout request will be retained." /> : <p role="status">{state.status === 'resolving' ? 'Restoring your account…' : 'Please sign in to continue your checkout.'}</p>}
        {state.status !== 'resolving' && <button onClick={onAccount}>Open account</button>}
      </>}
      <BotanicalDivider />
      <button className="checkout__secondary" onClick={() => navigateCheckout('/')}>Back to storefront</button>
    </div>
  </main>
}

function AddressCopy({ name, line1, line2, city, postcode, country }: { name: string; line1: string; line2?: string | null; city: string; postcode: string; country: string }) {
  return <address>{name}<br />{line1}<br />{line2 && <>{line2}<br /></>}{city}<br />{postcode}<br />{country}</address>
}

function AuthenticatedCheckout({ token, userId, onAccount, onAuthenticate }: { token: string; userId: number; onAccount: () => void; onAuthenticate: () => void }) {
  const cart = useCart()
  const orderId = checkoutOrderId(window.location.pathname)
  const checkout = useCheckout(token, userId, orderId)
  const { order, phase, message, secret, attempt } = checkout
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressId, setAddressId] = useState<number | null>(null)
  const [addressLoading, setAddressLoading] = useState(!orderId)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [addressAuthRequired, setAddressAuthRequired] = useState(false)
  const [reload, setReload] = useState(0)
  const [inputError, setInputError] = useState<string | null>(null)
  useEffect(() => {
    if (orderId) return
    let active = true
    void getAddresses(token).then(result => {
      if (!active) return
      setAddresses(result); setAddressId((result.find(address => address.isDefaultShipping) ?? result[0])?.id ?? null); setAddressError(null); setAddressAuthRequired(false)
    }).catch(reason => {
      if (!active) return
      const authRequired = reason instanceof AuthApiError && [401, 403].includes(reason.status)
      setAddressAuthRequired(authRequired)
      setAddressError(authRequired ? 'Please sign in and verify your account to load saved addresses.' : 'Unable to load saved addresses. Please try again.')
    }).finally(() => { if (active) setAddressLoading(false) })
    return () => { active = false }
  }, [orderId, token, reload])
  const selected = addresses.find(address => address.id === addressId)
  const billing = addresses.find(address => address.isDefaultBilling)
  const pending = ['creating', 'loading', 'preparing', 'waiting'].includes(phase)
  const confirmed = phase === 'confirmed'
  const frozen = Boolean(attempt)
  const verificationBlocked = phase === 'verification'
  const definiteRejection = attempt?.rejection === 'EMAIL_VERIFICATION_REQUIRED'
  const canCreate = !orderId && !order && !pending && phase !== 'terminal' && !verificationBlocked && (frozen || (cart.items.length > 0 && !cart.isLoading && !cart.pendingItemIds.length && Boolean(selected && billing) && !addressLoading))

  return <>
    <p className="checkout__eyebrow">Build &amp; Bloom · Your purchase</p>
    <h1>{confirmed ? 'Thank you for your order' : 'Checkout'}</h1>
    {orderId && <p>Order #{orderId}</p>}
    {(message || inputError || addressError) && <p className="checkout__error" role="alert">{message || inputError || addressError}</p>}
    {confirmed && <div className="checkout__notice" role="status"><strong>Payment confirmed · {order?.status === 'CONFIRMED' ? 'Order confirmed' : order?.status === 'DISPATCHED' ? 'Order dispatched' : 'Order completed'}</strong><p>Your order is confirmed. Your cart has been preserved to protect changes made while you were paying. Please review purchased items before checking out again.</p></div>}
    {phase === 'terminal' && <div className="checkout__notice" role="status"><p>{order && isExpired(order) ? 'Your reservation has expired. This order can no longer be paid.' : 'This checkout cannot continue.'}{order?.payment?.status === 'SUCCEEDED' && ' Payment was recorded; please contact us about this order before making another payment.'}</p><button onClick={checkout.restart}>Return to storefront and review cart</button></div>}
    {(phase === 'auth' || addressAuthRequired) && <button onClick={onAuthenticate}>Sign in / verify account</button>}
    {verificationBlocked && <VerificationNotice token={token} message="Your order request was not accepted because your email is not verified. No order was created by this request. Your checkout details are saved." onVerified={checkout.resumeAfterVerification} />}
    {phase === 'loading' && <p role="status">Loading your order…</p>}

    {(order || !orderId) && <div className="checkout__columns">
      <section aria-labelledby="checkout-summary"><h2 id="checkout-summary">{order ? 'Order summary' : 'Cart summary'}</h2>
        {order ? <><ul className="checkout__items">{order.orderItems.map(item => <li key={item.id}><strong>{item.productListing.legoProduct.title}</strong><span>{item.conditionSnapshot === 'USED_LIKE_NEW' ? 'New – Outer Box Damage' : 'New'} · Quantity {item.quantity}</span><span>{formatGbp(priceToPence(item.unitPrice))} each · {formatGbp(priceToPence(item.lineTotal))}</span></li>)}</ul><p className="checkout__total">Order total <strong>{formatGbp(priceToPence(order.totalAmount))}</strong></p></> : <>
          {cart.isLoading ? <p role="status">Loading your cart…</p> : <ul className="checkout__items">{cart.items.map(item => <li key={item.productListingId}><strong>{item.listing.legoProduct.title}</strong><span>{item.listing.condition === 'USED_LIKE_NEW' ? 'New – Outer Box Damage' : 'New'} · Quantity {item.quantity}</span><span>{formatGbp(priceToPence(item.listing.effectivePrice))} each · {formatGbp(lineAmountPence(item))}</span></li>)}</ul>}
          {!cart.items.length && !cart.isLoading && <p>Your cart is empty. Add an item before checking out.</p>}
          <p className="checkout__total">Estimated total <strong>{formatGbp(cartTotalPence(cart.items))}</strong></p><p>Final prices and availability are confirmed when your order is reserved.</p>
          {cart.error && <p role="alert">{cart.error}</p>}
        </>}
      </section>
      <section aria-labelledby="checkout-delivery"><h2 id="checkout-delivery">Delivery address</h2>
        {order ? <AddressCopy name={order.deliveryRecipientName} line1={order.deliveryLine1} line2={order.deliveryLine2} city={order.deliveryCity} postcode={order.deliveryPostcode} country={order.deliveryCountryCode} /> : <>
          {frozen ? <><p>{definiteRejection ? 'Your checkout request is saved. Continuing after verification uses the same items and delivery address.' : 'A checkout request is saved. Retry uses the original items and delivery address, even if your cart has since changed.'}</p><ul>{attempt?.input.items.map(item => <li key={item.productListingId}>Listing #{item.productListingId} · Quantity {item.quantity}</li>)}</ul>{attempt?.input.deliveryAddress && <AddressCopy name={attempt.input.deliveryAddress.recipientName} line1={attempt.input.deliveryAddress.line1} line2={attempt.input.deliveryAddress.line2} city={attempt.input.deliveryAddress.city} postcode={attempt.input.deliveryAddress.postcode} country={attempt.input.deliveryAddress.countryCode} />}</> : addressLoading ? <p role="status">Loading addresses…</p> : <>
            <label>Saved delivery address<select value={addressId ?? ''} onChange={event => { setAddressId(Number(event.target.value)); setInputError(null) }} disabled={pending}><option value="" disabled>Choose an address</option>{addresses.map(address => <option key={address.id} value={address.id}>{address.recipientName} · {address.line1} · {address.postcode}</option>)}</select></label>
            {selected && <AddressCopy name={selected.recipientName} line1={selected.line1} line2={selected.line2} city={selected.city} postcode={selected.postcode} country={selected.country} />}
          </>}
          <button className="checkout__secondary" disabled={pending} onClick={onAccount}>Manage saved addresses in My Account</button>
          <button className="checkout__secondary" disabled={pending} onClick={() => { setAddressLoading(true); setReload(value => value + 1) }}>Reload addresses</button>
        </>}
        <h2>Billing address</h2>
        {order ? <AddressCopy name={order.billingRecipientName} line1={order.billingLine1} line2={order.billingLine2} city={order.billingCity} postcode={order.billingPostcode} country={order.billingCountryCode} /> : billing ? <AddressCopy name={billing.recipientName} line1={billing.line1} line2={billing.line2} city={billing.city} postcode={billing.postcode} country={billing.country} /> : !addressLoading && <p>Add a default billing address in My Account before continuing.</p>}
        {!order && <p>Your saved default billing address will be used. Delivery selection does not change it.</p>}
      </section>
    </div>}
    {!orderId && phase !== 'terminal' && <button disabled={!canCreate} onClick={() => {
      try { const input = attempt?.input ?? (selected ? orderInput(cart.items, selected) : null); if (input) { setInputError(null); void checkout.create(input) } }
      catch (reason) { setInputError(reason instanceof Error ? reason.message : 'Please check your delivery address.') }
    }}>{phase === 'creating' ? 'Reserving your order…' : verificationBlocked ? 'Verify email before creating order' : definiteRejection ? 'Continue saved checkout' : frozen ? 'Retry saved order request' : 'Create order and review total'}</button>}
    {!orderId && frozen && !definiteRejection && !pending && phase !== 'terminal' && <p>Retry first if the previous response was lost. Starting again abandons recovery of that request. <button className="checkout__secondary" onClick={checkout.restart}>Leave saved checkout and review cart</button></p>}
    {order && !confirmed && phase !== 'terminal' && <section className="checkout__payment" aria-labelledby="checkout-payment"><h2 id="checkout-payment">Payment</h2>
      {phase === 'reserved' && <><p>Your order is reserved. Review the final total above before continuing to payment.</p>{order.reservationExpiresAt && <p>Reserved until {new Date(order.reservationExpiresAt).toLocaleTimeString('en-GB')}.</p>}<button onClick={() => void checkout.prepare()}>Continue to secure payment</button></>}
      {phase === 'preparing' && <p role="status">Preparing secure payment…</p>}
      {phase === 'payment' && secret && <StripePaymentForm clientSecret={secret} orderId={order.id} onVerify={() => void checkout.verify()} onRecheck={() => void checkout.recheck()} />}
      {phase === 'waiting' && <p role="status">Payment is being verified. Confirming your order…</p>}
      {phase === 'pending' && <><p role="status">Your payment confirmation is still pending. You can safely return to this order URL or recheck. Do not start another payment.</p><button onClick={() => void checkout.recheck()}>Recheck order status</button></>}
      {phase === 'failure' && <><button onClick={() => void checkout.recheck()}>Check order status</button><button onClick={() => void checkout.prepare()}>Retry payment setup</button></>}
    </section>}
    {orderId && !order && phase === 'failure' && <button onClick={() => void checkout.reloadOrder()}>Retry loading order</button>}
  </>
}
