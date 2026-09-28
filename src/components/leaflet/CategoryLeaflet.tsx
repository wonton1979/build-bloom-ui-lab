import { useEffect, useRef, useState } from 'react'
import type { BackendCategory, CatalogueProduct } from '../../features/catalogue/api'
import { categoryProducts } from '../../features/catalogue/useCategoryCatalogue'
import { selectCategoryFeaturedProducts } from '../../features/catalogue/productSpreads'
import { LeafletProduct } from './LeafletProduct'
import { LeafletShell } from './LeafletShell'
import { useLeafletActions } from './LeafletActions'
import { selectCollectionLeafletProducts } from './categoryLeafletProducts'
import harryPotterEnvironmentDesktop from '../../assets/leaflet-themes/harry-potter/environment-desktop.png'
import harryPotterEnvironmentDesktopBack from '../../assets/leaflet-themes/harry-potter/environment-desktop-back.png'
import vehiclesEnvironmentDesktop from '../../assets/leaflet-themes/vehicles/environment-desktop.png'
import vehiclesEnvironmentDesktopBack from '../../assets/leaflet-themes/vehicles/environment-desktop-back.png'
import starWarsEnvironmentDesktop from '../../assets/leaflet-themes/star-wars/environment-desktop.png'
import starWarsEnvironmentDesktopBack from '../../assets/leaflet-themes/star-wars/environment-desktop-back.png'
import friendsEnvironmentDesktop from '../../assets/leaflet-themes/friends/environment-desktop.png'
import friendsEnvironmentDesktopBack from '../../assets/leaflet-themes/friends/environment-desktop-back.png'
import './CategoryLeaflet.css'

export type LeafletSide = 'front' | 'back'
const oppositeSide = (side: LeafletSide): LeafletSide => side === 'front' ? 'back' : 'front'
const isHarryPotterCategory = (category: BackendCategory) => category.name.trim().toLocaleLowerCase('en') === 'harry potter'
const isVehiclesCategory = (category: BackendCategory) => category.name.trim().toLocaleLowerCase('en') === 'vehicles'
const isStarWarsCategory = (category: BackendCategory) => category.name.trim().toLocaleLowerCase('en') === 'star wars'
const isFriendsCategory = (category: BackendCategory) => category.name.trim().toLocaleLowerCase('en') === 'friends'
const isThemedCollectionCategory = (category: BackendCategory) => isHarryPotterCategory(category) || isVehiclesCategory(category) || isStarWarsCategory(category) || isFriendsCategory(category)
const starWarsFeaturedProductLimit = 1

function categoryBackProducts(category: BackendCategory, products: readonly CatalogueProduct[]) {
  const { others } = categoryProducts(products)
  if (!isStarWarsCategory(category)) return others
  const featuredIds = new Set(selectCategoryFeaturedProducts(products, starWarsFeaturedProductLimit).map(product => product.id))
  return others.filter(product => !featuredIds.has(product.id))
}

