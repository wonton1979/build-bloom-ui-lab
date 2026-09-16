type Bounds = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>

/** Map both representations through the same physical scale at the gutter.
 * Layout dimensions stay fixed; only the existing translation timeline maps
 * the closed presentation into the final open presentation.
 */
export function bookTransitionGeometry(closed: Bounds, book: Bounds, page: Bounds) {
  const scaleX = closed.width / page.width
  const scaleY = closed.height / page.height
  const dx = closed.left - (book.left + book.width / 2)
  const dy = closed.top - book.top
  const shift = (initialX: number, initialY: number, finalX: number, finalY: number): Keyframe[] => [
    {
      transform: `translate(${dx}px, ${dy}px) scale(${initialX}, ${initialY})`,
      offset: 0, easing: 'cubic-bezier(.25,.65,.3,1)',
    },
    { transform: `translate(0px, 0px) scale(${finalX}, ${finalY})`, offset: 0.72 },
    { transform: `translate(0px, 0px) scale(${finalX}, ${finalY})`, offset: 1 },
  ]
  // At every shared eased progress: closedSize * coverScale = pageSize * bookScale.
  // Top-of-gutter parent origins also keep the two rotating hinge centres aligned.
  return {
    coverShift: shift(1, 1, 1 / scaleX, 1 / scaleY),
    bookShift: shift(scaleX, scaleY, 1, 1),
    // Perspective is expressed in each rotating face's local coordinates.
    // Normalizing it makes front and back project to the same silhouette.
    coverPerspective: 2400 * scaleX,
    pagePerspective: 2400,
  }
}
