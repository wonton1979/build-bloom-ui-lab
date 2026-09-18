import featureArtwork from '../../assets/categories/vehicles/vehicle-77256-feature.png'
import astonMartinArtwork from '../../assets/categories/vehicles/vehicle-77245-standard.png'
import bmwArtwork from '../../assets/categories/vehicles/vehicle-42226-standard.png'
import type { ProductListing } from '../../features/catalogue/api'
import { selectVehicle } from '../../features/catalogue/vehicles'
import type { VehiclesState } from '../../features/catalogue/useVehicles'
import './VehiclesProductPage.css'

const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const supportingSlots = [
  { setNumber: '77245', artwork: astonMartinArtwork },
  { setNumber: '42226', artwork: bmwArtwork },
] as const

function ProductCopy({ listing }: { listing: ProductListing }) {
  const { legoProduct: product } = listing
  const age = product.ageRecommendation?.trim()
  return (
    <div className="vehicle-product__copy">
      <p className="vehicle-product__number">LEGO {product.setNumber}</p>
      <h3>{product.title}</h3>
      <ul className="vehicle-product__facts" aria-label="Product information">
        {product.theme && <li>{product.theme}</li>}
        {product.pieceCount != null && <li>{product.pieceCount} pieces</li>}
        {age && <li>{/^ages?\b/i.test(age) ? age : `Ages ${age}${/^\d+$/.test(age) ? '+' : ''}`}</li>}
      </ul>
      <div className="vehicle-product__footer">
        <p className="vehicle-product__price">
          {listing.salePrice !== null && <del aria-label="Original price">{pounds.format(Number(listing.originalPrice))}</del>}
          <span aria-label={listing.salePrice !== null ? 'Sale price' : 'Price'}>{pounds.format(Number(listing.salePrice ?? listing.originalPrice))}</span>
        </p>
        {/* TODO: connect to in-book product details when that interaction exists. */}
        <button type="button" className="vehicle-product__details" disabled title="Product details coming soon">View Details →</button>
      </div>
    </div>
  )
}

export function VehiclesProductPage({ side, state, onRetry }: {
  side: 'feature' | 'supporting'
  state: VehiclesState
  onRetry: () => void
}) {
  const feature = side === 'feature'
  const listing = state.status === 'ready' ? selectVehicle(state.listings, '77256') : undefined
  return (
    <section className={`vehicles-page vehicles-page--${side}`} aria-labelledby={`vehicles-${side}-heading`}>
      <header className="vehicles-page__heading">
        <h2 id={`vehicles-${side}-heading`}>{feature ? 'Vehicles' : 'More amazing vehicles'}</h2>
        {feature && <p>Built for the thrill</p>}
      </header>
      {state.status === 'loading' && <p className="vehicles-page__message" role="status">Opening the garage…</p>}
      {state.status === 'error' && <div className="vehicles-page__message" role="alert">
        <p>We couldn’t load the vehicles.</p>
        <button type="button" onClick={onRetry}>Try again</button>
      </div>}
      {feature && state.status === 'ready' && !listing && <p className="vehicles-page__message">This vehicle is currently unavailable.</p>}
      {feature && listing && <article className="vehicle-product vehicle-product--feature" aria-label={listing.legoProduct.title}>
        <img className="vehicle-product__art vehicle-product__art--feature" src={featureArtwork}
          alt={`Illustrated ${listing.legoProduct.title}`} width={1536} height={1024} />
        <ProductCopy listing={listing} />
      </article>}
      {!feature && state.status === 'ready' && <div className="vehicles-supporting-products">
        {supportingSlots.map(({ setNumber, artwork }) => {
          const supporting = selectVehicle(state.listings, setNumber)
          return supporting ? (
            <article key={setNumber} className="vehicle-product vehicle-product--supporting" aria-label={supporting.legoProduct.title}>
              <img className="vehicle-product__art vehicle-product__art--supporting" src={artwork}
                alt={`Illustrated ${supporting.legoProduct.title}`} width={1536} height={1024} />
              <ProductCopy listing={supporting} />
            </article>
          ) : <p key={setNumber} className="vehicles-page__message">Set {setNumber} is currently unavailable.</p>
        })}
      </div>}
    </section>
  )
}
