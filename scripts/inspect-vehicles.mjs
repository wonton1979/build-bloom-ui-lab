// Finite production-build inspection. No dev server, dependencies or data writes.
// Default: real API. --fixtures: isolated HTTP responses for navigation/artwork tests.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const fixtureMode = process.argv.includes('--fixtures')
const dir = resolve('node_modules/.tmp/vehicles-inspection', fixtureMode ? 'fixtures' : 'live')
mkdirSync(dir, { recursive: true })
const dist = resolve('dist')
assert(existsSync(resolve(dist, 'index.html')), 'Run the production build first')
const fixture = (id, feature = false) => ({
  id, isRetired: false, setNumber: 'fixture-' + id,
  title: id % 3 === 0 ? 'Classic Defender Off-Road Adventure and Expedition Vehicle ' + id : 'Catalogue integration vehicle number ' + id,
  theme: id % 2 ? 'Test theme' : 'Speed Champions', ageRecommendation: id % 2 ? '9' : '18+', pieceCount: id % 2 ? 123 : 2345,
  description: 'Test product description ' + id,
  category: { id: 11, name: 'Vehicles', subtitle: 'Built for the thrill', description: 'Test category editorial copy', imageUrl: null },
  isFeatureProduct: feature, catalogueArtworkUrl: null, catalogueArtworkPublicId: null,
  productImages: [
    { id: id * 10 + 1, url: '/__test-photo.svg?image=1', altText: 'Test product photograph one', sortOrder: 0 },
    { id: id * 10 + 2, url: '/__test-photo.svg?image=2', altText: 'Test product photograph two', sortOrder: 1 },
    { id: id * 10 + 3, url: '/__test-photo.svg?image=3', altText: null, sortOrder: 2 },
  ],
  offers: [{ id: id + 1000, legoProductId: id, condition: 'NEW', usedLifecycle: null, damageDescription: null,
    originalPrice: '25.99', salePrice: null, effectivePrice: '25.99', currentStock: 5, availableStock: 5, active: true, usedConditionPhotos: [] }],
})
let fixtureProducts = [fixture(90, true), ...Array.from({ length: 11 }, (_, i) => fixture(i + 1))]
let servedProducts = []
const selectedOffer = product => product.offers.find(offer => offer.active && offer.availableStock > 0 && offer.condition === 'NEW')
  ?? product.offers.find(offer => offer.active && offer.availableStock > 0 && offer.usedLifecycle === 'AVAILABLE')
const requests = []
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405).end(); return }
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/api/categories') {
      const data = fixtureMode ? [fixture(1).category] : await (await fetch((process.env.CATALOGUE_API_URL || 'http://localhost:3000') + '/categories')).json()
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
      return
    }
    if (url.pathname === '/api/products') {
      assert.equal(url.searchParams.get('categoryId'), '11')
      assert(!url.searchParams.has('colorfulLifeCategory'))
      let data
      if (fixtureMode) {
        data = { items: fixtureProducts, pagination: { page: 1, pageSize: 100, totalItems: fixtureProducts.length, totalPages: 1 } }
      } else {
        const response = await fetch((process.env.CATALOGUE_API_URL || 'http://localhost:3000') + '/products' + url.search, { signal: AbortSignal.timeout(10000) })
        assert(response.ok, 'Local API failed: ' + response.status)
        data = await response.json()
      }
      servedProducts = url.searchParams.get('page') === '1' ? data.items : [...servedProducts, ...data.items]
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
      return
    }
    if (url.pathname.startsWith('/__test-') && fixtureMode) {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240"><ellipse cx="180" cy="120" rx="145" ry="65" fill="#80aaa0" fill-opacity=".5"/><text x="100" y="125" fill="#493c31">Test delivery asset</text></svg>'
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end(svg)
      return
    }
    const file = resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!file.startsWith(dist + sep) || !existsSync(file)) { res.writeHead(404).end(); return }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime }).end(readFileSync(file))
  } catch (error) { res.writeHead(500).end(String(error)) }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const frontendUrl = 'http://127.0.0.1:' + server.address().port
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
  '--user-data-dir=' + dir + '/profile', '--remote-debugging-port=0',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
