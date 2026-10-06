import { type RefObject, useEffect, useRef, useState } from 'react'
import { AccountForms } from '../account/AccountForms'
import { useAuth } from '../../features/auth/AuthProvider'
import catBooks from '../../assets/account/account-hub-cat-books.png'
import cardSprig from '../../assets/account/account-hub-card-sprig.png'
import accountHouse from '../../assets/account/account-hub-account-house.png'
import ordersParcel from '../../assets/account/account-hub-orders-parcel.png'
import foliageBottomLeft from '../../assets/account/account-hub-foliage-bottom-left.png'
import foliageBottomRight from '../../assets/account/account-hub-foliage-bottom-right.png'
import dividerLeaf from '../../assets/shared/hr-leaf.png'
import { navigateCheckout } from '../../features/checkout/state'
import { PersonalInformation } from '../account/PersonalInformation'

export function AuthenticatedAccountHub({ email, onSignOut, onOpenAccount, onOpenOrders }: { email: string; onSignOut: () => void; onOpenAccount?: () => void; onOpenOrders?: () => void }) {
  return (
    <div className="account-experience account-experience--authenticated">
      <div className="account-experience__task">
        <div className="account-hub__top">
          <header className="account-experience__heading account-hub__identity">
            <p className="account-experience__eyebrow">Your little corner of Build &amp; Bloom</p>
            <h2 id="account-task-title"><span className="account-hub__heading-line">Account</span> connected</h2>
            <p>Signed in as {email}.</p>
          </header>
          <img className="account-hub__cat-books" src={catBooks} alt="" aria-hidden="true" />
        </div>
        <div className="account-hub__cards" aria-label="Account destinations">
          <article className="account-hub-card" aria-labelledby="account-hub-account-title">
            <img className="account-hub-card__sprig" src={cardSprig} alt="" aria-hidden="true" />
            <div className="account-hub-card__copy">
              <h3 id="account-hub-account-title">My Account</h3>
              <p>Personal details, addresses &amp; preferences</p>
            </div>
            <img className="account-hub-card__feature account-hub-card__feature--house" src={accountHouse} alt="" aria-hidden="true" />
            {onOpenAccount && <button className="account-hub-card__action" type="button" aria-label="Open My Account" onClick={onOpenAccount} />}
          </article>
          <article className="account-hub-card" aria-labelledby="account-hub-orders-title">
            <img className="account-hub-card__sprig account-hub-card__sprig--orders" src={cardSprig} alt="" aria-hidden="true" />
            <div className="account-hub-card__copy">
              <h3 id="account-hub-orders-title">My Orders</h3>
              <p>Orders, delivery &amp; order history</p>
            </div>
            <img className="account-hub-card__feature account-hub-card__feature--parcel" src={ordersParcel} alt="" aria-hidden="true" />
            {onOpenOrders && <button className="account-hub-card__action" type="button" aria-label="Open My Orders" onClick={onOpenOrders} />}
          </article>
        </div>
        <div className="account-hub__divider" aria-hidden="true"><span><img src={dividerLeaf} alt="" /></span></div>
        <div className="account-hub__signout">
          <button className="account-hub__signout-button" type="button" onClick={onSignOut}>Sign Out</button>
        </div>
      </div>
      <img className="account-hub__foliage account-hub__foliage--left" src={foliageBottomLeft} alt="" aria-hidden="true" />
      <img className="account-hub__foliage account-hub__foliage--right" src={foliageBottomRight} alt="" aria-hidden="true" />
      <p className="account-hub__sentiment">Good things grow here.</p>
    </div>
  )
}

export function AccountModalCloseButton({ onClose, closeRef }: { onClose: () => void; closeRef?: RefObject<HTMLButtonElement | null> }) {
  return <button ref={closeRef} type="button" className="account-modal__close" aria-label="Close account dialog" onClick={onClose}>×</button>
}

export function AccountModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousStatus = useRef<string | undefined>(undefined)
  const { state, logout } = useAuth()
  const [view, setView] = useState<'hub' | 'personal'>('hub')
  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  useEffect(() => {
    if (previousStatus.current === 'authenticating' && state.status === 'authenticated') { setView('hub'); onClose() }
    previousStatus.current = state.status
  }, [onClose, state.status])
  const activeView = state.status === 'authenticated' ? view : 'hub'
  return (
    <div className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className={`account-modal__surface${state.status === 'authenticated' ? activeView === 'personal' ? ' account-modal__surface--personal' : ' account-modal__surface--hub' : state.status === 'verificationRequired' ? ' account-modal__surface--verification' : ''}`}>
        <AccountModalCloseButton closeRef={closeRef} onClose={onClose} />
        <h1 id="account-modal-title" className="account-modal__accessible-title">My Account</h1>
        {state.status === 'authenticated' ? activeView === 'personal' ? <PersonalInformation onBack={() => setView('hub')} /> : <AuthenticatedAccountHub email={state.user.email} onOpenAccount={() => setView('personal')} onOpenOrders={() => { onClose(); navigateCheckout('/account/orders') }} onSignOut={() => { logout(); onClose() }} /> : <AccountForms />}
      </section>
    </div>
  )
}
