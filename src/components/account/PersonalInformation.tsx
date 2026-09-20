import { useState, type FormEvent } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import type { UpdateCurrentUser } from '../../features/auth/api'
import { draftFromUser, profilePatchFromDraft, type ProfileDraft } from './profileDraft'
import { SavedAddresses } from './SavedAddresses'
import titleLeft from '../../assets/my-account/account-title-botanical-left.png'
import titleRight from '../../assets/my-account/account-title-botanical-right.png'
import sprout from '../../assets/my-account/account-personal-info-sprout.png'
import boyDog from '../../assets/my-account/account-boy-dog-sign.png'
import booksLavender from '../../assets/my-account/account-books-lavender.png'
import sprigLeft from '../../assets/my-account/account-botanical-sprig-left.png'
import sprigRight from '../../assets/my-account/account-botanical-sprig-right.png'
import heart from '../../assets/my-account/account-botanical-heart.png'
import floralSprig from '../../assets/my-account/account-floral-sprig.png'
import './PersonalInformation.css'

export function PersonalInformation({ onBack }: { onBack: () => void }) {
  const { state, updateProfile } = useAuth()
  const authenticatedState = state.status === 'authenticated' ? state : null
  const user = authenticatedState?.user ?? null
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ProfileDraft>(() => user ? draftFromUser(user) : { firstName: '', lastName: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const beginEdit = () => { setDraft(draftFromUser(user)); setError(null); setEditing(true) }
  const cancel = () => { setDraft(draftFromUser(user)); setError(null); setEditing(false) }
  const update = (field: keyof ProfileDraft, value: string) => setDraft(current => ({ ...current, [field]: value }))
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const firstName = draft.firstName.trim()
    const lastName = draft.lastName.trim()
    if (!firstName && user.firstName !== null) { setError('First name cannot be empty.'); return }
    if (!lastName && user.lastName !== null) { setError('Last name cannot be empty.'); return }
    const payload: UpdateCurrentUser = profilePatchFromDraft(draft)
    setSaving(true); setError(null)
    try {
      const updated = await updateProfile(payload)
      setDraft(draftFromUser(updated)); setEditing(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your information')
    } finally { setSaving(false) }
  }

  return <div className="my-account">
      <button className="my-account__back" type="button" onClick={onBack}>← Back to Account</button>
      <header className="my-account__heading">
        <img src={titleLeft} alt="" aria-hidden="true" />
        <div>
        <h2 id="account-task-title">My Account</h2>
        <p>Your little corner of Build &amp; Bloom</p>
        </div>
        <img src={titleRight} alt="" aria-hidden="true" />
      </header>
      <div className="my-account__columns">
      <section className="my-account__panel personal-information" aria-labelledby="personal-information-title">
      <header className="my-account__section-heading">
        <img src={sprout} alt="" aria-hidden="true" />
        <div><h3 id="personal-information-title">Personal Information</h3><p>Keep your personal details up to date.</p></div>
      </header>
      {error && <p className="my-account__error" role="alert">{error}</p>}
      {editing ? <form className="account-personal-information__form" onSubmit={save}>
        <label className="my-account__field">Email <span className="my-account__readonly-note">Read only</span><input type="email" value={user.email} readOnly aria-readonly="true" /></label>
        <label className="my-account__field">First name<input value={draft.firstName} onChange={event => update('firstName', event.target.value)} autoComplete="given-name" /></label>
        <label className="my-account__field">Last name<input value={draft.lastName} onChange={event => update('lastName', event.target.value)} autoComplete="family-name" /></label>
        <label className="my-account__field">Phone number<input type="tel" value={draft.phone} onChange={event => update('phone', event.target.value)} autoComplete="tel" /></label>
        <div className="account-personal-information__actions"><button className="my-account__button my-account__button--primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button><button className="my-account__button" type="button" onClick={cancel} disabled={saving}>Cancel</button></div>
      </form> : <div className="account-personal-information__details">
        <dl><div><dt>Email <span className="my-account__readonly-note">Read only</span></dt><dd className="personal-information__email">{user.email}</dd></div><div><dt>First name</dt><dd>{user.firstName?.trim() || 'Not provided'}</dd></div><div><dt>Last name</dt><dd>{user.lastName?.trim() || 'Not provided'}</dd></div><div><dt>Phone number</dt><dd>{user.phone?.trim() || 'Not provided'}</dd></div></dl>
        <div className="account-personal-information__actions"><button className="my-account__button my-account__button--primary" type="button" onClick={beginEdit}>Edit information</button></div>
      </div>}
      <img className="personal-information__floral" src={floralSprig} alt="" aria-hidden="true" />
      </section>
      {authenticatedState && <SavedAddresses token={authenticatedState.token} />}
      </div>
      <footer className="my-account__footer">
        <img className="my-account__boy-dog" src={boyDog} alt="" aria-hidden="true" />
        <div className="my-account__sentiment">
          <img src={sprigLeft} alt="" aria-hidden="true" />
          <p>Small details<br />build a brighter journey</p>
          <img className="my-account__heart" src={heart} alt="" aria-hidden="true" />
          <img src={sprigRight} alt="" aria-hidden="true" />
        </div>
        <img className="my-account__books" src={booksLavender} alt="" aria-hidden="true" />
      </footer>
  </div>
}
