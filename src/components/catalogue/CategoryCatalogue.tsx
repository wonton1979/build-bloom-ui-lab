import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { BookShell } from '../BookShell'
import { PageTurn } from './PageTurn'
import { OpeningWelcomePage } from './OpeningWelcomePage'
import { CatalogueIndexPage } from './CatalogueIndexPage'
import { FrontMatterContentsPage, FrontMatterWelcomePage } from './FrontMatterSpread'
import type { CatalogueCategory } from './categories'
import { catalogueCategories } from './categories'
import { CategoryOpeningPage } from './CategoryOpeningSpread'
import { CategoryLeaflet } from '../leaflet/CategoryLeaflet'
import { SearchLeaflet } from '../leaflet/SearchLeaflet'
import { useCatalogueSearch } from '../../features/catalogue/useCatalogueSearch'
import { useCategoryCatalogue } from '../../features/catalogue/useCategoryCatalogue'
import './CategoryCatalogue.css'
import type { CatalogueLeafletSide, CatalogueSpread } from './catalogueSpread'
import { categoryLocation, normalizeProductLocation, sameSpread, spreadAfterAction } from './catalogueSpread'
import { planProductSpreads } from '../../features/catalogue/productSpreads'
import { CatalogueProductDetails, VehiclesProductPage } from './VehiclesProductPage'
import type { ProductListing } from '../../features/catalogue/api'

export type { CatalogueSpread } from './catalogueSpread'

type CatalogueProps = {
  spread: CatalogueSpread
  onSpreadChange: (spread: CatalogueSpread) => void
  onClose: () => void
  onAddToCart?: (listing: ProductListing) => void
  leafletSide?: CatalogueLeafletSide | null
  onLeafletSideChange?: (side: CatalogueLeafletSide | null, settled?: boolean) => void
  onSpreadNormalize?: (spread: CatalogueSpread) => void
}

function CategoryEntry({ category, onCategory }: { category: CatalogueCategory; onCategory?: (slug: string) => void }) {
  return (
    <li>
      <a
        className="category-entry"
        href={category.href}
        onClick={onCategory ? (event) => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onCategory(category.id) } } : undefined}
        style={{
          '--category-colour': category.colour,
          '--category-image-scale': category.imageScale ?? 1,
        } as CSSProperties}
      >
        <span className="category-entry__art">
          <img
            src={category.image}
            alt=""
            width={category.imageWidth}
            height={category.imageHeight}
            decoding="async"
          />
        </span>
        <span className="category-entry__copy">
          <span className="category-entry__label">{category.label}</span>
          <span className="category-entry__tagline">{category.tagline}</span>
        </span>
        <span className="category-entry__arrow" aria-hidden="true">↗</span>
      </a>
    </li>
  )
}

export function CataloguePageContent({ categories, heading, start, onCategory }: {
  categories: readonly CatalogueCategory[]
  heading?: string
  start: number
  onCategory?: (slug: string) => void
}) {
  return (
    <nav className="category-page" aria-label={heading ?? 'Catalogue categories continued'}>
      {heading && (
        <div className="category-page__heading">
          <h2>{heading}</h2>
          <p>Build. Play. Collect. Bloom.</p>
        </div>
      )}
      <ol className="category-page__entries" start={start}>
        {categories.map((category) => <CategoryEntry key={category.id} category={category} onCategory={onCategory} />)}
      </ol>
    </nav>
  )
}

import { cataloguePages } from './cataloguePages'

const [pageOne, pageTwo, pageThree, pageFour] = cataloguePages

type SearchDetails = { kind: 'search-details'; listingId: number }
type PresentedSpread = CatalogueSpread | SearchDetails
const isSearchDetails = (location: PresentedSpread): location is SearchDetails => typeof location !== 'string' && location.kind === 'search-details'
const sameLocation = (a: PresentedSpread, b: PresentedSpread) => isSearchDetails(a) || isSearchDetails(b)
  ? isSearchDetails(a) && isSearchDetails(b) && a.listingId === b.listingId : sameSpread(a, b)

