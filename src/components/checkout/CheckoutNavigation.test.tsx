// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { CartContext, type CartContextValue } from '../../features/cart/CartContext'
import { cartListing, offer } from '../../features/catalogue/catalogueFixtures'
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'authenticated', token: 'jwt', user: { id: 1, email: 'customer@example.com' } }, logout: vi.fn() }) }))
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
vi.mock('../../features/account/addressApi', () => ({ getAddresses: () => Promise.resolve([]) }))
vi.mock('./StripePaymentForm', () => ({ StripePaymentForm: () => null }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let container: HTMLDivElement
let cart: CartContextValue
beforeEach(() => {
  history.replaceState({}, '', '/'); sessionStorage.clear()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  cart = { items: [{ productListingId: 11, listing: cartListing(offer(11)), quantity: 2 }], isLoading: false, pendingItemIds: [], error: null, addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() }
})
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals() })
async function mount() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => root.render(<CartContext.Provider value={cart}><App /></CartContext.Provider>)) }
async function openCart() { await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Open your cart"]')!.click()) }
describe('native Cart → Checkout navigation', () => {
  it('navigates populated authenticated cart through its existing actions slot and restores storefront on back', async () => {
    await mount(); await openCart()
    const checkout = [...container.querySelectorAll('button')].find(button => button.textContent === 'Checkout')!
    expect(checkout.disabled).toBe(false)
    await act(async () => checkout.click())
    expect(location.pathname).toBe('/checkout'); expect(container.textContent).toContain('Estimated total'); expect(container.querySelector('.cart-modal')).toBeNull()
    await act(async () => { history.replaceState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(container.querySelector('[aria-label="Catalogue"]')).not.toBeNull()
  })
  it('does not offer checkout for an empty cart', async () => { cart.items = []; await mount(); await openCart(); expect([...container.querySelectorAll('button')].some(button => button.textContent === 'Checkout')).toBe(false) })
  it('waits for pending cart changes before checkout', async () => { cart.pendingItemIds = [11]; await mount(); await openCart(); expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Checkout')?.disabled).toBe(true) })
})
