import { isolateTransitionBacking } from './transitionBacking'
import { bookTransitionGeometry } from './bookTransitionGeometry'

/** Reverse the opening coordinate mapping while retaining the closing lifecycle. */
export function startClosingTransition(root: HTMLElement, onComplete: () => void) {
  const stage = root.parentElement!
  const target = stage.querySelector<HTMLElement>('.closing-transition__target .closed-catalogue')!
  const book = stage.querySelector<HTMLElement>('.book-shell')!
  const left = book.querySelector<HTMLElement>('.book-shell__page--left')!
  const backing = book.querySelector<HTMLElement>('.book-shell__cover')!
  const gutter = book.querySelector<HTMLElement>('.book-shell__spine')!
  const frame = root.querySelector<HTMLElement>('.closing-transition__frame')!
  const sheet = root.querySelector<HTMLElement>('.closing-transition__sheet')!
  const closedRect = target.getBoundingClientRect()
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

  // The inside face is the actual left page. Its thin rounded hardcover lip
  // shares its transform; the stationary backing never exposes a blank board.
  const paperStyle = getComputedStyle(left)
  const paperDepth = Math.max(0, ...paperStyle.boxShadow
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
  movingEdge.className = 'closing-transition__moving-edge'
  movingEdge.setAttribute('aria-hidden', 'true')
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
  const shadowRoom = Math.max(backingBounds.width, backingBounds.height)
  const [cornerX, cornerY = cornerX] = paperStyle.borderBottomLeftRadius.split(' ').map(parseFloat)
  movingEdge.style.clipPath = `path("M ${-shadowRoom} ${-shadowRoom} H ${lipLeft} V ${lipBottom - cornerY} `
    + `A ${cornerX} ${cornerY} 0 0 0 ${lipLeft + cornerX} ${lipBottom} `
    + `H ${boardHinge} V ${backingBounds.height + shadowRoom} H ${-shadowRoom} Z")`
  left.prepend(movingEdge)
  const previousBackingClip = backing.style.clipPath
  backing.style.clipPath = `inset(${-shadowRoom}px ${-shadowRoom}px ${-shadowRoom}px ${boardHinge}px)`
  const previous = { transformOrigin: left.style.transformOrigin, backfaceVisibility: left.style.backfaceVisibility }
  const previousBookOrigin = book.style.transformOrigin
  book.style.transformOrigin = 'center top'
  left.style.transformOrigin = 'right center'
  left.style.backfaceVisibility = 'hidden'

  // Reverse the shared physical scale without changing either face's layout box.
  // Translation begins after the cover starts lifting.
  const timing: KeyframeAnimationOptions = { duration: 1050, fill: 'both', easing: 'linear', direction: 'reverse' }
  const rotations = (initial: number, final: number, perspective: number): Keyframe[] => [
    { transform: `perspective(${perspective}px) rotateY(${initial}deg)`, offset: 0, easing: 'cubic-bezier(.35,0,.3,1)' },
    { transform: `perspective(${perspective}px) rotateY(${final}deg)`, offset: 1 },
  ]
  const restoreBacking = isolateTransitionBacking({
    backing, sheet,
    cover: sheet.querySelector<HTMLElement>('.closed-catalogue__back-cover')!,
    paperRight: bounds.right,
  })
  const animations = [
    frame.animate(geometry.coverShift, timing),
    book.animate(geometry.bookShift, timing),
    sheet.animate(rotations(0, -180, geometry.coverPerspective), timing),
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
      finalFrame = requestAnimationFrame(onComplete)
    })
  }
  void Promise.all(animations.map(animation => animation.finished)).then(finish).catch(() => {})
  const motion = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 1199px)')
  const settle = () => {
    animations.forEach(animation => animation.finish())
    finish()
  }
  const skip = () => { if (motion.matches) settle() }
  motion.addEventListener('change', skip)
  window.addEventListener('resize', settle)
  return () => {
    cancelled = true
    cancelAnimationFrame(firstFrame)
    cancelAnimationFrame(finalFrame)
    motion.removeEventListener('change', skip)
    window.removeEventListener('resize', settle)
    animations.forEach(animation => animation.cancel())
    backing.style.clipPath = previousBackingClip
    restoreBacking()
    movingEdge.remove()
    Object.assign(left.style, previous)
    book.style.transformOrigin = previousBookOrigin
  }
}
