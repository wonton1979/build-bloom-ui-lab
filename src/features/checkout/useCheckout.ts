import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckoutApiError, createOrder, getOrder, preparePayment, type Order, type OrderInput } from './api'
import { clearAttempt, isConfirmed, isTerminal, navigateCheckout, readAttempt, saveAttempt, type CreationAttempt } from './state'

export type Phase = 'ready' | 'creating' | 'loading' | 'reserved' | 'preparing' | 'payment' | 'waiting' | 'pending' | 'confirmed' | 'failure' | 'terminal' | 'auth'
export const verificationDelays = [0, 1000, 2000, 3000, 5000, 8000, 10000]

export function useCheckout(token: string, userId: number, orderId: number | null) {
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
    setPhase(reason instanceof CheckoutApiError && [401, 403].includes(reason.status) ? 'auth' : reason instanceof CheckoutApiError && (reason.status === 404 || ['ORDER_EXPIRED', 'ORDER_NOT_PAYABLE', 'ORDER_IDEMPOTENCY_MISMATCH', 'INVALID_IDEMPOTENCY_KEY'].includes(reason.code ?? '')) ? 'terminal' : 'failure')
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
    if (busy.current || obtainedOrderId.current || orderId || order) return
    busy.current = true; setMessage(null); setPhase('creating')
    try {
      const current: CreationAttempt = attemptRef.current ?? { key: crypto.randomUUID(), input }
      // Persist before sending. A lost response must replay the same key AND payload.
      saveAttempt(userId, current); attemptRef.current = current; setAttempt(current)
      const result = await createOrder(token, current.input, current.key)
      if (!active.current) return
      obtainedOrderId.current = result.id
      window.history.replaceState({}, '', `/checkout/orders/${result.id}`)
      clearAttempt(userId)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (reason) { if (active.current) fail(reason) }
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
      if (reason instanceof CheckoutApiError && reason.code === 'PAYMENT_ALREADY_COMPLETED') {
        try { accept(await getOrder(token, order.id)); setMessage('Payment was already recorded. Recheck the order if confirmation is still pending.') } catch (readError) { fail(readError) }
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
  return { order, phase, message, secret, attempt, create, prepare, verify, restart, reloadOrder }
}
