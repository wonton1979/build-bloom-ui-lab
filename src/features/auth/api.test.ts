import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STORAGE_KEY, clearStoredToken, getCurrentUser, isVerificationRequired, resendVerification, signIn, signUp, storeToken, updateCurrentUser, verifyEmail } from './api'

describe('storefront auth API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('signs up with only the backend fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'signup-token' }), { status: 201 }))
    vi.stubGlobal('fetch', fetcher)
    await signUp('person@example.com', 'Abcdef1!')
    expect(fetcher).toHaveBeenCalledWith('/api/auth/signup', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'person@example.com', password: 'Abcdef1!' }) }))
  })

  it('logs in with email and password', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'login-token' }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await signIn('person@example.com', 'Abcdef1!')
    expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({ body: JSON.stringify({ email: 'person@example.com', password: 'Abcdef1!' }) }))
  })

  it('loads the current user with a bearer token', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1, email: 'person@example.com', firstName: null, lastName: null, phone: null }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await getCurrentUser('jwt-token')
    expect((fetcher.mock.calls[0][1] as RequestInit).headers).toBeInstanceOf(Headers)
    expect(((fetcher.mock.calls[0][1] as RequestInit).headers as Headers).get('Authorization')).toBe('Bearer jwt-token')
  })

  it('maps backend errors without exposing credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 })))
    await expect(signIn('person@example.com', 'secret')).rejects.toMatchObject({ status: 401, message: 'Invalid credentials' })
  })

  it('patches only editable profile fields and sends the bearer token', async () => {
    const response = { id: 1, email: 'person@example.com', firstName: 'Ada', lastName: 'Lovelace', phone: '' }
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await updateCurrentUser('jwt-token', { firstName: 'Ada', lastName: 'Lovelace', phone: '' })
    expect(fetcher).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ firstName: 'Ada', lastName: 'Lovelace', phone: '' }),
    }))
    expect((fetcher.mock.calls[0][1].headers as Headers).get('Authorization')).toBe('Bearer jwt-token')
  })

  it('uses the project-scoped session storage key', () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() }
    vi.stubGlobal('window', { sessionStorage: storage })
    storeToken('jwt-token')
    clearStoredToken()
    expect(storage.setItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY, 'jwt-token')
    expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY)
  })
})


describe('email verification HTTP contracts', () => {
  it('submits only the verification token and uses Bearer auth for resend without a body', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}')))
    vi.stubGlobal('fetch', fetcher)
    await verifyEmail('verification-token')
    expect(fetcher).toHaveBeenCalledWith('/api/auth/verify-email', expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'verification-token' }) }))
    await resendVerification('jwt')
    expect(fetcher.mock.calls[1][0]).toBe('/api/auth/resend-verification')
    expect(fetcher.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer jwt')
    expect(fetcher.mock.calls[1][1].body).toBeUndefined()
  })
  it('parses nested codes/messages and recognizes verification with different wording', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Please confirm this address' } }), { status: 403 })))
    const error = await getCurrentUser('jwt').catch(error => error)
    expect(error).toMatchObject({ status: 403, code: 'EMAIL_VERIFICATION_REQUIRED', serverMessage: 'Please confirm this address' })
    expect(isVerificationRequired(error)).toBe(true)
  })
  it('does not misclassify unrelated 403 errors as verification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Access denied' } }), { status: 403 })))
    const error = await getCurrentUser('jwt').catch(error => error)
    expect(error.message).toBe('Access denied'); expect(isVerificationRequired(error)).toBe(false)
  })
  it('retains compatibility with legacy string verification errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Email verification required' }), { status: 403 })))
    expect(isVerificationRequired(await getCurrentUser('jwt').catch(error => error))).toBe(true)
  })
})
