import { beginAuthenticationIntent, discardSession, logoutSession, sessionGeneration, SessionError, subscribeSession } from './session'
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type PropsWithChildren } from 'react'
import { AuthApiError, clearStoredToken, getCurrentUser, isVerificationRequired, readStoredToken, signIn, signUp, storeSession, updateCurrentUser, type CurrentUser, type UpdateCurrentUser } from './api'
import { authReducer, type AuthState } from './state'

type Credentials = { email: string; password: string }
type AuthContextValue = {
  state: AuthState
  authenticate: (mode: 'signin' | 'signup', credentials: Credentials) => Promise<void>
  updateProfile: (profile: UpdateCurrentUser) => Promise<CurrentUser>
  logout: () => void
  refreshAuth: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to complete that request'
}

export function AuthProvider({ children }: PropsWithChildren) {
  const initialToken = readStoredToken()
  const [state, dispatch] = useReducer(authReducer, initialToken ? { status: 'resolving' } : { status: 'signedOut' })
  const profileRequest = useRef(0)
  const resolving = useRef(0)
  const authIntent = useRef(0)
  const pendingIntent = useRef<number | null>(null)

  const resolve = useCallback(async (token: string, registered = false) => {
    const request = ++profileRequest.current
    const intent = authIntent.current
    const current = sessionGeneration()
    resolving.current += 1
    try {
      const user = await getCurrentUser(token)
      if (request !== profileRequest.current || sessionGeneration() !== current || !readStoredToken()) return false
      dispatch({ type: 'authenticated', token: readStoredToken()!, user })
      return true
    } catch (error) {
      if (request !== profileRequest.current || intent !== authIntent.current) return false
      // Renewal can invalidate this intent's own session and advance its
      // generation. Its pending-intent listener deliberately ignores events;
      // the owning profile operation must still settle the UI after cleanup.
      // Older operations cannot reach this branch after login/logout supersedes them.
      if (!readStoredToken()) {
        dispatch({ type: 'signedOut' })
        return false
      }
      if (sessionGeneration() !== current) return false
      if ((error instanceof AuthApiError && error.status === 401) || (error instanceof SessionError && error.invalid)) {
        clearStoredToken()
        dispatch({ type: 'signedOut' })
      } else if (isVerificationRequired(error)) {
        dispatch({ type: 'verificationRequired', token: readStoredToken()!, message: registered ? 'Your account was created. A verification email has been sent. Please verify your email before continuing.' : 'Please verify your email before continuing.' })
      } else {
        dispatch({ type: 'error', token: readStoredToken()!, message: `${registered ? 'Your account was created. A verification email has been sent. Verify your email, then sign in again. ' : ''}${errorMessage(error)}` })
      }
      return false
    } finally { resolving.current -= 1 }
  }, [])

  useEffect(() => subscribeSession(() => {
    if (pendingIntent.current !== null) return
    const token = readStoredToken()
    if (!token) { profileRequest.current += 1; dispatch({ type: 'signedOut' }) }
    else if (!resolving.current) void resolve(token)
  }), [resolve])

  useEffect(() => {
    const token = readStoredToken()
    if (token) void resolve(token)
    return () => { profileRequest.current += 1; authIntent.current += 1 }
  }, [resolve])

  const authenticate = useCallback(async (mode: 'signin' | 'signup', credentials: Credentials) => {
    const intent = ++authIntent.current
    pendingIntent.current = intent
    profileRequest.current += 1
    beginAuthenticationIntent()
    dispatch({ type: 'authenticate', mode })
    try {
      const response = mode === 'signup' ? await signUp(credentials.email, credentials.password) : await signIn(credentials.email, credentials.password)
      if (intent !== authIntent.current) { discardSession(response); return }
      storeSession(response)
      await resolve(response.token, mode === 'signup')
    } catch (error) {
      if (intent !== authIntent.current) return
      if (error instanceof AuthApiError && error.status === 401) {
        clearStoredToken()
        dispatch({ type: 'signedOut', error: error.message })
        return
      }
      dispatch({ type: 'error', message: errorMessage(error) })
    } finally { if (pendingIntent.current === intent) pendingIntent.current = null }
  }, [resolve])

  const refreshAuth = useCallback(async () => {
    if (pendingIntent.current !== null) return false
    const token = readStoredToken()
    if (!token) return false
    return resolve(token)
  }, [resolve])

  const logout = useCallback(() => {
    authIntent.current += 1
    pendingIntent.current = null
    profileRequest.current += 1
    logoutSession()
    dispatch({ type: 'signedOut' })
  }, [])

  const updateProfile = useCallback(async (profile: UpdateCurrentUser) => {
    if (state.status !== 'authenticated') throw new Error('You must be signed in to update your profile')
    const request = ++profileRequest.current
    const token = state.token
    const updated = await updateCurrentUser(token, profile)
    if (request !== profileRequest.current || readStoredToken() !== token) throw new Error('Authentication changed while saving your profile')
    dispatch({ type: 'authenticated', token: readStoredToken()!, user: updated })
    return updated
  }, [state])

  const value = useMemo(() => ({ state, authenticate, updateProfile, logout, refreshAuth }), [state, authenticate, updateProfile, logout, refreshAuth])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (value) return value
  // Keeps the presentational form renderable in isolated/static component tests.
  return { state: { status: 'signedOut' } as AuthState, authenticate: async () => undefined, updateProfile: async () => { throw new Error('Authentication unavailable') }, logout: () => undefined, refreshAuth: async () => false }
}

export type { CurrentUser }
