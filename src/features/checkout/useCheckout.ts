import { useCart } from '../cart/CartContext'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckoutApiError, createOrder, getOrder, preparePayment, recoverPayment, type Order, type OrderInput } from './api'
import { clearAttempt, isConfirmed, isTerminal, navigateCheckout, readAttempt, saveAttempt, type CreationAttempt } from './state'
import { AuthApiError, getCurrentUser, isVerificationRequired } from '../auth/api'

export type Phase = 'ready' | 'creating' | 'loading' | 'reserved' | 'preparing' | 'payment' | 'waiting' | 'pending' | 'confirmed' | 'failure' | 'terminal' | 'auth' | 'verification' | 'cart-conflict'
export const verificationDelays = [0, 1000, 2000, 3000, 5000, 8000, 10000]

export function useCheckout(token: string, userId: number, orderId: number | null) {
  const { refreshCart } = useCart()
  const [order, setOrder] = useState<Order | null>(null)
  const [phase, setPhase] = useState<Phase>(orderId ? 'loading' : 'ready')
  const [message, setMessage] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(() => readAttempt(userId))
  const attemptRef = useRef(attempt)
  const obtainedOrderId = useRef(orderId)
  const active = useRef(true)
  const busy = useRef(false)
  const run = useRef(0)

  const accept = useCallback((next: Order) => {
    setOrder(next)
    if (isConfirmed(next)) { setPhase('confirmed'); setSecret(null); return true }
    if (isTerminal(next)) { setPhase('terminal'); setSecret(null); return true }
    if (next.payment?.status === 'SUCCEEDED') { setPhase('pending'); return true }
    setPhase('reserved'); return false
  }, [])

  const fail = useCallback((reason: unknown) => {
    setMessage(reason instanceof Error ? reason.message : 'Connection lost. Please try again.')
    setPhase(reason instanceof CheckoutApiError && reason.status === 403 && reason.code === 'EMAIL_VERIFICATION_REQUIRED' ? 'verification' : reason instanceof CheckoutApiError && [401, 403].includes(reason.status) ? 'auth' : reason instanceof CheckoutApiError && (reason.status === 404 || ['ORDER_EXPIRED', 'ORDER_NOT_PAYABLE', 'ORDER_IDEMPOTENCY_MISMATCH', 'INVALID_IDEMPOTENCY_KEY'].includes(reason.code ?? '')) ? 'terminal' : 'failure')
  }, [])

  useEffect(() => {
    active.current = true
    let cancelled = false
    if (orderId) {
      void getOrder(token, orderId).then(next => { if (!cancelled) accept(next) }).catch(reason => { if (!cancelled) fail(reason) })
    }
    return () => { cancelled = true; active.current = false; run.current += 1 }
  }, [accept, fail, orderId, token])

  // Stop offering payment when an unpaid reservation reaches its deadline.
  useEffect(() => {
    if (!order?.reservationExpiresAt || order.payment?.status === 'SUCCEEDED' || ['waiting', 'pending'].includes(phase)) return
    const timer = window.setTimeout(() => { setSecret(null); setPhase('terminal'); setMessage('Your inventory reservation has expired. Return to your cart to start again.') }, Math.max(0, Date.parse(order.reservationExpiresAt) - Date.now()))
    return () => window.clearTimeout(timer)
  }, [order, phase])

  const create = async (input: OrderInput) => {
    if (busy.current || obtainedOrderId.current || orderId || order || phase === 'verification') return
    if (!attemptRef.current && input.items.length === 0) return
    busy.current = true; setMessage(null); setPhase('creating')
    try {
      if (attemptRef.current?.rejection === 'EMAIL_VERIFICATION_REQUIRED') {
        // A deliberate continuation checks backend authority before another POST.
        try { await getCurrentUser(token); if (!active.current) return }
        catch (reason) {
          if (isVerificationRequired(reason)) throw new CheckoutApiError(403, 'EMAIL_VERIFICATION_REQUIRED')
          if (reason instanceof AuthApiError) throw new CheckoutApiError(reason.status, reason.code)
          throw reason
        }
      }
      const saved = attemptRef.current
      const current: CreationAttempt = saved ? { key: saved.key, input: saved.input } : { key: crypto.randomUUID(), input }
      // Persist before sending. A lost response must replay the same key AND payload.
      saveAttempt(userId, current); attemptRef.current = current; setAttempt(current)
      const result = await createOrder(token, current.input, current.key)
      if (!active.current) return
      obtainedOrderId.current = result.id
      window.history.replaceState({}, '', `/checkout/orders/${result.id}`)
      clearAttempt(userId)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (reason) {
      if (active.current) {
        if (reason instanceof CheckoutApiError && reason.status === 409 && reason.code === 'CART_QUANTITY_UNAVAILABLE') {
          // Definite rejection: retire this identity, never rewrite an ambiguous request.
          clearAttempt(userId); attemptRef.current = null; setAttempt(null)
          setMessage(reason.message); setPhase('cart-conflict')
          await refreshCart()
          return
        }
        if (reason instanceof CheckoutApiError && reason.status === 403 && reason.code === 'EMAIL_VERIFICATION_REQUIRED' && attemptRef.current) {
          const rejected: CreationAttempt = { ...attemptRef.current, rejection: 'EMAIL_VERIFICATION_REQUIRED' }
          attemptRef.current = rejected; setAttempt(rejected)
          // Keep the original identity and payload. This response is definite,
          // unlike a timeout: it must not be described as a lost order response.
          try { saveAttempt(userId, rejected) } catch { /* The original request was already persisted before sending. */ }
        }
        fail(reason)
      }
    }
    finally { busy.current = false }
  }

  const verify = useCallback(async () => {
    const id = orderId ?? order?.id
    if (!id || busy.current || !active.current) return
    busy.current = true; setPhase('waiting'); setSecret(null); setMessage(null)
    const currentRun = ++run.current
    try {
      for (const delay of verificationDelays) {
        if (delay) await new Promise(resolve => window.setTimeout(resolve, delay))
        if (!active.current || run.current !== currentRun) return
        const next = await getOrder(token, id)
        if (!active.current || run.current !== currentRun) return
        setOrder(next)
        if (isConfirmed(next) || isTerminal(next)) { accept(next); return }
      }
      setPhase('pending')
    } catch (reason) { if (active.current && run.current === currentRun) { fail(reason); if (!(reason instanceof CheckoutApiError) || ![401, 403, 404].includes(reason.status)) setPhase('pending') } }
    finally { busy.current = false }
  }, [accept, fail, order, orderId, token])

  // Provider recovery is an explicit customer action, never part of GET polling.
  const recheck = async () => {
    const id = orderId ?? order?.id
    if (!id || busy.current || !active.current || (order && (isConfirmed(order) || isTerminal(order)))) return
    busy.current = true; setPhase('waiting'); setSecret(null); setMessage(null)
    const currentRun = ++run.current
    try {
      const next = await recoverPayment(token, id)
      if (!active.current || run.current !== currentRun) return
      if (!accept(next)) setPhase('pending')
    } catch (reason) {
      if (active.current && run.current === currentRun) {
        fail(reason)
        if (!(reason instanceof CheckoutApiError) || ![401, 403, 404].includes(reason.status)) setPhase('pending')
      }
    } finally { busy.current = false }
  }

  const prepare = async () => {
    if (!order || busy.current || isTerminal(order) || isConfirmed(order)) return
    busy.current = true; setPhase('preparing'); setMessage(null)
    try {
      const next = await getOrder(token, order.id)
      if (!active.current) return
      if (accept(next)) return
      const clientSecret = await preparePayment(token, next.id)
      if (active.current) { setSecret(clientSecret); setPhase('payment') }
    } catch (reason) {
      if (!active.current) return
      if (reason instanceof CheckoutApiError && ['PAYMENT_ALREADY_COMPLETED', 'ORDER_NOT_PAYABLE'].includes(reason.code ?? '')) {
        try {
          const next = await getOrder(token, order.id)
          if (!active.current) return
          if (isConfirmed(next)) { setMessage(null); accept(next) }
          else if (reason.code === 'PAYMENT_ALREADY_COMPLETED') {
            accept(next); setMessage('Payment was already recorded. Recheck the order if confirmation is still pending.')
          } else { setOrder(next); fail(reason) }
        } catch (readError) { if (active.current) fail(readError) }
      } else fail(reason)
    } finally { busy.current = false }
  }
  const restart = () => { clearAttempt(userId); navigateCheckout('/') }
  const reloadOrder = async () => {
    if (!orderId || busy.current || !active.current) return
    busy.current = true; setPhase('loading'); setMessage(null)
    try {
      const next = await getOrder(token, orderId)
      if (active.current) accept(next)
    } catch (reason) { if (active.current) fail(reason) }
    finally { busy.current = false }
  }
  const checkedReturn = useRef(false)
  useEffect(() => {
    if (!order || checkedReturn.current || !new URLSearchParams(window.location.search).has('payment_intent')) return
    checkedReturn.current = true
    window.history.replaceState({}, '', `/checkout/orders/${order.id}`)
    if (!isConfirmed(order) && !isTerminal(order)) void Promise.resolve().then(() => { if (active.current) void verify() })
  }, [order, verify])
  const resumeAfterVerification = () => { setMessage(null); setPhase('ready') }
  return { order, phase, message, secret, attempt, create, prepare, verify, recheck, restart, reloadOrder, resumeAfterVerification }
}
