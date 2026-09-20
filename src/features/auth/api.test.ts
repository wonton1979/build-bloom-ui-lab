import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STORAGE_KEY, clearStoredToken, getCurrentUser, signIn, signUp, storeToken } from './api'

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

  it('uses the project-scoped session storage key', () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() }
    vi.stubGlobal('window', { sessionStorage: storage })
    storeToken('jwt-token')
    clearStoredToken()
    expect(storage.setItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY, 'jwt-token')
    expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY)
  })
})
