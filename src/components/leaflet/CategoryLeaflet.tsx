import { useEffect, useRef, useState } from 'react'
import type { BackendCategory, ProductListing } from '../../features/catalogue/api'
import { categoryProducts } from '../../features/catalogue/useCategoryCatalogue'
import { formatGbp, listingUnitPricePence, priceToPence } from '../../features/cart/CartContext'
import { ProductPrintImage } from '../catalogue/CategoryOpeningSpread'
import './CategoryLeaflet.css'

export type LeafletSide = 'front' | 'back'
const oppositeSide = (side: LeafletSide): LeafletSide => side === 'front' ? 'back' : 'front'

function ListingPrint({ listing, featured = false, onDetails }: { listing: ProductListing; featured?: boolean; onDetails: (id: number) => void }) {
  const product = listing.legoProduct
  return <article className={`leaflet-product${featured ? ' leaflet-product--featured' : ''}`} data-leaflet-listing={listing.id}>
    <ProductPrintImage listing={listing} className="leaflet-product__art" />
    <div className="leaflet-product__copy">
      <p className="leaflet-product__set">LEGO {product.theme} · {product.setNumber}</p>
      <h3>{product.title}</h3>
      <p className="leaflet-product__facts">{[product.pieceCount != null ? `${product.pieceCount} pieces` : '', product.ageRecommendation ? `Ages ${product.ageRecommendation}${/^\d+$/.test(product.ageRecommendation) ? '+' : ''}` : '', listing.condition === 'NEW' ? 'New' : 'Used, like new'].filter(Boolean).join(' · ')}</p>
      {featured && product.description && <p className="leaflet-product__description">{product.description}</p>}
      <div className="leaflet-product__purchase">
        <p className="leaflet-product__price">{listing.salePrice !== null && <del>{formatGbp(priceToPence(listing.originalPrice))}</del>}<strong>{formatGbp(listingUnitPricePence({ listing }))}</strong></p>
        <span className="leaflet-product__stock">{listing.availableStock > 0 ? `${listing.availableStock} available` : 'Out of stock'}</span>
      </div>
      <button type="button" onClick={() => onDetails(listing.id)} aria-label={`View details for ${product.title}`}>Take a closer look <span aria-hidden="true">→</span></button>
    </div>
  </article>
}

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
            {feature ? <><span className="leaflet__feature-label">Featured build</span><ListingPrint listing={feature} featured onDetails={onDetails} /></> : <div className="leaflet__no-feature"><h2>A little world to discover</h2><p>{listings.length ? 'Turn over to explore this collection.' : 'New builds will appear here when they are available.'}</p></div>}
          </div>
          {promotions.length > 0 && <section className="leaflet__teasers" aria-labelledby="leaflet-teasers-title">
            <h2 id="leaflet-teasers-title">A little more to love</h2>
            {promotions.map(listing => <ListingPrint key={listing.id} listing={listing} onDetails={onDetails} />)}
          </section>}
        </div>
      </> : <>
        {remaining.length > 0 ? <>
          <p className="leaflet__count">{remaining.length} {remaining.length === 1 ? 'more build' : 'more builds'} to spark your imagination</p>
          <div className="leaflet__products">{remaining.map(listing => <ListingPrint key={listing.id} listing={listing} onDetails={onDetails} />)}</div>
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
  const dialog = useRef<HTMLDialogElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const animation = useRef<Animation | null>(null)
  const busy = useRef(false)
  const disposed = useRef(false)
  useEffect(() => {
    disposed.current = false
    const opener = document.activeElement as HTMLElement | null
    const element = dialog.current!
    element.showModal()
    return () => { disposed.current = true; animation.current?.cancel(); element.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  const turnOver = async () => {
    if (busy.current) return
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
  return <dialog ref={dialog} className="leaflet-dialog" aria-labelledby="leaflet-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div ref={sheet} className="leaflet" data-side={side} data-category-id={category.id} aria-busy={turning}>
      <div className="leaflet__toolbar"><button type="button" onClick={onClose}>← Back to the storybook</button><button type="button" aria-label="Close leaflet" onClick={onClose}>×</button></div>
      <LeafletContent category={category} listings={listings} side={side} onDetails={onDetails} />
      <footer className="leaflet__footer"><span>Build. Play. Collect. Bloom.</span><button className="leaflet__turn" type="button" disabled={turning} onClick={() => void turnOver()}>{side === 'front' ? 'Turn over →' : '← Turn over'}</button></footer>
      <span className="catalogue-spread-status" role="status">{category.name} leaflet, {side}</span>
    </div>
  </dialog>
}
