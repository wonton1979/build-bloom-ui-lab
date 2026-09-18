import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import openingSpreadReference from './assets/reference/opening-spread-master.png'
import { CategoryCatalogue } from './components/catalogue/CategoryCatalogue'
import { ClosedCatalogue } from './components/catalogue/ClosedCatalogue'
import { OpeningTransition } from './components/catalogue/OpeningTransition'
import { ClosingTransition } from './components/catalogue/ClosingTransition'
import { BookShell } from './components/BookShell'
import type { CatalogueSpread } from './components/catalogue/catalogueSpread'
import './App.css'
import { AccountModal } from './components/homepage/AccountModal'
import { BookOwnedCart } from './components/catalogue/BookOwnedCart'
import { BookOwnedUser } from './components/catalogue/BookOwnedUser'

function App() {
  const [view, setView] = useState<'live' | 'reference'>('live')
  const [catalogueOpen, setCatalogueOpen] = useState(false)
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState<'turning' | 'landed' | null>(null)
  const [closedRect, setClosedRect] = useState<DOMRect | null>(null)
  const [spread, setSpread] = useState<CatalogueSpread>('categories-primary')
  const [accountOpen, setAccountOpen] = useState(false)
  const [guestHint, setGuestHint] = useState<'user' | 'cart' | null>(null)
  const guestHintTimer = useRef<number | null>(null)
  const pendingBookmarkHref = useRef<string | null>(null)
  const stageRef = useRef<HTMLElement>(null)
  const previousSpread = useRef(spread)
  const previouslyOpen = useRef(false)
  const showReference = import.meta.env.DEV && view === 'reference'
  const showGuestHint = (source: 'user' | 'cart') => {
    if (guestHintTimer.current !== null) window.clearTimeout(guestHintTimer.current)
    setGuestHint(source)
    guestHintTimer.current = window.setTimeout(() => {
      guestHintTimer.current = null
      setGuestHint(null)
    }, 5_000)
  }
  const dismissGuestHint = () => {
    if (guestHintTimer.current !== null) window.clearTimeout(guestHintTimer.current)
    guestHintTimer.current = null
    setGuestHint(null)
  }
  useEffect(() => () => {
    if (guestHintTimer.current !== null) window.clearTimeout(guestHintTimer.current)
  }, [])
  useLayoutEffect(() => {
    const stage = stageRef.current
    const page = stage?.querySelector<HTMLElement>('.book-shell__page--right')
    if (!stage || !page) return
    const measure = () => {
      const rect = page.getBoundingClientRect()
      stage.style.setProperty('--closed-page-width', `${rect.width}px`)
      stage.style.setProperty('--closed-page-height', `${rect.height}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(page)
    return () => observer.disconnect()
  }, [showReference, catalogueOpen])
  const openCatalogue = () => {
    if (catalogueOpen || opening || closing) return
    const measuredCover = stageRef.current?.querySelector('.closed-catalogue')?.getBoundingClientRect() ?? null
    setClosedRect(measuredCover)
    setCatalogueOpen(true)
    if (!measuredCover || window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 760px)').matches) return
    setOpening(true)
  }
  const finishOpening = () => {
    if (!opening) return
    setOpening(false)
    stageRef.current?.focus({ preventScroll: true })
    const href = pendingBookmarkHref.current
    pendingBookmarkHref.current = null
    if (href) window.location.assign(href)
  }
  const openCityBookmark = (href: string) => {
    pendingBookmarkHref.current = href
    openCatalogue()
    if (window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 760px)').matches) {
      window.requestAnimationFrame(() => {
        pendingBookmarkHref.current = null
        window.location.assign(href)
      })
    }
  }
  const closeCatalogue = () => {
    if (!catalogueOpen || opening || closing || spread !== 'categories-primary') return
    if (window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 760px)').matches) {
      setCatalogueOpen(false)
      return
    }
    setClosing('turning')
  }
  const finishClosing = () => {
    if (closing !== 'turning') return
    // Mount the actual closed cover beneath the settled overlay first.
    setCatalogueOpen(false)
    setClosing('landed')
  }
  useLayoutEffect(() => {
    if (closing !== 'landed') return
    const frame = requestAnimationFrame(() => setClosing(null))
    return () => cancelAnimationFrame(frame)
  }, [closing])
  useLayoutEffect(() => {
    if (!catalogueOpen && !closing) {
      // Restore keyboard access after closing without scrolling the tabletop.
      // Initial mounting intentionally leaves focus where the visitor put it.
      if (previouslyOpen.current) {
        stageRef.current?.querySelector<HTMLButtonElement>(':scope > .closed-catalogue .closed-catalogue__trigger')?.focus({ preventScroll: true })
      }
    }
    previouslyOpen.current = catalogueOpen || Boolean(closing)
  }, [catalogueOpen, closing])

  useEffect(() => {
    if (previousSpread.current === spread) return
    previousSpread.current = spread
    const stage = stageRef.current
    stage?.querySelectorAll('.book-shell__spread, .book-shell__content').forEach((page) => {
      page.scrollTop = 0
    })
    // Move focus into the new spread without moving the viewport or the book.
    stage?.focus({ preventScroll: true })
  }, [spread])

  const closeAccount = () => {
    setAccountOpen(false)
    requestAnimationFrame(() => stageRef.current?.querySelector<HTMLButtonElement>('.stage-user')?.focus({ preventScroll: true }))
  }

  return (
    <>
      {import.meta.env.DEV && (
        <div className="lab-review-controls" role="group" aria-label="Design review view">
          <span>UI Lab · Design review</span>
          <button type="button" aria-pressed={view === 'live'} onClick={() => setView('live')}>
            Live BookShell
          </button>
          <button type="button" aria-pressed={view === 'reference'} onClick={() => setView('reference')}>
            Opening Spread Reference
          </button>
        </div>
      )}
      {showReference ? (
        <main className="lab-reference-stage" aria-label="Opening spread design reference">
          <img
            src={openingSpreadReference}
            alt="Approved Build & Bloom desktop opening catalogue spread design reference"
          />
        </main>
      ) : (
        <main className="catalogue-stage" data-book-state={catalogueOpen || closing ? 'open' : 'closed'} aria-label="Catalogue" ref={stageRef} tabIndex={-1} inert={Boolean(closing) || accountOpen}>
          <div className="user-cart-group" aria-label="Catalogue tools">
            <BookOwnedUser
              onOpenAccount={() => { dismissGuestHint(); setAccountOpen(true) }}
              onGuestHint={() => showGuestHint('user')}
            />
            <BookOwnedCart onGuestClick={() => showGuestHint('cart')} />
            {guestHint && <button className="guest-cart-bubble" type="button" onClick={() => { dismissGuestHint(); setAccountOpen(true) }}>
              {guestHint === 'user' ? <>Hi! Sign in or<br />create an account.</> : <>Hi! Sign in to<br />use your cart.</>}
              <span aria-hidden="true" />
            </button>}
          </div>
          <div className="mobile-quick-controls" aria-label="Quick navigation">
            <button type="button" onClick={() => setAccountOpen(true)}>Account</button>
            <button type="button">Cart</button>
          </div>
          <span className="catalogue-spread-status" role="status">
            {spread === 'vehicles' ? 'Vehicles product spread' : spread === 'opening' ? 'Opening spread' : spread === 'categories-primary' ? 'Catalogue spread 1 of 2' : 'Catalogue spread 2 of 2'}
          </span>
            <div className="catalogue-stage__open-underlay" style={{ visibility: catalogueOpen ? 'visible' : 'hidden' }} aria-hidden={!catalogueOpen} inert={!catalogueOpen || opening}>
              {catalogueOpen ? <CategoryCatalogue
                spread={spread}
                onSpreadChange={setSpread}
                onClose={closeCatalogue}
              /> : <BookShell />}
            </div>
          {!catalogueOpen && <ClosedCatalogue onOpen={openCatalogue} onBookmark={openCityBookmark} />}
          {opening && closedRect && <OpeningTransition closedRect={closedRect} onAnimationEnd={finishOpening} />}
          {closing === 'turning' && (
            <div className="closing-transition__target" aria-hidden="true" inert>
              <ClosedCatalogue onOpen={() => {}} />
            </div>
          )}
          {closing && <ClosingTransition onComplete={finishClosing} />}
        </main>
      )}
      {!showReference && accountOpen && <AccountModal onClose={closeAccount} />}
    </>
  )
}

export default App


