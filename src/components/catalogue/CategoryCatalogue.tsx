import { useState } from 'react'
import type { CSSProperties } from 'react'
import { BookShell } from '../BookShell'
import { PageTurn } from './PageTurn'
import { OpeningWelcomePage } from './OpeningWelcomePage'
import { CatalogueIndexPage } from './CatalogueIndexPage'
import type { CatalogueCategory } from './categories'
import './CategoryCatalogue.css'
import type { CatalogueSpread } from './catalogueSpread'
import { spreadAfterAction } from './catalogueSpread'

export type { CatalogueSpread } from './catalogueSpread'

type CatalogueProps = {
  spread: CatalogueSpread
  onSpreadChange: (spread: CatalogueSpread) => void
  onClose: () => void
}

function CategoryEntry({ category }: { category: CatalogueCategory }) {
  return (
    <li>
      <a
        className="category-entry"
        href={category.href}
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

export function CataloguePageContent({ categories, heading, start }: {
  categories: readonly CatalogueCategory[]
  heading?: string
  start: number
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
        {categories.map((category) => <CategoryEntry key={category.id} category={category} />)}
      </ol>
    </nav>
  )
}

import { cataloguePages } from './cataloguePages'

const [pageOne, pageTwo, pageThree, pageFour] = cataloguePages

/** The same shell persists; only its two content slots change. */
export function CategoryCatalogue({ spread, onSpreadChange, onClose }: CatalogueProps) {
  const opening = spread === 'opening'
  const primary = spread === 'categories-primary'
  const back = spreadAfterAction(spread, 'backward')
  const forward = spreadAfterAction(spread, 'forward')
  const [turn, setTurn] = useState<'forward' | 'backward' | null>(null)
  const beginTurn = (direction: 'forward' | 'backward', next: CatalogueSpread) => {
    if (turn || next === spread) return
    if (opening || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onSpreadChange(next)
      return
    }
    setTurn(direction)
  }
  const finishTurn = () => {
    if (!turn) return
    if (turn === 'forward') {
      // Commit the destination beneath the frozen Page 3 back face first.
      onSpreadChange('categories-more')
      window.requestAnimationFrame(() => setTurn(null))
      return
    }
    onSpreadChange('categories-primary')
    setTurn(null)
  }
  const leftContent = opening ? <OpeningWelcomePage /> : (
    <CataloguePageContent
      categories={primary ? pageOne : pageThree}
      heading={primary ? 'Our Catalogue' : 'More little worlds'}
      start={primary ? 1 : 8}
    />
  )
  const rightContent = opening ? <CatalogueIndexPage /> : (
    <CataloguePageContent
      categories={primary ? pageTwo : pageFour}
      start={primary ? 4 : 11}
    />
  )
  const turningPage = turn ? (
    <PageTurn direction={turn} onComplete={finishTurn}
      front={
        <div className="spread-page">
          <CataloguePageContent
            categories={turn === 'forward' ? pageTwo : pageThree}
            heading={turn === 'forward' ? undefined : 'More little worlds'}
            start={turn === 'forward' ? 4 : 8}
          />
        </div>
      }
      back={
        <div className="spread-page">
          <CataloguePageContent
            categories={turn === 'forward' ? pageThree : pageTwo}
            heading={turn === 'forward' ? 'More little worlds' : undefined}
            start={turn === 'forward' ? 8 : 4}
          />
        </div>
      }
    />
  ) : null

  const underlayLeft = turn === 'backward' ? <CataloguePageContent categories={pageOne} heading="Our Catalogue" start={1} /> : leftContent
  const underlayRight = turn === 'forward' ? <CataloguePageContent categories={pageFour} start={11} /> : rightContent

  return (
    <BookShell
      bookOverlay={undefined}
      leftPage={
        <div className={opening ? 'spread-page spread-page--welcome' : 'spread-page'}>
          {underlayLeft}
          {!opening && (
            <div className="spread-page__navigation">
              {spread === 'categories-primary' ? (
                <button type="button" disabled={Boolean(turn)} onClick={onClose}>← Close Book</button>
              ) : (
                <button type="button" disabled={Boolean(turn)} onClick={() => beginTurn('backward', back)}>← Back</button>
              )}
            </div>
          )}
        </div>
      }
      rightPage={
        <div className="spread-page spread-page--right">
          {underlayRight}
          {spread !== 'categories-more' && (
            <div className="spread-page__navigation">
              <button type="button" disabled={Boolean(turn)} onClick={() => beginTurn('forward', forward)}>
                {opening ? 'Discover all 13 worlds →' : 'More →'}
              </button>
            </div>
          )}
        </div>
      }
      pageTurn={turningPage}
    />
  )
}
