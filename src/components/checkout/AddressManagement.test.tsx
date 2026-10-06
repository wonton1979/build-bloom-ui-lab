// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { CartContext, type CartContextValue } from '../../features/cart/CartContext'
import { cartListing, offer } from '../../features/catalogue/catalogueFixtures'
import { createAddress, getAddresses, type Address } from '../../features/account/addressApi'
import { createOrder, preparePayment, recoverPayment } from '../../features/checkout/api'
import { readAttempt } from '../../features/checkout/state'
vi.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'authenticated', token: 'jwt', user: { id: 1, email: 'jane@example.com', firstName: 'Jane', lastName: 'Smith', phone: null } }, logout: vi.fn() }) }))
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
vi.mock('../../features/account/addressApi', async original => ({ ...await original<typeof import('../../features/account/addressApi')>(), getAddresses: vi.fn(), createAddress: vi.fn() }))
vi.mock('../../features/checkout/api', async original => ({ ...await original<typeof import('../../features/checkout/api')>(), createOrder: vi.fn(), preparePayment: vi.fn(), recoverPayment: vi.fn() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const first: Address = { id: 1, recipientName: 'Jane Smith', line1: '1 Street', line2: null, city: 'London', postcode: 'SW1A 1AA', country: 'United Kingdom', phone: null, isDefaultShipping: true, isDefaultBilling: true }
const cart: CartContextValue = { items: [{ productListingId: 900, listing: cartListing(offer(900)), quantity: 1 }], isLoading: false, error: null, pendingItemIds: [], addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() }
let root: Root
let container: HTMLDivElement
let book: Address[]
async function mount() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => root.render(<CartContext.Provider value={cart}><App /></CartContext.Provider>)) }
async function click(text: string) { await act(async () => { const button = [...container.querySelectorAll('button')].find(button => button.textContent?.includes(text) || button.getAttribute('aria-label') === text); if (!button) throw new Error(`Missing ${text}`); button.click() }) }
async function fill(label: string, value: string) { await act(async () => { const input = [...container.querySelectorAll('label')].find(element => element.textContent === label)!.querySelector('input')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) }) }
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); history.replaceState({}, '', '/checkout'); book = []
  vi.mocked(getAddresses).mockImplementation(() => Promise.resolve(book))
  vi.mocked(createAddress).mockImplementation(async () => { book = [first]; return first })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
})
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals() })
describe('checkout return from existing address management', () => {
  it('creates the first address and fetches authoritative delivery/billing on modal close', async () => {
    await mount(); await click('Add delivery address')
    expect(container.querySelector('.saved-addresses')).not.toBeNull()
    await click('Add address'); await fill('Address line 1', '1 Street'); await fill('City', 'London'); await fill('Postcode', 'SW1A 1AA')
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(createAddress).toHaveBeenCalledWith('jwt', expect.objectContaining({ recipientName: 'Jane Smith', country: 'United Kingdom' }))
    await click('Close account dialog')
    expect(container.querySelector('.account-modal')).toBeNull(); expect(container.querySelector('select')?.value).toBe('1')
    expect(container.querySelectorAll('address')).toHaveLength(2)
    expect(container.textContent).toContain('United Kingdom'); expect(getAddresses).toHaveBeenCalledTimes(4)
    expect(createOrder).not.toHaveBeenCalled(); expect(preparePayment).not.toHaveBeenCalled(); expect(recoverPayment).not.toHaveBeenCalled()
  })
  it('preserves an ambiguous saved request/key through address management and refetch', async () => {
    book = [first]; vi.mocked(createOrder).mockRejectedValue(new Error('Response lost'))
    await mount(); await click('Create order')
    const saved = readAttempt(1)!
    const uuid = vi.spyOn(crypto, 'randomUUID')
    await click('Manage saved addresses'); book = [{ ...first, line1: 'Edited Street' }]
    await click('Close account dialog')
    expect(readAttempt(1)).toEqual(saved); expect(uuid).not.toHaveBeenCalled(); uuid.mockRestore()
    expect(container.textContent).toContain('Retry saved order request')
    expect(createOrder).toHaveBeenCalledTimes(1); expect(preparePayment).not.toHaveBeenCalled(); expect(recoverPayment).not.toHaveBeenCalled()
  })
})
