// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { AUTH_STORAGE_KEY, AuthApiError, getCurrentUser } from '../../features/auth/api'
import { type OrderDetail, type OrderSummary } from '../../features/orders/api'
import { canResumeCheckout, orderDetailId, orderStatusLabel, paymentStatusLabel } from '../../features/orders/presentation'
import { CustomerOrders } from './CustomerOrders'

vi.mock('../../features/auth/api', async original => ({ ...await original<typeof import('../../features/auth/api')>(), getCurrentUser: vi.fn() }))
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const item = { id: 1, quantity: 2, unitPrice: '10.25', lineTotal: '20.50', conditionSnapshot: 'NEW', productListing: { id: 900, legoProduct: { title: 'Flowers', setNumber: '123' } } }
const summary: OrderSummary = { id: 41, status: 'PENDING', totalAmount: '20.50', createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z', shippingCarrier: null, trackingNumber: null, dispatchedAt: null, completedAt: null, orderItems: [item] }
const detail: OrderDetail = { ...summary, payment: null, reservationExpiresAt: new Date(Date.now() + 1800000).toISOString(), billingRecipientName: 'Billing Customer', billingLine1: '2 Street', billingLine2: null, billingCity: 'London', billingCounty: null, billingPostcode: 'SW1A 1AA', billingCountryCode: 'GB', billingPhone: null, deliveryRecipientName: 'Delivery Customer', deliveryLine1: '1 Street', deliveryLine2: 'Flat 1', deliveryCity: 'London', deliveryCounty: 'London', deliveryPostcode: 'SW1A 1AA', deliveryCountryCode: 'GB', deliveryPhone: '0123456789' }
let root: Root
let container: HTMLDivElement
let fetcher: ReturnType<typeof vi.fn>
const response = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
async function mount(element: ReactNode = <App />) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<AuthProvider>{element}</AuthProvider>))
}
async function click(text: string) {
  await act(async () => { const button = [...container.querySelectorAll('button')].find(button => button.textContent === text || button.getAttribute('aria-label') === text); if (!button) throw new Error(`Missing ${text}`); button.click() })
}
async function navigate(path: string) { await act(async () => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }) }
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt'); history.replaceState({}, '', '/account/orders')
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, email: 'test@example.com', firstName: null, lastName: null, phone: null })
  fetcher = vi.fn((url: string) => {
    if (url === '/api/orders') return response([summary])
    if (url === '/api/orders/41') return response(detail)
    throw new Error(`Unexpected test request ${url}`)
  })
  vi.stubGlobal('fetch', fetcher)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
})
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals() })

