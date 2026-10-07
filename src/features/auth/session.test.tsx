import { getCart } from '../cart/api'
import { getOrder } from '../checkout/api'
// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthProvider'
import { getCurrentUser } from './api'
import { authenticatedFetch, clearStoredToken, readSession, SESSION_STORAGE_KEY, storeSession, storeToken, type Session } from './session'
import { CartContext, type CartContextValue } from '../cart/CartContext'
import App from '../../App'
vi.mock('../catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
// Synthetic credentials only; assertions never print their values.
const original: Session = { token: 'synthetic-access-before', refreshToken: 'a'.repeat(43), accessTokenExpiresAt: '2030-01-01T00:00:00Z', refreshExpiresAt: '2030-02-01T00:00:00Z' }
const replacement: Session = { ...original, token: 'synthetic-access-after', refreshToken: 'b'.repeat(43), accessTokenExpiresAt: '2030-01-02T00:00:00Z' }
const user = { id: 1, email: 'test@example.com', firstName: 'Test', lastName: null, phone: null }
const result = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const rejected = () => result({ error: { code: 'SESSION_INVALID', message: 'Invalid or expired token' } }, 401)
let root: Root | undefined
let container: HTMLDivElement
let auth: ReturnType<typeof useAuth>
let fetcher: ReturnType<typeof vi.fn>
function Capture() {
  const value = useAuth()
  useEffect(() => { auth = value }, [value])
  return <p data-auth-state>{value.state.status}</p>
}
async function mount(app = false) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  const cart: CartContextValue = { items: [], pendingItemIds: [], isLoading: false, error: null, refreshCart: async () => {}, addListing: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn() }
  await act(async () => root!.render(<AuthProvider><Capture />{app && <CartContext.Provider value={cart}><App /></CartContext.Provider>}</AuthProvider>))
}
async function click(text: string) {
  await act(async () => {
    const button = [...container.querySelectorAll('button')].find(button => button.textContent === text || button.getAttribute('aria-label') === text)
    if (!button) throw new Error('Expected action unavailable')
    button.click()
  })
}
beforeEach(() => {
  clearStoredToken(); sessionStorage.clear(); history.replaceState({}, '', '/')
  fetcher = vi.fn((url: string) => {
    if (url === '/api/users/me') return Promise.resolve(result(user))
    if (url === '/api/auth/logout') return Promise.resolve(new Response(null, { status: 204 }))
    throw new Error('Unexpected test endpoint')
  })
  vi.stubGlobal('fetch', fetcher)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
})
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = undefined; clearStoredToken(); document.body.innerHTML = ''; vi.unstubAllGlobals()
})

