// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CategoryLeaflet, LeafletContent } from './CategoryLeaflet'
import { selectCollectionLeafletProducts, selectHarryPotterLeafletProducts } from './categoryLeafletProducts'
import { categoryProducts } from '../../features/catalogue/useCategoryCatalogue'
import { fixtureCategory as category, offer, product } from '../../features/catalogue/catalogueFixtures'
import harryPotterEnvironmentDesktop from '../../assets/leaflet-themes/harry-potter/environment-desktop.png'
import harryPotterEnvironmentDesktopBack from '../../assets/leaflet-themes/harry-potter/environment-desktop-back.png'
import vehiclesEnvironmentDesktop from '../../assets/leaflet-themes/vehicles/environment-desktop.png'
import vehiclesEnvironmentDesktopBack from '../../assets/leaflet-themes/vehicles/environment-desktop-back.png'
import starWarsEnvironmentDesktop from '../../assets/leaflet-themes/star-wars/environment-desktop.png'
import starWarsEnvironmentDesktopBack from '../../assets/leaflet-themes/star-wars/environment-desktop-back.png'
import friendsEnvironmentDesktop from '../../assets/leaflet-themes/friends/environment-desktop.png'
import friendsEnvironmentDesktopBack from '../../assets/leaflet-themes/friends/environment-desktop-back.png'

const feature = product(9, [offer(9, { effectivePrice: '12.99', availableStock: 1 })], { isFeatureProduct: true, catalogueArtworkUrl: '/feature.png' })
const others = [product(1), product(2)]
const printedIds = (markup: string) => [...markup.matchAll(/data-leaflet-product="(\d+)"/g)].map(match => Number(match[1]))
const harryPotter = { ...category, name: 'Harry Potter' }
const starWars = { ...category, name: 'Star Wars', subtitle: 'Adventure among the stars', description: 'Build your own story among the stars.' }
const friends = { ...category, name: 'Friends', subtitle: 'Welcome to Heartlake City' }
const genericCategory = { ...category, name: 'Creator' }
const collectionProducts = (count: number) => Array.from({ length: count }, (_, index) => {
  const id = 100 + index
  return product(id, [offer(1000 + index, { legoProductId: id })], { title: `Collection build ${index + 1}`, setNumber: `764${index}` })
})

