import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AccountForms, AccountView } from './AccountForms'

describe('account experience', () => {
  it('opens with one sign-in task, labelled credentials and a registration switch', () => {
    const markup = renderToStaticMarkup(<AccountForms />)
    expect(markup.match(/<form\b/g)).toHaveLength(1)
    expect(markup.match(/<input\b/g)).toHaveLength(2)
    expect(markup).toContain('Welcome back!')
    expect(markup).toContain('type="password"')
    expect(markup).toContain('aria-label="Show password"')
    expect(markup).toContain('autoComplete="current-password"')
    expect(markup).toContain('for="account-signin-email"')
    expect(markup).toContain('Create Account')
    expect(markup).not.toContain('confirmPassword')
  })

  it('collects only email, password and confirmation in the registration form', () => {
    const markup = renderToStaticMarkup(<AccountView mode="create" onModeChange={() => {}} />)
    expect(markup.match(/<form\b/g)).toHaveLength(1)
    expect(markup.match(/<input\b/g)).toHaveLength(3)
    for (const field of ['email', 'password', 'confirmPassword']) {
      expect(markup).toContain(`for="account-create-${field}"`)
    }
    expect(markup.match(/type="password"/g)).toHaveLength(2)
    expect(markup).toContain('aria-label="Show confirm password"')
    expect(markup).toContain('<label for="account-create-email">Email</label>')
    expect(markup).toContain('<label for="account-create-password">Password</label>')
    expect(markup).toContain('<label for="account-create-confirmPassword">Confirm password</label>')
    expect(markup).toContain('autoComplete="email"')
    expect(markup.match(/autoComplete="new-password"/g)).toHaveLength(2)
    expect(markup).not.toMatch(/first.?name|last.?name|given-name|family-name/i)
    expect([...markup.matchAll(/<input\b[^>]*\bname="([^"]+)"/g)].map((match) => match[1]))
      .toEqual(['email', 'password', 'confirmPassword'])
    expect(markup).not.toContain('account-signin-')
  })

})
