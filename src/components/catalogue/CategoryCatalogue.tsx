import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { BookShell } from '../BookShell'
import { PageTurn } from './PageTurn'
import { OpeningWelcomePage } from './OpeningWelcomePage'
import { CatalogueIndexPage } from './CatalogueIndexPage'
import type { CatalogueCategory } from './categories'
import './CategoryCatalogue.css'
import type { CatalogueSpread } from './catalogueSpread'
import { productLocation, sameSpread, spreadAfterAction } from './catalogueSpread'
import { planProductSpreads } from '../../features/catalogue/productSpreads'
import { CatalogueProductDetails, VehiclesProductPage } from './VehiclesProductPage'
import { useVehicles } from '../../features/catalogue/useVehicles'

export type { CatalogueSpread } from './catalogueSpread'

type CatalogueProps = {
  spread: CatalogueSpread
  onSpreadChange: (spread: CatalogueSpread) => void
  onClose: () => void
}

function CategoryEntry({ category, onVehicles }: { category: CatalogueCategory; onVehicles?: () => void }) {
  return (
    <li>
      <a
        className="category-entry"
        href={category.href}
        onClick={category.id === 'vehicles' && onVehicles ? (event) => { event.preventDefault(); onVehicles() } : undefined}
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

export function CataloguePageContent({ categories, heading, start, onVehicles }: {
  categories: readonly CatalogueCategory[]
  heading?: string
  start: number
  onVehicles?: () => void
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
        {categories.map((category) => <CategoryEntry key={category.id} category={category} onVehicles={onVehicles} />)}
      </ol>
    </nav>
  )
}

import { cataloguePages } from './cataloguePages'

const [pageOne, pageTwo, pageThree, pageFour] = cataloguePages

/** The same shell persists; category and product turns share one coordinator. */
export function CategoryCatalogue({ spread, onSpreadChange, onClose }: CatalogueProps) {
  const productsOpen = typeof spread !== 'string'
  const { state: vehiclesState, retry } = useVehicles(productsOpen)
  const listings = vehiclesState.status === 'ready' ? vehiclesState.listings : []
  const productSpreads = planProductSpreads(listings)
  const current: CatalogueSpread = typeof spread !== 'string' && spread.kind === 'products'
    ? { ...spread, index: Math.max(0, Math.min(spread.index, productSpreads.length - 1)) }
    : spread
  const [turn, setTurn] = useState<{ direction: 'forward' | 'backward'; from: CatalogueSpread; to: CatalogueSpread } | null>(null)
  const locked = useRef(false)
  const unlockFrame = useRef<number | null>(null)
  useEffect(() => () => { if (unlockFrame.current !== null) cancelAnimationFrame(unlockFrame.current) }, [])

  const navigate = (next: CatalogueSpread) => {
    if (!locked.current) onSpreadChange(next)
  }
  const beginTurn = (direction: 'forward' | 'backward', next: CatalogueSpread) => {
    if (locked.current || sameSpread(next, current)) return
    if (current === 'opening' || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

  const pageContent = (location: CatalogueSpread, side: 'left' | 'right') => {
    if (typeof location !== 'string') {
      if (location.kind === 'details') return <CatalogueProductDetails side={side} listing={listings.find(item => item.id === location.listingId)} />
      return <VehiclesProductPage side={side} spread={productSpreads[location.index]} status={vehiclesState.status} onRetry={retry}
        onViewDetails={(listingId) => navigate({ kind: 'details', listingId, returnTo: location })} />
    }
    if (location === 'opening') return side === 'left' ? <OpeningWelcomePage /> : <CatalogueIndexPage />
    const primary = location === 'categories-primary'
    return <CataloguePageContent categories={side === 'left' ? (primary ? pageOne : pageThree) : (primary ? pageTwo : pageFour)}
      heading={side === 'left' ? (primary ? 'Our Catalogue' : 'More little worlds') : undefined}
      start={side === 'left' ? (primary ? 1 : 8) : (primary ? 4 : 11)}
      onVehicles={() => navigate(productLocation())} />
  }
  const pageClass = (location: CatalogueSpread, side: 'left' | 'right') => {
    const product = typeof location !== 'string'
    const next = spreadAfterAction(location, 'forward', productSpreads.length)
    const navigation = side === 'left' || !sameSpread(location, next)
    return `spread-page${side === 'right' ? ' spread-page--right' : ''}${location === 'opening' && side === 'left' ? ' spread-page--welcome' : ''}${product ? ' spread-page--vehicles' : ''}${product && navigation ? ' spread-page--product-navigation' : ''}`
  }
  const frozenPage = (location: CatalogueSpread, side: 'left' | 'right') => (
    <div className={pageClass(location, side)}>{pageContent(location, side)}</div>
  )
  const source = turn?.from ?? current
  const left = turn?.direction === 'backward' ? turn.to : source
  const right = turn?.direction === 'forward' ? turn.to : source
  const backLabel = details ? '← Back to Vehicles' : firstProduct ? '← Back to Categories' : '← Back'

  return (
    <>
      {typeof current !== 'string' && current.kind === 'products' && <span className="catalogue-spread-status" role="status">
        Vehicles product spread {current.index + 1} of {Math.max(1, productSpreads.length)}
      </span>}
      <BookShell
        leftPage={<div className={pageClass(left, 'left')} data-product-index={typeof current !== 'string' && current.kind === 'products' ? current.index : undefined}>
          {pageContent(left, 'left')}
          {current !== 'opening' && <div className="spread-page__navigation">
            {current === 'categories-primary'
              ? <button type="button" disabled={Boolean(turn)} onClick={onClose}>← Close Book</button>
              : <button type="button" disabled={Boolean(turn)} onClick={() => firstProduct || details ? navigate(backward) : beginTurn('backward', backward)}>{backLabel}</button>}
          </div>}
        </div>}
        rightPage={<div className={pageClass(right, 'right')}>
          {pageContent(right, 'right')}
          {hasForward && <div className="spread-page__navigation">
            <button type="button" disabled={Boolean(turn)} onClick={() => beginTurn('forward', forward)}>
              {typeof current !== 'string' ? 'More Vehicles →' : current === 'opening' ? 'Discover all 13 worlds →' : 'More →'}
            </button>
          </div>}
        </div>}
        pageTurn={turn ? <PageTurn direction={turn.direction} onComplete={finishTurn}
          front={frozenPage(turn.from, turn.direction === 'forward' ? 'right' : 'left')}
          back={frozenPage(turn.to, turn.direction === 'forward' ? 'left' : 'right')} /> : null}
      />
    </>
  )
}
