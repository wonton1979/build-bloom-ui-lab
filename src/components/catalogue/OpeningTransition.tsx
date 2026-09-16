import { useLayoutEffect, useRef } from 'react'
import { ClosedCatalogue } from './ClosedCatalogue'
import { isolateTransitionBacking } from './transitionBacking'
import { bookTransitionGeometry } from './bookTransitionGeometry'
import './OpeningTransition.css'

type OpeningTransitionProps = {
  closedRect: DOMRect
  onAnimationEnd: () => void
}

/** Rigid cover over the real folded left page and real right page. */
export function OpeningTransition({ closedRect, onAnimationEnd }: OpeningTransitionProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const finishRef = useRef(onAnimationEnd)
  useLayoutEffect(() => { finishRef.current = onAnimationEnd }, [onAnimationEnd])

  useLayoutEffect(() => {
    const root = rootRef.current!
    const stage = root.parentElement!
    const book = stage.querySelector<HTMLElement>('.book-shell')!
    const left = book.querySelector<HTMLElement>('.book-shell__page--left')!
    const backing = book.querySelector<HTMLElement>('.book-shell__cover')!
    const gutter = book.querySelector<HTMLElement>('.book-shell__spine')!
    const frame = root.querySelector<HTMLElement>('.opening-transition__frame')!
    const sheet = root.querySelector<HTMLElement>('.opening-transition__sheet')!
    const bounds = book.getBoundingClientRect()
    const leftBounds = left.getBoundingClientRect()
    const backingBounds = backing.getBoundingClientRect()
    const stageBounds = stage.getBoundingClientRect()
    const hinge = bounds.left + bounds.width / 2
    const geometry = bookTransitionGeometry(closedRect, bounds, leftBounds)
    Object.assign(frame.style, {
      left: `${hinge - stageBounds.left}px`, top: `${bounds.top - stageBounds.top}px`,
      width: `${closedRect.width}px`, height: `${closedRect.height}px`,
      transformOrigin: 'left top',
    })

    // Attach the lip to the page itself: its parent supplies the complete
    // rotation, perspective and translated-book coordinate system.
    // Include the paper-edge shadows when locating the bottom lip.
    const paperDepth = Math.max(0, ...getComputedStyle(left).boxShadow
      .replace(/rgba?\([^)]*\)/g, '')
      .split(',')
      .map(shadow => {
        const lengths = shadow.match(/-?[\d.]+px/g)?.map(parseFloat) ?? []
        return shadow.includes('inset') ? 0 : (lengths[1] ?? 0) + (lengths[3] ?? 0) + (lengths[2] ?? 0)
      }))
    const lipLeft = leftBounds.left - backingBounds.left
    const lipBottom = leftBounds.bottom + paperDepth - backingBounds.top
    const boardHinge = hinge - backingBounds.left
    const backingStyle = getComputedStyle(backing)
    const movingEdge = document.createElement('div')
    movingEdge.className = 'opening-transition__moving-edge'
    movingEdge.setAttribute('aria-hidden', 'true')
    // Absolute child coordinates begin inside the page border, not at its outer box.
    Object.assign(movingEdge.style, {
      left: `${backingBounds.left - leftBounds.left - left.clientLeft}px`,
      top: `${backingBounds.top - leftBounds.top - left.clientTop}px`,
      width: `${backingBounds.width}px`, height: `${backingBounds.height}px`,
      background: backingStyle.background,
      border: backingStyle.border,
      borderRadius: backingStyle.borderRadius,
      boxShadow: backingStyle.boxShadow,
      boxSizing: backingStyle.boxSizing,
    })
    // Clip the temporary board to only its left/bottom lip and external shadow.
    // Its interior and entire right half can never become a visible panel.
    const shadowRoom = Math.max(backingBounds.width, backingBounds.height)
    // Follow the rounded paper cutout instead of cutting a square notch into
    // the lip. The copied backing radius still owns the outer cover contour.
    const [cornerX, cornerY = cornerX] = getComputedStyle(left).borderBottomLeftRadius
      .split(' ').map(parseFloat)
    movingEdge.style.clipPath = `path("M ${-shadowRoom} ${-shadowRoom} H ${lipLeft} V ${lipBottom - cornerY} `
      + `A ${cornerX} ${cornerY} 0 0 0 ${lipLeft + cornerX} ${lipBottom} `
      + `H ${boardHinge} V ${backingBounds.height + shadowRoom} H ${-shadowRoom} Z")`
    left.prepend(movingEdge)
    const previousBackingClip = backing.style.clipPath
    // Only the real right half remains exposed until the page has settled.
    backing.style.clipPath = `inset(${-shadowRoom}px ${-shadowRoom}px ${-shadowRoom}px ${boardHinge}px)`

    // These temporary inline properties are restored exactly on cleanup.
    const previous = { transformOrigin: left.style.transformOrigin, backfaceVisibility: left.style.backfaceVisibility }
    const previousBookOrigin = book.style.transformOrigin
    book.style.transformOrigin = 'center top'
    left.style.transformOrigin = 'right center'
    left.style.backfaceVisibility = 'hidden'
    const timing: KeyframeAnimationOptions = { duration: 1050, fill: 'both', easing: 'linear' }
    const rotations = (initial: number, final: number, perspective: number): Keyframe[] => [
      { transform: `perspective(${perspective}px) rotateY(${initial}deg)`, offset: 0, easing: 'cubic-bezier(.35,0,.3,1)' },
      { transform: `perspective(${perspective}px) rotateY(${final}deg)`, offset: 1 },
    ]
    // Backing paint is measured in its untransformed local coordinate system.
    const restoreBacking = isolateTransitionBacking({
      backing, sheet,
      cover: sheet.querySelector<HTMLElement>('.closed-catalogue__back-cover')!,
      paperRight: bounds.right,
    })
    const animations = [
      frame.animate(geometry.coverShift, timing),
      book.animate(geometry.bookShift, timing),
      sheet.animate(rotations(0, -180, geometry.coverPerspective), timing),
      // The real left page is the readable reverse surface, never a blank overlay.
      left.animate(rotations(180, 0, geometry.pagePerspective), timing),
      gutter.animate([
        { opacity: 0, offset: 0 }, { opacity: 0, offset: 0.7 }, { opacity: 1, offset: 1 },
      ], timing),
    ]
    let cancelled = false
    let scheduled = false
    let firstFrame = 0
    let finalFrame = 0
    const finish = () => {
      if (cancelled || scheduled) return
      scheduled = true
      firstFrame = requestAnimationFrame(() => {
        finalFrame = requestAnimationFrame(() => finishRef.current())
      })
    }
    void Promise.all(animations.map(animation => animation.finished)).then(finish).catch(() => {})
    const motion = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 760px)')
    const skip = () => { if (motion.matches) finishRef.current() }
    motion.addEventListener('change', skip)
    window.addEventListener('resize', finish)
    return () => {
      cancelled = true
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(finalFrame)
      motion.removeEventListener('change', skip)
      window.removeEventListener('resize', finish)
      animations.forEach(animation => animation.cancel())
      restoreBacking()
      // Swap the identical lip for the real board in the same cleanup, after
      // the completed rotation has been held across the existing frame boundary.
      backing.style.clipPath = previousBackingClip
      movingEdge.remove()
      Object.assign(left.style, previous)
      book.style.transformOrigin = previousBookOrigin
    }
  }, [closedRect])

  return (
    <div ref={rootRef} className="opening-transition" aria-hidden="true" inert>
      <div className="opening-transition__frame">
        <div className="opening-transition__sheet">
          <div className="opening-transition__front"><ClosedCatalogue onOpen={() => {}} showCityBookmark={false} /></div>
        </div>
      </div>
    </div>
  )
}

