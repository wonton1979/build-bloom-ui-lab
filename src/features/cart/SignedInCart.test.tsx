// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { AuthProvider, useAuth } from '../auth/AuthProvider'
import { AUTH_STORAGE_KEY, AuthApiError, getCurrentUser } from '../auth/api'
import { CartProvider } from './CartProvider'
import { useCart } from './CartContext'
import { addCartItem, deleteCartItem, getCart, updateCartItem } from './api'
import { cartListing, offer } from '../catalogue/catalogueFixtures'
import type { ProductListingOffer } from '../catalogue/api'

vi.mock('../auth/api', async original => ({ ...await original<typeof import('../auth/api')>(), getCurrentUser: vi.fn() }))
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), getCart: vi.fn(), addCartItem: vi.fn(), updateCartItem: vi.fn(), deleteCartItem: vi.fn() }))
vi.mock('../catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
vi.mock('../../components/catalogue/CategoryCatalogue', () => ({ CategoryCatalogue: ({ onAddToCart }: { onAddToCart: (listing: ProductListingOffer, title: string) => void }) => <button onClick={() => onAddToCart(offer(42), 'Test set')}>Add test set</button> }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let container: HTMLDivElement
let cart: ReturnType<typeof useCart>
let auth: ReturnType<typeof useAuth>
const listing = cartListing(offer(42))
const populated = { items: [{ productListingId: 42, quantity: 1, productListing: listing }] }
function Capture() {
  const value = useCart(); const session = useAuth()
  useEffect(() => { cart = value; auth = session }, [value, session])
  return null
}
async function mount() {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<AuthProvider><CartProvider><Capture /><App /></CartProvider></AuthProvider>))
}
async function click(selector: string) { await act(async () => container.querySelector<HTMLButtonElement>(selector)!.click()) }
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); history.replaceState({}, '', '/?spread=front-matter')
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
  vi.mocked(getCart).mockResolvedValue(populated)
  vi.mocked(addCartItem).mockResolvedValue({ items: [{ ...populated.items[0], quantity: 2 }] })
  vi.mocked(updateCartItem).mockResolvedValue(populated)
  vi.mocked(deleteCartItem).mockResolvedValue({ items: [] })
})
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals() })
describe('signed-in cart regardless of email verification', () => {
  it.each(['verified', 'unverified'])('%s customer hydrates, adds, opens and mutates their cart', async verification => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'customer-jwt')
    if (verification === 'verified') vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, email: 'customer@example.com', firstName: null, lastName: null, phone: null })
    else vi.mocked(getCurrentUser).mockRejectedValue(new AuthApiError(403, 'Verify', undefined, 'EMAIL_VERIFICATION_REQUIRED'))
    await mount()
    expect(auth.state.status).toBe(verification === 'verified' ? 'authenticated' : 'verificationRequired')
    expect(getCart).toHaveBeenCalledExactlyOnceWith('customer-jwt'); expect(cart.items[0].quantity).toBe(1)
    await click('.catalogue-stage__open-underlay button')
    expect(addCartItem).toHaveBeenCalledExactlyOnceWith('customer-jwt', 42, 1)
    vi.mocked(getCart).mockResolvedValue({ items: [{ ...populated.items[0], quantity: 2 }] })
    await click('.stage-cart'); expect(container.querySelector('.cart-modal')).not.toBeNull()
    expect(container.textContent).toContain('Quantity: 2'); expect(container.textContent).not.toContain('Hi! Sign in to')
    await act(async () => { expect(await cart.updateQuantity(42, 1)).toBe(true) })
    expect(updateCartItem).toHaveBeenCalledExactlyOnceWith('customer-jwt', 42, 1)
    await act(async () => { expect(await cart.removeItem(42)).toBe(true) })
    expect(deleteCartItem).toHaveBeenCalledExactlyOnceWith('customer-jwt', 42)
    expect(cart.items).toEqual([])
    if (verification === 'unverified') {
      await act(async () => { history.pushState({}, '', '/checkout'); window.dispatchEvent(new PopStateEvent('popstate')) })
      expect(container.textContent).toContain('Verify your email before an order can be created')
      expect(container.textContent).toContain('Resend verification email')
    }
    await act(async () => auth.logout())
    expect(auth.state.status).toBe('signedOut'); expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(cart.items).toEqual([])
  })
  it('keeps guests out of persistent cart operations and shows the existing sign-in hint', async () => {
    await mount(); await click('.catalogue-stage__open-underlay button'); await click('.stage-cart')
    expect(container.querySelector('.cart-modal')).toBeNull(); expect(container.textContent).toContain('Hi! Sign in to')
    await act(async () => { await cart.addListing(offer(42)); expect(await cart.updateQuantity(42, 1)).toBe(false); expect(await cart.removeItem(42)).toBe(false) })
    for (const api of [getCart, addCartItem, updateCartItem, deleteCartItem]) expect(api).not.toHaveBeenCalled()
  })
})