let socket
const deadline = setTimeout(() => { browser.kill(); server.closeAllConnections(); server.close(); process.exitCode = 1 }, 240000)
try {
  const ws = await new Promise((resolve, reject) => {
    let logs = ''
    browser.stderr.on('data', b => { logs += b; const m = logs.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) resolve(m[1]) })
    browser.on('error', reject)
    browser.on('exit', () => reject(new Error('Browser exited')))
  })
  socket = new WebSocket(ws)
  await new Promise(r => socket.addEventListener('open', r, { once: true }))
  let serial = 0
  const pending = new Map()
  socket.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url)
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result) }
  })
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++serial
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const call = (method, params) => send(method, params, sessionId)
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  const waitFor = async expression => {
    for (let i = 0; i < 120; i++) {
      if (await evaluate(`(${expression}) && !document.querySelector('.catalogue-turn')`)) return
      await new Promise(r => setTimeout(r, 100))
    }
    throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText'))
  }
  const settle = () => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
  const click = async text => {
    assert(await evaluate(`(() => { const e = [...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === ${JSON.stringify(text)} && !e.closest('[inert]')); if (!e || e.disabled) return false; e.click(); return true })()`), text)
    await settle()
  }
  const index = () => evaluate("Number(document.querySelector('[data-product-index]')?.dataset.productIndex)")
  const ids = () => evaluate("[...document.querySelectorAll('.book-shell__spread [data-product-id]')].map(e => Number(e.dataset.productId))")
  const finishTurn = () => waitFor("!document.querySelector('.catalogue-turn')")
  const snapshot = async name => {
    await settle()
    const shot = await call('Page.captureScreenshot', { format: 'png' })
    writeFileSync(resolve(dir, name + '.png'), Buffer.from(shot.data, 'base64'))
  }
  const checkLayout = async (name, width, height) => {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
    await settle()
    const metrics = await evaluate(`(() => {
      const pages = [...document.querySelectorAll('.book-shell__spread .book-shell__content')];
      const overlaps = [...document.querySelectorAll('.vehicles-supporting-products')].some(group => {
        const children = [...group.children].map(e => e.getBoundingClientRect());
        return children.length > 1 && children[0].bottom > children[1].top;
      });
      const navCollisions = pages.some(page => {
        const nav = page.querySelector('.spread-page__navigation');
        const products = [...page.querySelectorAll('[data-product-id]')];
        return nav && products.some(p => p.getBoundingClientRect().bottom > nav.getBoundingClientRect().top);
      });
      return { horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        pages: pages.map(e => ({ width: e.clientWidth, scrollWidth: e.scrollWidth, height: e.clientHeight, scrollHeight: e.scrollHeight })),
        overlaps, navCollisions, scrollX, scrollY };
    })()`)
    assert(!metrics.horizontalOverflow && !metrics.overlaps && !metrics.navCollisions, JSON.stringify(metrics))
    assert(metrics.pages.every(p => p.scrollWidth <= p.width))
    if (width > 1100) assert(metrics.pages.every(p => p.scrollHeight <= p.height), JSON.stringify(metrics))
    assert.equal(metrics.scrollX, 0)
    assert.equal(metrics.scrollY, 0)
    await snapshot(name + '-' + width)
    console.log(name, width, JSON.stringify(metrics))
  }
  const enterVehicles = async (continueBrowsing = true) => {
    await call('Page.navigate', { url: frontendUrl })
    await waitFor("Boolean(document.querySelector('.closed-catalogue__trigger'))")
    await evaluate("document.querySelector('.closed-catalogue__trigger').click()")
    await waitFor("document.querySelector('[data-book-state=open]') && !document.querySelector('.opening-transition')")
    await evaluate("window.originalBook = document.querySelector('.book-shell'); window.originalRect = originalBook.getBoundingClientRect().toJSON()")
    await evaluate("document.querySelector('.front-matter__entry:not(:disabled)').click()")
    await finishTurn()
    await click('More →')
    await finishTurn()
    await evaluate("document.querySelector('a[href=\"/categories/vehicles\"]').click()")
    await waitFor("Boolean(document.querySelector('.category-opening__invitation'))")
    if (!continueBrowsing) return
    await click('Continue in the storybook →')
    await finishTurn()
    await waitFor("Boolean(document.querySelector('[data-product-index]'))")
    await settle()
  }
  const assertBook = async () => {
    assert(await evaluate("originalBook === document.querySelector('.book-shell') && document.querySelector('.catalogue-stage').dataset.bookState === 'open'"))
  }
  // Real pointer input catches overlapping transparent artwork; DOM click()
  // and keyboard activation intentionally bypass browser hit-testing.
  const pointerClick = async (selector, xFraction = .5, yFraction = .5) => {
    const point = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      el.scrollIntoView({block:'nearest',inline:'nearest'});
      const r = el.getBoundingClientRect();
      return {x:r.x+r.width*${xFraction},y:r.y+r.height*${yFraction}};
    })()`)
    const intendedHit = () => evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      return el.contains(document.elementFromPoint(${point.x},${point.y}));
    })()`)
    assert(await intendedHit(), 'Pointer intercepted before hover: ' + selector)
    await call('Input.dispatchMouseEvent', {type:'mouseMoved', ...point})
    await settle()
    assert(await intendedHit(), 'Pointer intercepted after hover: ' + selector)
    await call('Input.dispatchMouseEvent', {type:'mousePressed', ...point, button:'left', clickCount:1})
    await call('Input.dispatchMouseEvent', {type:'mouseReleased', ...point, button:'left', clickCount:1})
    await settle()
  }
  const checkPointerInteractions = async () => {
    const geometry = () => evaluate(`JSON.stringify(['.book-shell','.stage-user','.stage-cart'].map(s => document.querySelector(s).getBoundingClientRect().toJSON()))`)
    for (const [width,height] of [[1440,900],[820,900],[390,844]]) {
      await call('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:width<600})
      await settle()
      const before = await geometry()
      const checked = []
      do {
        for (const id of await ids()) {
          const listingId = selectedOffer(servedProducts.find(product => product.id === id)).id
          const originalIndex = await index()
          // Cover both edges and the centre of the visible Details label.
          for (const fraction of [.15,.5,.85]) {
            await pointerClick(`[data-product-id="${id}"] button`, fraction)
            await waitFor(`Boolean(document.querySelector('[data-detail-listing-id="${listingId}"]'))`)
            assert(!await evaluate("Boolean(document.querySelector('.account-modal'))"))
            await assertBook()
            await pointerClick('.spread-page__navigation button')
            await finishTurn()
            assert.equal(await index(), originalIndex)
          }
          if (await evaluate(`Boolean(document.querySelector('[data-product-id="${id}"] .vehicle-product__art-button'))`)) {
            await pointerClick(`[data-product-id="${id}"] .vehicle-product__art-button`)
            await waitFor(`Boolean(document.querySelector('[data-detail-listing-id="${listingId}"]'))`)
            assert(!await evaluate("Boolean(document.querySelector('.account-modal'))"))
            await pointerClick('.spread-page__navigation button')
            await finishTurn()
            await evaluate(`document.querySelector('[data-product-id="${id}"] .vehicle-product__art-button').focus()`)
            await call('Input.dispatchKeyEvent', {type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13})
            await call('Input.dispatchKeyEvent', {type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
            await waitFor(`Boolean(document.querySelector('[data-detail-listing-id="${listingId}"]'))`)
            assert(!await evaluate("Boolean(document.querySelector('.account-modal'))"))
            await pointerClick('.spread-page__navigation button')
            await finishTurn()
          }
          checked.push(id)
        }
        if (!await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='More Vehicles →')")) break
        await pointerClick('.spread-page--right .spread-page__navigation button')
        await finishTurn()
      } while (true)
      assert.equal(await geometry(), before, 'Book/User/Cart geometry must not change')
      if (width > 760) {
        await pointerClick('.stage-user', .5, .8)
        await waitFor("Boolean(document.querySelector('.account-modal'))")
        await pointerClick('.account-modal__close')
        await waitFor("!document.querySelector('.account-modal')")
        await pointerClick('.stage-cart')
        await waitFor("document.querySelector('.guest-cart-bubble')?.textContent.includes('use your cart')")
        await pointerClick('.guest-cart-bubble')
        await waitFor("Boolean(document.querySelector('.account-modal'))")
        await pointerClick('.account-modal__close')
        await waitFor("!document.querySelector('.account-modal')")
      }
      while (await index() > 0) { await pointerClick('.spread-page__navigation button'); await finishTurn() }
      console.log('PASS pointer hit-testing', width, checked)
    }
    await call('Emulation.setDeviceMetricsOverride', {width:1440,height:900,deviceScaleFactor:1,mobile:false})
  }
  const checkDetails = async id => {
    const product = servedProducts.find(p => p.id === id)
    const listingId = selectedOffer(product).id
    await evaluate(`document.querySelector('[data-product-id="${id}"] button').focus({preventScroll:true})`)
    assert(await evaluate(`document.activeElement === document.querySelector('[data-product-id="${id}"] button')`), 'Details must be keyboard focusable')
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 })
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await waitFor(`Boolean(document.querySelector('[data-detail-listing-id="${listingId}"]'))`)
    await assertBook()
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.product-details__thumbnail img')].map(i => i.getAttribute('src'))"), product.productImages.map(i => i.url))
    if (product.productImages.length > 1) {
      assert.equal(await evaluate("document.querySelector('.product-details__main-image img')?.getAttribute('src')"), product.productImages[0].url)
      assert.equal(await evaluate("document.querySelectorAll('.product-details__thumbnail').length"), product.productImages.length)
      assert.equal(await evaluate("document.querySelector('.product-details__thumbnail[aria-pressed=\"true\"] img')?.getAttribute('src')"), product.productImages[0].url)
      await evaluate("document.querySelectorAll('.product-details__thumbnail')[1].click()")
      assert.equal(await evaluate("document.querySelector('.product-details__main-image img')?.getAttribute('src')"), product.productImages[1].url)
      assert.equal(await evaluate("document.querySelectorAll('.product-details__thumbnail[aria-pressed=\"true\"]').length"), 1)
      await snapshot('details-gallery-' + id)
    }
    await click('← Back to Vehicles')
    await finishTurn()
    await waitFor("Boolean(document.querySelector('[data-product-index]'))")
    await assertBook()
  }

  await call('Network.enable')
  // URL checks never depend on a successful external CDN download.
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await enterVehicles()
  const firstIds = await ids()
  const expected = servedProducts.filter(p => p.category?.id === 11)
  assert(expected.every(p => typeof p.isFeatureProduct === 'boolean' && 'catalogueArtworkUrl' in p))
  const feature = expected.find(p => p.isFeatureProduct)
  const standards = expected.filter(p => p !== feature)
  assert.deepEqual(firstIds, standards.slice(0, 4).map(p => p.id))
  assert(await evaluate("JSON.stringify(originalRect) === JSON.stringify(originalBook.getBoundingClientRect().toJSON())"))
  await assertBook()
  if (process.argv.includes('--hit-testing')) await checkPointerInteractions()
  if (fixtureMode) {
    await checkDetails(standards[0].id)
    // Two immediate activations must schedule one turn, not skip a spread.
    await evaluate("(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'More Vehicles →'); button.click(); button.click() })()")
    await settle()
    assert(await evaluate("document.querySelectorAll('.catalogue-turn').length === 1 && [...document.querySelectorAll('.spread-page__navigation button')].every(b => b.disabled)"))
    await finishTurn()
    assert.equal(await index(), 1)
    assert.deepEqual(await ids(), standards.slice(4, 8).map(p => p.id))
    assert(await evaluate("document.activeElement.classList.contains('catalogue-stage')"))
    await checkDetails(standards[4].id)
    assert.equal(await index(), 1)
    for (const [w, h] of [[1440,900], [1280,800], [1366,768], [820,900], [390,844]]) await checkLayout('later-missing-artwork', w, h)
    await call('Emulation.setDeviceMetricsOverride', { width:1440, height:900, deviceScaleFactor:1, mobile:false })
    await click('More Vehicles →')
    await finishTurn()
    assert.equal(await index(), 2)
    assert.deepEqual(await ids(), standards.slice(8).map(p => p.id))
    assert(!await evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'More Vehicles →')"))
    await click('← Back')
    await finishTurn()
    assert.equal(await index(), 1)
    await click('← Back')
    await finishTurn()
    assert.equal(await index(), 0)
  } else {
    if (firstIds.length) await checkDetails(firstIds[0])
    const seen = [...firstIds]
    while (await evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'More Vehicles →')")) {
      await click('More Vehicles →')
      await finishTurn()
      seen.push(...await ids())
    }
    assert.deepEqual([...seen].sort((a,b) => a-b), standards.map(p => p.id).sort((a,b) => a-b))
    assert.equal(new Set(seen).size, seen.length)
    while (await index() > 0) { await click('← Back'); await finishTurn() }
  }
  for (const [w,h] of [[1440,900], [1280,800], [1366,768], [820,900], [390,844]]) await checkLayout('first-spread', w,h)
  const artworkSources = await evaluate("[...document.querySelectorAll('img.vehicle-product__art')].map(i => i.getAttribute('src'))")
  const rendered = await ids()
  for (const id of rendered) {
    const product = expected.find(p => p.id === id)
    assert(await evaluate(`document.querySelector('[data-product-id="${id}"]').innerText.includes(${JSON.stringify(product.title)})`))
    if (product.catalogueArtworkUrl) {
      assert(artworkSources.includes(product.catalogueArtworkUrl) || requests.includes(new URL(product.catalogueArtworkUrl, frontendUrl).href))
    } else assert(!await evaluate(`Boolean(document.querySelector('[data-product-id="${id}"] img'))`))
  }
  assert(!requests.some(url => /vehicle-\d+-(feature|standard)/.test(url)), 'No local product artwork may be requested')
  await call('Emulation.setDeviceMetricsOverride', { width:1440, height:900, deviceScaleFactor:1, mobile:false })
  await click('← Back to Vehicles')
  await finishTurn()
  await waitFor("Boolean(document.querySelector('.category-opening__invitation'))")
    await click('← Back to Categories')
    await finishTurn()
  await assertBook()
  assert(await evaluate("Boolean(document.querySelector('a[href=\"/categories/vehicles\"]'))"))
  await click('← Back')
  await finishTurn()
  await click('← Back to Contents')
  await finishTurn()
  await click('← Close Book')
  await waitFor("document.querySelector('.catalogue-stage').dataset.bookState === 'closed'")
  await evaluate("document.querySelector('.closed-catalogue__trigger').click()")
  await waitFor("document.querySelector('.catalogue-stage').dataset.bookState === 'open' && !document.querySelector('.opening-transition')")

  if (fixtureMode) {
    // Reduced motion, the fourth-product acceptance case, and backend URL replacement.
    fixtureProducts = [fixture(90,true), fixture(1), fixture(2), fixture(3)]
    await call('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'reduce' }] })
    await enterVehicles()
    assert.equal(await index(), 0)
    assert(!await evaluate("Boolean(document.querySelector('.catalogue-turn'))"))
    assert.deepEqual(await ids(), [1,2,3])
    assert(!await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='More Vehicles →')"))
    await checkDetails(3)
    fixtureProducts = fixtureProducts.map(p => ({ ...p, catalogueArtworkUrl: '/__test-art.svg?version=1&id=' + p.id }))
    await enterVehicles()
    assert((await evaluate("[...document.querySelectorAll('img.vehicle-product__art')].map(i => i.getAttribute('src'))")).every(url => url.includes('version=1')))
    await checkLayout('feature-with-delivery-artwork',1440,900)
    fixtureProducts = fixtureProducts.map(p => ({ ...p, catalogueArtworkUrl: p.catalogueArtworkUrl.replace('version=1','version=2') }))
    await enterVehicles()
    assert((await evaluate("[...document.querySelectorAll('img.vehicle-product__art')].map(i => i.getAttribute('src'))")).every(url => url.includes('version=2')))
    await checkDetails(3)
    fixtureProducts = [fixture(90,true), ...Array.from({length:7}, (_, i) => fixture(i + 1))]
      .map(p => ({ ...p, catalogueArtworkUrl: '/__test-art.svg?id=' + p.id }))
    await enterVehicles()
    await click('More Vehicles →')
    for (const [w,h] of [[1440,900], [1280,800], [1366,768], [820,900], [390,844]]) await checkLayout('later-with-delivery-artwork',w,h)
    assert(await evaluate(`(() => {
      return [...document.querySelectorAll('img.vehicle-product__art')].every(img => {
        for (let node = img; node && !node.classList.contains('book-shell__content'); node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none' || parseFloat(style.borderTopWidth)) return false;
        }
        return true;
      });
    })()`), 'Artwork ancestors must reveal the actual book paper')
    // Failed artwork delivery does not remove the listing or leave a broken img.
    fixtureProducts = [fixture(1, true), fixture(2), fixture(3)].map(p => ({...p, catalogueArtworkUrl:'/missing-test-art.png'}))
    await enterVehicles()
    await waitFor("!document.querySelector('img.vehicle-product__art')")
    assert.deepEqual(await ids(), [2,3])
    assert(!await evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'More Vehicles →')"))
    await checkDetails(2)
    // The feature-only category stays on its opening, with a working Details
    // action and no artificial empty normal spread.
    fixtureProducts = [fixture(90,true)]
    await enterVehicles(false)
    assert.deepEqual(await ids(), [90])
    assert(!await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Continue in the storybook →')"))
    await pointerClick('.category-opening-feature .vehicle-product__details')
    await waitFor("Boolean(document.querySelector('[data-detail-listing-id=\"1090\"]'))")
    await click('← Back to Vehicles')
    await finishTurn()
    await waitFor("Boolean(document.querySelector('.category-opening-feature'))")
    assert.deepEqual(await ids(), [90])
  }
  console.log('PASS: ' + (fixtureMode ? 'fixture acceptance' : 'live API') + ' — navigation, details, book persistence, responsive containment, artwork policy, close/reopen.')
  await send('Browser.close')
} finally {
  clearTimeout(deadline)
  socket?.close()
  browser.kill()
  server.closeAllConnections()
  await new Promise(r => server.close(r))
}