describe('real provider session restoration', () => {
  it('restores a valid stored renewable session without rotating it', async () => {
    storeSession(original); await mount()
    expect(auth.state.status).toBe('authenticated')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(Boolean(readSession()?.refreshToken)).toBe(true)
  })
  it('stores the complete login contract atomically and restores it on same-tab reload', async () => {
    fetcher.mockImplementation((url: string) => Promise.resolve(result(url === '/api/auth/login' ? original : user)))
    await mount()
    await act(async () => auth.authenticate('signin', { email: user.email, password: 'Synthetic-test-password' }))
    expect(auth.state.status).toBe('authenticated')
    expect(readSession()?.refreshToken === original.refreshToken).toBe(true)
    expect(Boolean(sessionStorage.getItem(SESSION_STORAGE_KEY))).toBe(true)
    expect(Object.keys(readSession() ?? {}).sort()).toEqual(['accessTokenExpiresAt', 'refreshExpiresAt', 'refreshToken', 'token'])
    await act(async () => root!.unmount()); root = undefined
    await mount(); expect(auth.state.status).toBe('authenticated')
  })
  it.each(['verified', 'unverified'])('renews rejected access and restores %s authority', async kind => {
    storeSession({ ...original, accessTokenExpiresAt: '2026-01-01T00:00:00Z' })
    fetcher.mockImplementation((url: string, init: RequestInit) => {
      if (url === '/api/auth/refresh') return Promise.resolve(result(replacement))
      const renewed = new Headers(init.headers).get('Authorization') === 'Bearer ' + replacement.token
      return Promise.resolve(!renewed ? rejected() : kind === 'verified' ? result(user) : result({ error: { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Verify' } }, 403))
    })
    const saved = JSON.stringify({ key: 'stable-test-identity', input: { items: [{ productListingId: 900, quantity: 1 }] } })
    sessionStorage.setItem('colorful-life:checkout-attempt:1', saved)
    await mount()
    expect(auth.state.status).toBe(kind === 'verified' ? 'authenticated' : 'verificationRequired')
    expect(readSession()?.token === replacement.token).toBe(true)
    expect(readSession()?.refreshToken === replacement.refreshToken).toBe(true)
    expect(readSession()?.refreshExpiresAt).toBe(original.refreshExpiresAt)
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1)
    expect(sessionStorage.getItem('colorful-life:checkout-attempt:1') === saved).toBe(true)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/users/me', '/api/auth/refresh', '/api/users/me'])
  })
  it.each(['invalid', 'expired', 'revoked'])('clears a definitively %s refresh session', async kind => {
    storeSession({ ...original, ...(kind === 'expired' ? { refreshExpiresAt: '2026-01-01T00:00:00Z' } : {}) }); fetcher.mockImplementation(() => Promise.resolve(rejected()))
    await mount(); expect(auth.state.status).toBe('signedOut'); expect(readSession() === null).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('fails safely on restoration 401 for a legacy access-only session', async () => {
    storeToken(original.token); fetcher.mockImplementation(() => Promise.resolve(rejected()))
    await mount(); expect(auth.state.status).toBe('signedOut'); expect(readSession() === null).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each(['network', 'server', 'malformed'])('retains potentially renewable credentials on %s refresh failure', async kind => {
    storeSession(original)
    fetcher.mockImplementation((url: string) => {
      if (url !== '/api/auth/refresh') return Promise.resolve(rejected())
      if (kind === 'network') return Promise.reject(new Error('Connection unavailable'))
      return Promise.resolve(kind === 'server' ? result({}, 503) : result({ token: 'invalid-response-marker' }))
    })
    await mount(); expect(auth.state.status).toBe('error')
    expect(readSession()?.refreshToken === original.refreshToken).toBe(true)
    expect(container.textContent).not.toContain('invalid-response-marker')
    fetcher.mockImplementation((url: string) => Promise.resolve(result(url === '/api/auth/refresh' ? replacement : user)))
    await act(async () => { await auth.refreshAuth() })
    expect(auth.state.status).toBe('authenticated')
  })
  it.each(['network', 'server', 'malformed'])('retains credentials on %s profile restoration failure', async kind => {
    storeSession(original)
    fetcher.mockImplementation(() => kind === 'network' ? Promise.reject(new Error('Offline')) : Promise.resolve(result(kind === 'malformed' ? {} : {}, kind === 'server' ? 503 : 200)))
    await mount(); expect(auth.state.status).toBe('error'); expect(readSession()?.token === original.token).toBe(true)
  })
  it('stops after one refresh and one rejected retry', async () => {
    storeSession(original)
    fetcher.mockImplementation((url: string) => Promise.resolve(url === '/api/auth/refresh' ? result(replacement) : rejected()))
    await mount(); expect(auth.state.status).toBe('signedOut')
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
})

describe('shared renewal and logout races', () => {
  it('concurrent and late old-token callers share one rotation', async () => {
    storeSession(original)
    let finish!: (response: Response) => void
    fetcher.mockImplementation((url: string, init: RequestInit) => url === '/api/auth/refresh' ? new Promise(resolve => { finish = resolve }) : Promise.resolve(new Headers(init.headers).get('Authorization') === 'Bearer ' + replacement.token ? result(user) : rejected()))
    const callers = [getCurrentUser(original.token), getCurrentUser(original.token), getCurrentUser(original.token)]
    await vi.waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1))
    finish(result(replacement))
    expect((await Promise.all(callers)).every(value => value.id === user.id)).toBe(true)
    await getCurrentUser(original.token)
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1)
  })
  it('settles every caller on shared refresh failure and permits a later explicit retry', async () => {
    storeSession(original)
    let finish!: (response: Response) => void
    fetcher.mockImplementation((url: string) => url === '/api/auth/refresh' ? new Promise(resolve => { finish = resolve }) : Promise.resolve(rejected()))
    const callers = Promise.allSettled([getCurrentUser(original.token), getCurrentUser(original.token)])
    await vi.waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1))
    finish(result({}, 503))
    expect((await callers).every(value => value.status === 'rejected')).toBe(true)
    expect(Boolean(readSession())).toBe(true)
  })
  it.each(['success', 'network', 'server'])('clears UI and credentials immediately when backend logout has %s', async kind => {
    storeSession(original); await mount()
    fetcher.mockImplementation(() => kind === 'network' ? Promise.reject(new Error('Offline')) : Promise.resolve(new Response(null, { status: kind === 'server' ? 503 : 204 })))
    await act(async () => auth.logout())
    expect(auth.state.status).toBe('signedOut'); expect(readSession() === null).toBe(true)
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/logout')).toHaveLength(1)
  })
  it('logout wins an in-flight refresh and revokes its rotated credential without resurrection', async () => {
    storeSession(original); await mount()
    let finish!: (response: Response) => void
    fetcher.mockImplementation((url: string) => {
      if (url === '/api/auth/refresh') return new Promise(resolve => { finish = resolve })
      return Promise.resolve(url === '/api/auth/logout' ? new Response(null, { status: 204 }) : rejected())
    })
    let restoring!: Promise<boolean>
    await act(async () => { restoring = auth.refreshAuth(); await Promise.resolve(); await Promise.resolve() })
    await act(async () => auth.logout())
    await act(async () => { finish(result(replacement)); await restoring })
    expect(auth.state.status).toBe('signedOut'); expect(readSession() === null).toBe(true)
    const revocations = fetcher.mock.calls.filter(([url]) => url === '/api/auth/logout')
    expect(revocations).toHaveLength(2)
    expect(JSON.parse(revocations[1][1].body).refreshToken === replacement.refreshToken).toBe(true)
  })
  it('never automatically replays a rejected business mutation', async () => {
    storeSession(original)
    fetcher.mockImplementation((url: string) => Promise.resolve(url === '/api/auth/refresh' ? result(replacement) : rejected()))
    const response = await authenticatedFetch('/api/isolated-write', { method: 'POST' }, original.token)
    expect(response.status).toBe(401)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/isolated-write', '/api/auth/refresh'])
  })
})

describe('real auth and native navigation', () => {
  const order = { id: 41, status: 'PENDING', totalAmount: '10.00', payment: null, reservationExpiresAt: null, orderItems: [], createdAt: '2026-01-01T00:00:00Z', billingRecipientName: 'Customer', billingLine1: '1 Street', billingCity: 'Bath', billingPostcode: 'BA1', billingCountryCode: 'GB', deliveryRecipientName: 'Customer', deliveryLine1: '1 Street', deliveryCity: 'Bath', deliveryPostcode: 'BA1', deliveryCountryCode: 'GB' }
  it.each(['/checkout', '/checkout/orders/41', '/account/orders/41'])('%s → Back to storefront preserves the real authenticated provider', async path => {
    storeSession(original); history.replaceState({}, '', path)
    fetcher.mockImplementation((url: string) => Promise.resolve(result(url === '/api/users/me' ? user : url === '/api/users/me/addresses' ? [] : order)))
    await mount(true); await click('Back to storefront')
    expect(location.pathname).toBe('/'); expect(auth.state.status).toBe('authenticated')
    expect(readSession()?.token === original.token).toBe(true)
    await click('Open your account'); expect(container.textContent).toContain('Signed in as')
    expect(fetcher.mock.calls.every(([, init]) => (init.method ?? 'GET') === 'GET')).toBe(true)
  })
  it.each(['verified', 'unverified'])('ignores a stale guest hint immediately on %s authentication transition', async kind => {
    await mount(true)
    await act(async () => container.querySelector('button.stage-user')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    expect(container.textContent).toContain('Hi! Sign in or')
    fetcher.mockImplementation((url: string) => Promise.resolve(url === '/api/auth/login' ? result(original) : kind === 'verified' ? result(user) : result({ error: { code: 'EMAIL_VERIFICATION_REQUIRED' } }, 403)))
    await act(async () => auth.authenticate('signin', { email: user.email, password: 'Synthetic-test-password' }))
    expect(container.textContent).not.toContain('Hi! Sign in or')
    expect(auth.state.status).toBe(kind === 'verified' ? 'authenticated' : 'verificationRequired')
  })
})

describe('additional session safety boundaries', () => {
  it('shares renewal across cart and checkout reads without touching frozen checkout intent', async () => {
    storeSession(original)
    const saved = JSON.stringify({ key: 'fixed-test-key', input: { items: [{ productListingId: 900, quantity: 1 }] } })
    sessionStorage.setItem('colorful-life:checkout-attempt:1', saved)
    fetcher.mockImplementation((url: string, init: RequestInit) => {
      if (url === '/api/auth/refresh') return Promise.resolve(result(replacement))
      return Promise.resolve(new Headers(init.headers).get('Authorization') === 'Bearer ' + replacement.token ? result(url === '/api/cart' ? { items: [] } : { id: 41 }) : rejected())
    })
    await Promise.all([getCart(original.token), getOrder(original.token, 41)])
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1)
    expect(fetcher.mock.calls.every(([url, init]) => url === '/api/auth/refresh' || (init.method ?? 'GET') === 'GET')).toBe(true)
    expect(sessionStorage.getItem('colorful-life:checkout-attempt:1') === saved).toBe(true)
  })
  it('settles all concurrent callers on a definitively invalid refresh', async () => {
    storeSession(original)
    let finish!: (response: Response) => void
    fetcher.mockImplementation((url: string) => url === '/api/auth/refresh' ? new Promise(resolve => { finish = resolve }) : Promise.resolve(rejected()))
    const callers = Promise.allSettled([getCurrentUser(original.token), getCurrentUser(original.token)])
    await vi.waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1))
    finish(rejected())
    expect((await callers).every(value => value.status === 'rejected')).toBe(true)
    expect(readSession() === null).toBe(true)
  })
  it('rejects a malformed login response without persisting or rendering its content', async () => {
    fetcher.mockImplementation(() => Promise.resolve(result({ token: 'malformed-marker', refreshToken: 'not-valid' })))
    await mount()
    await act(async () => auth.authenticate('signin', { email: user.email, password: 'Synthetic-test-password' }))
    expect(auth.state.status).toBe('error')
    expect(readSession() === null).toBe(true)
    expect(container.textContent).not.toContain('malformed-marker')
  })
  it('provides customer retry after a temporary profile outage without a fresh sign-in', async () => {
    storeSession(original)
    fetcher.mockImplementation(() => Promise.resolve(result({}, 503)))
    await mount(true); await click('Open your account')
    expect(container.textContent).toContain('Retry connection')
    fetcher.mockImplementation(() => Promise.resolve(result(user)))
    await click('Retry connection')
    expect(auth.state.status).toBe('authenticated')
    expect(readSession()?.token === original.token).toBe(true)
  })
  it('does not resurrect a session when logout wins a pending login', async () => {
    let finish!: (response: Response) => void
    fetcher.mockImplementation((url: string) => url === '/api/auth/login' ? new Promise(resolve => { finish = resolve }) : Promise.resolve(new Response(null, { status: 204 })))
    await mount()
    let signingIn!: Promise<void>
    await act(async () => { signingIn = auth.authenticate('signin', { email: user.email, password: 'Synthetic-test-password' }) })
    await act(async () => auth.logout())
    await act(async () => { finish(result(original)); await signingIn })
    expect(auth.state.status).toBe('signedOut'); expect(readSession() === null).toBe(true)
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/logout')).toHaveLength(1)
  })
})

describe('stale credentials and mutation response boundaries', () => {
  const customerB = { ...user, id: 2, firstName: 'Second' }
  const sessionB = { ...original, token: 'synthetic-second-access', refreshToken: 'c'.repeat(43) }
  it.each(['refresh-first', 'login-first', 'invalid-refresh', 'temporary-refresh', 'logout'] as const)('explicit login owns auth while older renewal completes: %s', async scenario => {
    storeSession(original); await mount()
    let finishRefresh!: (response: Response) => void
    let finishLogin!: (response: Response) => void
    fetcher.mockImplementation((url: string, init: RequestInit) => {
      if (url === '/api/auth/refresh') return new Promise(resolve => { finishRefresh = resolve })
      if (url === '/api/auth/login') return new Promise(resolve => { finishLogin = resolve })
      if (url === '/api/auth/logout') return Promise.resolve(new Response(null, { status: 204 }))
      return Promise.resolve(new Headers(init.headers).get('Authorization') === 'Bearer ' + sessionB.token ? result(customerB) : rejected())
    })
    const background = getCurrentUser(original.token).catch(() => undefined)
    await vi.waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1))
    let login!: Promise<void>
    await act(async () => { login = auth.authenticate('signin', { email: customerB.email, password: 'Synthetic-test-password' }) })
    if (scenario === 'logout') await act(async () => auth.logout())
    if (scenario === 'login-first') await act(async () => { finishLogin(result(sessionB)); await login })
    await act(async () => {
      finishRefresh(scenario === 'invalid-refresh' ? rejected() : scenario === 'temporary-refresh' ? result({}, 503) : result(replacement))
      await background
    })
    if (scenario !== 'login-first') {
      if (scenario !== 'logout') expect(auth.state.status).toBe('authenticating')
      await act(async () => { finishLogin(result(sessionB)); await login })
    }
    expect(auth.state.status).toBe(scenario === 'logout' ? 'signedOut' : 'authenticated')
    expect(auth.state.status === 'authenticated' && auth.state.user.id === customerB.id).toBe(scenario !== 'logout')
    expect(readSession()?.token === sessionB.token).toBe(scenario !== 'logout')
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1)
    const revokedB = fetcher.mock.calls.some(([url, init]) => url === '/api/auth/logout' && JSON.parse(String(init.body)).refreshToken === sessionB.refreshToken)
    expect(revokedB).toBe(scenario === 'logout')
    expect(fetcher.mock.calls.every(([url, init]) => ['GET', 'HEAD'].includes(init.method ?? 'GET') || ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'].includes(url))).toBe(true)
  })
  it.each(['older-first', 'newer-first'])('newest competing login wins: %s', async order => {
    await mount()
    const responses: Array<(response: Response) => void> = []
    fetcher.mockImplementation((url: string) => {
      if (url === '/api/auth/login') return new Promise(resolve => { responses.push(resolve) })
      if (url === '/api/auth/logout') return Promise.resolve(new Response(null, { status: 204 }))
      return Promise.resolve(result(customerB))
    })
    let older!: Promise<void>; let newer!: Promise<void>
    await act(async () => { older = auth.authenticate('signin', { email: user.email, password: 'Synthetic-test-password' }) })
    await act(async () => { newer = auth.authenticate('signin', { email: customerB.email, password: 'Synthetic-test-password' }) })
    for (const index of order === 'older-first' ? [0, 1] : [1, 0]) {
      await act(async () => { responses[index](result(index === 0 ? original : sessionB)); await (index === 0 ? older : newer) })
    }
    expect(auth.state.status === 'authenticated' && auth.state.user.id === customerB.id).toBe(true)
    expect(readSession()?.token === sessionB.token).toBe(true)
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(0)
    const revocations = fetcher.mock.calls.filter(([url]) => url === '/api/auth/logout')
    expect(revocations).toHaveLength(1)
    expect(JSON.parse(String(revocations[0][1].body)).refreshToken === original.refreshToken).toBe(true)
  })
  it('does not send retired credentials from a callback after logout', async () => {
    storeSession(original); clearStoredToken()
    const outcome = await getCurrentUser(original.token).then(() => false, () => true)
    expect(outcome).toBe(true); expect(fetcher).not.toHaveBeenCalled()
  })
  it('does not substitute another customer session into a stale caller', async () => {
    storeSession(original)
    storeSession({ ...replacement, token: 'different-customer-access' })
    const outcome = await getCurrentUser(original.token).then(() => false, () => true)
    expect(outcome).toBe(true); expect(fetcher).not.toHaveBeenCalled()
  })
  it('preserves a definite rejected mutation response if renewal is temporarily unavailable', async () => {
    storeSession(original)
    fetcher.mockImplementation((url: string) => Promise.resolve(url === '/api/auth/refresh' ? result({}, 503) : rejected()))
    const response = await authenticatedFetch('/api/isolated-write', { method: 'POST' }, original.token)
    expect(response.status).toBe(401)
    expect(readSession()?.token === original.token).toBe(true)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/isolated-write', '/api/auth/refresh'])
  })
})
