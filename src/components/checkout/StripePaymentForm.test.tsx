// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentForm } from './StripePaymentForm'
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), retrieve: vi.fn(), elements: {} }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(() => Promise.resolve(null)) }))
vi.mock('@stripe/react-stripe-js', () => {
  const stripe = { confirmPayment: mocks.confirm, retrievePaymentIntent: mocks.retrieve }
  return { useStripe: () => stripe, useElements: () => mocks.elements, PaymentElement: () => <div data-payment-element="true" />, Elements: ({ children }: { children: React.ReactNode }) => children }
})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let container: HTMLDivElement
async function mount() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); const verify = vi.fn(); await act(async () => root.render(<PaymentForm clientSecret="secret" orderId={41} onVerify={verify} />)); return verify }
async function submit() { await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
beforeEach(() => { mocks.confirm.mockReset(); mocks.retrieve.mockReset().mockResolvedValue({ paymentIntent: { status: 'requires_payment_method' } }) })
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = ''; vi.unstubAllEnvs() })
describe('Stripe payment submission', () => {
  it('blocks duplicate payment submission and uses order-specific return URL', async () => {
    let resolve!: (value: object) => void
    mocks.confirm.mockImplementation(() => new Promise(done => { resolve = done }))
    const verify = await mount(); await submit(); await submit()
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(mocks.confirm).toHaveBeenCalledWith({ elements: mocks.elements, confirmParams: { return_url: `${location.origin}/checkout/orders/41` }, redirect: 'if_required' })
    expect(verify).not.toHaveBeenCalled()
    await act(async () => resolve({ paymentIntent: { status: 'succeeded' } }))
    expect(verify).toHaveBeenCalledTimes(1); expect(container.textContent).not.toContain('Pay now')
  })
  it('allows declined payment retry without declaring order success', async () => {
    mocks.confirm.mockResolvedValue({ error: { type: 'card_error', message: 'Your card was declined.' } })
    const verify = await mount(); await submit()
    expect(container.textContent).toContain('declined'); expect(verify).not.toHaveBeenCalled(); expect(container.querySelector('button')?.disabled).toBe(false)
    mocks.confirm.mockResolvedValue({}); await submit(); expect(verify).toHaveBeenCalledTimes(1)
  })
  it('routes an ambiguous provider/network outcome to status checking', async () => {
    mocks.confirm.mockRejectedValue(new Error('offline')); const verify = await mount(); await submit()
    expect(container.textContent).toContain('Connection lost'); expect(container.textContent).not.toContain('Pay now')
    await act(async () => container.querySelector('button')!.click()); expect(verify).toHaveBeenCalledOnce()
  })
  it('does not offer payment again when a recovered intent is already processing', async () => {
    mocks.retrieve.mockResolvedValue({ paymentIntent: { status: 'processing' } })
    const verify = await mount(); expect(verify).toHaveBeenCalledOnce(); expect(mocks.confirm).not.toHaveBeenCalled()
  })
  it.each(['', 'pk_test_mock'])('handles unavailable Stripe configuration/SDK with key %s', async key => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', key)
    vi.resetModules()
    const { StripePaymentForm } = await import('./StripePaymentForm')
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root.render(<StripePaymentForm clientSecret="secret" orderId={41} onVerify={vi.fn()} />))
    expect(container.textContent).toContain(key ? 'Secure payment could not load' : 'Payments are not configured')
  })
})
