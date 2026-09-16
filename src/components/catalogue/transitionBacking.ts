/** The rotating closed shell and the exposed book body share one bottom edge.
 * Occlude only redundant board paint; never clip or animate its contact shadow.
 */
export function isolateTransitionBacking({ backing, sheet, cover, paperRight }: {
  backing: HTMLElement
  sheet: HTMLElement
  cover: HTMLElement
  paperRight: number
}) {
  const bounds = backing.getBoundingClientRect()
  const style = getComputedStyle(backing)
  const shadows = style.boxShadow.split(/,(?![^()]*\))/)
  const isSolidEdge = (shadow: string) => {
    const lengths = shadow.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g)?.map(parseFloat) ?? []
    return (lengths[2] ?? 0) === 0
  }
  const paint = document.createElement('div')
  paint.className = 'transition-backing-paint'
  paint.setAttribute('aria-hidden', 'true')
  Object.assign(paint.style, {
    position: 'absolute', pointerEvents: 'none',
    left: `${-backing.clientLeft}px`, top: `${-backing.clientTop}px`,
    width: `${bounds.width}px`, height: `${bounds.height}px`,
    background: style.background, border: style.border,
    borderRadius: style.borderRadius, boxSizing: style.boxSizing,
    boxShadow: shadows.filter(isSolidEdge).join(',') || 'none',
  })
  const previous = {
    background: backing.style.background, borderColor: backing.style.borderColor,
    boxShadow: backing.style.boxShadow,
  }
  const contactShadow = shadows.filter(shadow => !isSolidEdge(shadow)).join(',') || 'none'
  // Contact shadow needs its own occlusion surface: leaving it on the parent
  // casts a second, hard-starting band below the old open-board silhouette.
  const contact = document.createElement('div')
  contact.className = 'transition-contact-shadow'
  contact.setAttribute('aria-hidden', 'true')
  Object.assign(contact.style, {
    position: 'absolute', pointerEvents: 'none',
    left: `${-backing.clientLeft}px`, top: `${-backing.clientTop}px`,
    width: `${bounds.width}px`, height: `${bounds.height}px`,
    borderRadius: style.borderRadius, boxShadow: contactShadow,
  })
  backing.prepend(paint)
  backing.prepend(contact)
  Object.assign(backing.style, { background: 'transparent', borderColor: 'transparent', boxShadow: 'none' })

  const room = Math.max(bounds.width, bounds.height)
  const rightInset = bounds.right - paperRight
  const shadowReach = Math.max(0, ...shadows.filter(shadow => !isSolidEdge(shadow)).map(shadow => {
    const lengths = shadow.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g)?.map(parseFloat) ?? []
    return Math.abs(lengths[0] ?? 0) + (lengths[2] ?? 0) + Math.max(0, lengths[3] ?? 0)
  }))
  let frame = 0
  const update = () => {
    // Read the existing transform, without supplying a second motion timeline.
    // Once edge-on, the front shell is culled and the real backing owns the lip.
    const frontVisible = new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m11 > 0
    if (frontVisible) {
      const board = backing.getBoundingClientRect()
      const projected = cover.getBoundingClientRect()
      const scale = board.width / bounds.width
      const start = (projected.left - board.left) / scale
      const coveredRight = (projected.right - board.left) / scale
      const coversPaper = coveredRight >= bounds.width - rightInset
      const end = coversPaper ? bounds.width + room : coveredRight
      // The closed shell owns the covered column, including its solid extrusion
      // shadow and outer lip. Do not leave a second rim at its lower corners.
      paint.style.clipPath = `path(evenodd, "M ${-room} ${-room} H ${bounds.width + room} `
        + `V ${bounds.height + room} H ${-room} Z `
        + `M ${start} ${-room} H ${end} V ${bounds.height + room} H ${start} Z")`
      // The front shell already casts the contact shadow in the covered area.
      // Only its uncovered neighbour contributes; feathering is confined to
      // soft shadow paint and never changes a solid edge or motion timeline.
      contact.style.maskImage = coversPaper ? 'linear-gradient(transparent, transparent)'
        : `linear-gradient(to right, transparent ${coveredRight}px, black ${coveredRight + shadowReach}px)`
    } else {
      paint.style.clipPath = 'none'
      contact.style.maskImage = 'none'
    }
    frame = requestAnimationFrame(update)
  }
  update()
  return () => {
    cancelAnimationFrame(frame)
    paint.remove()
    contact.remove()
    Object.assign(backing.style, previous)
  }
}
