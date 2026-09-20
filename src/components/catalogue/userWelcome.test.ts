import { describe, expect, it } from 'vitest'
import { USER_ACCOUNT_HINT, USER_WELCOME_GREETING_MS, USER_WELCOME_HINT_MS, welcomeGreeting } from './userWelcome'

describe('authenticated User welcome copy', () => {
  it('uses the real first name when present', () => {
    expect(welcomeGreeting('Yejun')).toBe('Welcome back, Yejun!')
  })

  it.each([null, '', '   ', undefined])('falls back without an empty name for %j', (name) => {
    expect(welcomeGreeting(name)).toBe('Welcome back!')
  })

  it('keeps the account hint and readable display timings explicit', () => {
    expect(USER_ACCOUNT_HINT).toBe('Click me anytime to manage your account and orders.')
    expect(USER_WELCOME_GREETING_MS).toBe(3_000)
    expect(USER_WELCOME_HINT_MS).toBe(6_000)
  })
})
