// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { CartContext, type CartContextValue } from '../../features/cart/CartContext'
import { cartListing, offer } from '../../features/catalogue/catalogueFixtures'
const mocks = vi.hoisted(() => ({ getOrder: vi.fn() }))
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'authenticated', token: 'jwt', user: { id: 1, email: 'customer@example.com' } }, logout: vi.fn() }) }))
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
vi.mock('../../features/account/addressApi', () => ({ getAddresses: () => Promise.resolve([]) }))
vi.mock('../../features/checkout/api', async original => ({ ...await original<typeof import('../../features/checkout/api')>(), getOrder: mocks.getOrder }))
vi.mock('./StripePaymentForm', () => ({ StripePaymentForm: () => null }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let container: HTMLDivElement
let cart: CartContextValue
beforeEach(() => {
  history.replaceState({}, '', '/'); sessionStorage.clear()
  mocks.getOrder.mockReset().mockResolvedValue({
    id: 41, status: 'PENDING', totalAmount: '10.00', payment: null, reservationExpiresAt: null, orderItems: [],
    deliveryRecipientName: 'Test', deliveryLine1: '1 Street', deliveryCity: 'London', deliveryPostcode: 'SW1A 1AA', deliveryCountryCode: 'GB',
    billingRecipientName: 'Test', billingLine1: '1 Street', billingCity: 'London', billingPostcode: 'SW1A 1AA', billingCountryCode: 'GB',
  })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const getBounds = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('book-shell__page--right') ? new DOMRect(0, 0, 520, 580) : getBounds.call(this)
  })
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  cart = { items: [{ productListingId: 11, listing: cartListing(offer(11)), quantity: 2 }], isLoading: false, pendingItemIds: [], error: null, refreshCart: vi.fn().mockResolvedValue(undefined), addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() }
})
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.restoreAllMocks() })
async function mount() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => root.render(<CartContext.Provider value={cart}><App /></CartContext.Provider>)) }
async function openCart() { await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Open your cart"]')!.click()) }
async function traverseHistory(direction: 'back' | 'forward') {
  await act(async () => {
    await new Promise<void>(resolve => {
      window.addEventListener('popstate', () => resolve(), { once: true })
      history[direction]()
    })
  })
}
describe('native Cart → Checkout navigation', () => {
  it('restores the measured Catalogue Book after Cart → Checkout → Back to storefront', async () => {
    await mount(); await openCart()
    const originalStage = container.querySelector<HTMLElement>('[aria-label="Catalogue"]')!
    expect(originalStage.style.getPropertyValue('--closed-page-width')).toBe('520px')
    const checkout = [...container.querySelectorAll('button')].find(button => button.textContent === 'Checkout')!
    expect(checkout.disabled).toBe(false)
    await act(async () => checkout.click())
    expect(location.pathname).toBe('/checkout'); expect(container.textContent).toContain('Estimated total'); expect(container.querySelector('.cart-modal')).toBeNull()
    const back = [...container.querySelectorAll('button')].find(button => button.textContent === 'Back to storefront')!
    await act(async () => back.click())
    expect(location.pathname).toBe('/')
    const restoredStage = container.querySelector<HTMLElement>('[aria-label="Catalogue"]')!
    expect(restoredStage).not.toBe(originalStage)
    expect(restoredStage.querySelector('.closed-catalogue__artwork')).not.toBeNull()
    // Desktop cover width comes from these measurements; DOM presence alone
    // misses a collapsed, invisible book after the stage has been remounted.
    expect(restoredStage.style.getPropertyValue('--closed-page-width')).toBe('520px')
    expect(restoredStage.style.getPropertyValue('--closed-page-height')).toBe('580px')
    await traverseHistory('back')
    expect(location.pathname).toBe('/checkout')
    expect(container.querySelector('.checkout')).not.toBeNull()
    await traverseHistory('forward')
    expect(location.pathname).toBe('/')
    expect(container.querySelector<HTMLElement>('.catalogue-stage')?.style.getPropertyValue('--closed-page-width')).toBe('520px')
  })
  it.each(['/checkout', '/checkout/orders/41'])('restores the book from a direct %s visit', async path => {
    history.replaceState({}, '', path)
    await mount()
    expect(location.pathname).toBe(path)
    expect(container.querySelector('.checkout')).not.toBeNull()
    expect(container.querySelector('.catalogue-stage')).toBeNull()
    if (path.includes('/orders/')) { expect(mocks.getOrder).toHaveBeenCalledWith('jwt', 41); expect(container.textContent).toContain('Order #41') }
    const back = [...container.querySelectorAll('button')].find(button => button.textContent === 'Back to storefront')!
    await act(async () => back.click())
    expect(location.pathname).toBe('/')
    expect(container.querySelector<HTMLElement>('.catalogue-stage')?.style.getPropertyValue('--closed-page-width')).toBe('520px')
    expect(container.querySelector('.closed-catalogue__artwork')).not.toBeNull()
  })
  it('does not offer checkout for an empty cart', async () => { cart.items = []; await mount(); await openCart(); expect([...container.querySelectorAll('button')].some(button => button.textContent === 'Checkout')).toBe(false) })
  it('waits for pending cart changes before checkout', async () => { cart.pendingItemIds = [11]; await mount(); await openCart(); expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Checkout')?.disabled).toBe(true) })
})