export function LeafletContent({ category, products, collectionProducts, side, onDetails }: {
  category: BackendCategory; products: readonly CatalogueProduct[]; collectionProducts?: readonly CatalogueProduct[]; side: LeafletSide; onDetails: (id: number) => void
}) {
  const { feature, others } = categoryProducts(products)
  const starWarsFeatures = isStarWarsCategory(category) ? selectCategoryFeaturedProducts(products, starWarsFeaturedProductLimit) : []
  const harryPotterFront = side === 'front' && isHarryPotterCategory(category)
  const harryPotterBack = side === 'back' && isHarryPotterCategory(category)
  const vehiclesFront = side === 'front' && isVehiclesCategory(category)
  const vehiclesBack = side === 'back' && isVehiclesCategory(category)
  const starWarsFront = side === 'front' && isStarWarsCategory(category)
  const starWarsBack = side === 'back' && isStarWarsCategory(category)
  const friendsFront = side === 'front' && isFriendsCategory(category)
  const friendsBack = side === 'back' && isFriendsCategory(category)
  const collectionBack = side === 'back' && isThemedCollectionCategory(category)
  const themedFront = harryPotterFront || vehiclesFront || starWarsFront || friendsFront
  return <>
    {!themedFront && !collectionBack && <header className="leaflet__masthead"><span className="leaflet__brand">Build &amp; Bloom</span><span className="leaflet__motto">Small bricks.<br />Big possibilities.</span></header>}
    {!themedFront && !collectionBack && <div className="leaflet__category-band"><div><p className="leaflet__edition">The {category.name} collection</p><h1 id="leaflet-title">{side === 'front' ? category.name : 'More to explore'}</h1></div><p>{category.subtitle}</p></div>}
    <div className={`leaflet__print-area leaflet__print-area--${side}${harryPotterFront ? ' leaflet__print-area--harry-potter-front' : ''}${harryPotterBack ? ' leaflet__print-area--harry-potter-back' : ''}${collectionBack ? ' leaflet__print-area--collection-back' : ''}${vehiclesFront ? ' leaflet__print-area--vehicles-front' : ''}${vehiclesBack ? ' leaflet__print-area--vehicles-back' : ''}${starWarsFront ? ' leaflet__print-area--star-wars-front' : ''}${starWarsBack ? ' leaflet__print-area--star-wars-back' : ''}${friendsFront ? ' leaflet__print-area--friends-front' : ''}${friendsBack ? ' leaflet__print-area--friends-back' : ''}`} key={side} id={friendsBack || starWarsFront || starWarsBack ? 'leaflet-title' : undefined} tabIndex={0} aria-label={harryPotterFront ? 'Featured story' : vehiclesFront ? 'Vehicles featured story' : starWarsFront ? 'Star Wars featured story' : friendsFront ? 'Friends featured story' : harryPotterBack ? 'Harry Potter collection products' : vehiclesBack ? 'Vehicles collection products' : starWarsBack ? 'Star Wars collection products' : friendsBack ? 'Friends collection products' : `${category.name} ${side === 'front' ? 'featured product' : 'other products'}`}>
      {side === 'front' ? harryPotterFront ? <div className="leaflet__harry-potter-story">
        {feature ? <LeafletProduct product={feature} featured showDescription={false} titleId="leaflet-title" onDetails={onDetails} /> : <div className="leaflet__no-feature"><h2 id="leaflet-title">A story is on its way</h2><p>Turn over to explore the collection.</p></div>}
      </div> : vehiclesFront ? <>
        <div className="leaflet__vehicles-story">
          {feature ? <LeafletProduct product={feature} featured showDescription={false} titleId="leaflet-title" onDetails={onDetails} /> : <div className="leaflet__no-feature"><h2 id="leaflet-title">A build is on its way</h2><p>Turn over to explore the collection.</p></div>}
        </div>
      </> : starWarsFront ? <>
        <div className="leaflet__star-wars-featured-build" aria-label={`${category.name} Featured Build`}>
          {starWarsFeatures[0] && <LeafletProduct product={starWarsFeatures[0]} featured showDescription={false} onDetails={onDetails} />}
        </div>
        {!starWarsFeatures.length && <div className="leaflet__no-feature"><p>{products.length ? 'Turn over to explore this collection.' : 'New builds will appear here when they are available.'}</p></div>}
      </> : friendsFront ? <>
        <div className="leaflet__friends-story" aria-label="Friends Featured Build">
          {feature ? <LeafletProduct product={feature} featured showDescription={false} titleId="leaflet-title" onDetails={onDetails} /> : <div className="leaflet__no-feature"><h2 id="leaflet-title">A build is on its way</h2><p>Turn over to explore the collection.</p></div>}
        </div>
      </> : <>
        <p className="leaflet__editorial">{category.description}</p>
        <div className="leaflet__front-promotions">
          <div className="leaflet__front-hero">
            {feature ? <><span className="leaflet__feature-label">Featured build</span><LeafletProduct product={feature} featured onDetails={onDetails} /></> : <div className="leaflet__no-feature"><h2>A little world to discover</h2><p>{products.length ? 'Turn over to explore this collection.' : 'New builds will appear here when they are available.'}</p></div>}
          </div>
        </div>
      </> : <>
        {collectionBack ? <>
          {!friendsBack && !starWarsBack && <header className="leaflet__collection-heading">
            <h1 id="leaflet-title">The {category.name} Collection</h1>
            <p>Choose a build to take a closer look.</p>
          </header>}
          {(collectionProducts ?? ((starWarsBack || friendsBack) ? categoryBackProducts(category, products) : others)).length > 0 ? <div className={`leaflet__products leaflet__products--collection${vehiclesBack ? ' leaflet__products--vehicles-collection' : ''}${starWarsBack ? ' leaflet__products--star-wars-collection' : ''}${friendsBack ? ' leaflet__products--friends-collection' : ''}`}>
            {(collectionProducts ?? ((starWarsBack || friendsBack) ? categoryBackProducts(category, products) : others)).map(product => <LeafletProduct key={product.id} product={product} browseOnly linkedArtwork linkedTitle onDetails={onDetails} />)}
          </div> : <p className="leaflet__empty">More discoveries are on their way.</p>}
        </> : others.length > 0 ? <>
          <p className="leaflet__count">{others.length} {others.length === 1 ? 'more build' : 'more builds'} to spark your imagination</p>
          <div className="leaflet__products">{others.map(product => <LeafletProduct key={product.id} product={product} onDetails={onDetails} />)}</div>
        </> : <p className="leaflet__empty">{products.length ? 'Your Featured Build is waiting on the front.' : 'More discoveries are on their way.'}</p>}
      </>}
    </div>
  </>
}

