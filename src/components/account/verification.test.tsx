// @vitest-environment jsdom
import { act, StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../../features/auth/AuthProvider'
import { AUTH_STORAGE_KEY, AuthApiError, getCurrentUser, resendVerification, signIn, signUp, verifyEmail } from '../../features/auth/api'
import { VerifyEmail } from './VerifyEmail'
import { VerificationNotice } from './VerificationNotice'
import { AccountForms } from './AccountForms'
import App from '../../App'
import { readAttempt, saveAttempt } from '../../features/checkout/state'
import { AccountModal } from '../homepage/AccountModal'

vi.mock('../../features/auth/api', async original => ({ ...await original<typeof import('../../features/auth/api')>(), getCurrentUser: vi.fn(), verifyEmail: vi.fn(), resendVerification: vi.fn(), signIn: vi.fn(), signUp: vi.fn() }))
vi.mock('../../features/catalogue/useCatalogueCategories', () => ({ useCatalogueCategories: () => ({ state: { status: 'loading' }, retry: vi.fn() }) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | null = null
let container: HTMLDivElement
let auth: ReturnType<typeof useAuth>
const user = { id: 1, email: 'test@example.com', firstName: 'Test', lastName: null, phone: null }
const savedAttempt = { key: 'original-checkout-key', input: { items: [{ productListingId: 16901, quantity: 2 }] }, rejection: 'EMAIL_VERIFICATION_REQUIRED' as const }
const verificationError = () => new AuthApiError(403, 'Verify', 'Different backend wording', 'EMAIL_VERIFICATION_REQUIRED')
function Capture() { const value = useAuth(); useEffect(() => { auth = value }, [value]); return <p data-auth>{value.state.status}</p> }
async function mount(element: ReactNode, strict = false) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  const content = <AuthProvider><Capture />{element}</AuthProvider>
  await act(async () => root!.render(strict ? <StrictMode>{content}</StrictMode> : content))
}
async function click(text: string) { await act(async () => { const button = [...container.querySelectorAll('button')].find(button => button.textContent?.includes(text)); if (!button) throw new Error(`Missing button ${text}`); button.click() }) }
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); history.replaceState({}, '', '/verify-email?token=test-verification-token')
  vi.mocked(getCurrentUser).mockResolvedValue(user); vi.mocked(verifyEmail).mockResolvedValue(); vi.mocked(resendVerification).mockResolvedValue()
})
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals() })

