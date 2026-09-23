import { useEffect, useRef } from 'react'
import type { CatalogueSearch } from '../../features/catalogue/useCatalogueSearch'
import { LeafletShell } from './LeafletShell'
import { LeafletProduct } from './LeafletProduct'
import { useLeafletActions } from './LeafletActions'
import findBanner from '../../assets/categories/search/search-find-a-set-banner.png'
import resultsBanner from '../../assets/categories/search/search-results-banner.png'
import emptyBanner from '../../assets/categories/search/search-no-results-banner.png'
import initialArt from '../../assets/categories/search/search-empty.png'
import loadingArt from '../../assets/categories/search/search-loading.png'
import emptyArt from '../../assets/categories/search/search-no-results.png'
import bird from '../../assets/categories/search/search-bird.png'
import flower from '../../assets/categories/search/search-flower.png'
import leafLeft from '../../assets/categories/search/search-leaf-left.png'
import leafRight from '../../assets/categories/search/search-leaf-right.png'
import './SearchLeaflet.css'

type SearchSession = { opener: HTMLElement | null; scrollTop: number; focusListingId?: number }
type SearchProps = { search: CatalogueSearch; session: SearchSession; onClose: () => void; onDetails: (id: number, scrollTop: number) => void }

export function SearchLeaflet({ search, session, onClose, onDetails }: SearchProps) {
  return <LeafletShell search onClose={onClose} returnFocus={() => session.opener?.isConnected
    ? session.opener : document.querySelector<HTMLElement>('.book-shell__spread [data-find-a-set]')} onReady={dialog => {
    const target = session.focusListingId
      ? dialog.querySelector<HTMLButtonElement>(`[data-leaflet-listing="${session.focusListingId}"] button`)
      : dialog.querySelector<HTMLInputElement>('#catalogue-search')
    target?.focus({ preventScroll: true })
    const area = dialog.querySelector('.search-leaflet__results')
    if (area) area.scrollTop = session.scrollTop
  }}>
    <SearchLeafletContent search={search} onDetails={onDetails} />
  </LeafletShell>
}

export function SearchLeafletContent({ search, onDetails }: Pick<SearchProps, 'search' | 'onDetails'>) {
  const { input, state, changeInput, submit, changePage, retry } = search
  const { leave } = useLeafletActions()
  const area = useRef<HTMLDivElement>(null)
  const previousState = useRef(state)
  useEffect(() => {
    if (previousState.current !== state && area.current) area.current.scrollTop = 0
    previousState.current = state
  }, [state])
  const title = state.status === 'results' ? 'Search Results' : state.status === 'empty' ? 'No Results Found' : 'Find a Set'
  const banner = state.status === 'results' ? resultsBanner : state.status === 'empty' ? emptyBanner : findBanner
  const count = state.status === 'results' ? state.data.pagination.totalItems : undefined
  const pagination = state.status === 'results' && state.data.pagination.totalPages > 1 ? state.data.pagination : undefined
  return <>
    <header className="search-leaflet__heading">
      <span className="search-leaflet__brand">Build &amp; Bloom</span>
      <h1 id="leaflet-title" className="catalogue-spread-status">{title}</h1>
      <img className="search-leaflet__banner" src={banner} width={state.status === 'results' ? 471 : state.status === 'empty' ? 502 : 470} height={state.status === 'results' ? 127 : state.status === 'empty' ? 129 : 131} alt="" aria-hidden="true" />
      <p role="status" aria-live="polite">{count !== undefined ? `${count} ${count === 1 ? 'match' : 'matches'} found` : state.status === 'empty' ? 'No matching sets found' : 'Search by name or set number'}</p>
    </header>
    <form className="search-leaflet__form" role="search" onSubmit={event => { event.preventDefault(); submit() }}>
      <label htmlFor="catalogue-search" className="catalogue-spread-status">Search sets by name or set number</label>
      <button type="submit" aria-label="Search sets" className="search-leaflet__submit"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg></button>
      <input id="catalogue-search" name="q" type="search" autoComplete="off" placeholder="Search by name or set number…" value={input} onChange={event => changeInput(event.target.value)} />
      {input && <button type="button" className="search-leaflet__clear" aria-label="Clear search" onClick={() => { changeInput(''); document.getElementById('catalogue-search')?.focus() }}>×</button>}
    </form>
    <div ref={area} className="leaflet__print-area search-leaflet__results" data-search-state={state.status} aria-busy={state.status === 'loading'} tabIndex={0} aria-label="Search results">
      {state.status === 'initial' && <div className="search-leaflet__state">
        <img src={initialArt} width={487} height={264} alt="" />
        <p className="search-leaflet__invitation">Start typing to explore<br />a world of sets.</p>
        <p className="search-leaflet__note">Big adventures start with a single search.</p>
      </div>}
      {state.status === 'loading' && <div className="search-leaflet__state" role="status"><img src={loadingArt} width={357} height={277} alt="" /><h2>Searching…</h2><p>Finding the best sets for you.</p></div>}
      {state.status === 'empty' && <div className="search-leaflet__state"><img src={emptyArt} width={503} height={289} alt="" /><h2>No matching sets this time.</h2><p>Check the spelling, try a shorter name,<br />or search by set number.</p></div>}
      {state.status === 'error' && <div className="search-leaflet__state search-leaflet__error" role="alert"><h2>A little trouble searching</h2><p>{state.message}</p><button type="button" onClick={retry}>Try again</button></div>}
      {state.status === 'results' && <div className="leaflet__products">
        {state.data.items.map(listing => <LeafletProduct key={listing.id} listing={listing} showCategory linkedArtwork linkedTitle onDetails={id => {
          const scrollTop = area.current?.scrollTop ?? 0
          void leave(() => onDetails(id, scrollTop))
        }} />)}
      </div>}
    </div>
    <footer className="leaflet__footer search-leaflet__footer">
      {pagination ? <nav aria-label="Search result pages" className="search-leaflet__pagination">
        <button type="button" disabled={pagination.page === 1} onClick={() => changePage(pagination.page - 1)}>← Previous</button>
        <span>Page {pagination.page} of {pagination.totalPages}</span>
        <button type="button" disabled={pagination.page === pagination.totalPages} onClick={() => changePage(pagination.page + 1)}>Next →</button>
      </nav> : <span>Small bricks. Big possibilities.</span>}
    </footer>
    <img className="search-leaflet__decoration search-leaflet__leaf-left" src={leafLeft} alt="" aria-hidden="true" />
    <img className="search-leaflet__decoration search-leaflet__leaf-right" src={leafRight} alt="" aria-hidden="true" />
    <img className="search-leaflet__decoration search-leaflet__flower" src={flower} alt="" aria-hidden="true" />
    {state.status === 'results' && <img className="search-leaflet__decoration search-leaflet__bird" src={bird} alt="" aria-hidden="true" />}
  </>
}
