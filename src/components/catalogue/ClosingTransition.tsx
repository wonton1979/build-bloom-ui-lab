import { useLayoutEffect, useRef } from 'react'
import { ClosedCatalogue } from './ClosedCatalogue'
import { startClosingTransition } from './closingTransitionMotion'
import './ClosingTransition.css'


export function ClosingTransition({ onComplete }: { onComplete: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const finishRef = useRef(onComplete)
  useLayoutEffect(() => { finishRef.current = onComplete }, [onComplete])
  useLayoutEffect(() => startClosingTransition(rootRef.current!, () => finishRef.current()), [])

  return (
    <div ref={rootRef} className="closing-transition" aria-hidden="true" inert>
      <div className="closing-transition__frame">
        <div className="closing-transition__sheet">
          <div className="closing-transition__front"><ClosedCatalogue onOpen={() => {}} showCityBookmark={false} /></div>
        </div>
      </div>
    </div>
  )
}
