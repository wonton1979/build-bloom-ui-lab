import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VehiclesProductPage } from './VehiclesProductPage'
import { CategoryCatalogue } from './CategoryCatalogue'
import type { ProductListing } from '../../features/catalogue/api'
import { selectVehicle } from '../../features/catalogue/vehicles'
import { spreadAfterAction } from './catalogueSpread'

const listing = (setNumber: string, overrides: Partial<ProductListing> = {}): ProductListing => ({
  id: Number(setNumber), condition: 'NEW', originalPrice: '25.99', salePrice: null,
  colorfulLifeCategory: 'VEHICLES',
  legoProduct: { setNumber, title: `API title ${setNumber}`, theme: 'API theme', pieceCount: 357, ageRecommendation: '9' },
  listingImages: [{ url: '/catalogue-image.png', altText: 'Catalogue photograph', sortOrder: 0 }],
  ...overrides,
})
const listings = [listing('42226'), listing('77245'), listing('77256')]

describe('Vehicles editorial spread', () => {
  it('selects all three editorial products from VEHICLES independently of ordering or LEGO theme', () => {
    expect(selectVehicle(listings, '77256')?.legoProduct.title).toBe('API title 77256')
    expect(selectVehicle(listings, '77245')?.legoProduct.title).toBe('API title 77245')
    expect(selectVehicle(listings, '42226')?.legoProduct.title).toBe('API title 42226')
  })

  it.each(['77256', '77245', '42226'])('requires the official category for %s, without an absent-field fallback', (set) => {
    expect(selectVehicle([listing(set)], set)).toBeDefined()
    expect(selectVehicle([listing(set, { colorfulLifeCategory: 'OTHERS' })], set)).toBeUndefined()
    expect(selectVehicle([listing(set, { colorfulLifeCategory: null })], set)).toBeUndefined()
    const legacy = listing(set)
    Reflect.deleteProperty(legacy, 'colorfulLifeCategory')
    expect(selectVehicle([legacy], set)).toBeUndefined()
  })

  it('prefers a new listing consistently when multiple conditions exist', () => {
    const used = listing('77256', { id: 1, condition: 'USED_LIKE_NEW' })
    expect(selectVehicle([used, listings[2]], '77256')).toBe(listings[2])
  })

  it('renders API text and the exact transparent feature asset, with no fabricated third product', () => {
    const markup = renderToStaticMarkup(<VehiclesProductPage side="feature" state={{ status: 'ready', listings }} onRetry={() => {}} />)
    expect(markup).toContain('src="/src/assets/categories/vehicles/vehicle-77256-feature.png"')
    for (const value of ['API title 77256', 'API theme', '357 pieces', 'Ages 9+', '£25.99', 'Vehicles', 'Built for the thrill']) expect(markup).toContain(value)
    expect(markup).not.toContain('42226')
    expect(markup).not.toContain('API title 77245')
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>View Details →/)
  })

  it('replaces the photograph with exact 77245 artwork and keeps API sale/original prices', () => {
    const markup = renderToStaticMarkup(<VehiclesProductPage side="supporting" state={{ status: 'ready', listings: [listing('77245', { salePrice: '19.50' })] }} onRetry={() => {}} />)
    for (const value of ['API title 77245', 'src="/src/assets/categories/vehicles/vehicle-77245-standard.png"', '£19.50', '£25.99', '<del', 'More amazing vehicles']) expect(markup).toContain(value)
    expect(markup).not.toContain('/catalogue-image.png')
    expect(markup).not.toContain('vehicle-42226-standard.png')
    expect(markup).toContain('Set 42226 is currently unavailable.')
  })

  it('renders 77245 above 42226 with equal supporting semantics and two Details actions', () => {
    const markup = renderToStaticMarkup(<VehiclesProductPage side="supporting" state={{ status: 'ready', listings }} onRetry={() => {}} />)
    expect(markup).toContain('src="/src/assets/categories/vehicles/vehicle-42226-standard.png"')
    expect(markup).toContain('API title 42226')
    expect(markup.indexOf('aria-label="API title 77245"')).toBeLessThan(markup.indexOf('aria-label="API title 42226"'))
    expect(markup.match(/<article /g)).toHaveLength(2)
    expect(markup.match(/View Details →/g)).toHaveLength(2)
    expect(markup).not.toContain('77256')
  })

  it('does not fabricate the BMW product when absent or outside VEHICLES', () => {
    const render = (items: ProductListing[]) => renderToStaticMarkup(<VehiclesProductPage side="supporting" state={{ status: 'ready', listings: items }} onRetry={() => {}} />)
    for (const items of [[], [listing('42226', { colorfulLifeCategory: 'OTHERS' })]]) {
      const markup = render(items)
      expect(markup).toContain('Set 42226 is currently unavailable.')
      expect(markup).not.toContain('vehicle-42226-standard.png')
      expect(markup).not.toContain('API title 42226')
      expect(markup).not.toContain('£25.99')
    }
  })

  it('renders unavailable/loading/error states without substituting hardcoded products', () => {
    const render = (state: Parameters<typeof VehiclesProductPage>[0]['state']) => renderToStaticMarkup(<VehiclesProductPage side="feature" state={state} onRetry={() => {}} />)
    expect(render({ status: 'loading' })).toContain('role="status"')
    expect(render({ status: 'error' })).toContain('Try again')
    expect(render({ status: 'ready', listings: [] })).toContain('currently unavailable')
    expect(render({ status: 'ready', listings: [] })).not.toContain('£25.99')
  })

  it('keeps one open BookShell, a back-to-categories action and no fake pagination', () => {
    const markup = renderToStaticMarkup(<CategoryCatalogue spread="vehicles" onSpreadChange={() => {}} onClose={() => {}} />)
    expect(markup.match(/aria-label="Open catalogue book"/g)).toHaveLength(1)
    expect(markup).toContain('← Back to Categories')
    expect(markup).not.toContain('More →')
    expect(spreadAfterAction('vehicles', 'backward')).toBe('categories-more')
  })
})
