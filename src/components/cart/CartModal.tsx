import { useEffect, useRef, type ReactNode } from 'react'
import emptyWagon from '../../assets/cart/cart-empty-wagon.png'
import emptyFooter from '../../assets/cart/cart-empty-footer.png'
import filledWagon from '../../assets/cart/cart-filled-wagon.png'
import filledFooter from '../../assets/cart/cart-filled-footer.png'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import './CartModal.css'

// Presentation boundary only: there is no cart model/service in this frontend yet.
// The future cart owner supplies its real item UI, summary and supported actions.
export type CartPresentation =
  | { kind: 'empty' }
  | { kind: 'filled'; items: ReactNode; summary?: ReactNode; actions?: ReactNode }

export function CartContent({ content, onContinueShopping, closeControl }: {
  content: CartPresentation
  onContinueShopping: () => void
  closeControl?: ReactNode
}) {
  const empty = content.kind === 'empty'
  return (
    <>
      <div className="cart-modal__scroll">
        {closeControl}
        <div className={`cart-modal__page cart-modal__page--${content.kind}`}>
          <h1 id="cart-modal-title">Shopping Cart</h1>
          <img className="cart-modal__wagon" src={empty ? emptyWagon : filledWagon} alt="" aria-hidden="true" />
          {content.kind === 'empty' ? (
            <div className="cart-modal__empty">
              <h2>Your cart is empty</h2>
              <p>Looks like this little wagon is<br />waiting for an adventure.</p>
              <button className="cart-modal__action" type="button" onClick={onContinueShopping}>Continue Shopping</button>
            </div>
          ) : (
            <div className="cart-modal__contents">
              <section className="cart-modal__items" aria-label="Cart items">{content.items}</section>
              {content.summary && <section className="cart-modal__summary" aria-label="Cart summary">{content.summary}</section>}
              {content.actions && <div className="cart-modal__actions">{content.actions}</div>}
            </div>
          )}
          <div className="cart-modal__divider"><BotanicalDivider /></div>
        </div>
      </div>
      <div className={`cart-modal__footer-edge cart-modal__footer-edge--${content.kind}`} aria-hidden="true">
        <img className="cart-modal__footer" src={empty ? emptyFooter : filledFooter} alt="" />
      </div>
    </>
  )
}

export function CartModal({ onClose, content = { kind: 'empty' } }: {
  onClose: () => void
  content?: CartPresentation
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const surfaceRef = useRef<HTMLElement>(null)
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const controls = Array.from(surfaceRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      ) ?? []).filter(element => element.getClientRects().length > 0)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])
  return (
    <div className="cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-modal-title"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={surfaceRef} className="cart-modal__surface">
        <CartContent content={content} onContinueShopping={onClose} closeControl={
          <button ref={closeRef} className="cart-modal__close" type="button" aria-label="Close shopping cart" onClick={onClose}>×</button>
        } />
      </section>
    </div>
  )
}
