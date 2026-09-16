import type { ReactNode } from 'react'
import './BookShell.css'

type BookShellProps = {
  leftPage?: ReactNode
  rightPage?: ReactNode
  label?: string
  pageTurn?: ReactNode
  bookOverlay?: ReactNode
}

/** A fixed desktop spread. Page content owns its headings and interactions. */
export function BookShell({
  leftPage,
  rightPage,
  label = 'Open catalogue book',
  pageTurn,
  bookOverlay,
}: BookShellProps) {
  return (
    <section className="book-shell" aria-label={label}>
      <div className="book-shell__cover" aria-hidden="true" />
      <div className="book-shell__spread">
        <section className="book-shell__page book-shell__page--left" aria-label="Left page">
          <div className="book-shell__content">{leftPage}</div>
        </section>
        <section className="book-shell__page book-shell__page--right" aria-label="Right page">
          <div className="book-shell__content">{rightPage}</div>
        </section>
      </div>
      <div className="book-shell__spine" aria-hidden="true" />
      {bookOverlay}
      {pageTurn}
    </section>
  )
}
