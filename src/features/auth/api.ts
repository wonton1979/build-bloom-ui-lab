export const AUTH_STORAGE_KEY = 'colorful-life:storefront:jwt'

export type CurrentUser = {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
}

export class AuthApiError extends Error {
  readonly status: number
  readonly serverMessage?: string
  readonly code?: string

  constructor(status: number, message: string, serverMessage?: string, code?: string) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.serverMessage = serverMessage
    this.code = code
  }
}

export const apiBase = () => (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export async function requestJson<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${apiBase()}${path}`, { ...init, headers })
  let body: unknown = null
  try { body = await response.json() } catch { /* Empty error responses are handled below. */ }
  if (!response.ok) {
    const error = typeof body === 'object' && body !== null && 'error' in body ? body.error : undefined
    const nested = typeof error === 'object' && error !== null ? error as { code?: unknown; message?: unknown } : undefined
    const code = typeof nested?.code === 'string' ? nested.code : undefined
    const serverMessage = typeof error === 'string' ? error : typeof nested?.message === 'string' ? nested.message : undefined
    const message = code === 'EMAIL_VERIFICATION_REQUIRED' ? 'Email verification required' : response.status === 401 ? 'Invalid credentials' : response.status === 409 && path === '/auth/signup' ? 'Email already in use' : serverMessage || 'Unable to complete that request'
    throw new AuthApiError(response.status, message, serverMessage, code)
  }
  return body as T
}

export function isVerificationRequired(error: unknown): boolean {
  return error instanceof AuthApiError && error.status === 403 && (error.code === 'EMAIL_VERIFICATION_REQUIRED' || (!error.code && error.serverMessage === 'Email verification required'))
}

export function verifyEmail(token: string) {
  return requestJson<void>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
}

export function resendVerification(token: string) {
  return requestJson<void>('/auth/resend-verification', { method: 'POST' }, token)
}

export function signUp(email: string, password: string) {
  return requestJson<{ token: string }>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function signIn(email: string, password: string) {
  return requestJson<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function getCurrentUser(token: string) {
  return requestJson<CurrentUser>('/users/me', { method: 'GET' }, token)
}

export type UpdateCurrentUser = Partial<Pick<CurrentUser, 'firstName' | 'lastName' | 'phone'>>

export function updateCurrentUser(token: string, profile: UpdateCurrentUser) {
  return requestJson<CurrentUser>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(profile),
  }, token)
}

export function readStoredToken(): string | null {
  try { return window.sessionStorage.getItem(AUTH_STORAGE_KEY) } catch { return null }
}

export function storeToken(token: string) {
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, token)
}

export function clearStoredToken() {
  try { window.sessionStorage.removeItem(AUTH_STORAGE_KEY) } catch { /* Storage may be unavailable in privacy mode. */ }
}
