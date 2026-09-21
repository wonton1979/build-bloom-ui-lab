import { useEffect, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { LeafletActions } from './LeafletActions'
import './CategoryLeaflet.css'

type Leave = (complete: () => void) => Promise<void>

/** Shared paper/dialog lifecycle; category turnover remains owned by CategoryLeaflet. */
export function LeafletShell({ children, onClose, sheetRef, side, categoryId, busy = false, search = false, onReady, returnFocus }: {
  children: ReactNode
  onClose: () => void
  sheetRef?: Ref<HTMLDivElement>
  side?: 'front' | 'back'
  categoryId?: number
  busy?: boolean
  search?: boolean
  onReady?: (dialog: HTMLDialogElement) => void
  returnFocus?: HTMLElement | null | (() => HTMLElement | null)
}) {
  const [closing, setClosing] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const presenceAnimation = useRef<Animation | null>(null)
  const leaving = useRef(false)
  const disposed = useRef(false)
  const initial = useRef({ onReady, returnFocus })
  useEffect(() => {
    disposed.current = false
    const opener = initial.current.returnFocus ?? document.activeElement as HTMLElement | null
    const element = dialog.current!
    element.showModal()
    initial.current.onReady?.(element)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      presenceAnimation.current = element.animate([
        { opacity: 0, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 220, easing: 'ease-out' })
    }
    return () => {
      disposed.current = true
      presenceAnimation.current?.cancel()
      element.close()
      const target = typeof opener === 'function' ? opener() : opener
      if (target?.isConnected) target.focus({ preventScroll: true })
    }
  }, [])
  const leave: Leave = async complete => {
    if (leaving.current || disposed.current) return
    leaving.current = true
    setClosing(true)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const element = dialog.current!
      const { opacity, transform } = getComputedStyle(element)
      presenceAnimation.current?.cancel()
      presenceAnimation.current = element.animate([
        { opacity, transform },
        { opacity: 0, transform: 'translateY(5px)' },
      ], { duration: 220, easing: 'ease-out', fill: 'forwards' })
      try { await presenceAnimation.current.finished } catch { return }
    }
    if (!disposed.current) complete()
  }
  return <dialog ref={dialog} className={search ? 'leaflet-dialog search-leaflet-dialog' : 'leaflet-dialog'} data-closing={closing || undefined} aria-labelledby="leaflet-title"
    onKeyDownCapture={search ? event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); void leave(onClose) } } : undefined}
    onCancel={event => { event.preventDefault(); void leave(onClose) }}>
    <div ref={sheetRef} className={search ? 'leaflet search-leaflet' : 'leaflet'} data-side={side} data-category-id={categoryId} aria-busy={busy || closing} inert={closing}>
      <div className="leaflet__toolbar"><button type="button" onClick={() => void leave(onClose)}>← Back to the storybook</button><button type="button" aria-label="Close leaflet" onClick={() => void leave(onClose)}>×</button></div>
      <LeafletActions.Provider value={{ leave, closing }}>{children}</LeafletActions.Provider>
    </div>
  </dialog>
}
