import { useEffect, useRef } from 'react'
import { AccountForms } from '../account/AccountForms'

export function AccountModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return (
    <div className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="account-modal__surface">
        <button ref={closeRef} type="button" className="account-modal__close" aria-label="Close account dialog" onClick={onClose}>×</button>
        <h1 id="account-modal-title" className="account-modal__accessible-title">My Account</h1>
        <AccountForms />
      </section>
    </div>
  )
}