describe('Category advertising leaflet', () => {
  it('selects one product feature and preserves each product once', () => {
    const products = [others[0], feature, others[1], others[0]]
    expect(categoryProducts(products)).toEqual({ feature, others })
    expect(categoryProducts(others)).toEqual({ feature: undefined, others })
    expect(products).toHaveLength(4)
  })
  it('prints one product card with the lowest offer price and available total', () => {
    const withOffers = product(1, [offer(101, { legoProductId: 1, effectivePrice: '5.00', currentStock: 0, availableStock: 0 }), offer(102, { legoProductId: 1, condition: 'USED_LIKE_NEW', usedLifecycle: 'AVAILABLE', effectivePrice: '18.50', availableStock: 1 })])
    const markup = renderToStaticMarkup(<LeafletContent category={genericCategory} products={[feature, withOffers, others[1]]} side="front" onDetails={() => {}} />)
    expect(printedIds(markup)).toEqual([9])
    expect(markup).toContain('£12.99')
    expect(markup).not.toContain('£18.50')
    expect(markup).toContain('123 pieces')
    expect(markup).not.toContain('Used')
  })
  it('prints every non-feature LegoProduct on the back', () => {
    const products = [feature, ...others, product(3), product(4)]
    const markup = renderToStaticMarkup(<LeafletContent category={genericCategory} products={products} side="back" onDetails={() => {}} />)
    expect(printedIds(markup)).toEqual([1, 2, 3, 4])
    expect(markup).not.toContain('API product 9')
    expect(markup).toContain('5 available')
    expect(markup.match(/data-leaflet-product=/g)).toHaveLength(4)
    expect(markup).not.toMatch(/BookShell|Next page|Page \d/)
  })
  it('renders every Harry Potter collection product from catalogue data on the reverse', () => {
    const harryPotterCategory = { ...harryPotter, subtitle: 'Magic in every build' }
    const collection = [product(41, [offer(401, { legoProductId: 41, effectivePrice: '18.25' })], { title: 'Castle in the Clouds', setNumber: '76401', catalogueArtworkUrl: '/castle.png', isFeatureProduct: true }),
      product(52, [offer(502, { legoProductId: 52, effectivePrice: '29.50' })], { title: 'Owl Post', setNumber: '76402' }),
      product(63, [offer(603, { legoProductId: 63, effectivePrice: '12.00' })], { title: 'Forest Cottage', setNumber: '76403' })]
    const markup = renderToStaticMarkup(<CategoryLeaflet category={harryPotterCategory} products={collection} side="back" onClose={() => {}} onDetails={() => {}} />)

    expect(printedIds(markup)).toEqual(collection.filter(item => !item.isFeatureProduct).map(item => item.id))
    expect(markup).toContain('The Harry Potter Collection')
    expect(markup).toContain('Choose a build to take a closer look.')
    expect(markup).not.toContain('Castle in the Clouds')
    expect(markup).not.toContain('76401')
    expect(markup).not.toContain('£18.25')
    expect(markup).not.toContain('src="/castle.png"')
    for (const frontCopy of ['Build &amp; Bloom', 'More to explore', 'Small bricks.', 'Big possibilities.', 'Magic in every build', 'You’ve seen every build in this collection', 'Build. Play. Collect. Bloom.']) {
      expect(markup).not.toContain(frontCopy)
    }
    expect(markup).toContain(`src="${harryPotterEnvironmentDesktopBack}"`)
    expect(markup).not.toContain(`src="${harryPotterEnvironmentDesktop}"`)
    expect(markup).not.toContain('← Back to the storybook')
    expect(markup).toContain('aria-label="Close leaflet"')
  })
  it('shows every product when the collection has at most eleven items', () => {
    const collection = collectionProducts(11)
    const markup = renderToStaticMarkup(<CategoryLeaflet category={harryPotter} products={collection} side="back" onClose={() => {}} onDetails={() => {}} />)
    expect(printedIds(markup)).toEqual(collection.map(item => item.id))
  })
  it('shows no more than eleven products from a larger collection', () => {
    const collection = collectionProducts(16)
    const markup = renderToStaticMarkup(<CategoryLeaflet category={harryPotter} products={collection} side="back" onClose={() => {}} onDetails={() => {}} />)
    const visibleIds = printedIds(markup)
    expect(visibleIds).toHaveLength(11)
    expect(visibleIds.every(id => collection.some(item => item.id === id))).toBe(true)
  })
  it('renders the Vehicles reverse as a shared collection view from catalogue products', () => {
    const vehicles = { ...category, name: 'Vehicles' }
    const collection = [product(741, [offer(1741, { legoProductId: 741, effectivePrice: '24.99' })], { title: 'Rally Car', setNumber: '77250', catalogueArtworkUrl: '/rally-car.png', isFeatureProduct: true }), ...collectionProducts(13)]
    const markup = renderToStaticMarkup(<CategoryLeaflet category={vehicles} products={collection} side="back" onClose={() => {}} onDetails={() => {}} />)
    const visibleIds = printedIds(markup)

    expect(markup).toContain(`class="leaflet__environment" src="${vehiclesEnvironmentDesktopBack}" alt="" aria-hidden="true"`)
    expect(markup).not.toContain(`src="${vehiclesEnvironmentDesktop}"`)
    expect(markup).toContain('The Vehicles Collection')
    expect(markup).toContain('Choose a build to take a closer look.')
    expect(markup).toContain('leaflet__print-area--collection-back')
    expect(visibleIds).toHaveLength(11)
    expect(visibleIds.every(id => collection.some(item => item.id === id))).toBe(true)
    expect(visibleIds).not.toContain(741)
    expect(markup).not.toContain('Rally Car')
    expect(markup).not.toContain('77250')
    expect(markup).not.toContain('£24.99')
    for (const frontCopy of ['Build &amp; Bloom', 'More to explore', 'Small bricks.', 'Big possibilities.', 'Build. Play. Collect. Bloom.']) {
      expect(markup).not.toContain(frontCopy)
    }
    expect(markup).not.toContain('← Back to the storybook')
    expect(markup).toContain('aria-label="Close leaflet"')
    expect(markup).toContain('← Turn over')
  })
  it('displays the complete Vehicles collection when it contains at most eleven products', () => {
    const vehicles = { ...category, name: 'Vehicles' }
    const collection = collectionProducts(11)
    const markup = renderToStaticMarkup(<CategoryLeaflet category={vehicles} products={collection} side="back" onClose={() => {}} onDetails={() => {}} />)
    expect(printedIds(markup)).toEqual(collection.map(item => item.id))
  })
  it('randomly samples without mutating the source collection', () => {
    const collection = collectionProducts(16)
    const original = [...collection]
    const lowSample = selectHarryPotterLeafletProducts(collection, () => 0)
    const highSample = selectHarryPotterLeafletProducts(collection, () => .999999)
    expect(lowSample).toHaveLength(11)
    expect(lowSample.every(item => original.some(source => source.id === item.id))).toBe(true)
    expect(lowSample.map(item => item.id)).not.toEqual(highSample.map(item => item.id))
    expect(collection).toEqual(original)
  })
  it('keeps every product represented once across both sides', () => {
    const products = [product(4), feature, product(2), product(3), product(1), product(5)]
    const front = renderToStaticMarkup(<LeafletContent category={genericCategory} products={products} side="front" onDetails={() => {}} />)
    expect(printedIds(front)).toEqual([9])
    const back = renderToStaticMarkup(<LeafletContent category={genericCategory} products={products} side="back" onDetails={() => {}} />)
    expect(printedIds(back)).toEqual([4, 2, 3, 1, 5])
    const allIds = [...printedIds(front), ...printedIds(back)]
    expect(new Set(allIds).size).toBe(allIds.length)
  })
  it('handles empty and unfeatured product arrays without placeholder cards', () => {
    const solo = renderToStaticMarkup(<LeafletContent category={genericCategory} products={[feature]} side="front" onDetails={() => {}} />)
    expect(solo).not.toContain('leaflet__teasers')
    const empty = renderToStaticMarkup(<LeafletContent category={genericCategory} products={[]} side="front" onDetails={() => {}} />)
    expect(empty).not.toContain('data-leaflet-product=')
  })
  it('has a named dialog, return control and one whole-sheet turnover control', () => {
    const markup = renderToStaticMarkup(<CategoryLeaflet category={genericCategory} products={[feature]} onClose={() => {}} onDetails={() => {}} />)
    expect(markup).toContain('<dialog')
    expect(markup).toContain('aria-labelledby="leaflet-title"')
    expect(markup).toContain('Close leaflet')
    expect(markup).toContain('Turn over →')
    expect(markup).not.toContain('book-shell')
  })
  it('adds the local environment layer only to the Harry Potter Leaflet', () => {
    const harryPotter = { ...category, name: 'Harry Potter' }
    const harryPotterMarkup = renderToStaticMarkup(<CategoryLeaflet category={harryPotter} products={[feature]} onClose={() => {}} onDetails={() => {}} />)
    const otherCategoryMarkup = renderToStaticMarkup(<CategoryLeaflet category={genericCategory} products={[feature]} onClose={() => {}} onDetails={() => {}} />)
    expect(harryPotterMarkup).toContain(`class="leaflet__environment" src="${harryPotterEnvironmentDesktop}" alt="" aria-hidden="true"`)
    expect(otherCategoryMarkup).not.toContain('leaflet__environment')
  })
  it('keeps the Harry Potter front to one accessible featured story', () => {
    const harryPotter = { ...category, name: 'Harry Potter', subtitle: 'Magic in every build' }
    const markup = renderToStaticMarkup(<CategoryLeaflet category={harryPotter} products={[feature, ...others]} onClose={() => {}} onDetails={() => {}} />)
    expect(printedIds(markup)).toEqual([feature.id])
    expect(markup).toContain('aria-labelledby="leaflet-title"')
    expect(markup).toContain('id="leaflet-title">API product 9</h3>')
    expect(markup).toContain('API theme · test-9')
    expect(markup).toContain('123 pieces')
    expect(markup).toContain('£12.99')
    expect(markup).toContain('1 available')
    expect(markup).toContain('Take a closer look')
    expect(markup).not.toContain('Build &amp; Bloom')
    expect(markup).not.toContain('Small bricks.')
    expect(markup).not.toContain('Harry Potter collection')
    expect(markup).not.toContain('Magic in every build')
    expect(markup).not.toContain('Test editorial copy')
    expect(markup).not.toContain('Featured build')
    expect(markup).not.toContain('A little more to love')
    expect(markup).not.toContain('data-leaflet-product="1"')
    expect(markup).not.toContain('data-leaflet-product="2"')
    expect(markup).toContain('src="/feature.png"')
    expect(markup).not.toContain('/product-image-9.jpg')
  })
  it('renders the Vehicles front theme with its environment and existing featured product', () => {
    const markup = renderToStaticMarkup(<CategoryLeaflet category={category} products={[feature, ...others]} onClose={() => {}} onDetails={() => {}} />)

    expect(markup).toContain(`class="leaflet__environment" src="${vehiclesEnvironmentDesktop}" alt="" aria-hidden="true"`)
    expect(markup).not.toContain('The Vehicles Collection')
    expect(markup).not.toContain('Built for speed. Made to explore.')
    expect(markup).toContain('class="leaflet__print-area leaflet__print-area--front leaflet__print-area--vehicles-front"')
    expect(printedIds(markup)).toEqual([feature.id])
    expect(markup).toContain('API product 9')
    expect(markup).toContain('id="leaflet-title">API product 9</h3>')
    expect(markup).toContain('test-9')
    expect(markup).toContain('123 pieces · Ages 9+')
    expect(markup).toContain('£12.99')
    expect(markup).toContain('Take a closer look')
    expect(markup).not.toContain('← Back to the storybook')
    expect(markup).toContain('aria-label="Close leaflet"')
    expect(markup).toContain('Turn over →')
  })
  it('renders Star Wars through the shared featured-build front with its supplied environment', () => {
    const markup = renderToStaticMarkup(<CategoryLeaflet category={starWars} products={[feature, ...others]} onClose={() => {}} onDetails={() => {}} />)

    expect(markup).toContain(`class="leaflet__environment" src="${starWarsEnvironmentDesktop}" alt="" aria-hidden="true"`)
    expect(markup).not.toContain(`src="${starWarsEnvironmentDesktopBack}"`)
    expect(markup).toContain('class="leaflet__print-area leaflet__print-area--front leaflet__print-area--star-wars-front"')
    expect(markup).not.toContain('class="leaflet__star-wars-heading"')
    expect(markup).not.toContain('class="leaflet__editorial"')
    expect(markup).not.toContain('Adventure among the stars')
    expect(markup).not.toContain('Travel to galaxies far away')
    expect(printedIds(markup)).toContain(feature.id)
    expect(markup).toContain('class="leaflet__star-wars-featured-build" aria-label="Star Wars Featured Build"')
    expect(markup).toContain('class="leaflet-product leaflet-product--featured"')
    expect(markup).toContain('src="/feature.png"')
    expect(markup.match(/class="leaflet-product__art"/g)).toHaveLength(1)
    expect(printedIds(markup)).toEqual([feature.id])
    expect(markup).not.toContain('class="leaflet__products')
    expect(markup).not.toContain('data-leaflet-product="1"')
    expect(markup).not.toContain('data-leaflet-product="2"')
    expect(markup).toContain('Take a closer look')
    expect(markup).toContain('aria-label="Close leaflet"')
    expect(markup).toContain('Turn over →')
    expect(markup).not.toContain('<h1 id="leaflet-title">Star Wars</h1>')
  })
  it('renders the Friends front as one featured product inside its supplied environment', () => {
    const markup = renderToStaticMarkup(<CategoryLeaflet category={friends} products={[others[0], feature, others[1]]} onClose={() => {}} onDetails={() => {}} />)

    expect(markup).toContain(`class="leaflet__environment" src="${friendsEnvironmentDesktop}" alt="" aria-hidden="true"`)
    expect(markup).not.toContain(`src="${friendsEnvironmentDesktopBack}"`)
    expect(markup).toContain('leaflet__print-area--friends-front')
    expect(markup).toContain('class="leaflet__friends-layout"')
    expect(markup.match(/class="leaflet-product leaflet-product--featured"/g)).toHaveLength(1)
    expect(markup).toContain('class="leaflet__friends-story" aria-label="Friends Featured Build"')
    expect(printedIds(markup)).toEqual([feature.id])
    expect(markup).toContain('id="leaflet-title">API product 9</h3>')
    expect(markup).toContain('123 pieces')
    expect(markup).toContain('£12.99')
    expect(markup).toContain('Take a closer look')
    expect(markup).not.toContain('The Friends Collection')
    expect(markup).not.toContain('class="leaflet__products')
  })
  it.each([1, 2, 3, 5, 6, 9, 11])('renders a variable Friends reverse collection of %i catalogue products', count => {
    const featured = product(980, [offer(1980, { legoProductId: 980 })], { title: 'Friends feature', isFeatureProduct: true })
    const collection = collectionProducts(count).map(item => ({ ...item, catalogueArtworkUrl: `/catalogue/friends-${item.id}.png` }))
    const products = [featured, ...collection]
    const markup = renderToStaticMarkup(<CategoryLeaflet category={friends} products={products} side="back" onClose={() => {}} onDetails={() => {}} />)

    expect(markup).toContain(`class="leaflet__environment" src="${friendsEnvironmentDesktopBack}" alt="" aria-hidden="true"`)
    expect(markup).not.toContain(`src="${friendsEnvironmentDesktop}"`)
    expect(markup).toContain('leaflet__print-area--friends-back')
    expect(markup).toContain('leaflet__products--friends-collection')
    expect(printedIds(markup)).toEqual(collectionProducts(count).map(item => item.id))
    expect(printedIds(markup)).not.toContain(featured.id)
    expect(markup).not.toContain('The Friends Collection')
    expect(markup).not.toContain('Choose a build to take a closer look.')
    expect(markup).not.toContain('leaflet__collection-heading')
    const rendered = document.createElement('div')
    rendered.innerHTML = markup
    expect(rendered.querySelector('#leaflet-title')?.getAttribute('aria-label')).toBe('Friends collection products')
    for (const item of collection) {
      expect(rendered.querySelector(`[data-leaflet-product="${item.id}"] img`)?.getAttribute('src')).toBe(item.catalogueArtworkUrl)
    }
    expect(markup).toContain('← Turn over')
  })
  it('caps a larger Friends reverse at eleven real catalogue products and excludes the front feature', () => {
    const featured = product(981, [offer(1981, { legoProductId: 981 })], { title: 'Friends feature', isFeatureProduct: true })
    const source = [featured, ...collectionProducts(16)]
    const markup = renderToStaticMarkup(<CategoryLeaflet category={friends} products={source} side="back" onClose={() => {}} onDetails={() => {}} />)
    const visible = printedIds(markup)

    expect(visible).toHaveLength(11)
    expect(visible.every(id => source.some(item => item.id === id))).toBe(true)
    expect(visible).not.toContain(featured.id)
    expect(markup).not.toContain('Friends feature')
  })
  it('shows one Star Wars Featured Build on the front and keeps the remaining products on the back', () => {
    const features = Array.from({ length: 3 }, (_, index) => product(930 + index, [offer(1930 + index)], {
      title: `Star Wars feature ${index + 1}`, isFeatureProduct: true,
    }))
    const standards = [product(940), product(941)]
    const products = [standards[0], features[0], standards[1], ...features.slice(1)]
    const front = renderToStaticMarkup(<LeafletContent category={starWars} products={products} side="front" onDetails={() => {}} />)
    const back = renderToStaticMarkup(<LeafletContent category={starWars} products={products} side="back" onDetails={() => {}} />)
    expect(printedIds(front)).toEqual([features[0].id])
    expect(front.match(/class="leaflet-product leaflet-product--featured"/g)).toHaveLength(1)
    expect(front.match(/class="leaflet-product__art"/g)).toHaveLength(1)
    expect(front).not.toContain('leaflet__star-wars-featured-slot')
    expect(front).not.toContain('class="leaflet__products')
    expect(printedIds(back)).toEqual([...standards, ...features.slice(1)].map(item => item.id))
    expect(printedIds(back)).not.toContain(features[0].id)
  })
  it('renders one Star Wars Featured Build and puts all remaining featured products on the back', () => {
    const features = Array.from({ length: 4 }, (_, index) => product(950 + index, [offer(1950 + index)], {
      title: `Star Wars feature ${index + 1}`, isFeatureProduct: true,
    }))
    const standard = product(960)
    const products = [features[0], standard, ...features.slice(1)]
    const front = renderToStaticMarkup(<LeafletContent category={starWars} products={products} side="front" onDetails={() => {}} />)
    const back = renderToStaticMarkup(<LeafletContent category={starWars} products={products} side="back" onDetails={() => {}} />)

    expect(printedIds(front)).toEqual([features[0].id])
    expect(printedIds(back)).toEqual([standard.id, ...features.slice(1).map(item => item.id)])
  })
  it('switches Star Wars to its two-column collection reverse and keeps product selection in the shared detail flow', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })))
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
    const selected = product(88, [offer(808, { legoProductId: 88 })], { title: 'X-wing Starfighter', setNumber: '75301', catalogueArtworkUrl: '/x-wing.png' })
    const onDetails = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => { root.render(<CategoryLeaflet category={starWars} products={[feature, selected, ...others]} onClose={() => {}} onDetails={onDetails} />) })

    expect(container.querySelector('.leaflet__environment')?.getAttribute('src')).toBe(starWarsEnvironmentDesktop)
    await act(async () => { container.querySelector<HTMLButtonElement>('.leaflet__turn')!.click() })

    expect(container.querySelector('.leaflet[data-side="back"]')).not.toBeNull()
    expect(container.querySelector('.leaflet__environment')?.getAttribute('src')).toBe(starWarsEnvironmentDesktopBack)
    expect(container.querySelector('.leaflet__print-area--star-wars-back')).not.toBeNull()
    expect(container.querySelector('.leaflet__products--star-wars-collection')).not.toBeNull()
    expect(container.querySelector('.leaflet__products--star-wars-collection')?.classList.contains('leaflet__products--vehicles-collection')).toBe(false)
    expect(printedIds(container.innerHTML)).toEqual([88, 1, 2])
    expect(printedIds(container.innerHTML)).not.toContain(feature.id)
    expect(container.querySelectorAll('[aria-label="Close leaflet"]')).toHaveLength(1)
    expect(container.querySelector('.leaflet__turn')?.textContent).toBe('← Turn over')
    await act(async () => { container.querySelector<HTMLButtonElement>('.leaflet__turn')!.click() })
    expect(container.querySelector('.leaflet__environment')?.getAttribute('src')).toBe(starWarsEnvironmentDesktop)
    await act(async () => { container.querySelector<HTMLButtonElement>('.leaflet__turn')!.click() })
    expect(container.querySelector('.leaflet__environment')?.getAttribute('src')).toBe(starWarsEnvironmentDesktopBack)
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-leaflet-product="88"] .leaflet-product__title-button')!.click() })
    expect(onDetails).toHaveBeenCalledWith(808)

    await act(async () => root.unmount())
  })
  it.each(['Vehicles', 'Harry Potter', 'Star Wars', 'Friends'])('keeps a non-first %s Featured Build exclusively on the front', theme => {
    const themedCategory = { ...category, name: theme }
    const featured = product(912, [offer(1912, { legoProductId: 912 })], { title: `${theme} feature`, isFeatureProduct: true })
    const standards = [product(914), product(915)]
    const source = [standards[0], featured, standards[1]]
    const front = renderToStaticMarkup(<CategoryLeaflet category={themedCategory} products={source} onClose={() => {}} onDetails={() => {}} />)
    const back = renderToStaticMarkup(<CategoryLeaflet category={themedCategory} products={source} side="back" onClose={() => {}} onDetails={() => {}} />)
    const frontIds = printedIds(front)
    const backIds = printedIds(back)

    expect(frontIds).toEqual([featured.id])
    expect(backIds).toEqual(standards.map(item => item.id))
    expect(backIds).not.toContain(featured.id)
    expect(new Set([...frontIds, ...backIds]).size).toBe(frontIds.length + backIds.length)
    expect(front).not.toContain('class="leaflet__products')
    expect(back).toContain('← Turn over')
  })
  it.each(['Vehicles', 'Harry Potter', 'Star Wars', 'Friends'])('keeps a featured-only %s leaflet free of reverse duplicates', theme => {
    const themedCategory = { ...category, name: theme }
    const featured = product(916, [offer(1916, { legoProductId: 916 })], { title: `${theme} only feature`, isFeatureProduct: true })
    const back = renderToStaticMarkup(<CategoryLeaflet category={themedCategory} products={[featured]} side="back" onClose={() => {}} onDetails={() => {}} />)
    expect(printedIds(back)).toEqual([])
    expect(back).not.toContain(`${theme} only feature`)
    expect(back).toContain('More discoveries are on their way.')
  })
  it.each(['Vehicles', 'Harry Potter', 'Star Wars', 'Friends'])('keeps only the one non-feature product on a small %s reverse', theme => {
    const themedCategory = { ...category, name: theme }
    const featured = product(917, [offer(1917, { legoProductId: 917 })], { title: `${theme} feature`, isFeatureProduct: true })
    const standard = product(918, [offer(1918, { legoProductId: 918 })], { title: `${theme} standard` })
    const back = renderToStaticMarkup(<CategoryLeaflet category={themedCategory} products={[featured, standard]} side="back" onClose={() => {}} onDetails={() => {}} />)
    expect(printedIds(back)).toEqual([standard.id])
    expect(back).not.toContain(`${theme} feature`)
    expect(back).toContain(`${theme} standard`)
  })
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Reverse collection product selection', () => {
  it('keeps its random eleven-product selection stable through ordinary rerenders', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })))
    vi.spyOn(Math, 'random').mockReturnValue(.25)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
    const collection = collectionProducts(16)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const render = () => <CategoryLeaflet category={harryPotter} products={collection} side="back" onClose={() => {}} onDetails={() => {}} />
    await act(async () => { root.render(render()) })
    const firstSelection = printedIds(container.innerHTML)
    const randomCalls = vi.mocked(Math.random).mock.calls.length

    await act(async () => { root.render(render()) })
    expect(printedIds(container.innerHTML)).toEqual(firstSelection)
    expect(vi.mocked(Math.random).mock.calls).toHaveLength(randomCalls)
    await act(async () => root.unmount())
  })

  it('turns over and opens the selected product through the existing details callback', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })))
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
    const harryPotter = { ...category, name: 'Harry Potter' }
    const selected = product(88, [offer(808, { legoProductId: 88 })], { title: 'Azkaban Express', setNumber: '76408' })
    const onDetails = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => { root.render(<CategoryLeaflet category={harryPotter} products={[feature, selected]} onClose={() => {}} onDetails={onDetails} />) })

    await act(async () => { container.querySelector<HTMLButtonElement>('.leaflet__turn')!.click() })
    expect(container.querySelector('.leaflet[data-side="back"]')).not.toBeNull()
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-leaflet-product="88"] .leaflet-product__title-button')!.click() })
    expect(onDetails).toHaveBeenCalledWith(808)

    await act(async () => root.unmount())
  })

  it('uses the shared turn control to flip the Vehicles leaflet', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })))
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => { root.render(<CategoryLeaflet category={category} products={[feature, ...others]} onClose={() => {}} onDetails={() => {}} />) })

    await act(async () => { container.querySelector<HTMLButtonElement>('.leaflet__turn')!.click() })
    expect(container.querySelector('.leaflet[data-side="back"]')).not.toBeNull()
    expect(container.querySelector('.leaflet__turn')?.textContent).toBe('← Turn over')

    await act(async () => { container.querySelector<HTMLButtonElement>('.leaflet__turn')!.click() })
    expect(container.querySelector('.leaflet[data-side="front"]')).not.toBeNull()

    await act(async () => root.unmount())
  })

  it('flips the Friends leaflet with its matching environment and opens reverse products through the shared detail flow', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })))
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
    const selected = product(989, [offer(1989, { legoProductId: 989 })], { title: 'Heartlake City Café', setNumber: '42618' })
    const onDetails = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => { root.render(<CategoryLeaflet category={friends} products={[feature, selected]} onClose={() => {}} onDetails={onDetails} />) })

    expect(container.querySelector('.leaflet__environment')?.getAttribute('src')).toBe(friendsEnvironmentDesktop)
    await act(async () => { container.querySelector<HTMLButtonElement>('.leaflet__turn')!.click() })
    expect(container.querySelector('.leaflet__environment')?.getAttribute('src')).toBe(friendsEnvironmentDesktopBack)
    expect(container.querySelector('.leaflet__products--friends-collection')).not.toBeNull()
    expect(container.querySelector('.leaflet__collection-heading')).toBeNull()
    expect(printedIds(container.innerHTML)).toEqual([selected.id])
    await act(async () => { container.querySelector<HTMLButtonElement>(`[data-leaflet-product="${selected.id}"] .leaflet-product__title-button`)!.click() })
    expect(onDetails).toHaveBeenCalledWith(1989)

    await act(async () => root.unmount())
  })

  it('keeps the shared Vehicles collection sample stable and opens a selected reverse product', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })))
    vi.spyOn(Math, 'random').mockReturnValue(.25)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
    const vehicles = { ...category, name: 'Vehicles' }
    const collection = collectionProducts(16)
    const onDetails = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const render = () => <CategoryLeaflet category={vehicles} products={collection} side="back" onClose={() => {}} onDetails={onDetails} />
    await act(async () => { root.render(render()) })
    const firstSelection = printedIds(container.innerHTML)
    const randomCalls = vi.mocked(Math.random).mock.calls.length

    await act(async () => { root.render(render()) })
    expect(printedIds(container.innerHTML)).toEqual(firstSelection)
    expect(vi.mocked(Math.random).mock.calls).toHaveLength(randomCalls)
    expect(selectCollectionLeafletProducts(collection)).toHaveLength(11)

    const selected = collection.find(item => item.id === firstSelection[0])!
    await act(async () => { container.querySelector<HTMLButtonElement>(`[data-leaflet-product="${selected.id}"] .leaflet-product__title-button`)!.click() })
    expect(onDetails).toHaveBeenCalledWith(selected.offers[0].id)
    await act(async () => root.unmount())
  })
})
