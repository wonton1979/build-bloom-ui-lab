import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import './PageTurn.css'

type PageTurnProps = {
  direction: 'forward' | 'backward'
  front: ReactNode
  back: ReactNode
  onComplete: () => void
}

/** One measured sheet; its two faces use the ordinary BookShell page layout. */
export function PageTurn({ direction, front, back, onComplete }: PageTurnProps) {
  const ref = useRef<HTMLDivElement>(null)
  const completeRef = useRef(onComplete)
  useLayoutEffect(() => { completeRef.current = onComplete }, [onComplete])

  useLayoutEffect(() => {
    const sheet = ref.current!
    const book = sheet.closest<HTMLElement>('.book-shell')!
    const side = direction === 'forward' ? 'right' : 'left'
    const source = book.querySelector<HTMLElement>(`.book-shell__spread > .book-shell__page--${side}`)!
    const pages = book.querySelector<HTMLElement>('.book-shell__spread')!
    const sourceBox = source.getBoundingClientRect()
    const bookBox = book.getBoundingClientRect()
    Object.assign(sheet.style, {
      left: `${sourceBox.left - bookBox.left}px`, top: `${sourceBox.top - bookBox.top}px`,
      width: `${sourceBox.width}px`, height: `${sourceBox.height}px`,
      transformOrigin: direction === 'forward' ? 'left center' : 'right center',
    })
    const wasInert = pages.inert
    pages.inert = true
    const fallback = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 760px)')
    const turn = sheet.animate([
      { transform: 'perspective(2400px) rotateY(0deg)' },
      { transform: `perspective(2400px) rotateY(${direction === 'forward' ? -180 : 180}deg)` },
    ], { duration: fallback.matches ? 0 : 760, easing: 'cubic-bezier(.35,0,.3,1)', fill: 'both' })
    const shade = sheet.querySelector<HTMLElement>('.catalogue-turn__shadow')!.animate([
      { opacity: 0, offset: 0 },
      { opacity: 0.16, offset: 0.45 },
      { opacity: 0.04, offset: 0.78 },
      { opacity: 0, offset: 1 },
    ], { duration: fallback.matches ? 0 : 760, fill: 'both' })
    let disposed = false
    let completed = false
    const complete = () => {
      if (disposed || completed) return
      completed = true
      completeRef.current()
    }
    // Keep the final transforms in place during the existing React handoff.
    void Promise.all([turn.finished, shade.finished]).then(complete).catch(() => {})
    const finishEarly = () => { turn.finish(); shade.finish() }
    const motionChanged = () => { if (fallback.matches) finishEarly() }
    window.addEventListener('resize', finishEarly)
    fallback.addEventListener('change', motionChanged)
    return () => {
      disposed = true
      window.removeEventListener('resize', finishEarly)
      fallback.removeEventListener('change', motionChanged)
      turn.cancel()
      shade.cancel()
      pages.inert = wasInert
    }
  }, [direction])

  const sourceSide = direction === 'forward' ? 'right' : 'left'
  const destinationSide = direction === 'forward' ? 'left' : 'right'
  return (
    <div ref={ref} className="catalogue-turn" aria-hidden="true" inert>
      <div className={`catalogue-turn__face book-shell__page book-shell__page--${sourceSide}`}>
        <div className="book-shell__content">{front}</div>
      </div>
      <div className={`catalogue-turn__face catalogue-turn__face--back book-shell__page book-shell__page--${destinationSide}`}>
        <div className="book-shell__content">{back}</div>
      </div>
      <div className="catalogue-turn__shadow" />
    </div>
  )
}
