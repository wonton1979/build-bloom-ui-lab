import { describe, expect, it } from 'vitest'
import { authReducer, type AuthState } from './state'

const user = { id: 4, email: 'person@example.com', firstName: 'Ada', lastName: null, phone: null }

describe('auth state transitions', () => {
  it('represents restoration, authentication, verification, signed out and errors distinctly', () => {
    let state: AuthState = { status: 'signedOut' }
    state = authReducer(state, { type: 'resolve' })
    expect(state).toEqual({ status: 'resolving' })
    state = authReducer(state, { type: 'authenticate', mode: 'signin' })
    expect(state).toEqual({ status: 'authenticating', mode: 'signin' })
    state = authReducer(state, { type: 'authenticated', token: 'jwt', user })
    expect(state).toMatchObject({ status: 'authenticated', token: 'jwt', user })
    state = authReducer(state, { type: 'verificationRequired', token: 'jwt', message: 'Email verification required' })
    expect(state.status).toBe('verificationRequired')
    state = authReducer(state, { type: 'error', message: 'Network unavailable', token: 'jwt' })
    expect(state).toEqual({ status: 'error', message: 'Network unavailable', token: 'jwt' })
    expect(authReducer(state, { type: 'signedOut' })).toEqual({ status: 'signedOut', error: undefined })
  })
})
