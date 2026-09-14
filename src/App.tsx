import { useState } from 'react'
import openingSpreadReference from './assets/reference/opening-spread-master.png'
import { BookShell } from './components/BookShell'
import './App.css'

function App() {
  const [view, setView] = useState<'live' | 'reference'>('live')
  const showReference = import.meta.env.DEV && view === 'reference'

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
        <main className="catalogue-stage" aria-label="Catalogue">
          <BookShell />
        </main>
      )}
    </>
  )
}

export default App
