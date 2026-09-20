import { renderToStaticMarkup } from 'react-dom/server'
import type { MouseEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AccountModal, AccountModalCloseButton, AuthenticatedAccountHub } from './AccountModal'

describe('authenticated Account Hub presentation', () => {
  it('shows the real email and both future destinations as non-interactive stationery', () => {
    const markup = renderToStaticMarkup(<AuthenticatedAccountHub email="jerry@example.com" onSignOut={() => {}} />)
    expect(markup).toContain('Account</span> connected')
    expect(markup).toContain('Signed in as jerry@example.com.')
    expect(markup).toContain('My Account')
    expect(markup).toContain('Personal details, addresses &amp; preferences')
    expect(markup).toContain('My Orders')
    expect(markup).toContain('Orders, delivery &amp; order history')
    expect(markup).not.toContain('Coming soon')
    expect(markup).not.toContain('account-hub-card__cue')
    expect(markup).toContain('account-hub-cat-books')
    expect(markup).toContain('account-hub-account-house')
    expect(markup).toContain('account-hub-orders-parcel')
    expect(markup).toContain('account-hub-foliage-bottom-left')
    expect(markup).toContain('account-hub-foliage-bottom-right')
    expect(markup).toContain('Good things grow here.')
    expect(markup.match(/<article\b/g)).toHaveLength(2)
    expect(markup).not.toMatch(/<a\b/)
    expect(markup).not.toContain('onClick')
  })

  it('keeps Sign Out as the only action in the presentation shell', () => {
    const onSignOut = vi.fn()
    const markup = renderToStaticMarkup(<AuthenticatedAccountHub email="jerry@example.com" onSignOut={onSignOut} />)
    expect(markup).toContain('class="account-hub__signout-button"')
    expect(markup.match(/<button\b/g)).toHaveLength(1)
    expect(onSignOut).not.toHaveBeenCalled()
  })

  it('keeps the modal close control separate from Sign Out', () => {
    const onClose = vi.fn()
    const markup = renderToStaticMarkup(<AccountModal onClose={onClose} />)
    expect(markup).toContain('class="account-modal__close"')
    expect(markup).toContain('type="button"')
    expect(markup).toContain('aria-label="Close account dialog"')
    expect(markup).not.toContain('account-hub__signout-button')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('invokes onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    const button = AccountModalCloseButton({ onClose })
    if (typeof button.props.onClick !== 'function') throw new Error('Close button is not clickable')
    button.props.onClick({} as MouseEvent<HTMLButtonElement>)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
