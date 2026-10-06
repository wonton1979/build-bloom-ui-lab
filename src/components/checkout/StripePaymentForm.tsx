import { useEffect, useRef, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const stripePromise = publishableKey && /^pk_(test|live)_\S+$/.test(publishableKey) ? loadStripe(publishableKey).catch(() => null) : null

export function StripePaymentForm({ clientSecret, orderId, onVerify, onRecheck }: { clientSecret: string; orderId: number; onVerify: () => void; onRecheck?: () => void }) {
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    let active = true
    void stripePromise?.then(stripe => { if (active && !stripe) setUnavailable(true) })
    return () => { active = false }
  }, [])
  if (!stripePromise) return <p role="alert">Payments are not configured.{import.meta.env.DEV && ' Set VITE_STRIPE_PUBLISHABLE_KEY to a valid Stripe publishable key, then reload.'}</p>
  if (unavailable) return <p role="alert">Secure payment could not load. Check your connection and reload this order to try again.</p>
  return <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#65547c', borderRadius: '12px' } } }}><PaymentForm orderId={orderId} clientSecret={clientSecret} onVerify={onVerify} onRecheck={onRecheck} /></Elements>
}

export function PaymentForm({ orderId, clientSecret, onVerify, onRecheck }: { orderId: number; clientSecret: string; onVerify: () => void; onRecheck?: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const locked = useRef(false)
  const callback = useRef(onVerify)
  useEffect(() => { callback.current = onVerify }, [onVerify])
  const [state, setState] = useState<'loading' | 'ready' | 'submitting' | 'unknown'>('loading')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!stripe) return
    let active = true
    void stripe.retrievePaymentIntent(clientSecret).then(result => {
      if (!active) return
      if (['succeeded', 'processing'].includes(result.paymentIntent?.status ?? '')) { callback.current(); return }
      if (result.error || result.paymentIntent?.status === 'canceled') { setState('unknown'); setError('This payment cannot be resumed. Please check your order status.'); return }
      setState('ready')
    }).catch(() => { if (active) { setState('unknown'); setError('Unable to check payment status. Please recheck your order.') } })
    return () => { active = false }
  }, [stripe, clientSecret])
  return <form onSubmit={async event => {
    event.preventDefault()
    if (!stripe || !elements || locked.current || state !== 'ready') return
    locked.current = true; setState('submitting'); setError(null)
    try {
      const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/checkout/orders/${orderId}` }, redirect: 'if_required' })
      if (result.error) {
        if (['card_error', 'validation_error'].includes(result.error.type)) { setError(result.error.message ?? 'Your payment was declined. Please check your payment details.'); setState('ready') }
        else { setState('unknown'); setError('The payment outcome is not yet known. Please check your order before trying again.') }
      } else { setState('unknown'); callback.current() }
    } catch { setState('unknown'); setError('Connection lost during payment. Please check your order before trying again.') }
    finally { locked.current = false }
  }}>
    <PaymentElement onLoadError={() => { setState('unknown'); setError('Secure payment could not load. Please check your order and try again.') }} />
    {error && <p role="alert">{error}</p>}
    <p role="status">{state === 'loading' ? 'Checking payment details…' : state === 'submitting' ? 'Submitting payment… Complete any authentication requested by your bank.' : ''}</p>
    {state === 'unknown' ? <button type="button" onClick={onRecheck ?? onVerify}>Check order status</button> : <button type="submit" disabled={!stripe || !elements || state !== 'ready'}>{state === 'submitting' ? 'Processing payment…' : 'Pay now'}</button>}
  </form>
}