describe('verification route and token handling', () => {
  it('routes /verify-email, consumes a token once in StrictMode and removes it from the URL/storage', async () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt')
    await mount(<App />, true)
    expect(verifyEmail).toHaveBeenCalledExactlyOnceWith('test-verification-token')
    expect(location.search).toBe(''); expect(container.textContent).toContain('Your email has been verified')
    expect(container.textContent).not.toContain('test-verification-token')
    expect(JSON.stringify(sessionStorage)).not.toContain('test-verification-token')
    expect(auth.state.status).toBe('authenticated')
  })
  it.each([false, true])('opens sign-in after three seconds without depending on saved checkout (%s)', async saved => {
    vi.useFakeTimers()
    if (saved) saveAttempt(user.id, savedAttempt)
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const onSignIn = vi.fn()
    await mount(<VerifyEmail onSignIn={onSignIn} />, true)
    expect(container.querySelector('h1')?.textContent).toBe('Email verified')
    expect(container.textContent).toContain('You can now sign in to your Build & Bloom account')
    expect(container.textContent).toContain('Sign in now')
    for (const text of ['Continue shopping', 'Continue to checkout', 'saved request', 'Open account', 'refresh your account']) expect(container.textContent).not.toContain(text)
    expect(getItem.mock.calls.some(([key]) => key.startsWith('colorful-life:checkout-attempt:'))).toBe(false)
    getItem.mockRestore()
    expect(auth.state.status).toBe('signedOut')
    expect(getCurrentUser).not.toHaveBeenCalled(); expect(signIn).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(2999)); expect(onSignIn).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(1)); expect(onSignIn).toHaveBeenCalledOnce()
    expect(readAttempt(user.id)).toEqual(saved ? savedAttempt : null)
  })
  it('allows immediate sign-in without repeating the timed transition', async () => {
    vi.useFakeTimers(); const onSignIn = vi.fn()
    await mount(<VerifyEmail onSignIn={onSignIn} />)
    await click('Sign in now'); await click('Sign in now')
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(onSignIn).toHaveBeenCalledOnce()
  })
  it('opens the actual Sign In form even with an existing authenticated session', async () => {
    vi.useFakeTimers(); sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt')
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    await mount(<App />)
    expect(auth.state.status).toBe('authenticated')
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(location.pathname).toBe('/')
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(container.querySelector('input[type="password"]')).not.toBeNull()
    expect(auth.state.status).toBe('signedOut'); expect(signIn).not.toHaveBeenCalled()
  })
  it('cancels the automatic transition when the page unmounts', async () => {
    vi.useFakeTimers(); const onSignIn = vi.fn()
    await mount(<VerifyEmail onSignIn={onSignIn} />)
    await act(async () => root!.unmount()); root = null
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(onSignIn).not.toHaveBeenCalled()
  })
  it('renders a verifying state while the request is pending', async () => {
    vi.mocked(verifyEmail).mockImplementation(() => new Promise(() => {}))
    await mount(<VerifyEmail onSignIn={vi.fn()} />)
    expect(container.textContent).toContain('Verifying your email'); expect(verifyEmail).toHaveBeenCalledOnce(); expect(location.search).toBe('')
  })
  it.each(['/verify-email', '/verify-email?token=%20'])('does not submit a missing or whitespace token at %s', async path => {
    history.replaceState({}, '', path)
    await mount(<VerifyEmail onSignIn={vi.fn()} />)
    expect(container.textContent).toContain('no verification token'); expect(verifyEmail).not.toHaveBeenCalled()
  })
  it('handles invalid/expired/used links neutrally and transitions to sign-in after three seconds', async () => {
    vi.useFakeTimers(); const onSignIn = vi.fn()
    vi.mocked(verifyEmail).mockRejectedValue(new AuthApiError(400, 'private details test-verification-token'))
    await mount(<VerifyEmail onSignIn={onSignIn} />)
    expect(container.querySelector('h1')?.textContent).toBe('Verification link unavailable')
    expect(container.textContent).toContain('invalid, expired, or has already been used')
    expect(container.textContent).toContain('Sign in to check your account status or request a new verification email')
    expect(container.textContent).not.toContain('Sign in to resend verification')
    expect(container.textContent).not.toContain('private details'); expect(location.search).toBe('')
    expect(container.querySelector('button')?.textContent).toBe('Sign in')
    await act(async () => vi.advanceTimersByTimeAsync(2999)); expect(onSignIn).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(1)); expect(onSignIn).toHaveBeenCalledOnce()
  })
  it('offers a guarded retry for network failure without persisting the token', async () => {
    vi.mocked(verifyEmail).mockRejectedValueOnce(new Error('offline')).mockResolvedValue()
    await mount(<VerifyEmail onSignIn={vi.fn()} />); expect(container.textContent).toContain('could not confirm')
    await click('Retry verification'); expect(container.textContent).toContain('Your email has been verified'); expect(verifyEmail).toHaveBeenCalledTimes(2)
  })

})

