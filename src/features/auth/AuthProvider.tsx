/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type PropsWithChildren } from 'react'
import { AuthApiError, clearStoredToken, getCurrentUser, readStoredToken, signIn, signUp, storeToken, updateCurrentUser, type CurrentUser, type UpdateCurrentUser } from './api'
import { authReducer, type AuthState } from './state'

type Credentials = { email: string; password: string }
type AuthContextValue = {
  state: AuthState
  authenticate: (mode: 'signin' | 'signup', credentials: Credentials) => Promise<void>
  updateProfile: (profile: UpdateCurrentUser) => Promise<CurrentUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to complete that request'
}

export function AuthProvider({ children }: PropsWithChildren) {
  const initialToken = readStoredToken()
  const [state, dispatch] = useReducer(authReducer, initialToken ? { status: 'resolving' } : { status: 'signedOut' })
  const profileRequest = useRef(0)

  const resolve = useCallback(async (token: string) => {
    try {
      const user = await getCurrentUser(token)
      dispatch({ type: 'authenticated', token, user })
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        clearStoredToken()
        dispatch({ type: 'signedOut' })
      } else if (error instanceof AuthApiError && error.status === 403 && error.serverMessage === 'Email verification required') {
        dispatch({ type: 'verificationRequired', token, message: error.message })
      } else {
        dispatch({ type: 'error', token, message: errorMessage(error) })
      }
    }
  }, [])

  useEffect(() => {
    const token = readStoredToken()
    if (token) void resolve(token)
  }, [resolve])

  const authenticate = useCallback(async (mode: 'signin' | 'signup', credentials: Credentials) => {
    profileRequest.current += 1
    dispatch({ type: 'authenticate', mode })
    try {
      const response = mode === 'signup' ? await signUp(credentials.email, credentials.password) : await signIn(credentials.email, credentials.password)
      storeToken(response.token)
      await resolve(response.token)
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        clearStoredToken()
        dispatch({ type: 'signedOut', error: error.message })
        return
      }
      dispatch({ type: 'error', message: errorMessage(error) })
    }
  }, [resolve])

  const logout = useCallback(() => {
    profileRequest.current += 1
    clearStoredToken()
    dispatch({ type: 'signedOut' })
  }, [])

  const updateProfile = useCallback(async (profile: UpdateCurrentUser) => {
    if (state.status !== 'authenticated') throw new Error('You must be signed in to update your profile')
    const request = ++profileRequest.current
    const token = state.token
    const updated = await updateCurrentUser(token, profile)
    if (request !== profileRequest.current || readStoredToken() !== token) throw new Error('Authentication changed while saving your profile')
    dispatch({ type: 'authenticated', token, user: updated })
    return updated
  }, [state])

  const value = useMemo(() => ({ state, authenticate, updateProfile, logout }), [state, authenticate, updateProfile, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (value) return value
  // Keeps the presentational form renderable in isolated/static component tests.
  return { state: { status: 'signedOut' } as AuthState, authenticate: async () => undefined, updateProfile: async () => { throw new Error('Authentication unavailable') }, logout: () => undefined }
}

export type { CurrentUser }
