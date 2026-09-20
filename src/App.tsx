import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import openingSpreadReference from './assets/reference/opening-spread-master.png'
import { CategoryCatalogue } from './components/catalogue/CategoryCatalogue'
import { ClosedCatalogue } from './components/catalogue/ClosedCatalogue'
import { OpeningTransition } from './components/catalogue/OpeningTransition'
import { ClosingTransition } from './components/catalogue/ClosingTransition'
import { BookShell } from './components/BookShell'
import type { CatalogueSpread } from './components/catalogue/catalogueSpread'
import { categoryFromPath } from './components/catalogue/catalogueSpread'
import './App.css'
import { AccountModal } from './components/homepage/AccountModal'
import { CartModal } from './components/cart/CartModal'
import { CartItems } from './components/cart/CartItems'
import { BookOwnedCart } from './components/catalogue/BookOwnedCart'
import { BookOwnedUser } from './components/catalogue/BookOwnedUser'
import { CustomerInformationFallback } from './components/homepage/CustomerInformationFallback'
import { useAuth } from './features/auth/AuthProvider'
import { useCart } from './features/cart/CartContext'
import type { ProductListing } from './features/catalogue/api'
import { USER_ACCOUNT_HINT, USER_WELCOME_GREETING_MS, USER_WELCOME_HINT_MS, welcomeGreeting } from './components/catalogue/userWelcome'