describe('My Orders entry and list', () => {
  it('opens My Orders from the account card using native history', async () => {
    history.replaceState({}, '', '/'); await mount(); await click('Open your account'); await click('Open My Orders')
    expect(location.pathname).toBe('/account/orders'); expect(container.querySelector('.account-modal')).toBeNull()
    expect(container.textContent).toContain('My Orders'); expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('loads authoritative summaries in backend order without inventing payment state', async () => {
    fetcher.mockResolvedValue(response([ { ...summary, id: 42, status: 'CONFIRMED' }, summary ]))
    await mount()
    expect(container.textContent).toContain('Order status: Confirmed'); expect(container.textContent).toContain('£20.50'); expect(container.textContent).toContain('2 items · Flowers')
    expect([...container.querySelectorAll('h2')].map(h => h.textContent)).toEqual(['Order #42', 'Order #41'])
    expect(container.textContent).not.toContain('Payment status'); expect(container.textContent).not.toContain('pending payment')
  })
  it('shows loading and empty history', async () => {
    let finish!: (value: Response) => void
    fetcher.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await mount(); expect(container.textContent).toContain('Loading your orders')
    await act(async () => finish(new Response('[]')))
    expect(container.textContent).toContain('haven’t placed any orders')
  })
  it('offers safe retry after API/network failure without displaying internal errors', async () => {
    fetcher.mockRejectedValueOnce(new Error('private provider detail'))
    await mount(); expect(container.textContent).toContain('Unable to load your orders'); expect(container.textContent).not.toContain('private provider')
    await click('Retry'); expect(container.textContent).toContain('Order #41'); expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('opens selected order detail and rereads on refresh/re-entry', async () => {
    await mount(); await click('View order #41')
    expect(location.pathname).toBe('/account/orders/41'); expect(container.textContent).toContain('Delivery Customer')
    fetcher.mockImplementation((url: string) => response(url === '/api/orders' ? [summary] : { ...detail, status: 'CONFIRMED', payment: { status: 'SUCCEEDED', paidAt: '2026-10-02T12:00:00Z' } }))
    await click('Refresh order'); expect(fetcher.mock.calls.filter(([url]) => url === '/api/orders/41')).toHaveLength(2)
    expect(container.textContent).toContain('Payment status: Confirmed'); expect(container.textContent).not.toContain('Resume checkout')
    await navigate('/account/orders'); await navigate('/account/orders/41')
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/orders/41')).toHaveLength(3)
  })
})

describe('Order Detail and resume', () => {
  it('loads direct detail and displays actual items, totals, snapshots and expiry safely', async () => {
    history.replaceState({}, '', '/account/orders/41'); await mount()
    for (const text of ['Flowers', 'Quantity 2', '£10.25 each · £20.50', 'Delivery Customer', 'Billing Customer', 'Flat 1', '0123456789', 'Reservation expires']) expect(container.textContent).toContain(text)
    expect(fetcher.mock.calls[0][0]).toBe('/api/orders/41')
    expect(container.textContent).not.toContain('null'); expect(container.textContent).not.toContain('undefined')
    expect(container.textContent).not.toContain('clientSecret'); expect(container.textContent).not.toContain('providerReference')
  })
  it('resumes the existing checkout with GET only, preserving all checkout identity', async () => {
    history.replaceState({}, '', '/account/orders/41')
    const saved = JSON.stringify({ key: 'original-key', input: { items: [{ productListingId: 900, quantity: 2 }] } })
    sessionStorage.setItem('colorful-life:checkout-attempt:1', saved)
    const uuid = vi.spyOn(crypto, 'randomUUID')
    await mount(); await click('Resume checkout')
    expect(location.pathname).toBe('/checkout/orders/41'); expect(container.textContent).toContain('Order summary')
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/orders/41', '/api/orders/41'])
    expect(fetcher.mock.calls.every(([, init]) => (init as RequestInit).method === undefined || (init as RequestInit).method === 'GET')).toBe(true)
    expect(uuid).not.toHaveBeenCalled(); uuid.mockRestore()
    expect(sessionStorage.getItem('colorful-life:checkout-attempt:1')).toBe(saved)
  })
  it.each(['CONFIRMED', 'DISPATCHED', 'COMPLETED'])('shows paid %s correctly without Resume', async status => {
    history.replaceState({}, '', '/account/orders/41')
    fetcher.mockImplementation(() => response({ ...detail, status, payment: { status: 'SUCCEEDED', paidAt: '2026-10-02T12:00:00Z' } }))
    await mount(); expect(container.textContent).toContain(`Order status: ${orderStatusLabel(status)}`)
    expect(container.textContent).toContain('Payment status: Confirmed'); expect(container.textContent).toContain('Paid ')
    expect(container.textContent).not.toContain('Resume checkout')
  })
  it.each(['EXPIRED', 'CANCELLED', 'RETURNED'])('keeps %s terminal', async status => {
    history.replaceState({}, '', '/account/orders/41'); fetcher.mockImplementation(() => response({ ...detail, status }))
    await mount(); expect(container.textContent).toContain(orderStatusLabel(status)); expect(container.textContent).not.toContain('Resume checkout')
  })
  it('handles future states without claiming success or exposing raw state', async () => {
    history.replaceState({}, '', '/account/orders/41'); fetcher.mockImplementation(() => response({ ...detail, status: 'FUTURE_ORDER', payment: { status: 'FUTURE_PAYMENT', paidAt: null } }))
    await mount(); expect(container.textContent).toContain('Status unavailable'); expect(container.textContent).not.toContain('FUTURE_'); expect(container.textContent).not.toContain('Resume checkout')
  })
  it('discards a previous detail response after navigation', async () => {
    let finish!: (value: Response) => void
    history.replaceState({}, '', '/account/orders/41')
    fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await mount(); await navigate('/account/orders')
    await act(async () => finish(new Response(JSON.stringify(detail))))
    expect(container.textContent).not.toContain('Delivery Customer'); expect(container.textContent).toContain('My Orders')
  })
})

describe('verified-only auth and owner-safe failure handling', () => {
  it.each(['/account/orders', '/account/orders/41'])('signed-out %s uses existing sign-in without querying orders', async path => {
    sessionStorage.clear(); history.replaceState({}, '', path); await mount()
    expect(fetcher).not.toHaveBeenCalled(); expect(container.textContent).toContain('Please sign in')
    await click('Sign in'); expect(container.querySelector('[role="dialog"]')).not.toBeNull(); expect(container.querySelector('input[type="password"]')).not.toBeNull()
  })
  it.each(['/account/orders', '/account/orders/41'])('unverified %s uses existing verification UI without querying orders', async path => {
    vi.mocked(getCurrentUser).mockRejectedValue(new AuthApiError(403, 'Verify', undefined, 'EMAIL_VERIFICATION_REQUIRED'))
    history.replaceState({}, '', path); await mount()
    expect(fetcher).not.toHaveBeenCalled(); expect(container.textContent).toContain('Please verify your email to view your orders')
    expect(container.textContent).toContain('Resend verification email'); expect(container.textContent).toContain('Sign out')
  })
  it.each([403, 404])('returns the same safe ownership message for status %s', async status => {
    history.replaceState({}, '', '/account/orders/41'); fetcher.mockImplementation(() => response({ error: 'private existence details' }, status))
    await mount(); expect(container.textContent).toContain('We cannot display this order information for your account')
    expect(container.textContent).not.toContain('private existence'); expect(container.textContent).not.toContain('Delivery Customer')
  })
  it('handles session expiry through the existing Sign In flow', async () => {
    fetcher.mockImplementation(() => response({}, 401)); await mount(); await click('Sign in')
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull(); expect(container.querySelector('input[type="password"]')).not.toBeNull()
  })
  it('handles structured verification rejection even after authenticated profile restoration', async () => {
    fetcher.mockImplementation(() => response({ error: { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Changed wording' } }, 403))
    await mount(); expect(container.textContent).toContain('Please verify your email to view your orders')
    expect(container.textContent).not.toContain('Changed wording')
  })
  it('does not request invalid or unsafe order IDs', async () => {
    await mount(<CustomerOrders path="/account/orders/9007199254740992" onAccount={vi.fn()} onAuthenticate={vi.fn()} />)
    expect(fetcher).not.toHaveBeenCalled(); expect(container.textContent).toContain('Order unavailable')
  })
})

describe('conservative status/URL presentation', () => {
  it.each(['PENDING', 'PROCESSING', 'FAILED'])('permits checkout navigation for an unexpired pending order with %s payment', status => {
    expect(canResumeCheckout({ ...detail, payment: { status, paidAt: null } })).toBe(true)
  })
  it('rejects paid, cancelled, expired and unknown payment states', () => {
    for (const status of ['SUCCEEDED', 'CANCELED', 'FUTURE']) expect(canResumeCheckout({ ...detail, payment: { status, paidAt: null } })).toBe(false)
    expect(canResumeCheckout({ ...detail, reservationExpiresAt: '2000-01-01T00:00:00Z' })).toBe(false)
    expect(orderDetailId('/account/orders/-1')).toBeNull(); expect(orderDetailId('/account/orders/41')).toBe(41)
    expect(orderStatusLabel('__proto__')).toBe('Status unavailable'); expect(paymentStatusLabel('__proto__')).toBe('Status unavailable')
  })
})
