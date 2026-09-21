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
import { useCategoryCatalogue } from '../../features/catalogue/useCategoryCatalogue'
import './CategoryCatalogue.css'
import type { CatalogueSpread } from './catalogueSpread'
import { categoryLocation, sameSpread, spreadAfterAction } from './catalogueSpread'
import { planProductSpreads } from '../../features/catalogue/productSpreads'
import { CatalogueProductDetails, VehiclesProductPage } from './VehiclesProductPage'
import type { ProductListing } from '../../features/catalogue/api'

export type { CatalogueSpread } from './catalogueSpread'

type CatalogueProps = {
  spread: CatalogueSpread
  onSpreadChange: (spread: CatalogueSpread) => void
  onClose: () => void
  onAddToCart?: (listing: ProductListing) => void
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

/** The same shell persists; category and product turns share one coordinator. */
export function CategoryCatalogue({ spread, onSpreadChange, onClose, onAddToCart }: CatalogueProps) {
  const [turn, setTurn] = useState<{ direction: 'forward' | 'backward'; from: CatalogueSpread; to: CatalogueSpread } | null>(null)
  // Load the incoming category during its turn; retain outgoing data through handoff.
  const dataSpread = typeof spread !== 'string' ? spread : turn ? typeof turn.to !== 'string' ? turn.to : turn.from : spread
  const origin = typeof dataSpread !== 'string' ? dataSpread.kind === 'details' ? dataSpread.returnTo : dataSpread : undefined
  const categoryOrigin = origin ? origin.kind === 'category' ? origin : categoryLocation(origin.slug) : undefined
  const categoryName = catalogueCategories.find(category => category.id === categoryOrigin?.slug)?.label
  const { state: categoryState, retry: retryCategory } = useCategoryCatalogue(categoryName)
  const [leafletOpen, setLeafletOpen] = useState(false)
  const listings = categoryState.status === 'ready' ? categoryState.listings : []
  const displayCategoryName = categoryState.status === 'ready' ? categoryState.category.name : categoryName ?? 'Collection'
  const productSpreads = planProductSpreads(listings)
  const current: CatalogueSpread = typeof spread !== 'string' && spread.kind === 'products'
    ? { ...spread, index: Math.max(0, Math.min(spread.index, productSpreads.length - 1)) }
    : spread
  const locked = useRef(false)
  const unlockFrame = useRef<number | null>(null)
  useEffect(() => () => { if (unlockFrame.current !== null) cancelAnimationFrame(unlockFrame.current) }, [])

  const beginTurn = (direction: 'forward' | 'backward', next: CatalogueSpread) => {
    if (locked.current || sameSpread(next, current)) return
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onSpreadChange(next)
      return
    }
    locked.current = true
    setTurn({ direction, from: current, to: next })
  }
  const finishTurn = () => {
    if (!turn) return
    onSpreadChange(turn.to)
    // Hold the frozen faces through the React handoff, as in the category turn.
    unlockFrame.current = window.requestAnimationFrame(() => {
      setTurn(null)
      locked.current = false
      unlockFrame.current = null
    })
  }
  const forward = spreadAfterAction(current, 'forward', productSpreads.length)
  const backward = spreadAfterAction(current, 'backward', productSpreads.length)
  const hasForward = current !== 'categories-more' && !sameSpread(current, forward)
  const firstProduct = typeof current !== 'string' && current.kind === 'products' && current.index === 0
  const details = typeof current !== 'string' && current.kind === 'details'
  const emptyProductPage = (location: CatalogueSpread, side: 'left' | 'right') =>
    typeof location !== 'string' && location.kind === 'products' && categoryState.status === 'ready' && !productSpreads[location.index]?.[side].length

  const pageContent = (location: CatalogueSpread, side: 'left' | 'right') => {
    if (typeof location !== 'string') {
      if (location.kind === 'details') return <CatalogueProductDetails side={side} listing={listings.find(item => item.id === location.listingId)} onAddToCart={onAddToCart} />
      if (location.kind === 'category') return <CategoryOpeningPage side={side} state={categoryState} onRetry={retryCategory} onLeaflet={() => { if (!locked.current) setLeafletOpen(true) }} onDetails={listingId => beginTurn('forward', { kind: 'details', listingId, returnTo: location })} />
      return <VehiclesProductPage side={side} spread={productSpreads[location.index]} status={categoryState.status} categoryName={displayCategoryName} onRetry={retryCategory}
        onViewDetails={(listingId) => beginTurn('forward', { kind: 'details', listingId, returnTo: location })} />
    }
    if (location === 'opening') return side === 'left' ? <OpeningWelcomePage /> : <CatalogueIndexPage />
    if (location === 'front-matter') return side === 'left' ? <FrontMatterWelcomePage /> : <FrontMatterContentsPage onCatalogue={() => beginTurn('forward', 'categories-primary')} turning={Boolean(turn)} />
    const primary = location === 'categories-primary'
    return <CataloguePageContent categories={side === 'left' ? (primary ? pageOne : pageThree) : (primary ? pageTwo : pageFour)}
      heading={side === 'left' ? (primary ? 'Our Catalogue' : 'More little worlds') : undefined}
      start={side === 'left' ? (primary ? 1 : 8) : (primary ? 4 : 11)}
      onCategory={slug => beginTurn('forward', categoryLocation(slug))} />
  }
  const pageClass = (location: CatalogueSpread, side: 'left' | 'right') => {
    const category = typeof location !== 'string' && location.kind === 'category'
    const product = typeof location !== 'string' && !category
    const next = spreadAfterAction(location, 'forward', productSpreads.length)
    const navigation = side === 'left' || !sameSpread(location, next)
    return `spread-page${side === 'right' ? ' spread-page--right' : ''}${category ? ' spread-page--category-opening' : ''}${location === 'front-matter' ? ' spread-page--front-matter' : ''}${location === 'opening' && side === 'left' ? ' spread-page--welcome' : ''}${product ? ' spread-page--vehicles' : ''}${product && navigation ? ' spread-page--product-navigation' : ''}`
  }
  const frozenPage = (location: CatalogueSpread, side: 'left' | 'right') => (
    emptyProductPage(location, side) ? null : <div className={pageClass(location, side)}>{pageContent(location, side)}</div>
  )
  const source = turn?.from ?? current
  const left = turn?.direction === 'backward' ? turn.to : source
  const right = turn?.direction === 'forward' ? turn.to : source
  const categoryOpening = typeof current !== 'string' && current.kind === 'category'
  const backLabel = details || firstProduct ? `← Back to ${displayCategoryName}` : categoryOpening ? '← Back to Categories' : current === 'categories-primary' ? '← Back to Contents' : '← Back'

  return (
    <>
      {typeof current !== 'string' && current.kind === 'products' && <span className="catalogue-spread-status" role="status">
        {displayCategoryName} product spread {current.index + 1} of {Math.max(1, productSpreads.length)}
      </span>}
      <BookShell
        leftPage={emptyProductPage(left, 'left') ? null : <div className={pageClass(left, 'left')} data-product-index={typeof current !== 'string' && current.kind === 'products' ? current.index : undefined}>
          {pageContent(left, 'left')}
          {current !== 'opening' && <div className="spread-page__navigation">
            {current === 'front-matter'
              ? <button type="button" disabled={Boolean(turn)} onClick={onClose}>← Close Book</button>
              : <button type="button" disabled={Boolean(turn)} onClick={() => beginTurn('backward', backward)}>{backLabel}</button>}
          </div>}
        </div>}
        rightPage={emptyProductPage(right, 'right') ? null : <div className={pageClass(right, 'right')}>
          {pageContent(right, 'right')}
          {hasForward && current !== 'front-matter' && <div className="spread-page__navigation">
            <button type="button" disabled={Boolean(turn)} onClick={() => beginTurn('forward', forward)}>
              {categoryOpening ? 'Continue in the storybook →' : typeof current !== 'string' ? `More ${displayCategoryName} →` : current === 'opening' ? 'Discover all 13 worlds →' : 'More →'}
            </button>
          </div>}
        </div>}
        pageTurn={turn ? <PageTurn direction={turn.direction} onComplete={finishTurn}
          front={frozenPage(turn.from, turn.direction === 'forward' ? 'right' : 'left')}
          back={frozenPage(turn.to, turn.direction === 'forward' ? 'left' : 'right')} /> : null}
      />
      {leafletOpen && categoryOrigin && categoryState.status === 'ready' && createPortal(<CategoryLeaflet category={categoryState.category} listings={categoryState.listings}
        onClose={() => setLeafletOpen(false)} onDetails={listingId => { setLeafletOpen(false); beginTurn('forward', { kind: 'details', listingId, returnTo: categoryOrigin }) }} />, document.body)}
    </>
  )
}
