// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Checkout } from './Checkout'
import { CheckoutApiError } from '../../features/checkout/api'
import { CartContext, type CartContextValue } from '../../features/cart/CartContext'
import { cartListing, offer } from '../../features/catalogue/catalogueFixtures'
const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', token: 'jwt', user: { id: 1 } }, addresses: vi.fn(), create: vi.fn(), read: vi.fn(), prepare: vi.fn(), recover: vi.fn(), payment: vi.fn() }))
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: mocks.auth }) }))
vi.mock('../../features/account/addressApi', () => ({ getAddresses: mocks.addresses }))
vi.mock('../../features/checkout/api', async original => ({ ...await original<typeof import('../../features/checkout/api')>(), createOrder: mocks.create, getOrder: mocks.read, preparePayment: mocks.prepare, recoverPayment: mocks.recover }))
vi.mock('./StripePaymentForm', () => ({ StripePaymentForm: (props: { onVerify: () => void }) => { mocks.payment(); return <button onClick={props.onVerify}>Fake payment completed</button> } }))
const addresses = [{ id: 1, recipientName: 'Delivery', line1: '1 Street', line2: null, city: 'London', postcode: 'SW1A 1AA', country: 'GB', phone: null, isDefaultShipping: true, isDefaultBilling: false }, { id: 2, recipientName: 'Billing', line1: '2 Street', line2: null, city: 'London', postcode: 'SW1A 1AA', country: 'GB', phone: null, isDefaultShipping: false, isDefaultBilling: true }]
const listing = cartListing(offer(16901, { effectivePrice: '18.75' }))
const order = { id: 41, status: 'PENDING', totalAmount: '20.50', reservationExpiresAt: new Date(Date.now() + 1800000).toISOString(), payment: null, billingRecipientName: 'Billing', billingLine1: '2 Street', billingLine2: null, billingCity: 'London', billingPostcode: 'SW1A 1AA', billingCountryCode: 'GB', deliveryRecipientName: 'Delivery', deliveryLine1: '1 Street', deliveryLine2: null, deliveryCity: 'London', deliveryPostcode: 'SW1A 1AA', deliveryCountryCode: 'GB', orderItems: [{ id: 1, quantity: 1, unitPrice: '20.50', lineTotal: '20.50', conditionSnapshot: 'NEW', productListing: { id: 16901, legoProduct: { title: 'Flowers', setNumber: '123' } } }] }
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let container: HTMLDivElement
let cart: CartContextValue
async function mount() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => root.render(<CartContext.Provider value={cart}><Checkout onAccount={vi.fn()} /></CartContext.Provider>)) }
async function click(text: string) { await act(async () => { const button = [...container.querySelectorAll('button')].find(button => button.textContent?.includes(text)); if (!button) throw new Error(`Button missing: ${text}`); button.click() }) }
beforeEach(() => { vi.resetAllMocks(); mocks.auth.status = 'authenticated'; sessionStorage.clear(); history.replaceState({}, '', '/checkout'); mocks.addresses.mockResolvedValue(addresses); mocks.read.mockResolvedValue(order); mocks.prepare.mockResolvedValue('secret'); cart = { items: [{ productListingId: 16901, listing, quantity: 1 }], isLoading: false, error: null, pendingItemIds: [], addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() } })
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.useRealTimers(); document.body.innerHTML = '' })
describe('Checkout purchase UI', () => {
  it('prevents checkout with an empty cart', async () => { cart.items = []; await mount(); expect(container.textContent).toContain('cart is empty'); expect([...container.querySelectorAll('button')].find(button => button.textContent?.includes('Create order'))?.disabled).toBe(true) })
  it('allows an authenticated populated cart and shows distinct default billing', async () => { await mount(); expect(container.textContent).toContain('Estimated total'); expect(container.textContent).toContain('£18.75'); expect(container.textContent).toContain('Billing'); expect(container.textContent).toContain('default billing address will be used'); expect(container.querySelector('select')?.value).toBe('1'); expect([...container.querySelectorAll('button')].find(button => button.textContent?.includes('Create order'))?.disabled).toBe(false) })
  it('uses existing authentication UX for signed-out entry', async () => { mocks.auth.status = 'signedOut'; await mount(); expect(container.textContent).toContain('Please sign in'); expect(container.textContent).not.toContain('Create order') })
  it('blocks invalid country without sending an order', async () => { mocks.addresses.mockResolvedValue([{ ...addresses[0], country: 'Unknown land', isDefaultBilling: true }]); await mount(); await click('Create order'); expect(container.textContent).toContain('valid United Kingdom'); expect([...container.querySelectorAll('button')].find(button => button.textContent?.includes('Create order'))?.disabled).toBe(true); expect(mocks.create).not.toHaveBeenCalled() })
  it('submits the selected saved delivery without changing default billing', async () => { mocks.create.mockResolvedValue({ id: 41 }); await mount(); await click('Create order'); expect(mocks.create).toHaveBeenCalledWith('jwt', { items: [{ productListingId: 16901, quantity: 1 }], deliveryAddress: { recipientName: 'Delivery', line1: '1 Street', city: 'London', postcode: 'SW1A 1AA', countryCode: 'GB' } }, expect.any(String)); expect(cart.removeItem).not.toHaveBeenCalled(); expect(cart.updateQuantity).not.toHaveBeenCalled() })
  it('recovery replaces estimates with server totals and only mounts payment after setup', async () => { history.replaceState({}, '', '/checkout/orders/41'); await mount(); expect(container.textContent).toContain('£20.50'); expect(container.textContent).not.toContain('£18.75'); expect(mocks.payment).not.toHaveBeenCalled(); await click('Continue to secure payment'); expect(mocks.prepare).toHaveBeenCalledWith('jwt', 41); expect(mocks.payment).toHaveBeenCalled(); expect(cart.removeItem).not.toHaveBeenCalled() })
  it('keeps backend pending after browser completion and preserves all cart changes', async () => { vi.useFakeTimers(); history.replaceState({}, '', '/checkout/orders/41'); await mount(); await click('Continue to secure payment'); await click('Fake payment completed'); expect(container.textContent).toContain('being verified'); expect(container.textContent).not.toContain('Thank you'); expect(cart.removeItem).not.toHaveBeenCalled(); await act(async () => vi.advanceTimersByTimeAsync(29000)); expect(container.textContent).toContain('still pending'); mocks.recover.mockResolvedValue({ ...order, status: 'CONFIRMED', payment: { status: 'SUCCEEDED', paidAt: '2026-10-06' } }); await click('Recheck order'); expect(mocks.recover).toHaveBeenCalledExactlyOnceWith('jwt', 41); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.prepare).toHaveBeenCalledTimes(1); expect(container.textContent).toContain('Thank you'); expect(container.textContent).toContain('Payment confirmed'); expect(container.textContent).toContain('cart has been preserved'); expect(cart.removeItem).not.toHaveBeenCalled(); expect(cart.updateQuantity).not.toHaveBeenCalled() })
  it('keeps recovery errors safely recheckable without offering payment setup', async () => {
    vi.useFakeTimers(); history.replaceState({}, '', '/checkout/orders/41')
    await mount(); await click('Continue to secure payment'); await click('Fake payment completed')
    await act(async () => vi.advanceTimersByTimeAsync(29000))
    mocks.recover.mockRejectedValue(new Error('Recovery temporarily unavailable'))
    await click('Recheck order')
    expect(container.textContent).toContain('Recovery temporarily unavailable')
    expect(container.textContent).toContain('still pending')
    expect(container.textContent).not.toContain('Retry payment setup'); expect(container.textContent).not.toContain('Thank you')
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.prepare).toHaveBeenCalledTimes(1)
  })
  it('shows normal confirmation when order becomes non-payable during payment setup', async () => {
    history.replaceState({}, '', '/checkout/orders/41'); await mount()
    mocks.read.mockResolvedValueOnce(order).mockResolvedValue({ ...order, status: 'CONFIRMED', payment: { status: 'SUCCEEDED', paidAt: '2026-10-06' } })
    mocks.prepare.mockRejectedValue(new CheckoutApiError(409, 'ORDER_NOT_PAYABLE'))
    await click('Continue to secure payment')
    expect(container.textContent).toContain('Thank you for your order')
    expect(container.textContent).not.toContain('no longer available'); expect(container.textContent).not.toContain('Continue to secure payment')
    expect(mocks.recover).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.payment).not.toHaveBeenCalled()
  })
  it('zero addresses offers Add delivery address instead of an empty select or Reload', async () => {
    mocks.addresses.mockResolvedValue([]); await mount()
    expect(container.querySelector('select')).toBeNull(); expect(container.textContent).toContain('You need a delivery address')
    expect(container.textContent).toContain('Add delivery address'); expect(container.textContent).not.toContain('Reload')
    await click('Create order'); expect(mocks.create).not.toHaveBeenCalled()
  })
  it.each(['unchanged', 'removed', 'invalid'])('refetch handles a deliberate delivery selection that is %s', async change => {
    const third = { ...addresses[0], id: 3, recipientName: 'Chosen', isDefaultShipping: false }
    mocks.addresses.mockResolvedValue([...addresses, third]); await mount()
    await act(async () => { const select = container.querySelector('select')!; select.value = '3'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    const refreshed = [{ ...addresses[0], isDefaultShipping: false }, { ...addresses[1], isDefaultShipping: true }, ...(change === 'removed' ? [] : [{ ...third, city: change === 'invalid' ? '' : third.city }])]
    mocks.addresses.mockResolvedValue(refreshed)
    await act(async () => root.render(<CartContext.Provider value={cart}><Checkout onAccount={vi.fn()} addressRevision={1} /></CartContext.Provider>))
    expect(container.querySelector('select')?.value).toBe(change === 'unchanged' ? '3' : '2')
    expect(container.textContent).toContain('Billing'); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.prepare).not.toHaveBeenCalled()
  })
  it('follows an updated default when no deliberate selection has been made', async () => {
    await mount(); expect(container.querySelector('select')?.value).toBe('1')
    mocks.addresses.mockResolvedValue([{ ...addresses[0], isDefaultShipping: false }, { ...addresses[1], isDefaultShipping: true }])
    await act(async () => root.render(<CartContext.Provider value={cart}><Checkout onAccount={vi.fn()} addressRevision={1} /></CartContext.Provider>))
    expect(container.querySelector('select')?.value).toBe('2'); expect(container.textContent).toContain('Billing')
  })
  it('keeps new order creation disabled without an authoritative billing default', async () => {
    mocks.addresses.mockResolvedValue([addresses[0]]); await mount()
    expect(container.textContent).toContain('You need a default billing address')
    await click('Create order'); expect(mocks.create).not.toHaveBeenCalled()
  })
  it('revisits paid dispatched orders without payment controls', async () => { history.replaceState({}, '', '/checkout/orders/41'); mocks.read.mockResolvedValue({ ...order, status: 'DISPATCHED', payment: { status: 'SUCCEEDED', paidAt: '2026-10-06' } }); await mount(); expect(container.textContent).toContain('Order dispatched'); expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled() })
})
