import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import openingSpreadReference from './assets/reference/opening-spread-master.png'
import { CategoryCatalogue } from './components/catalogue/CategoryCatalogue'
import { ClosedCatalogue } from './components/catalogue/ClosedCatalogue'
import { OpeningTransition } from './components/catalogue/OpeningTransition'
import { ClosingTransition } from './components/catalogue/ClosingTransition'
import { BookShell } from './components/BookShell'
import type { CatalogueSpread } from './components/catalogue/catalogueSpread'
import { catalogueLocationFromUrl, catalogueLocationHref, categorySpreadIndex, isCategoryIndexSpread } from './components/catalogue/catalogueSpread'
import type { CatalogueLeafletSide } from './components/catalogue/catalogueSpread'
import './App.css'
import { AccountModal } from './components/homepage/AccountModal'
import { CartModal } from './components/cart/CartModal'
import { ConditionConfirmationDialog } from './components/catalogue/ConditionConfirmationDialog'
import { CartItems } from './components/cart/CartItems'
import { Checkout } from './components/checkout/Checkout'
import { CustomerOrders } from './components/account/CustomerOrders'
import { VerifyEmail } from './components/account/VerifyEmail'
import { navigateCheckout } from './features/checkout/state'
import { BookOwnedCart } from './components/catalogue/BookOwnedCart'
import { BookOwnedUser } from './components/catalogue/BookOwnedUser'
import { CustomerInformationFallback } from './components/homepage/CustomerInformationFallback'
import { useAuth } from './features/auth/AuthProvider'
import { isSignedIn } from './features/auth/state'
import { useCart } from './features/cart/CartContext'
import type { ProductListingOffer } from './features/catalogue/api'
import { useCatalogueCategories } from './features/catalogue/useCatalogueCategories'
import { useConditionConfirmation } from './features/catalogue/useConditionConfirmation'
import { resolveCatalogueCategories } from './components/catalogue/categories'
import { USER_ACCOUNT_HINT, USER_WELCOME_GREETING_MS, USER_WELCOME_HINT_MS, welcomeGreeting } from './components/catalogue/userWelcome'

