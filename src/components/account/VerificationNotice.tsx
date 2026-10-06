import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import { resendVerification } from '../../features/auth/api'
import './AccountExperience.css'

export function VerificationNotice({ token, message = 'Please verify your email before continuing.', onVerified }: { token: string; message?: string; onVerified?: () => void }) {
  const { refreshAuth, logout } = useAuth()
  const titleId = useId()
  const [pending, setPending] = useState<'send' | 'check' | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!cooldown) return
    const timer = window.setTimeout(() => setCooldown(false), 30000)
    return () => window.clearTimeout(timer)
  }, [cooldown])
  const perform = async (kind: 'send' | 'check') => {
    if (locked.current || (kind === 'send' && cooldown)) return
    locked.current = true; setPending(kind); setError(null); setFeedback(null)
    try {
      if (kind === 'send') {
        await resendVerification(token)
        if (mounted.current) { setCooldown(true); setFeedback('A verification email has been requested. Check your inbox and spam folder.') }
      } else {
        const verified = await refreshAuth()
        if (mounted.current) {
          if (verified) { setFeedback('Your email is verified. You can continue.'); onVerified?.() }
          else setError('Your account is not ready yet. Follow the verification email, then check again. If your session expired, sign in again.')
        }
      }
    } catch { if (mounted.current) setError('Unable to complete this request. Please try again.') }
    finally { locked.current = false; if (mounted.current) setPending(null) }
  }
  return <section className="account-experience__task" aria-labelledby={titleId} aria-busy={pending !== null}>
    <h2 id={titleId}>Verify your email</h2>
    <p>{message}</p><p>Open the link in your verification email, then return here to continue.</p>
    {feedback && <p role="status">{feedback}</p>}
    {error && <p className="account-form__message account-form__message--error" role="alert">{error}</p>}
    <button className="account-form__submit" disabled={pending !== null || cooldown} onClick={() => void perform('send')}>{pending === 'send' ? 'Sending verification email…' : cooldown ? 'Resend available shortly' : 'Resend verification email'}</button>
    <button className="my-account__button" disabled={pending !== null} onClick={() => void perform('check')}>{pending === 'check' ? 'Checking verification…' : 'I’ve verified my email'}</button>
    <button className="my-account__button" disabled={pending !== null} onClick={logout}>Sign out</button>
  </section>
}
