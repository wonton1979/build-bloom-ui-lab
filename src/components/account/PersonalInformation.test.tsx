import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { draftFromUser, profilePatchFromDraft } from './profileDraft'
import { PersonalInformation } from './PersonalInformation'

vi.mock('../../features/auth/AuthProvider', () => ({
  useAuth: () => ({
    state: { status: 'authenticated', token: 'test-token', user: { id: 7, email: 'person@example.com', firstName: null, lastName: 'Lovelace', phone: null } },
    updateProfile: vi.fn(),
  }),
}))

const user = { id: 7, email: 'person@example.com', firstName: 'Ada', lastName: null, phone: null }

describe('personal information editing', () => {
  it('initializes a safe local draft from the saved profile', () => {
    expect(draftFromUser(user)).toEqual({ firstName: 'Ada', lastName: '', phone: '' })
  })

  it('trims the editable fields and keeps phone clearing explicit', () => {
    expect(profilePatchFromDraft({ firstName: ' Ada ', lastName: ' Lovelace ', phone: '  ' })).toEqual({
      firstName: 'Ada', lastName: 'Lovelace', phone: '',
    })
  })

  it('does not submit empty nullable-name fields', () => {
    expect(profilePatchFromDraft({ firstName: '', lastName: '', phone: '0123' })).toEqual({ phone: '0123' })
  })

  it('renders the saved identity safely without null or undefined text', () => {
    const markup = renderToStaticMarkup(<PersonalInformation onBack={() => {}} />)
    expect(markup).toContain('person@example.com')
    expect(markup).toContain('Not provided')
    expect(markup).not.toContain('null')
    expect(markup).not.toContain('undefined')
  })

  it('keeps the two account sections and supplied decoration separate from saved data', () => {
    const markup = renderToStaticMarkup(<PersonalInformation onBack={() => {}} />)
    expect(markup).toContain('aria-labelledby="personal-information-title"')
    expect(markup).toContain('aria-labelledby="saved-addresses-title"')
    expect(markup).toContain('Read only')
    expect(markup).toContain('Edit information')
    expect(markup).toContain('Back to Account')
    expect(markup).toContain('Loading addresses…')
    for (const asset of ['account-boy-dog-sign', 'account-books-lavender', 'account-botanical-heart', 'account-botanical-sprig-left', 'account-botanical-sprig-right', 'account-floral-sprig', 'account-personal-info-sprout', 'account-saved-addresses-house', 'account-title-botanical-left', 'account-title-botanical-right']) {
      expect(markup).toContain(asset)
    }
    expect(markup).not.toContain('Good People Brighter Days')
  })
})