describe('unverified account and resend UX', () => {
  it('recognizes verification by code on session restoration rather than English text', async () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt'); vi.mocked(getCurrentUser).mockRejectedValue(verificationError())
    await mount(<AccountForms />)
    expect(auth.state).toMatchObject({ status: 'verificationRequired', token: 'jwt' }); expect(container.textContent).toContain('Resend verification email'); expect(container.querySelector('form')).toBeNull()
  })
  it('communicates successful signup and the sent verification email', async () => {
    vi.mocked(signUp).mockResolvedValue({ token: 'signup-jwt' }); vi.mocked(getCurrentUser).mockRejectedValue(verificationError())
    await mount(<AccountForms />)
    await act(async () => auth.authenticate('signup', { email: 'test@example.com', password: 'Abcdef1!' }))
    expect(container.textContent).toContain('Your account was created'); expect(container.textContent).toContain('A verification email has been sent'); expect(auth.state.status).toBe('verificationRequired')
  })
  it('keeps signup success visible if the subsequent profile refresh fails', async () => {
    vi.mocked(signUp).mockResolvedValue({ token: 'signup-jwt' }); vi.mocked(getCurrentUser).mockRejectedValue(new Error('Connection interrupted'))
    await mount(<AccountForms />)
    await act(async () => auth.authenticate('signup', { email: user.email, password: 'Abcdef1!' }))
    expect(auth.state.status).toBe('error'); expect(container.textContent).toContain('Your account was created'); expect(container.textContent).toContain('A verification email has been sent')
  })
  it('allows login for an unverified account and later rechecks its actual profile', async () => {
    vi.mocked(signIn).mockResolvedValue({ token: 'jwt' }); vi.mocked(getCurrentUser).mockRejectedValueOnce(verificationError()).mockResolvedValue(user)
    await mount(<AccountForms />); await act(async () => auth.authenticate('signin', { email: user.email, password: 'Abcdef1!' }))
    expect(auth.state.status).toBe('verificationRequired'); await click('I’ve verified'); expect(auth.state.status).toBe('authenticated')
  })
  it('blocks duplicate resend clicks, reports sending/success and enforces a cooldown', async () => {
    vi.useFakeTimers(); let finish!: () => void
    vi.mocked(resendVerification).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await mount(<VerificationNotice token="jwt" />)
    await click('Resend verification'); await click('Sending verification')
    expect(resendVerification).toHaveBeenCalledExactlyOnceWith('jwt'); expect(container.textContent).toContain('Sending verification email')
    await act(async () => finish()); expect(container.textContent).toContain('Check your inbox and spam folder'); expect(container.textContent).toContain('Resend available shortly')
    await act(async () => vi.advanceTimersByTimeAsync(30000)); expect(container.textContent).toContain('Resend verification email')
  })
  it('reports resend failure without exposing internal errors', async () => {
    vi.mocked(resendVerification).mockRejectedValue(new Error('SES/internal error'))
    await mount(<VerificationNotice token="jwt" />); await click('Resend verification')
    expect(container.textContent).toContain('Unable to complete'); expect(container.textContent).not.toContain('SES/internal')
  })
  it('keeps the compact modal labelled and its sign-out action working', async () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt'); vi.mocked(getCurrentUser).mockRejectedValue(verificationError())
    await mount(<AccountModal onClose={vi.fn()} />)
    const dialog = container.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(container.querySelector('.account-modal__surface--verification')).not.toBeNull()
    const notice = container.querySelector('.verification-notice')!
    expect(document.getElementById(notice.getAttribute('aria-labelledby')!)?.textContent).toBe('Verify your email')
    expect(notice.querySelectorAll('.verification-notice__actions button')).toHaveLength(2)
    expect(notice.querySelector('.verification-notice__signout')?.textContent).toBe('Sign out')
    await click('Sign out'); expect(auth.state.status).toBe('signedOut'); expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })
  it('cannot declare verification complete while the backend still rejects the profile', async () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'jwt'); vi.mocked(getCurrentUser).mockRejectedValue(verificationError())
    await mount(<AccountForms />); await click('I’ve verified')
    expect(auth.state.status).toBe('verificationRequired'); expect(container.textContent).toContain('not ready yet')
  })
})