describe('authoritative cart refresh and allocation mutations', () => {
  async function signIn() {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'customer-jwt')
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, email: 'customer@example.com', firstName: null, lastName: null, phone: null })
    await mount()
  }
  it('preserves total PATCH targets, retains allocation metadata, and delegates removal to backend', async () => {
    const allocated = { items: [{ ...populated.items[0], quantity: 2, allocatedQuantity: 1, unallocatedQuantity: 1 }] }
    vi.mocked(getCart).mockResolvedValue(allocated)
    vi.mocked(updateCartItem).mockResolvedValue({ items: [{ ...allocated.items[0], quantity: 3, unallocatedQuantity: 2 }] })
    await signIn()
    expect(cart.items[0]).toMatchObject({ quantity: 2, allocatedQuantity: 1, unallocatedQuantity: 1 })
    await act(async () => { expect(await cart.updateQuantity(42, 3)).toBe(true) })
    expect(updateCartItem).toHaveBeenCalledExactlyOnceWith('customer-jwt', 42, 3)
    expect(cart.items[0].quantity).toBe(3)
    await act(async () => { await cart.removeItem(42) })
    expect(deleteCartItem).toHaveBeenCalledExactlyOnceWith('customer-jwt', 42)
    expect(cart.items).toEqual([])
  })
  it('GET refresh can retain pending cleanup, then cart reopening obtains cleaned authoritative state', async () => {
    await signIn()
    await act(async () => { await cart.refreshCart() })
    expect(cart.items).toHaveLength(1)
    expect(addCartItem).not.toHaveBeenCalled(); expect(updateCartItem).not.toHaveBeenCalled(); expect(deleteCartItem).not.toHaveBeenCalled()
    vi.mocked(getCart).mockResolvedValue({ items: [] })
    await click('.stage-cart')
    expect(cart.items).toEqual([])
    expect(getCart).toHaveBeenCalledTimes(3)
  })
  it('coalesces concurrent refresh calls and leaves cached items intact on failure', async () => {
    await signIn()
    let finish!: (value: typeof populated) => void
    vi.mocked(getCart).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await act(async () => { void cart.refreshCart(); void cart.refreshCart() })
    expect(getCart).toHaveBeenCalledTimes(2)
    await act(async () => finish(populated))
    vi.mocked(getCart).mockRejectedValueOnce(new Error('Offline'))
    await act(async () => { await cart.refreshCart() })
    expect(cart.items).toHaveLength(1); expect(cart.error).toBe('Offline')
    await act(async () => { await cart.refreshCart() })
    expect(cart.error).toBeNull()
  })
  it('does not let refresh overwrite a subsequent queued cart mutation', async () => {
    await signIn()
    let finish!: (value: typeof populated) => void
    vi.mocked(getCart).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await act(async () => { void cart.refreshCart(); void cart.addListing(offer(42)) })
    expect(addCartItem).not.toHaveBeenCalled()
    await act(async () => finish(populated))
    expect(cart.items[0].quantity).toBe(2)
  })
  it('discards a refresh that finishes after sign out and never refreshes guests', async () => {
    await signIn()
    let finish!: (value: typeof populated) => void
    vi.mocked(getCart).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await act(async () => { void cart.refreshCart() })
    await act(async () => auth.logout())
    await act(async () => finish(populated))
    expect(cart.items).toEqual([])
    await act(async () => { await cart.refreshCart() })
    expect(getCart).toHaveBeenCalledTimes(2)
  })
  it('fails closed on malformed allocation metadata without corrupting the cache', async () => {
    await signIn()
    vi.mocked(getCart).mockResolvedValue({ items: [{ ...populated.items[0], allocatedQuantity: 1, unallocatedQuantity: 10 }] })
    await act(async () => { await cart.refreshCart() })
    expect(cart.error).toContain('cart quantities')
    expect(cart.items[0].quantity).toBe(1)
  })
})

describe('new allocation-aware addition', () => {
  it('adds one new unit without sending or detaching existing allocated quantities', async () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'customer-jwt')
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, email: 'customer@example.com', firstName: null, lastName: null, phone: null })
    const lowStock = cartListing(offer(42, { availableStock: 1 }))
    vi.mocked(getCart).mockResolvedValue({ items: [{ productListingId: 42, productListing: lowStock, quantity: 2, allocatedQuantity: 2, unallocatedQuantity: 0 }] })
    vi.mocked(addCartItem).mockResolvedValue({ items: [{ productListingId: 42, productListing: lowStock, quantity: 3, allocatedQuantity: 2, unallocatedQuantity: 1 }] })
    await mount()
    await act(async () => { await cart.addListing(offer(42, { availableStock: 1 })) })
    expect(addCartItem).toHaveBeenCalledExactlyOnceWith('customer-jwt', 42, 1)
    expect(cart.items[0]).toMatchObject({ quantity: 3, allocatedQuantity: 2, unallocatedQuantity: 1 })
  })
})
