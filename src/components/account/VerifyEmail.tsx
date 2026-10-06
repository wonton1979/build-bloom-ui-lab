import { useEffect, useRef, useState } from 'react'
import { AuthApiError, verifyEmail } from '../../features/auth/api'
import { useAuth } from '../../features/auth/AuthProvider'
import { navigateCheckout } from '../../features/checkout/state'
import { VerificationNotice } from './VerificationNotice'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import '../checkout/Checkout.css'

export function VerifyEmail({ onAccount }: { onAccount: () => void }) {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token')?.trim() ?? '')
  const [phase, setPhase] = useState<'verifying' | 'success' | 'invalid' | 'failure' | 'missing'>(token ? 'verifying' : 'missing')
  const { state, refreshAuth } = useAuth()
  const refresh = useRef(refreshAuth)
  useEffect(() => { refresh.current = refreshAuth }, [refreshAuth])
  const request = useRef<Promise<void> | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('token')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    if (!token) return
    let cancelled = false
    // Reuse the promise across StrictMode effect replay; tokens are single-use.
    request.current ??= verifyEmail(token)
    void request.current.then(async () => {
      if (cancelled) return
      setPhase('success')
      await refresh.current()
    }, reason => {
      if (!cancelled) setPhase(reason instanceof AuthApiError && reason.status === 400 ? 'invalid' : 'failure')
    })
    return () => { cancelled = true }
  }, [token, retry])
  const sessionToken = state.status === 'verificationRequired' || state.status === 'authenticated' ? state.token : null
  return <main className="checkout" tabIndex={-1}><div className="checkout__paper">
    <p className="checkout__eyebrow">Build &amp; Bloom · Your account</p><h1>Email verification</h1>
    {phase === 'verifying' && <p role="status">Verifying your email…</p>}
    {phase === 'success' && <><p role="status">Your email has been verified. Thank you!</p><p>Return to checkout to continue your saved request. No order will be created until you choose to continue.</p><button onClick={() => navigateCheckout('/checkout')}>Continue to checkout</button>{state.status !== 'authenticated' && <><p>Sign in, or refresh your account status, to continue.</p><button onClick={onAccount}>Open account</button></>}</>}
    {phase === 'missing' && <p role="alert">This link has no verification token. Open the complete link from your email, or request a new email.</p>}
    {phase === 'invalid' && <p role="alert">This verification link is invalid or has expired. If you already used it, check your account status. Otherwise request a new email.</p>}
    {phase === 'failure' && <><p role="alert">We could not confirm verification. Check your connection and try again. If the link was already used, check your account status.</p><button onClick={() => { if (phase !== 'failure') return; request.current = null; setPhase('verifying'); setRetry(value => value + 1) }}>Retry verification</button></>}
    {phase !== 'success' && phase !== 'verifying' && (sessionToken ? <VerificationNotice token={sessionToken} /> : <button onClick={onAccount}>Sign in to resend verification</button>)}
    <BotanicalDivider /><button className="checkout__secondary" onClick={() => navigateCheckout('/')}>Back to storefront</button>
  </div></main>
}