function App() {
  const [view] = useState<'live' | 'reference'>('live')
  const [catalogueOpen, setCatalogueOpen] = useState(() => typeof window !== 'undefined' && Boolean(categoryFromPath(window.location.pathname)))
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState<'turning' | 'landed' | null>(null)
  const [closedRect, setClosedRect] = useState<DOMRect | null>(null)
  const [spread, setSpread] = useState<CatalogueSpread>(() => typeof window !== 'undefined' ? categoryFromPath(window.location.pathname) ?? 'front-matter' : 'front-matter')
  const [accountOpen, setAccountOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [guestHint, setGuestHint] = useState<'user' | 'cart' | null>(null)
  const [userDialogue, setUserDialogue] = useState<string | null>(null)
  const guestHintTimer = useRef<number | null>(null)
  const userDialogueTimer = useRef<number | null>(null)
  const userDialogueRun = useRef(0)
  const pendingBookmarkHref = useRef<string | null>(null)
  const stageRef = useRef<HTMLElement>(null)
  const cartOpenerRef = useRef<HTMLElement | null>(null)
  const previousSpread = useRef(spread)
  const previouslyOpen = useRef(false)
  const previousAuthStatus = useRef<string | undefined>(undefined)
  const { state: authState } = useAuth()
  const { items: cartItems, addListing } = useCart()
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
  const cancelUserDialogue = () => {
    userDialogueRun.current += 1
    if (userDialogueTimer.current !== null) window.clearTimeout(userDialogueTimer.current)
    userDialogueTimer.current = null
    setUserDialogue(null)
  }
  const startUserWelcome = (firstName: string | null | undefined) => {
    const run = ++userDialogueRun.current
    if (userDialogueTimer.current !== null) window.clearTimeout(userDialogueTimer.current)
    setUserDialogue(welcomeGreeting(firstName))
    userDialogueTimer.current = window.setTimeout(() => {
      if (run !== userDialogueRun.current) return
      setUserDialogue(USER_ACCOUNT_HINT)
      userDialogueTimer.current = window.setTimeout(() => {
        if (run !== userDialogueRun.current) return
        userDialogueTimer.current = null
        setUserDialogue(null)
      }, USER_WELCOME_HINT_MS)
    }, USER_WELCOME_GREETING_MS)
  }
  const openAccount = () => {
    cancelUserDialogue()
    dismissGuestHint()
    setAccountOpen(true)
  }
  const openCart = () => {
    if (authState.status !== 'authenticated') { showGuestHint('cart'); return }
    cartOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dismissGuestHint()
    setCartOpen(true)
  }
  const addToCart = (listing: ProductListing) => {
    if (authState.status !== 'authenticated') { showGuestHint('cart'); return }
    addListing(listing)
  }
  const closeCart = useCallback(() => {
    setCartOpen(false)
    requestAnimationFrame(() => {
      const opener = cartOpenerRef.current
      if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true })
      else Array.from(stageRef.current?.querySelectorAll<HTMLElement>('.stage-cart, .mobile-quick-controls button:last-child') ?? [])
        .find(element => element.getClientRects().length > 0)?.focus({ preventScroll: true })
    })
  }, [])
  useEffect(() => () => {
    if (guestHintTimer.current !== null) window.clearTimeout(guestHintTimer.current)
    if (userDialogueTimer.current !== null) window.clearTimeout(userDialogueTimer.current)
    userDialogueRun.current += 1
  }, [])
  useEffect(() => {
    if (previousAuthStatus.current === 'authenticating' && authState.status === 'authenticated') {
      startUserWelcome(authState.user.firstName)
    }
    previousAuthStatus.current = authState.status
  }, [authState])
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
    if (href) { const destination = categoryFromPath(href); if (destination) setSpread(destination) }
  }
  const openCityBookmark = (href: string) => {
    pendingBookmarkHref.current = href
    openCatalogue()
    if (window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 760px)').matches) {
      window.requestAnimationFrame(() => {
        pendingBookmarkHref.current = null
        const destination = categoryFromPath(href)
        if (destination) setSpread(destination)
      })
    }
  }
  const closeCatalogue = () => {
    if (!catalogueOpen || opening || closing || spread !== 'front-matter') return
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
      {showReference ? (
        <main className="lab-reference-stage" aria-label="Opening spread design reference">
          <img
            src={openingSpreadReference}
            alt="Approved Build & Bloom desktop opening catalogue spread design reference"
          />
        </main>
      ) : (
        <main className="catalogue-stage" data-book-state={catalogueOpen || closing ? 'open' : 'closed'} aria-label="Catalogue" ref={stageRef} tabIndex={-1} inert={Boolean(closing) || accountOpen || cartOpen}>
          <div className="user-cart-group" aria-label="Catalogue tools">
            <BookOwnedUser
              onOpenAccount={openAccount}
              onGuestHint={() => { if (authState.status === 'signedOut') showGuestHint('user') }}
            />
            <BookOwnedCart onGuestClick={openCart} />
            {guestHint && <button className="guest-cart-bubble" type="button" onClick={openAccount}>
              {guestHint === 'user' ? <>Hi! Sign in or<br />create an account.</> : <>Hi! Sign in to<br />use your cart.</>}
              <span aria-hidden="true" />
            </button>}
            {userDialogue && <div className="guest-cart-bubble user-dialogue-bubble" role="status" aria-live="polite">
              {userDialogue}
              <span aria-hidden="true" />
            </div>}
          </div>
          <div className="mobile-quick-controls" aria-label="Quick navigation">
            <button type="button" onClick={openAccount}>Account</button>
            <button type="button" onClick={authState.status === 'authenticated' ? openCart : undefined}>Cart</button>
          </div>
          {!catalogueOpen && !opening && !closing && <CustomerInformationFallback />}
          <span className="catalogue-spread-status" role="status">
            {typeof spread !== 'string' ? (spread.kind === 'details' ? 'Product details' : '') : spread === 'front-matter' ? 'Welcome and Contents' : spread === 'opening' ? 'Opening spread' : spread === 'categories-primary' ? 'Catalogue spread 1 of 2' : 'Catalogue spread 2 of 2'}
          </span>
            <div className="catalogue-stage__open-underlay" style={{ visibility: catalogueOpen ? 'visible' : 'hidden' }} aria-hidden={!catalogueOpen} inert={!catalogueOpen || opening}>
              {catalogueOpen ? <CategoryCatalogue
                spread={spread}
                onSpreadChange={setSpread}
                onClose={closeCatalogue}
                onAddToCart={addToCart}
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
      {!showReference && cartOpen && authState.status === 'authenticated' && <CartModal onClose={closeCart}
        content={cartItems.length ? { kind: 'filled', items: <CartItems items={cartItems} /> } : { kind: 'empty' }} />}
    </>
  )
}

export default App


