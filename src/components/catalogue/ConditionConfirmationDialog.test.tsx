// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConditionConfirmationDialog } from './ConditionConfirmationDialog'
import { useConditionConfirmation } from '../../features/catalogue/useConditionConfirmation'
import { damaged10759, offer } from '../../features/catalogue/catalogueFixtures'
import type { ProductListingOffer } from '../../features/catalogue/api'

const exactOffer = offer(77, {
  condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', damageDescription: 'A deep crease along the upper right corner.',
  effectivePrice: '17.45',
  usedConditionPhotos: [
    { id: 3, listingId: 77, url: '/condition-third.jpg', publicId: 'c3', sortOrder: 3, createdAt: '' },
    { id: 1, listingId: 77, url: '/condition-first.jpg', publicId: 'c1', sortOrder: 1, createdAt: '' },
    { id: 2, listingId: 77, url: '/condition-second.jpg', altText: 'Close view of the damaged corner', publicId: 'c2', sortOrder: 2, createdAt: '' },
    { id: 4, listingId: 999, url: '/another-item.jpg', publicId: 'other', sortOrder: 0, createdAt: '' },
  ],
})

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

afterEach(() => { document.body.innerHTML = '' })

function mountDialog(selectedOffer: ProductListingOffer = exactOffer, onConfirm = vi.fn()) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => root.render(<ConditionConfirmationDialog offer={selectedOffer} productTitle="Forest Cabin" onCancel={vi.fn()} onConfirm={onConfirm} />))
  return { container, root, onConfirm }
}

