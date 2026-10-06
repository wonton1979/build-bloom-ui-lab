// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { AUTH_STORAGE_KEY } from '../../features/auth/api'
import { CartContext, type CartContextValue } from '../../features/cart/CartContext'
import { cartListing, offer } from '../../features/catalogue/catalogueFixtures'
import { readAttempt } from '../../features/checkout/state'

vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
vi.mock('../checkout/StripePaymentForm', () => ({ StripePaymentForm: () => null }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const user = { id: 1, email: 'test@example.com', firstName: 'Test', lastName: null, phone: null }
const address = { id: 1, recipientName: 'Test', line1: '1 Street', line2: null, city: 'London', postcode: 'SW1A 1AA', country: 'GB', phone: null, isDefaultShipping: true, isDefaultBilling: true }
let root: Root | null = null
let container: HTMLDivElement
let verified: boolean
let ambiguous: boolean
let fetcher: ReturnType<typeof vi.fn>
let cart: CartContextValue
const response = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
const required = () => response({ error: { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Different server wording' } }, 403)
async function mount() {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root!.render(<AuthProvider><CartContext.Provider value={cart}><App /></CartContext.Provider></AuthProvider>))
}
async function click(text: string) {
  await act(async () => { const button = [...container.querySelectorAll('button')].find(button => button.textContent?.includes(text)); if (!button) throw new Error(`Missing ${text}`); button.click() })
}
const orderCalls = () => fetcher.mock.calls.filter(([url]) => url === '/api/orders')
beforeEach(() => {
  verified = true; ambiguous = false; sessionStorage.clear(); sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt'); history.replaceState({}, '', '/checkout')
  cart = { items: [{ productListingId: 16901, listing: cartListing(offer(16901)), quantity: 2 }], isLoading: false, error: null, pendingItemIds: [], addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() }
  fetcher = vi.fn((url: string) => {
    if (url === '/api/users/me') return verified ? response(user) : required()
    if (url === '/api/users/me/addresses') return response([address])
    if (url === '/api/orders') return ambiguous ? Promise.reject(new Error('offline')) : verified ? response({ id: 41 }, 201) : required()
    if (url === '/api/auth/verify-email') { verified = true; return response({ message: 'Email verified' }) }
    if (url === '/api/auth/resend-verification') return response({ message: 'Requested' })
    if (url === '/api/orders/41') return response({ id: 41, status: 'PENDING', totalAmount: '20.00', reservationExpiresAt: null, payment: null, orderItems: [], billingRecipientName: 'Test', billingLine1: '1 Street', billingCity: 'London', billingPostcode: 'SW1A 1AA', billingCountryCode: 'GB', deliveryRecipientName: 'Test', deliveryLine1: '1 Street', deliveryCity: 'London', deliveryPostcode: 'SW1A 1AA', deliveryCountryCode: 'GB' })
    throw new Error(`Unexpected endpoint ${url}`)
  })
  vi.stubGlobal('fetch', fetcher)
})
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; document.body.innerHTML = ''; vi.unstubAllGlobals() })

describe('email verification and preserved checkout integration', () => {
  it('distinguishes definite 403, resends, verifies, refreshes auth and explicitly continues the identical checkout', async () => {
    await mount(); verified = false
    await click('Create order')
    const saved = readAttempt(1)!
    expect(saved.rejection).toBe('EMAIL_VERIFICATION_REQUIRED')
    expect(container.textContent).toContain('No order was created by this request')
    expect(container.textContent).not.toContain('Retry saved order request')
    expect(container.textContent).not.toContain('response was lost')
    expect(container.textContent).not.toContain('abandons recovery')
    expect([...container.querySelectorAll('button')].find(button => button.textContent?.includes('Verify email before'))?.disabled).toBe(true)
    await click('Resend verification email')
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/resend-verification')).toHaveLength(1)
    expect(orderCalls()).toHaveLength(1)
    await act(async () => { history.pushState({}, '', '/verify-email?token=fake-verification-token'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(container.textContent).toContain('Your email has been verified')
    expect(location.search).toBe(''); expect(readAttempt(1)).toEqual(saved); expect(orderCalls()).toHaveLength(1)
    await click('Continue to checkout')
    expect(location.pathname).toBe('/checkout'); expect(container.textContent).toContain('Continue saved checkout')
    expect(container.textContent).not.toContain('response was lost')
    await click('Continue saved checkout')
    expect(orderCalls()).toHaveLength(2)
    const first = orderCalls()[0][1] as RequestInit
    const second = orderCalls()[1][1] as RequestInit
    expect((first.headers as Record<string, string>)['Idempotency-Key']).toBe(saved.key)
    expect((second.headers as Record<string, string>)['Idempotency-Key']).toBe(saved.key)
    expect(second.body).toBe(first.body)
    expect(location.pathname).toBe('/checkout/orders/41'); expect(container.textContent).toContain('Order summary')
    expect(readAttempt(1)).toBeNull(); expect(cart.removeItem).not.toHaveBeenCalled()
  })
  it('keeps the saved attempt and verification UX after reload with an unverified session', async () => {
    await mount(); verified = false; await click('Create order'); const saved = readAttempt(1)
    await act(async () => root!.unmount()); root = null; await mount()
    expect(container.textContent).toContain('Verify your email'); expect(container.textContent).toContain('Resend verification email')
    expect(container.textContent).not.toContain('Retry saved order request'); expect(container.textContent).not.toContain('response was lost')
    expect(readAttempt(1)).toEqual(saved); expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBe('jwt'); expect(orderCalls()).toHaveLength(1)
  })
  it('preserves the genuinely ambiguous response messaging and identity', async () => {
    await mount(); ambiguous = true; await click('Create order')
    expect(container.textContent).toContain('Retry saved order request'); expect(container.textContent).toContain('response was lost')
    const key = readAttempt(1)?.key
    await click('Retry saved order request')
    expect(orderCalls()).toHaveLength(2); expect(readAttempt(1)?.key).toBe(key)
    expect(readAttempt(1)?.rejection).toBeUndefined()
  })
})
