import { useEffect, useRef, useState } from 'react'
import type { BackendCategory, ProductListing } from '../../features/catalogue/api'
import { categoryProducts } from '../../features/catalogue/useCategoryCatalogue'
import { LeafletProduct } from './LeafletProduct'
import { LeafletShell } from './LeafletShell'
import { useLeafletActions } from './LeafletActions'
import './CategoryLeaflet.css'

export type LeafletSide = 'front' | 'back'
const oppositeSide = (side: LeafletSide): LeafletSide => side === 'front' ? 'back' : 'front'

export function LeafletContent({ category, listings, side, onDetails }: {
  category: BackendCategory; listings: readonly ProductListing[]; side: LeafletSide; onDetails: (id: number) => void
}) {
  const { feature, others } = categoryProducts(listings)
  const promotions = others.slice(0, 2)
  const remaining = others.slice(promotions.length)
  return <>
    <header className="leaflet__masthead"><span className="leaflet__brand">Build &amp; Bloom</span><span className="leaflet__motto">Small bricks.<br />Big possibilities.</span></header>
    <div className="leaflet__category-band"><div><p className="leaflet__edition">The {category.name} collection</p><h1 id="leaflet-title">{side === 'front' ? category.name : `More to explore`}</h1></div><p>{category.subtitle}</p></div>
    <div className={`leaflet__print-area leaflet__print-area--${side}`} key={side} tabIndex={0} aria-label={`${category.name} ${side === 'front' ? 'featured product' : 'other products'}`}>
      {side === 'front' ? <>
        <p className="leaflet__editorial">{category.description}</p>
        <div className={`leaflet__front-promotions${promotions.length ? ' leaflet__front-promotions--with-teasers' : ''}`}>
          <div className="leaflet__front-hero">
            {feature ? <><span className="leaflet__feature-label">Featured build</span><LeafletProduct listing={feature} featured onDetails={onDetails} /></> : <div className="leaflet__no-feature"><h2>A little world to discover</h2><p>{listings.length ? 'Turn over to explore this collection.' : 'New builds will appear here when they are available.'}</p></div>}
          </div>
          {promotions.length > 0 && <section className="leaflet__teasers" aria-labelledby="leaflet-teasers-title">
            <h2 id="leaflet-teasers-title">A little more to love</h2>
            {promotions.map(listing => <LeafletProduct key={listing.id} listing={listing} onDetails={onDetails} />)}
          </section>}
        </div>
      </> : <>
        {remaining.length > 0 ? <>
          <p className="leaflet__count">{remaining.length} {remaining.length === 1 ? 'more build' : 'more builds'} to spark your imagination</p>
          <div className="leaflet__products">{remaining.map(listing => <LeafletProduct key={listing.id} listing={listing} onDetails={onDetails} />)}</div>
        </> : <p className="leaflet__empty">{listings.length ? 'You’ve seen every build in this collection. Turn over to revisit your favourites.' : 'More discoveries are on their way.'}</p>}
      </>}
    </div>
  </>
}

/** A separate, two-sided sheet. No BookShell, page numbers or page-turn coordinator. */
export function CategoryLeaflet({ category, listings, onClose, onDetails }: {
  category: BackendCategory; listings: readonly ProductListing[]; onClose: () => void; onDetails: (id: number) => void
}) {
  const [side, setSide] = useState<LeafletSide>('front')
  const [turning, setTurning] = useState(false)
  const sheet = useRef<HTMLDivElement>(null)
  const animation = useRef<Animation | null>(null)
  const busy = useRef(false)
  const disposed = useRef(false)
  useEffect(() => {
    disposed.current = false
    return () => { disposed.current = true; animation.current?.cancel() }
  }, [])
  const turnOver = async (closing: boolean) => {
    if (busy.current || closing) return
    const next = oppositeSide(side)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setSide(next); return }
    busy.current = true
    setTurning(true)
    const direction = side === 'front' ? -1 : 1
    try {
      // Lift the complete sheet off the table; change print only while edge-on.
      animation.current = sheet.current!.animate([
        { transform: 'perspective(1800px) translateY(0) rotateY(0deg) rotateZ(0deg)' },
        { transform: `perspective(1800px) translateY(-18px) rotateY(${direction * 88}deg) rotateZ(${direction * 2}deg)`, boxShadow: '18px 30px 38px #30261f55' },
      ], { duration: 330, easing: 'ease-in', fill: 'forwards' })
      await animation.current.finished
      if (disposed.current) return
      setSide(next)
      animation.current.cancel()
      animation.current = sheet.current!.animate([
        { transform: `perspective(1800px) translateY(-18px) rotateY(${-direction * 88}deg) rotateZ(${-direction * 2}deg)`, boxShadow: '-18px 30px 38px #30261f55' },
        { transform: 'perspective(1800px) translateY(-3px) rotateY(-1deg) rotateZ(.3deg)', offset: .8 },
        { transform: 'perspective(1800px) translateY(0) rotateY(0deg) rotateZ(0deg)' },
      ], { duration: 440, easing: 'ease-out' })
      await animation.current.finished
    } catch { /* Unmount cancels an in-flight sheet movement. */ }
    finally { if (!disposed.current) { busy.current = false; setTurning(false) } }
  }
  return <LeafletShell sheetRef={sheet} side={side} categoryId={category.id} busy={turning} onClose={onClose}>
    <CategorySheetContent category={category} listings={listings} side={side} turning={turning} turnOver={turnOver} onDetails={onDetails} />
  </LeafletShell>
}

function CategorySheetContent({ category, listings, side, turning, turnOver, onDetails }: {
  category: BackendCategory; listings: readonly ProductListing[]; side: LeafletSide; turning: boolean
  turnOver: (closing: boolean) => Promise<void>; onDetails: (id: number) => void
}) {
  const { leave, closing } = useLeafletActions()
  return <>
      <LeafletContent category={category} listings={listings} side={side} onDetails={id => void leave(() => onDetails(id))} />
      <footer className="leaflet__footer"><span>Build. Play. Collect. Bloom.</span><button className="leaflet__turn" type="button" disabled={turning} onClick={() => void turnOver(closing)}>{side === 'front' ? 'Turn over →' : '← Turn over'}</button></footer>
      <span className="catalogue-spread-status" role="status">{category.name} leaflet, {side}</span>
    </>
}