function App() {
  const [pathname, setPathname] = useState(() => typeof window === 'undefined' ? '/' : window.location.pathname)
  useEffect(() => {
    const update = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  const { state: backendCategoriesState, retry: retryBackendCategories } = useCatalogueCategories()
  const resolvedCategories = useMemo(() => backendCategoriesState.status === 'ready' ? resolveCatalogueCategories(backendCategoriesState.categories) : [], [backendCategoriesState])
  const [view] = useState<'live' | 'reference'>('live')
  const [initialLocation] = useState(() => typeof window !== 'undefined'
    ? catalogueLocationFromUrl(window.location.pathname, window.location.search)
    : { spread: 'front-matter' as CatalogueSpread, open: false, leafletSide: null })
  const [catalogueOpen, setCatalogueOpen] = useState(initialLocation.open)
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState<'turning' | 'landed' | null>(null)
  const [closedRect, setClosedRect] = useState<DOMRect | null>(null)
  const [spread, setSpread] = useState<CatalogueSpread>(initialLocation.spread)
  const [leafletSide, setLeafletSide] = useState<CatalogueLeafletSide | null>(initialLocation.leafletSide)
  const [accountInitialView, setAccountInitialView] = useState<'hub' | 'personal'>('hub')
  const [addressRevision, setAddressRevision] = useState(0)
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
  const { state: authState, logout } = useAuth()
  const { items: cartItems, refreshCart, addListing, isLoading: cartLoading, pendingItemIds } = useCart()
  const showReference = import.meta.env.DEV && view === 'reference'
  const showGuestHint = (source: 'user' | 'cart') => {
    if (guestHintTimer.current !== null) window.clearTimeout(guestHintTimer.current)
    setGuestHint(source)
    guestHintTimer.current = window.setTimeout(() => {
      guestHintTimer.current = null
      setGuestHint(null)
    }, 5_000)
  }
  const writeCatalogueLocation = (nextSpread: CatalogueSpread, nextLeafletSide: CatalogueLeafletSide | null, mode: 'push' | 'replace') => {
    if (typeof window === 'undefined') return
    const href = catalogueLocationHref(nextSpread, { open: true, leafletSide: nextLeafletSide })
    window.history[mode === 'push' ? 'pushState' : 'replaceState']({ catalogue: true }, '', href)
  }
  const changeSpread = (next: CatalogueSpread, mode: 'push' | 'replace' = 'push') => {
    writeCatalogueLocation(next, null, mode)
    setLeafletSide(null)
    setSpread(next)
  }
  const changeLeafletSide = (next: CatalogueLeafletSide | null, settled = true) => {
    if (settled) writeCatalogueLocation(spread, next, 'replace')
    setLeafletSide(next)
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
    setAccountInitialView('hub')
    cancelUserDialogue()
    dismissGuestHint()
    setAccountOpen(true)
  }
  const openAddresses = () => { openAccount(); setAccountInitialView('personal') }
  const openVerificationSignIn = () => {
    // Email verification does not authenticate: use the normal sign-in form.
    logout()
    window.history.pushState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
    openAccount()
  }
  const openCart = () => {
    if (!isSignedIn(authState)) { showGuestHint('cart'); return }
    cartOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dismissGuestHint()
    void refreshCart()
    setCartOpen(true)
  }
  const confirmConditionOffer = (offer: ProductListingOffer) => {
    if (!isSignedIn(authState)) { showGuestHint('cart'); return }
    void addListing(offer)
  }
  const conditionConfirmation = useConditionConfirmation(confirmConditionOffer)
  const addToCart = (offer: ProductListingOffer, productTitle: string) => {
    if (offer.condition === 'USED_LIKE_NEW') { conditionConfirmation.request(offer, productTitle); return }
    if (!isSignedIn(authState)) { showGuestHint('cart'); return }
    void addListing(offer)
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
    const restoreLocation = () => {
      const location = catalogueLocationFromUrl(window.location.pathname, window.location.search, backendCategoriesState.status === 'ready' ? resolvedCategories : undefined)
      setCatalogueOpen(location.open)
      setSpread(location.spread)
      setLeafletSide(location.leafletSide)
      setOpening(false)
      setClosing(null)
    }
    window.addEventListener('popstate', restoreLocation)
    return () => window.removeEventListener('popstate', restoreLocation)
  }, [backendCategoriesState.status, resolvedCategories])
  useEffect(() => {
    if (backendCategoriesState.status !== 'ready' || typeof window === 'undefined') return
    const frame = window.requestAnimationFrame(() => {
      const location = catalogueLocationFromUrl(window.location.pathname, window.location.search, resolvedCategories)
      setCatalogueOpen(location.open)
      setSpread(location.spread)
      setLeafletSide(location.leafletSide)
      if (!location.open && window.location.pathname.startsWith('/categories/')) window.history.replaceState({ catalogue: true }, '', '/')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [backendCategoriesState.status, resolvedCategories])
  useEffect(() => {
    if (authState.status !== 'signedOut') {
      if (guestHintTimer.current !== null) window.clearTimeout(guestHintTimer.current)
      guestHintTimer.current = null
      void Promise.resolve().then(() => setGuestHint(null))
    }
    if (previousAuthStatus.current === 'authenticating' && authState.status === 'authenticated') {
      startUserWelcome(authState.user.firstName)
    }
    previousAuthStatus.current = authState.status
  }, [authState])
  // Checkout replaces the stage DOM even when catalogueOpen stays false.
  // Re-measure the new stage when navigation brings the storefront back.
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
  }, [showReference, catalogueOpen, pathname])
  const openCatalogue = () => {
    if (catalogueOpen || opening || closing) return
    const measuredCover = stageRef.current?.querySelector('.closed-catalogue')?.getBoundingClientRect() ?? null
    setClosedRect(measuredCover)
    setCatalogueOpen(true)
    if (!pendingBookmarkHref.current) {
      writeCatalogueLocation('front-matter', null, 'push')
      setSpread('front-matter')
    }
    if (!measuredCover || window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 760px)').matches) return
    setOpening(true)
  }
  const finishOpening = () => {
    if (!opening) return
    setOpening(false)
    stageRef.current?.focus({ preventScroll: true })
    const href = pendingBookmarkHref.current
    pendingBookmarkHref.current = null
    if (href) { const destination = catalogueLocationFromUrl(href, '', backendCategoriesState.status === 'ready' ? resolvedCategories : undefined); changeSpread(destination.spread) }
  }
  const openCityBookmark = (href: string) => {
    pendingBookmarkHref.current = href
    openCatalogue()
    if (window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 760px)').matches) {
      window.requestAnimationFrame(() => {
        pendingBookmarkHref.current = null
        const destination = catalogueLocationFromUrl(href, '', backendCategoriesState.status === 'ready' ? resolvedCategories : undefined)
        changeSpread(destination.spread)
      })
    }
  }
  const closeCatalogue = () => {
    if (!catalogueOpen || opening || closing || spread !== 'front-matter') return
    if (window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 760px)').matches) {
      setCatalogueOpen(false)
      window.history.replaceState({ catalogue: true }, '', '/')
      return
    }
    setClosing('turning')
  }
  const finishClosing = () => {
    if (closing !== 'turning') return
    // Mount the actual closed cover beneath the settled overlay first.
    setCatalogueOpen(false)
    window.history.replaceState({ catalogue: true }, '', '/')
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
    if (accountInitialView === 'personal') setAddressRevision(value => value + 1)
    setAccountOpen(false)
    requestAnimationFrame(() => {
      const target = stageRef.current?.querySelector<HTMLButtonElement>('.stage-user') ?? document.querySelector<HTMLElement>('.checkout')
      target?.focus({ preventScroll: true })
    })
  }

  if (pathname === '/account/orders' || pathname.startsWith('/account/orders/')) return <>
    <div inert={accountOpen}><CustomerOrders path={pathname} onAccount={openAccount} onAuthenticate={() => { logout(); openAccount() }} /></div>
    {accountOpen && <AccountModal onClose={closeAccount} initialView={accountInitialView} />}
  </>

  if (pathname === '/verify-email' || pathname === '/checkout' || pathname.startsWith('/checkout/')) return <>
    <div inert={accountOpen}>{pathname === '/verify-email' ? <VerifyEmail onSignIn={openVerificationSignIn} /> : <Checkout key={`${pathname}:${authState.status === 'authenticated' ? authState.user.id : 'guest'}`} onAccount={openAccount} onAddresses={openAddresses} addressRevision={addressRevision} />}</div>
    {accountOpen && <AccountModal onClose={closeAccount} initialView={accountInitialView} />}
  </>

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
            {authState.status === 'signedOut' && guestHint && <button className="guest-cart-bubble" type="button" onClick={openAccount}>
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
            <button type="button" onClick={isSignedIn(authState) ? openCart : undefined}>Cart</button>
          </div>
          {!catalogueOpen && !opening && !closing && <CustomerInformationFallback />}
          <span className="catalogue-spread-status" role="status">
            {typeof spread !== 'string' ? (spread.kind === 'details' ? 'Product details' : '') : isCategoryIndexSpread(spread) ? `Catalogue spread ${categorySpreadIndex(spread) + 1} of ${Math.max(1, Math.ceil(Math.ceil(resolvedCategories.length / 3) / 2))}` : spread === 'front-matter' ? 'Welcome and Contents' : 'Opening spread'}
          </span>
            <div className="catalogue-stage__open-underlay" style={{ visibility: catalogueOpen ? 'visible' : 'hidden' }} aria-hidden={!catalogueOpen} inert={!catalogueOpen || opening}>
              {catalogueOpen ? <CategoryCatalogue
                spread={spread}
                backendCategoriesState={backendCategoriesState}
                onRetryCategories={retryBackendCategories}
                onSpreadChange={changeSpread}
                onSpreadNormalize={next => changeSpread(next, 'replace')}
                leafletSide={leafletSide}
                onLeafletSideChange={changeLeafletSide}
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
      {!showReference && conditionConfirmation.pending && <ConditionConfirmationDialog offer={conditionConfirmation.pending.offer} productTitle={conditionConfirmation.pending.productTitle}
        onCancel={conditionConfirmation.cancel} onConfirm={conditionConfirmation.confirm} />}
      {!showReference && accountOpen && <AccountModal onClose={closeAccount} initialView={accountInitialView} />}
      {!showReference && cartOpen && isSignedIn(authState) && <CartModal onClose={closeCart}
        content={cartItems.length ? { kind: 'filled', items: <CartItems items={cartItems} />, actions: <button className="cart-modal__action" disabled={cartLoading || pendingItemIds.length > 0} onClick={() => { setCartOpen(false); navigateCheckout('/checkout') }}>Checkout</button> } : { kind: 'empty' }} />}
    </>
  )
}

export default App