/** The same shell persists; category and product turns share one coordinator. */
export function CategoryCatalogue({ spread, onSpreadChange, onClose, onAddToCart, leafletSide: controlledLeafletSide, onLeafletSideChange, onSpreadNormalize }: CatalogueProps) {
  const [turn, setTurn] = useState<{ direction: 'forward' | 'backward'; from: PresentedSpread; to: PresentedSpread } | null>(null)
  const search = useCatalogueSearch()
  const [searchSession, setSearchSession] = useState<{ opener: HTMLElement | null; scrollTop: number; focusListingId?: number } | null>(null)
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchDetails, setSearchDetails] = useState<SearchDetails | null>(null)
  // Load the incoming category during its turn; retain outgoing data through handoff.
  const dataLocation = typeof spread !== 'string' ? spread : turn ? typeof turn.to !== 'string' ? turn.to : turn.from : spread
  const dataSpread = isSearchDetails(dataLocation) ? spread : dataLocation
  const origin = typeof dataSpread !== 'string' ? dataSpread.kind === 'details' ? dataSpread.returnTo : dataSpread : undefined
  const categoryOrigin = origin ? origin.kind === 'category' ? origin : categoryLocation(origin.slug) : undefined
  const categoryName = catalogueCategories.find(category => category.id === categoryOrigin?.slug)?.label
  const { state: categoryState, retry: retryCategory } = useCategoryCatalogue(categoryName)
  const [internalLeafletSide, setInternalLeafletSide] = useState<CatalogueLeafletSide | null>(null)
  const leafletSide = controlledLeafletSide === undefined ? internalLeafletSide : controlledLeafletSide
  const setLeaflet = (side: CatalogueLeafletSide | null, settled = true) => {
    if (controlledLeafletSide === undefined) setInternalLeafletSide(side)
    onLeafletSideChange?.(side, settled)
  }
  const listings = categoryState.status === 'ready' ? categoryState.listings : []
  const displayCategoryName = categoryState.status === 'ready' ? categoryState.category.name : categoryName ?? 'Collection'
  const productSpreads = planProductSpreads(listings)
  const current: PresentedSpread = searchDetails ?? (typeof spread !== 'string' && spread.kind === 'products'
    ? { ...spread, index: Math.max(0, Math.min(spread.index, productSpreads.length - 1)) }
    : spread)
  useEffect(() => {
    if (typeof spread === 'string' || spread.kind !== 'products' || categoryState.status !== 'ready') return
    const normalized = normalizeProductLocation(spread, productSpreads.length)
    if (!sameSpread(normalized, spread)) (onSpreadNormalize ?? onSpreadChange)(normalized)
  }, [categoryState.status, onSpreadChange, onSpreadNormalize, productSpreads.length, spread])
  const locked = useRef(false)
  const unlockFrame = useRef<number | null>(null)
  useEffect(() => () => { if (unlockFrame.current !== null) cancelAnimationFrame(unlockFrame.current) }, [])

  const commitSpread = (next: PresentedSpread) => {
    if (isSearchDetails(next)) setSearchDetails(next)
    else if (isSearchDetails(current)) setSearchDetails(null)
    else onSpreadChange(next)
  }
  const beginTurn = (direction: 'forward' | 'backward', next: PresentedSpread) => {
    if (locked.current || sameLocation(next, current)) return
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      commitSpread(next)
      if (isSearchDetails(current)) setSearchVisible(true)
      return
    }
    locked.current = true
    setTurn({ direction, from: current, to: next })
  }
  const finishTurn = () => {
    if (!turn) return
    commitSpread(turn.to)
    // Hold the frozen faces through the React handoff, as in the category turn.
    unlockFrame.current = window.requestAnimationFrame(() => {
      setTurn(null)
      locked.current = false
      unlockFrame.current = null
      if (isSearchDetails(turn.from)) setSearchVisible(true)
    })
  }
  const emptyProductPage = (location: PresentedSpread, side: 'left' | 'right') =>
    typeof location !== 'string' && location.kind === 'products' && categoryState.status === 'ready' && !productSpreads[location.index]?.[side].length

  const openSearch = () => {
    if (locked.current || searchVisible) return
    search.reset()
    setSearchSession({ opener: document.activeElement as HTMLElement | null, scrollTop: 0 })
    setSearchVisible(true)
  }
  const pageContent = (location: PresentedSpread, side: 'left' | 'right') => {
    if (typeof location !== 'string') {
      if (location.kind === 'search-details') return <CatalogueProductDetails side={side} listing={search.state.status === 'results' ? search.state.data.items.find(item => item.id === location.listingId) : undefined} onAddToCart={onAddToCart} />
      if (location.kind === 'details') return <CatalogueProductDetails side={side} listing={listings.find(item => item.id === location.listingId)} onAddToCart={onAddToCart} />
      if (location.kind === 'category') return <CategoryOpeningPage side={side} state={categoryState} onRetry={retryCategory} onLeaflet={() => { if (!locked.current) setLeaflet('front') }} onDetails={listingId => beginTurn('forward', { kind: 'details', listingId, returnTo: location })} />
      return <VehiclesProductPage side={side} spread={productSpreads[location.index]} status={categoryState.status} categoryName={displayCategoryName} onRetry={retryCategory}
        onViewDetails={(listingId) => beginTurn('forward', { kind: 'details', listingId, returnTo: location })} />
    }
    if (location === 'opening') return side === 'left' ? <OpeningWelcomePage /> : <CatalogueIndexPage />
    if (location === 'front-matter') return side === 'left' ? <FrontMatterWelcomePage /> : <FrontMatterContentsPage onCatalogue={() => beginTurn('forward', 'categories-primary')} onSearch={openSearch} turning={Boolean(turn)} />
    const primary = location === 'categories-primary'
    return <CataloguePageContent categories={side === 'left' ? (primary ? pageOne : pageThree) : (primary ? pageTwo : pageFour)}
      heading={side === 'left' ? (primary ? 'Our Catalogue' : 'More little worlds') : undefined}
      start={side === 'left' ? (primary ? 1 : 8) : (primary ? 4 : 11)}
      onCategory={slug => beginTurn('forward', categoryLocation(slug))} />
  }
  const pageClass = (location: PresentedSpread, side: 'left' | 'right') => {
    const category = typeof location !== 'string' && location.kind === 'category'
    const product = typeof location !== 'string' && !category
    const next = isSearchDetails(location) ? location : spreadAfterAction(location, 'forward', productSpreads.length)
    const navigation = side === 'left' || !sameLocation(location, next)
    return `spread-page${side === 'right' ? ' spread-page--right' : ''}${category ? ' spread-page--category-opening' : ''}${location === 'front-matter' ? ' spread-page--front-matter' : ''}${location === 'opening' && side === 'left' ? ' spread-page--welcome' : ''}${product ? ' spread-page--vehicles' : ''}${product && navigation ? ' spread-page--product-navigation' : ''}`
  }
  // Navigation participates in the editorial page's flex layout. Turning faces
  // must include the same row as live pages, not just their main content.
  const pageNavigation = (location: PresentedSpread, side: 'left' | 'right') => {
    if (isSearchDetails(location)) return side === 'left' ? <div className="spread-page__navigation"><button type="button" disabled={Boolean(turn)} onClick={() => beginTurn('backward', spread)}>← Back to Search Results</button></div> : null
    const categoryOpening = typeof location !== 'string' && location.kind === 'category'
    if (side === 'left') {
      if (location === 'opening') return null
      const backToCategory = typeof location !== 'string' && (location.kind === 'details' || location.kind === 'products' && location.index === 0)
      const label = backToCategory ? `← Back to ${displayCategoryName}` : categoryOpening ? '← Back to Categories' : location === 'categories-primary' ? '← Back to Contents' : '← Back'
      return <div className="spread-page__navigation">
        {location === 'front-matter'
          ? <button type="button" disabled={Boolean(turn)} onClick={onClose}>← Close Book</button>
          : <button type="button" disabled={Boolean(turn)} onClick={() => beginTurn('backward', spreadAfterAction(location, 'backward', productSpreads.length))}>{label}</button>}
      </div>
    }
    const forward = spreadAfterAction(location, 'forward', productSpreads.length)
    if (location === 'front-matter' || location === 'categories-more' || sameSpread(location, forward)) return null
    return <div className="spread-page__navigation">
      <button type="button" disabled={Boolean(turn)} onClick={() => beginTurn('forward', forward)}>
        {categoryOpening ? 'Continue in the storybook →' : typeof location !== 'string' ? `More ${displayCategoryName} →` : location === 'opening' ? 'Discover all 13 worlds →' : 'More →'}
      </button>
    </div>
  }
  const frozenPage = (location: PresentedSpread, side: 'left' | 'right') => (
    emptyProductPage(location, side) ? null : <div className={pageClass(location, side)}>{pageContent(location, side)}{pageNavigation(location, side)}</div>
  )
  const source = turn?.from ?? current
  const left = turn?.direction === 'backward' ? turn.to : source
  const right = turn?.direction === 'forward' ? turn.to : source

  return (
    <>
      {typeof current !== 'string' && current.kind === 'products' && <span className="catalogue-spread-status" role="status">
        {displayCategoryName} product spread {current.index + 1} of {Math.max(1, productSpreads.length)}
      </span>}
      <BookShell
        leftPage={emptyProductPage(left, 'left') ? null : <div className={pageClass(left, 'left')} data-product-index={typeof current !== 'string' && current.kind === 'products' ? current.index : undefined}>
          {pageContent(left, 'left')}
          {pageNavigation(current, 'left')}
        </div>}
        rightPage={emptyProductPage(right, 'right') ? null : <div className={pageClass(right, 'right')}>
          {pageContent(right, 'right')}
          {pageNavigation(current, 'right')}
        </div>}
        pageTurn={turn ? <PageTurn direction={turn.direction} onComplete={finishTurn}
          front={frozenPage(turn.from, turn.direction === 'forward' ? 'right' : 'left')}
          back={frozenPage(turn.to, turn.direction === 'forward' ? 'left' : 'right')} /> : null}
      />
      {leafletSide && categoryOrigin && categoryState.status === 'ready' && createPortal(<CategoryLeaflet category={categoryState.category} listings={categoryState.listings} side={leafletSide}
        onSideChange={setLeaflet} onClose={() => setLeaflet(null)} onDetails={listingId => { setLeaflet(null); beginTurn('forward', { kind: 'details', listingId, returnTo: categoryOrigin }) }} />, document.body)}
      {searchVisible && searchSession && createPortal(<SearchLeaflet search={search} session={searchSession}
        onClose={() => { setSearchVisible(false); setSearchSession(null); search.reset() }}
        onDetails={(listingId, scrollTop) => {
          setSearchSession({ ...searchSession, scrollTop, focusListingId: listingId })
          setSearchVisible(false)
          beginTurn('forward', { kind: 'search-details', listingId })
        }} />, document.body)}
    </>
  )
}
