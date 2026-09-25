import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import type { ProductListingOffer } from '../../features/catalogue/api'
import { effectivePricePence, formatGbp } from '../../features/cart/CartContext'
import './ConditionConfirmationDialog.css'

export function ConditionConfirmationDialog({ offer, productTitle, onCancel, onConfirm }: {
  offer: ProductListingOffer
  productTitle: string
  onCancel: () => void
  onConfirm: (offer: ProductListingOffer) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const photoOpenerRef = useRef<HTMLButtonElement | null>(null)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const titleId = useId()
  const descriptionId = useId()
  const photos = useMemo(() => offer.usedConditionPhotos.filter(photo => photo.listingId === offer.id)
    .slice().sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 3), [offer])

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    confirmRef.current?.focus({ preventScroll: true })
    return () => {
      dialog?.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  return <dialog ref={dialogRef} className="condition-confirmation" aria-modal="true" data-condition-listing-id={offer.id}
    aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onCancel() }}
    onClick={event => { if (event.target === event.currentTarget) onCancel() }}>
    <button className="condition-confirmation__close" type="button" aria-label="Close condition details" onClick={onCancel}>×</button>
    <h2 id={titleId}>New – Outer Box Damage</h2>
    <p className="condition-confirmation__product">{productTitle}</p>
    <p className="condition-confirmation__price">{formatGbp(effectivePricePence(offer))}</p>
    <div className="condition-confirmation__disclosure" id={descriptionId}>
      <p>This LEGO set has never been built or played with.</p>
      <p>Contents and internal packaging are complete.</p>
      <p>Only the outer retail box has cosmetic damage.</p>
      <p className="condition-confirmation__damage-description">{offer.damageDescription?.trim() || 'The outer box has cosmetic damage.'}</p>
    </div>
    {photos.length > 0 ? <div className="condition-confirmation__photos" aria-label="Condition photos of this physical item">
      {photos.map((photo, index) => <figure key={photo.id}>
        <button ref={element => { if (selectedPhotoIndex === index) photoOpenerRef.current = element }} type="button"
          className="condition-confirmation__photo-button" aria-haspopup="dialog"
          aria-label={`View condition photo ${index + 1} of ${photos.length}${productTitle ? ` for ${productTitle}` : ''}`}
          onClick={event => { photoOpenerRef.current = event.currentTarget; setSelectedPhotoIndex(index) }}>
          <img src={photo.url} alt={photo.altText?.trim() || `Condition photo ${index + 1}${productTitle ? ` of ${productTitle}` : ''}`} />
        </button>
        <figcaption>Condition photo {index + 1}</figcaption>
      </figure>)}
    </div> : <p className="condition-confirmation__missing" role="alert">Condition photos are temporarily unavailable. This item cannot be added right now.</p>}
    <p className="condition-confirmation__rights">This does not affect your statutory rights.</p>
    <div className="condition-confirmation__actions">
      <button type="button" className="condition-confirmation__cancel" onClick={onCancel}>Cancel</button>
      <button ref={confirmRef} type="button" className="condition-confirmation__confirm" disabled={!photos.length}
        onClick={() => onConfirm(offer)}>I've checked the condition — Add to Cart</button>
    </div>
    {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && <ConditionPhotoLightbox
      photo={photos[selectedPhotoIndex]} index={selectedPhotoIndex} total={photos.length} listingId={offer.id} productTitle={productTitle}
      openerRef={photoOpenerRef} onClose={() => setSelectedPhotoIndex(null)}
      onPrevious={() => setSelectedPhotoIndex(index => index === null ? null : (index + photos.length - 1) % photos.length)}
      onNext={() => setSelectedPhotoIndex(index => index === null ? null : (index + 1) % photos.length)} />}
  </dialog>
}

function ConditionPhotoLightbox({ photo, index, total, listingId, productTitle, openerRef, onClose, onPrevious, onNext }: {
  photo: ProductListingOffer['usedConditionPhotos'][number]
  index: number
  total: number
  listingId: number
  productTitle: string
  openerRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const photoLabel = photo.altText?.trim() || `Condition photo ${index + 1}${productTitle ? ` of ${productTitle}` : ''}`

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = openerRef.current
    dialog?.showModal()
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      dialog?.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [openerRef])

  return <dialog ref={dialogRef} className="condition-photo-lightbox" aria-modal="true"
    aria-label={`${photoLabel}, ${index + 1} of ${total}`} data-condition-photo-listing-id={listingId}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      else if (total > 1 && event.key === 'ArrowLeft') { event.preventDefault(); onPrevious() }
      else if (total > 1 && event.key === 'ArrowRight') { event.preventDefault(); onNext() }
    }}>
    <div className="condition-photo-lightbox__toolbar">
      <p className="condition-photo-lightbox__counter" aria-live="polite">{index + 1} of {total}</p>
      <button ref={closeRef} className="condition-photo-lightbox__close" type="button" aria-label="Close condition photo" onClick={onClose}>×</button>
    </div>
    <div className="condition-photo-lightbox__stage">
      {total > 1 && <button className="condition-photo-lightbox__nav condition-photo-lightbox__previous" type="button"
        aria-label="Previous condition photo" onClick={onPrevious}>‹</button>}
      <img className="condition-photo-lightbox__image" src={photo.url} alt={photoLabel} />
      {total > 1 && <button className="condition-photo-lightbox__nav condition-photo-lightbox__next" type="button"
        aria-label="Next condition photo" onClick={onNext}>›</button>}
    </div>
  </dialog>
}