/** A separate, two-sided sheet. No BookShell, page numbers or page-turn coordinator. */
export function CategoryLeaflet({ category, products, onClose, onDetails, side: controlledSide, onSideChange }: {
  category: BackendCategory; products: readonly CatalogueProduct[]; onClose: () => void; onDetails: (id: number) => void
  side?: LeafletSide; onSideChange?: (side: LeafletSide, settled?: boolean) => void
}) {
  const [internalSide, setInternalSide] = useState<LeafletSide>(controlledSide ?? 'front')
  const side = controlledSide ?? internalSide
  const changeSide = (next: LeafletSide, settled = true) => {
    if (controlledSide === undefined) setInternalSide(next)
    onSideChange?.(next, settled)
  }
  const [turning, setTurning] = useState(false)
  const [collectionProducts] = useState(() => {
    const otherProducts = categoryBackProducts(category, products)
    return isThemedCollectionCategory(category) ? selectCollectionLeafletProducts(otherProducts) : otherProducts
  })
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { changeSide(next); return }
    busy.current = true
    setTurning(true)
    const direction = side === 'front' ? -1 : 1
    try {
      animation.current = sheet.current!.animate([
        { transform: 'perspective(1800px) translateY(0) rotateY(0deg) rotateZ(0deg)' },
        { transform: `perspective(1800px) translateY(-18px) rotateY(${direction * 88}deg) rotateZ(${direction * 2}deg)`, boxShadow: '18px 30px 38px #30261f55' },
      ], { duration: 330, easing: 'ease-in', fill: 'forwards' })
      await animation.current.finished
      if (disposed.current) return
      changeSide(next, false)
      animation.current.cancel()
      animation.current = sheet.current!.animate([
        { transform: `perspective(1800px) translateY(-18px) rotateY(${-direction * 88}deg) rotateZ(${-direction * 2}deg)`, boxShadow: '-18px 30px 38px #30261f55' },
        { transform: 'perspective(1800px) translateY(-3px) rotateY(-1deg) rotateZ(.3deg)', offset: .8 },
        { transform: 'perspective(1800px) translateY(0) rotateY(0deg) rotateZ(0deg)' },
      ], { duration: 440, easing: 'ease-out' })
      await animation.current.finished
      if (!disposed.current) changeSide(next, true)
    } catch { /* Unmount cancels an in-flight sheet movement. */ }
    finally { if (!disposed.current) { busy.current = false; setTurning(false) } }
  }
  const themedCollectionBack = side === 'back' && isThemedCollectionCategory(category)
  const vehiclesFront = side === 'front' && isVehiclesCategory(category)
  return <LeafletShell sheetRef={sheet} side={side} categoryId={category.id} busy={turning} showBackNavigation={!(vehiclesFront || themedCollectionBack)} onClose={onClose}>
    <CategorySheetContent category={category} products={products} collectionProducts={collectionProducts} side={side} turning={turning} turnOver={turnOver} onDetails={onDetails} />
  </LeafletShell>
}

function CategorySheetContent({ category, products, collectionProducts, side, turning, turnOver, onDetails }: {
  category: BackendCategory; products: readonly CatalogueProduct[]; collectionProducts: readonly CatalogueProduct[]; side: LeafletSide; turning: boolean
  turnOver: (closing: boolean) => Promise<void>; onDetails: (id: number) => void
}) {
  const { leave, closing } = useLeafletActions()
  const content = <LeafletContent category={category} products={products} collectionProducts={collectionProducts} side={side} onDetails={id => void leave(() => onDetails(id))} />
  const collectionBack = side === 'back' && isThemedCollectionCategory(category)
  const footer = <footer className="leaflet__footer">{!collectionBack && <span>Build. Play. Collect. Bloom.</span>}<button className="leaflet__turn" type="button" disabled={turning} onClick={() => void turnOver(closing)}>{side === 'front' ? 'Turn over →' : '← Turn over'}</button></footer>
  return <>
    {isHarryPotterCategory(category) ? <img className="leaflet__environment" src={side === 'back' ? harryPotterEnvironmentDesktopBack : harryPotterEnvironmentDesktop} alt="" aria-hidden="true" />
      : isVehiclesCategory(category) ? <img className="leaflet__environment" src={side === 'back' ? vehiclesEnvironmentDesktopBack : vehiclesEnvironmentDesktop} alt="" aria-hidden="true" />
        : isStarWarsCategory(category) ? <img className="leaflet__environment" src={side === 'back' ? starWarsEnvironmentDesktopBack : starWarsEnvironmentDesktop} alt="" aria-hidden="true" />
          : isFriendsCategory(category) && <img className="leaflet__environment" src={side === 'back' ? friendsEnvironmentDesktopBack : friendsEnvironmentDesktop} alt="" aria-hidden="true" />}
    {isStarWarsCategory(category)
      ? <div className="leaflet__star-wars-layout">{content}{footer}</div>
      : side === 'front' && (isVehiclesCategory(category) || isFriendsCategory(category))
      ? <div className={isVehiclesCategory(category) ? 'leaflet__vehicles-layout' : 'leaflet__friends-layout'}>{content}{footer}</div>
      : <>{content}{footer}</>}
    <span className="catalogue-spread-status" role="status">{category.name} leaflet, {side}</span>
  </>
}
