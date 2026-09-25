import { useEffect, useId, useRef } from 'react'
import sprig from '../../assets/account/account-hub-card-sprig.png'
import { formatGbp, listingUnitPricePence, type CartItem } from '../../features/cart/CartContext'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import './RemoveItemDialog.css'

export interface RemoveItemDialogProps {
  item: CartItem
  onCancel: () => void
  onConfirm: (item: CartItem) => void
  isConfirming?: boolean
}

/** Confirmation boundary only; the caller owns persistence and cart updates. */
export function RemoveItemDialog({ item, onCancel, onConfirm, isConfirming = false }: RemoveItemDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const image = item.listing.legoProduct.productImages[0]

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    keepRef.current?.focus({ preventScroll: true })
    return () => {
      dialog?.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  return <dialog ref={dialogRef} className="remove-item-dialog" aria-modal="true"
    aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onCancel() }}
    onKeyDown={event => {
      // The underlying Cart also traps focus and handles Escape. Only this
      // top-layer dialog may handle keys until it has been dismissed.
      event.stopPropagation()
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button')
        const first = controls?.[0], last = controls?.[1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }}>
    <img className="remove-item-dialog__sprig remove-item-dialog__sprig--top" src={sprig} alt="" aria-hidden="true" />
    <img className="remove-item-dialog__sprig remove-item-dialog__sprig--bottom" src={sprig} alt="" aria-hidden="true" />
    <h2 id={titleId}>Remove this item?</h2>
    <div className="remove-item-dialog__divider"><BotanicalDivider /></div>
    <div className="remove-item-dialog__product">
      {image && <img className="remove-item-dialog__image" src={image.url} alt={image.altText ?? item.listing.legoProduct.title} />}
      <div className="remove-item-dialog__product-copy">
        <h3>{item.listing.legoProduct.title}</h3>
        <p>{formatGbp(listingUnitPricePence(item))}</p>
      </div>
    </div>
    <p className="remove-item-dialog__question" id={descriptionId}>Are you sure you want to take this out of your cart?</p>
    <div className="remove-item-dialog__actions">
      <button ref={keepRef} className="remove-item-dialog__keep" type="button" disabled={isConfirming} onClick={onCancel}>Keep it</button>
      <button className="remove-item-dialog__remove" type="button" disabled={isConfirming} aria-busy={isConfirming} onClick={() => onConfirm(item)}>Remove</button>
    </div>
  </dialog>
}
