import { useEffect, useRef, useState } from 'react'
import { AuthApiError, verifyEmail } from '../../features/auth/api'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import '../checkout/Checkout.css'

export function VerifyEmail({ onSignIn }: { onSignIn: () => void }) {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token')?.trim() ?? '')
  const [phase, setPhase] = useState<'verifying' | 'success' | 'invalid' | 'failure' | 'missing'>(token ? 'verifying' : 'missing')
  const signIn = useRef(onSignIn)
  const transitioned = useRef(false)
  useEffect(() => { signIn.current = onSignIn }, [onSignIn])
  const continueToSignIn = () => {
    if (transitioned.current) return
    transitioned.current = true
    signIn.current()
  }
  useEffect(() => {
    if (phase !== 'success' && phase !== 'invalid') return
    const timer = window.setTimeout(() => {
      if (transitioned.current) return
      transitioned.current = true
      signIn.current()
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [phase])
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
    void request.current.then(() => {
      if (!cancelled) setPhase('success')
    }, reason => {
      if (!cancelled) setPhase(reason instanceof AuthApiError && reason.status === 400 ? 'invalid' : 'failure')
    })
    return () => { cancelled = true }
  }, [token, retry])
  return <main className="checkout" tabIndex={-1}><div className="checkout__paper">
    <p className="checkout__eyebrow">Build &amp; Bloom · Your account</p><h1>{phase === 'success' ? 'Email verified' : phase === 'invalid' ? 'Verification link unavailable' : 'Email verification'}</h1>
    {phase === 'verifying' && <p role="status">Verifying your email…</p>}
    {phase === 'success' && <>
      <p role="status">Your email has been verified successfully. You can now sign in to your Build &amp; Bloom account.</p>
      <button onClick={continueToSignIn}>Sign in now</button>
    </>}
    {phase === 'missing' && <p role="alert">This link has no verification token. Open the complete link from your email, or request a new email.</p>}
    {phase === 'invalid' && <><p role="alert">This verification link is invalid, expired, or has already been used.</p><p>Sign in to check your account status or request a new verification email.</p></>}
    {phase === 'failure' && <><p role="alert">We could not confirm verification. Check your connection and try again. If the link was already used, check your account status.</p><button onClick={() => { if (phase !== 'failure') return; request.current = null; setPhase('verifying'); setRetry(value => value + 1) }}>Retry verification</button></>}
    {phase !== 'success' && phase !== 'verifying' && <button onClick={continueToSignIn}>Sign in</button>}
    <BotanicalDivider />
  </div></main>
}