describe('damaged-box condition confirmation', () => {
  it('shows the exact offer price, description and sorted condition photos only', () => {
    const markup = renderToStaticMarkup(<ConditionConfirmationDialog offer={exactOffer} productTitle="Forest Cabin" onCancel={() => {}} onConfirm={() => {}} />)
    expect(markup).toContain('New – Outer Box Damage')
    expect(markup).toContain('£17.45')
    expect(markup).toContain('A deep crease along the upper right corner.')
    expect(markup).toContain('never been built or played with')
    expect(markup).toContain('Contents and internal packaging are complete')
    expect(markup).toContain('Only the outer retail box has cosmetic damage')
    expect(markup).toContain('This does not affect your statutory rights.')
    expect(markup.indexOf('/condition-first.jpg')).toBeLessThan(markup.indexOf('/condition-second.jpg'))
    expect(markup.indexOf('/condition-second.jpg')).toBeLessThan(markup.indexOf('/condition-third.jpg'))
    expect(markup).not.toContain('/product-image.png')
    expect(markup).not.toContain('/another-item.jpg')
    expect(markup).toContain("I&#x27;ve checked the condition — Add to Cart")
  })

  it('fails closed if the exact offer has no condition photos', () => {
    const missing = { ...exactOffer, usedConditionPhotos: [] }
    const markup = renderToStaticMarkup(<ConditionConfirmationDialog offer={missing} productTitle="Forest Cabin" onCancel={() => {}} onConfirm={() => {}} />)
    expect(markup).toContain('Condition photos are temporarily unavailable')
    expect(markup).toContain('condition-confirmation__confirm" disabled')
    expect(markup).not.toContain('/product-image.png')
  })

  it('opens the selected original condition photo in an accessible, contained lightbox', async () => {
    const used = damaged10759.offers.find(item => item.id === 16901)!
    const mounted = mountDialog(used)
    const thumbnail = mounted.container.querySelectorAll<HTMLButtonElement>('.condition-confirmation__photo-button')[1]
    expect(thumbnail.getAttribute('aria-haspopup')).toBe('dialog')
    await act(async () => thumbnail.click())

    const lightbox = mounted.container.querySelector<HTMLDialogElement>('.condition-photo-lightbox')!
    const image = lightbox.querySelector<HTMLImageElement>('.condition-photo-lightbox__image')!
    expect(lightbox.open).toBe(true)
    expect(lightbox.getAttribute('aria-modal')).toBe('true')
    expect(lightbox.dataset.conditionPhotoListingId).toBe('16901')
    expect(document.activeElement).toBe(lightbox.querySelector('[aria-label="Close condition photo"]'))
    expect(image.getAttribute('src')).toBe('/used-condition-10759-2.jpg')
    expect(image.alt).toBe('Condition photo 2 of Forest Cabin')
    expect(lightbox.querySelector('.condition-photo-lightbox__counter')?.textContent).toBe('2 of 3')
    expect(image.className).toContain('condition-photo-lightbox__image')
    expect(mounted.container.innerHTML).not.toContain('/product-image-380.jpg')
    expect(mounted.container.innerHTML).not.toContain('/catalogue-artwork-10759.png')
    expect(mounted.onConfirm).not.toHaveBeenCalled()
    await act(async () => mounted.root.unmount())
  })

  it('moves through three listing-specific photos and updates the counter', async () => {
    const mounted = mountDialog()
    const thumbnail = mounted.container.querySelectorAll<HTMLButtonElement>('.condition-confirmation__photo-button')[0]
    await act(async () => thumbnail.click())
    const image = () => mounted.container.querySelector<HTMLImageElement>('.condition-photo-lightbox__image')!
    const counter = () => mounted.container.querySelector('.condition-photo-lightbox__counter')?.textContent
    expect(image().getAttribute('src')).toBe('/condition-first.jpg')
    expect(counter()).toBe('1 of 3')

    await act(async () => mounted.container.querySelector<HTMLButtonElement>('[aria-label="Next condition photo"]')!.click())
    expect(image().getAttribute('src')).toBe('/condition-second.jpg')
    expect(counter()).toBe('2 of 3')
    await act(async () => mounted.container.querySelector<HTMLButtonElement>('[aria-label="Next condition photo"]')!.click())
    expect(image().getAttribute('src')).toBe('/condition-third.jpg')
    expect(counter()).toBe('3 of 3')
    await act(async () => mounted.container.querySelector<HTMLButtonElement>('[aria-label="Previous condition photo"]')!.click())
    expect(image().getAttribute('src')).toBe('/condition-second.jpg')
    expect(counter()).toBe('2 of 3')
    expect(mounted.container.querySelector('[aria-label="Previous condition photo"]')).not.toBeNull()
    const lightbox = mounted.container.querySelector<HTMLDialogElement>('.condition-photo-lightbox')!
    await act(async () => lightbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(image().getAttribute('src')).toBe('/condition-third.jpg')
    await act(async () => lightbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    expect(image().getAttribute('src')).toBe('/condition-second.jpg')
    await act(async () => mounted.root.unmount())
  })

  it.each(['Escape key', 'Close control', 'backdrop'])('closes the lightbox with the %s and returns to the same condition modal', async closeMethod => {
    const add = vi.fn<(selected: ProductListingOffer) => void>()
    const mounted = mountDialog(exactOffer, add)
    const thumbnail = mounted.container.querySelectorAll<HTMLButtonElement>('.condition-confirmation__photo-button')[1]
    await act(async () => thumbnail.click())
    const lightbox = mounted.container.querySelector<HTMLDialogElement>('.condition-photo-lightbox')!
    if (closeMethod === 'Escape key') {
      await act(async () => lightbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    } else if (closeMethod === 'Close control') {
      await act(async () => lightbox.querySelector<HTMLButtonElement>('[aria-label="Close condition photo"]')!.click())
    } else {
      await act(async () => lightbox.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    }

    expect(mounted.container.querySelector('.condition-photo-lightbox')).toBeNull()
    const conditionDialog = mounted.container.querySelector<HTMLDialogElement>('.condition-confirmation')!
    expect(conditionDialog.open).toBe(true)
    expect(conditionDialog.dataset.conditionListingId).toBe('77')
    expect(conditionDialog.textContent).toContain('A deep crease along the upper right corner.')
    expect(conditionDialog.textContent).toContain("I've checked the condition — Add to Cart")
    expect(document.activeElement).toBe(thumbnail)
    expect(add).not.toHaveBeenCalled()
    await act(async () => mounted.root.unmount())
  })

  it('keeps image inspection separate from acknowledgement and only the CTA confirms the exact offer', async () => {
    const add = vi.fn<(selected: ProductListingOffer) => void>()
    const mounted = mountDialog(exactOffer, add)
    const thumbnail = mounted.container.querySelector<HTMLButtonElement>('.condition-confirmation__photo-button')!
    await act(async () => thumbnail.click())
    expect(add).not.toHaveBeenCalled()
    await act(async () => mounted.container.querySelector<HTMLButtonElement>('[aria-label="Next condition photo"]')!.click())
    await act(async () => mounted.container.querySelector<HTMLButtonElement>('[aria-label="Close condition photo"]')!.click())
    expect(mounted.container.querySelector('.condition-confirmation')).not.toBeNull()
    expect(add).not.toHaveBeenCalled()

    await act(async () => mounted.container.querySelector<HTMLButtonElement>('.condition-confirmation__confirm')!.click())
    expect(add).toHaveBeenCalledExactlyOnceWith(exactOffer)
    await act(async () => mounted.root.unmount())
  })

  it('does not add on open or cancel and confirms the exact pending ProductListing', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    const add = vi.fn<(offer: ProductListingOffer) => void>()
    function Flow() {
      const confirmation = useConditionConfirmation(add)
      return <>
        <button type="button" onClick={() => confirmation.request(exactOffer, 'Forest Cabin')}>Add to Cart</button>
        {confirmation.pending && <ConditionConfirmationDialog offer={confirmation.pending.offer} productTitle={confirmation.pending.productTitle} onCancel={confirmation.cancel} onConfirm={confirmation.confirm} />}
      </>
    }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<Flow />))
    await act(async () => container.querySelector('button')!.click())
    expect(container.querySelector('dialog')).not.toBeNull()
    expect(add).not.toHaveBeenCalled()
    await act(async () => container.querySelector<HTMLButtonElement>('.condition-confirmation__cancel')!.click())
    expect(add).not.toHaveBeenCalled()
    expect(container.querySelector('dialog')).toBeNull()

    await act(async () => container.querySelector('button')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('.condition-confirmation__confirm')!.click())
    expect(add).toHaveBeenCalledExactlyOnceWith(exactOffer)
    expect(container.querySelector('dialog')).toBeNull()
    await act(async () => root.unmount())
  })
})
