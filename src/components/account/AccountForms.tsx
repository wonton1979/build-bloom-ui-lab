import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import cottage from '../../assets/illustrations/opening-welcome-illustration.png'
import flower from '../../assets/decorations/catalogue-title-flower.png'
import { useAuth } from '../../features/auth/AuthProvider'
import './AccountExperience.css'
import { VerificationNotice } from './VerificationNotice'

export type AccountMode = 'signin' | 'create'
type FieldName = 'email' | 'password' | 'confirmPassword'
type Draft = Record<FieldName, string>
type FieldDefinition = { name: FieldName; label: string; type: 'email' | 'password'; autoComplete: string }
const email: FieldDefinition = { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }
const fields: Record<AccountMode, FieldDefinition[]> = {
  signin: [email, { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' }],
  create: [
    email,
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
    { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
  ],
}
const emptyDraft: Draft = { email: '', password: '', confirmPassword: '' }

function PasswordIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5 0 8.7 4.3 10 8-0.5 1.4-1.3 2.8-2.4 4" />
      <path d="M6.2 6.2C4.6 7.4 3.4 9.1 2 12c1.3 3.7 5 8 10 8 1 0 1.9-.2 2.8-.5" />
    </svg>
  ) : (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

type AccountViewProps = {
  mode: AccountMode
  onModeChange: (mode: AccountMode) => void
  draft?: Draft
  onFieldChange?: (name: FieldName, value: string) => void
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  error?: string
  submitting?: boolean
}

const passwordRules = [
  [/^.{8,}$/, 'at least 8 characters'],
  [/[a-z]/, 'a lowercase letter'],
  [/[A-Z]/, 'an uppercase letter'],
  [/[0-9]/, 'a digit'],
  [/[^A-Za-z0-9]/, 'a special character'],
] as const

export function AccountView({ mode, onModeChange, draft = emptyDraft, onFieldChange, onSubmit, error, submitting }: AccountViewProps) {
  const creating = mode === 'create'
  const [visible, setVisible] = useState<Record<'password' | 'confirmPassword', boolean>>({ password: false, confirmPassword: false })
  return (
    <div className="account-experience" data-account-mode={mode}>
      <aside className="account-experience__welcome" aria-label="Build & Bloom">
        <p className="account-experience__brand">Build &amp; Bloom</p>
        <p className="account-experience__story">Small pieces.<br />A world of possibilities.</p>
        <img className="account-experience__art" src={cottage} alt="" />
        <p className="account-experience__caption">A little imagination belongs in every day.</p>
      </aside>
      <div className="account-experience__task">
        <header className="account-experience__heading">
          <img src={flower} alt="" className="account-experience__flower" />
          <p className="account-experience__eyebrow">Your little corner of Build &amp; Bloom</p>
          <h2 id="account-task-title" tabIndex={-1}>{creating ? 'A little world,\nwith you in it.' : 'Welcome back!'}</h2>
          <p>{creating ? 'Create your account. Let’s start your next little story.' : 'Come on in. Your next little story is waiting.'}</p>
        </header>
        {error && <p className="account-form__message account-form__message--error" role="alert">{error}</p>}
        <form key={mode} className="account-form" aria-labelledby="account-task-title" onSubmit={onSubmit} noValidate>
          <div className="account-form__fields">
            {fields[mode].map(({ name, label, type, autoComplete }) => {
              const id = `account-${mode}-${name}`
              const isPassword = type === 'password'
              return (
                <div key={name} className={`account-form__field account-form__field--${name}`}>
                  <label htmlFor={id}>{label}</label>
                  <span className="account-form__input-wrap">
                    <input id={id} name={name} type={isPassword && visible[name as 'password' | 'confirmPassword'] ? 'text' : type} autoComplete={autoComplete}
                      autoCapitalize={type === 'email' ? 'none' : undefined}
                      spellCheck={type === 'email' ? false : undefined}
                      value={draft[name]} onChange={(event) => onFieldChange?.(name, event.target.value)} />
                    {isPassword && <button type="button" className="account-form__password-toggle"
                      aria-label={`${visible[name as 'password' | 'confirmPassword'] ? 'Hide' : 'Show'} ${name === 'confirmPassword' ? 'confirm password' : 'password'}`}
                      onClick={() => setVisible((current) => ({ ...current, [name]: !current[name as 'password' | 'confirmPassword'] }))}>
                      <PasswordIcon hidden={visible[name as 'password' | 'confirmPassword']} />
                    </button>}
                  </span>
                </div>
              )
            })}
          </div>
          <button className="account-form__submit" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : creating ? 'Create Account' : 'Sign In'}</button>
        </form>
        <p className="account-experience__switch">
          {creating ? 'Already part of our little world?' : 'New to our little world?'}{' '}
          <button type="button" onClick={() => onModeChange(creating ? 'signin' : 'create')}>
            {creating ? 'Sign In' : 'Create Account'}<span aria-hidden="true"> →</span>
          </button>
        </p>
      </div>
    </div>
  )
}

export function AccountForms() {
  const [mode, setMode] = useState<AccountMode>('signin')
  const [drafts, setDrafts] = useState({ signin: emptyDraft, create: emptyDraft })
  const container = useRef<HTMLDivElement>(null)
  const previousMode = useRef(mode)
  const { state, authenticate } = useAuth()
  const [formError, setFormError] = useState<string>()
  const submitting = state.status === 'authenticating'
  const serverError = state.status === 'signedOut' ? state.error : state.status === 'error' ? state.message : state.status === 'verificationRequired' ? state.message : undefined
  useLayoutEffect(() => {
    if (previousMode.current !== mode) {
      container.current?.querySelector<HTMLElement>('#account-task-title')?.focus({ preventScroll: true })
      const surface = container.current?.closest('.account-modal__surface')
      if (surface) surface.scrollTop = 0
      previousMode.current = mode
    }
  }, [mode])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const current = drafts[mode]
    if (!current.email.trim()) return setFormError('Enter your email address.')
    if (!current.password) return setFormError('Enter your password.')
    if (mode === 'create') {
      const failedRule = passwordRules.find(([rule]) => !rule.test(current.password))
      if (failedRule) return setFormError(`Your password needs ${failedRule[1]}.`)
      if (current.password !== current.confirmPassword) return setFormError('Your passwords do not match.')
    }
    setFormError(undefined)
    await authenticate(mode === 'create' ? 'signup' : 'signin', { email: current.email, password: current.password })
  }
  if (state.status === 'verificationRequired') return <VerificationNotice token={state.token} message={state.message} />
  return (
    <div ref={container}>
      <AccountView mode={mode} onModeChange={setMode} draft={drafts[mode]}
        onSubmit={submit} error={formError || serverError} submitting={submitting}
        onFieldChange={(name, value) => { setFormError(undefined); setDrafts((current) => ({ ...current, [mode]: { ...current[mode], [name]: value } })) }} />
    </div>
  )
}
