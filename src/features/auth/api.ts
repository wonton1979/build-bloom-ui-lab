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

  constructor(status: number, message: string, serverMessage?: string) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.serverMessage = serverMessage
  }
}

const apiBase = () => (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

async function requestJson<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${apiBase()}${path}`, { ...init, headers })
  let body: unknown = null
  try { body = await response.json() } catch { /* Empty error responses are handled below. */ }
  if (!response.ok) {
    const serverMessage = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : undefined
    const message = response.status === 401 ? 'Invalid credentials' : response.status === 403 ? 'Email verification required' : response.status === 409 ? 'Email already in use' : serverMessage || 'Unable to complete that request'
    throw new AuthApiError(response.status, message, serverMessage)
  }
  return body as T
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

export function readStoredToken(): string | null {
  try { return window.sessionStorage.getItem(AUTH_STORAGE_KEY) } catch { return null }
}

export function storeToken(token: string) {
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, token)
}

export function clearStoredToken() {
  try { window.sessionStorage.removeItem(AUTH_STORAGE_KEY) } catch { /* Storage may be unavailable in privacy mode. */ }
}
