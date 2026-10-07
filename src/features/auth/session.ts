// Tab-scoped credentials. Renewal is shared by authenticated reads, never by
// automatic replay of business mutations or by cross-tab synchronisation.
export const AUTH_STORAGE_KEY = 'colorful-life:storefront:jwt'
export const SESSION_STORAGE_KEY = 'colorful-life:storefront:session'
export const apiBase = () => (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export type Session = { token: string; refreshToken?: string; accessTokenExpiresAt?: string; refreshExpiresAt?: string }
export class SessionError extends Error {
  readonly invalid: boolean
  constructor(invalid = false) { super(invalid ? 'Your session has expired. Please sign in again.' : 'Unable to restore your session. Please try again.'); this.invalid = invalid }
}
let generation = 0
const listeners = new Set<() => void>()
const previousTokens = new Set<string>()
const retiredTokens = new Set<string>()
function retireSession() {
  const token = readStoredToken()
  if (token) retiredTokens.add(token)
  previousTokens.forEach(value => retiredTokens.add(value))
}
let refreshing: Promise<string> | null = null
export const sessionGeneration = () => generation
export function subscribeSession(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
const notify = () => listeners.forEach(listener => listener())

export function readSession(): Session | null {
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) {
      const value: unknown = JSON.parse(stored)
      return parseSession(value, true)
    }
    const token = window.sessionStorage.getItem(AUTH_STORAGE_KEY)
    return token ? { token } : null
  } catch { return null }
}
export const readStoredToken = () => readSession()?.token ?? null
export function parseSession(value: unknown, renewable: boolean): Session {
  if (!value || typeof value !== 'object') throw new SessionError()
  const data = value as Record<string, unknown>
  if (typeof data.token !== 'string' || !data.token.trim()) throw new SessionError()
  if (!renewable) return { token: data.token }
  if (typeof data.refreshToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.refreshToken)
    || typeof data.accessTokenExpiresAt !== 'string' || !Number.isFinite(Date.parse(data.accessTokenExpiresAt))
    || typeof data.refreshExpiresAt !== 'string' || !Number.isFinite(Date.parse(data.refreshExpiresAt))) throw new SessionError()
  return { token: data.token, refreshToken: data.refreshToken, accessTokenExpiresAt: data.accessTokenExpiresAt, refreshExpiresAt: data.refreshExpiresAt }
}
export function clearStoredToken() {
  retireSession()
  generation += 1; refreshing = null; previousTokens.clear()
  for (const key of [SESSION_STORAGE_KEY, AUTH_STORAGE_KEY]) {
    try { window.sessionStorage.removeItem(key) } catch { /* UI cleanup must still complete. */ }
  }
  notify()
}
export function storeToken(token: string) {
  retireSession()
  generation += 1; refreshing = null; previousTokens.clear()
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, token)
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  retiredTokens.delete(token)
}
export function storeSession(session: Session) {
  if (!session.refreshToken) { storeToken(session.token); return }
  const parsed = parseSession(session, true)
  retireSession()
  // One atomic storage record holds both sides of a rotating credential pair.
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed))
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
  generation += 1; refreshing = null; previousTokens.clear()
  retiredTokens.delete(parsed.token)
}
async function revoke(refreshToken: string) {
  try {
    await fetch(`${apiBase()}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }), signal: AbortSignal.timeout(10000) })
  } catch { /* Explicit logout always clears local credentials. */ }
}
export function discardSession(session: Session) { if (session.refreshToken) void revoke(session.refreshToken) }
export function logoutSession() {
  const session = readSession()
  clearStoredToken()
  if (session?.refreshToken) void revoke(session.refreshToken)
}
async function renew(token: string): Promise<string> {
  const session = readSession()
  if (!session || (!previousTokens.has(token) && session.token !== token)) throw new SessionError(true)
  if (refreshing) return refreshing
  if (session.token !== token) return session.token
  if (!session.refreshToken) { clearStoredToken(); throw new SessionError(true) }
  const current = generation
  const operation = (async () => {
    let response: Response
    try {
      response = await fetch(`${apiBase()}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }), signal: AbortSignal.timeout(10000) })
    } catch { throw new SessionError() }
    if (response.status === 401) {
      if (generation === current) clearStoredToken()
      throw new SessionError(true)
    }
    if (!response.ok) throw new SessionError()
    let replacement: Session
    try { replacement = parseSession(await response.json(), true) } catch { throw new SessionError() }
    if (generation !== current || readSession()?.token !== session.token) {
      // A logout/account replacement won. Revoke the rotated credential too,
      // even if revoking its old value raced after backend rotation.
      await revoke(replacement.refreshToken!)
      throw new SessionError(true)
    }
    try { window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(replacement)); window.sessionStorage.removeItem(AUTH_STORAGE_KEY) }
    catch { await revoke(replacement.refreshToken!); throw new SessionError() }
    previousTokens.add(session.token)
    notify()
    return replacement.token
  })()
  refreshing = operation
  try { return await operation } finally { if (refreshing === operation) refreshing = null }
}
export async function authenticatedFetch(url: string, init: RequestInit, token: string): Promise<Response> {
  const session = readSession()
  const ownsSession = session?.token === token || previousTokens.has(token)
  if (!ownsSession && retiredTokens.has(token)) throw new SessionError(true)
  const current = generation
  const activeToken = ownsSession && session ? session.token : token
  const send = (credential: string) => {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${credential}`)
    const request = { ...init, signal: init.signal ?? AbortSignal.timeout(10000) }
    return fetch(url, new Headers(init.headers).get('Authorization') === 'Bearer ' + credential ? request : { ...request, headers })
  }
  const response = await send(activeToken)
  if (ownsSession && generation !== current) throw new SessionError(true)
  // Never automatically replay POST/PATCH/DELETE, particularly checkout/payment.
  if (response.status !== 401 || !ownsSession) return response
  const readOnly = ['GET', 'HEAD'].includes((init.method ?? 'GET').toUpperCase())
  let renewed: string
  try { renewed = await renew(activeToken) } catch (error) {
    // Preserve the definite authentication rejection of a write. A renewal
    // outage must not turn it into an ambiguous business-request outcome.
    if (!readOnly) return response
    throw error
  }
  if (generation !== current) throw new SessionError(true)
  if (!readOnly) return response
  const retried = await send(renewed)
  if (generation !== current) throw new SessionError(true)
  if (retried.status === 401) { clearStoredToken(); throw new SessionError(true) }
  return retried
}
