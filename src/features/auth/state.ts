import type { CurrentUser } from './api'

export type AuthState =
  | { status: 'resolving' }
  | { status: 'signedOut'; error?: string }
  | { status: 'authenticating'; mode: 'signin' | 'signup' }
  | { status: 'authenticated'; token: string; user: CurrentUser }
  | { status: 'verificationRequired'; token: string; message: string }
  | { status: 'error'; message: string; token?: string }

export type AuthAction =
  | { type: 'resolve' }
  | { type: 'authenticate'; mode: 'signin' | 'signup' }
  | { type: 'authenticated'; token: string; user: CurrentUser }
  | { type: 'verificationRequired'; token: string; message: string }
  | { type: 'signedOut'; error?: string }
  | { type: 'error'; message: string; token?: string }

export function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'resolve': return { status: 'resolving' }
    case 'authenticate': return { status: 'authenticating', mode: action.mode }
    case 'authenticated': return { status: 'authenticated', token: action.token, user: action.user }
    case 'verificationRequired': return { status: 'verificationRequired', token: action.token, message: action.message }
    case 'signedOut': return { status: 'signedOut', error: action.error }
    case 'error': return { status: 'error', message: action.message, token: action.token }
  }
}

/** Both states have a backend-issued session; verification gates protected operations only. */
export function isSignedIn(state: AuthState): state is Extract<AuthState, { status: 'authenticated' | 'verificationRequired' }> {
  return state.status === 'authenticated' || state.status === 'verificationRequired'
}
