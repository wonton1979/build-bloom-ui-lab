// Real React/production-build browser integration. Default uses controlled HTTP
// responses (including delayed/error pages); --live uses the actual public API.
// No cart/auth/backend writes and no application-state injection.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const live = process.argv.includes('--live')
const api = process.env.CATALOGUE_API_URL || 'http://localhost:3000'
const dir = resolve('node_modules/.tmp/search-inspection', live ? 'live' : 'controlled')
const dist = resolve('dist')
mkdirSync(dir, { recursive: true })
assert(existsSync(resolve(dist, 'index.html')), 'Build first')
const sample = await (await fetch(api + '/products?pageSize=100')).json()
assert(sample.items.length, 'Public API needs at least one real listing for the image fixture')
const fixture = id => ({ ...sample.items[id % sample.items.length], id: 90000 + id,
  category: { id: id % 2 ? 11 : 4, name: id % 2 ? 'Vehicles' : 'City', subtitle: null, description: null, imageUrl: null },
  legoProduct: { ...sample.items[id % sample.items.length].legoProduct, setNumber: String(77000 + id),
    title: `Search test ${id}: ${id % 3 ? 'City adventure vehicle' : 'A very long classic off-road expedition vehicle and transporter collection'}` },
})
const products = Array.from({ length: 29 }, (_, i) => fixture(i + 1))
const requests = []
let failedRetry = false
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405).end(); return }
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/products' && url.searchParams.has('q')) {
        const q = url.searchParams.get('q'), page = Number(url.searchParams.get('page')), pageSize = Number(url.searchParams.get('pageSize'))
        requests.push({ q, page, pageSize })
        assert(!url.searchParams.has('categoryId'))
        if (!live) {
          if (q === 'slow') await new Promise(r => setTimeout(r, 1700))
          else await new Promise(r => setTimeout(r, 180))
          if (q === 'invalid' || q === 'error' || q === 'retry' && !failedRetry) {
            if (q === 'retry') failedRetry = true
            res.writeHead(q === 'invalid' ? 400 : 500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Test failure' })); return
          }
          const items = q === 'none' ? [] : q === 'fast' ? [fixture(101)] : q === 'slow' ? [fixture(102)] : q === '77001' ? [products[0]] : products
          // Simulate a catalogue shrinking after a page has been displayed.
          const available = q === 'shrink' && page > 1 ? items.slice(0, 2) : items
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
            items: available.slice((page - 1) * pageSize, page * pageSize),
            pagination: { page, pageSize, totalItems: available.length, totalPages: Math.ceil(available.length / pageSize) },
          })); return
        }
      }
      // Public reads only; keep authenticated state out of this test.
      if (!['/api/products', '/api/categories'].includes(url.pathname)) { res.writeHead(401).end('{}'); return }
      const response = await fetch(api + url.pathname.slice(4) + url.search)
      res.writeHead(response.status, { 'Content-Type': 'application/json' }).end(await response.text()); return
    }
    const file = resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!file.startsWith(dist + sep) || !existsSync(file)) { res.writeHead(404).end(); return }
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[extname(file)] || 'application/octet-stream' }).end(readFileSync(file))
  } catch (error) { res.writeHead(500).end(String(error)) }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
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
  })
  socket = new WebSocket(ws)
  await new Promise(r => socket.addEventListener('open', r, { once: true }))
  let serial = 0
  const pending = new Map(), errors = []
  socket.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails)
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result) }
  })
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })) })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const call = (method, params) => send(method, params, sessionId)
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  const settle = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  const wait = async expression => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) { await settle(); return }
      await new Promise(r => setTimeout(r, 75))
    }
    throw Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText'))
  }
  const idle = () => wait("!document.querySelector('.opening-transition,.closing-transition,.catalogue-turn,.leaflet-dialog[data-closing]')")
  const click = async selector => {
    await evaluate("Promise.all(document.querySelector('.leaflet-dialog')?.getAnimations().map(a=>a.finished.catch(()=>{}))??[])")
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`)
    await settle()
    const point = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!el.contains(document.elementFromPoint(x,y)))throw Error('Covered click: '+${JSON.stringify(selector)});return {x,y}})()`)
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
    await settle()
  }
  const key = async (key, code = key, modifiers = 0) => {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode: key === 'Enter' ? 13 : key === 'Escape' ? 27 : key === 'Tab' ? 9 : key === 'a' ? 65 : undefined })
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers })
  }
  const type = async (text, submit = true) => {
    await click('#catalogue-search')
    await key('a', 'KeyA', 2)
    await call('Input.insertText', { text })
    if (submit) await key('Enter')
  }
  const state = status => wait(`document.querySelector('[data-search-state="${status}"]')!==null`)
  const ids = () => evaluate("[...document.querySelectorAll('.search-leaflet [data-leaflet-listing]')].map(e=>Number(e.dataset.leafletListing))")
  const input = () => evaluate("document.querySelector('#catalogue-search').value")
  const shot = async name => {
    await evaluate("Promise.all(document.querySelector('.leaflet-dialog')?.getAnimations().map(a=>a.finished.catch(()=>{}))??[])")
    await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
    await settle()
    const screenshot = await call('Page.captureScreenshot', { format: 'png' })
    writeFileSync(dir + '/' + name + '.png', Buffer.from(screenshot.data, 'base64'))
  }
  await call('Page.enable')
  await call('Runtime.enable')
  if (!live) await call('Page.addScriptToEvaluateOnNewDocument', { source: `const actualFetch=window.fetch;window.fetch=(url,options)=>actualFetch(url,String(url).includes('q=slow')?{...options,signal:undefined}:options)` })
  // The slow request intentionally ignores AbortSignal at transport level to
  // prove generation checking, not just successful fetch cancellation.
  for (const [width, height] of [[1440, 900], [820, 1000], [390, 844]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
    await call('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port })
    await wait("!!document.querySelector('.catalogue-stage > .closed-catalogue .closed-catalogue__trigger')")
    await click('.catalogue-stage > .closed-catalogue .closed-catalogue__trigger')
    await idle()
    await wait("!!document.querySelector('[data-find-a-set]')")
    const book = await evaluate("document.querySelector('.book-shell').getBoundingClientRect().toJSON()")
    const canonical = await evaluate("document.querySelector('.catalogue-stage > .catalogue-spread-status').textContent")
    const before = requests.length
    await click('[data-find-a-set]')
    await state('initial')
    assert.equal(await evaluate("document.activeElement.id"), 'catalogue-search')
    assert.equal(requests.length, before, 'Opening performs no product search')
    assert(!await evaluate("!!document.querySelector('.catalogue-turn')"), 'Find a Set is not book navigation')
    await shot('initial-' + width)
    assert(await evaluate("(()=>{const a=document.querySelector('.search-leaflet__results');return a.scrollWidth<=a.clientWidth+1 && document.querySelector('.leaflet-dialog').getBoundingClientRect().right<=innerWidth})()"), 'No horizontal overflow')
    // Native dialog must trap keyboard focus.
    await key('Tab', 'Tab', 1)
    assert(await evaluate("document.querySelector('.leaflet-dialog').contains(document.activeElement)"))
    await type(live ? 'Ferrari' : 'adventure')
    if (!live) { await state('loading'); assert(!await evaluate("!!document.querySelector('.search-leaflet__pagination')")) }
    await state('results')
    const firstIds = await ids()
    assert(firstIds.length > 0)
    await shot('results-' + width)
    if (!live) {
      assert.equal(firstIds.length, 12)
      assert.deepEqual(await evaluate("[...new Set([...document.querySelectorAll('.search-leaflet__product-category')].map(e=>e.textContent))].sort()"), ['City', 'Vehicles'])
      assert(await evaluate("document.querySelector('.search-leaflet__pagination button').disabled"))
      await click('.search-leaflet__pagination button:last-child')
      await state('results')
      assert(await evaluate("document.querySelector('.search-leaflet__pagination').textContent.includes('Page 2 of 3')"))
      await click('.search-leaflet__pagination button:last-child')
      await state('results')
      assert(await evaluate("document.querySelector('.search-leaflet__pagination button:last-child').disabled"))
      assert.equal((await ids()).length, 5)
      const atBoundary = requests.length
      await click('.search-leaflet__pagination button:last-child')
      assert.equal(requests.length, atBoundary)
    }
    // Details must retain the exact page/results, not change to a category.
    const retainedIds = await ids(), retainedQuery = await input(), requestCount = requests.length
    const retainedPage = await evaluate("document.querySelector('.search-leaflet__pagination span')?.textContent")
    const selected = retainedIds.at(-1)
    await evaluate(`document.querySelector('[data-leaflet-listing="${selected}"] button').scrollIntoView({block:'center'})`)
    const scroll = await evaluate("document.querySelector('.search-leaflet__results').scrollTop")
    await click(`[data-leaflet-listing="${selected}"] button`)
    await wait(`!!document.querySelector('.book-shell__spread [data-detail-listing-id="${selected}"]') && !document.querySelector('.leaflet-dialog,.catalogue-turn')`)
    assert.equal(await evaluate("document.querySelector('.catalogue-stage > .catalogue-spread-status').textContent"), canonical)
    await shot('details-' + width)
    await click('.book-shell__spread > .book-shell__page--left .spread-page__navigation button')
    await idle()
    await state('results')
    assert.equal(await input(), retainedQuery)
    assert.deepEqual(await ids(), retainedIds)
    assert.equal(await evaluate("document.querySelector('.search-leaflet__pagination span')?.textContent"), retainedPage)
    assert.equal(requests.length, requestCount, 'Return uses retained result data, not a fresh/category request')
    const restoredScroll = await evaluate("document.querySelector('.search-leaflet__results').scrollTop")
    assert(Math.abs(restoredScroll - scroll) < 2, `Scroll restored: ${scroll} -> ${restoredScroll} at ${width}`)
    assert.equal(await evaluate("Number(document.activeElement.closest('[data-leaflet-listing]')?.dataset.leafletListing)"), selected, 'Focus returns to selected result')
    if (!live) {
      await click('.search-leaflet__pagination button:first-child')
      await state('results')
      assert(await evaluate("document.querySelector('.search-leaflet__pagination').textContent.includes('Page 2 of 3')"))
    }
    await type(live ? '77240' : '77001')
    await state('results')
    assert.equal(requests.at(-1).page, 1, 'New query resets pagination')
    assert(!await evaluate("!!document.querySelector('.search-leaflet__pagination')"), 'Single page hides pagination')
    if (live) assert(await evaluate("[...document.querySelectorAll('.leaflet-product__set')].every(e=>e.textContent.includes('77240'))"))
    await type(live ? 'zzno-such-set-928xx' : 'none')
    await state('empty')
    await shot('empty-' + width)
    assert(!await evaluate("!!document.querySelector('.search-leaflet__pagination')"))
    await click('[aria-label="Clear search"]')
    await state('initial')
    assert.equal(await input(), '')
    const beforeBlank = requests.length
    await type('   ')
    await state('initial')
    assert.equal(requests.length, beforeBlank, 'Blank query never requests')
    if (!live && width === 1440) {
      for (const query of ['error', 'invalid', 'retry']) {
        await type(query)
        await state('error')
        assert(!await evaluate("!!document.querySelector('.search-leaflet__pagination')"))
        assert.equal(await input(), query)
      }
      await shot('error-' + width)
      await click('.search-leaflet__error button')
      await state('results')
      await type('slow')
      await state('loading')
      await wait(`true`)
      await new Promise(r=>setTimeout(r,80))
      await shot('loading-' + width)
      await type('fast')
      await state('results')
      assert.deepEqual(await ids(), [90101])
      await new Promise(r=>setTimeout(r,1800))
      assert.deepEqual(await ids(), [90101], 'Unabortable stale response cannot replace newer results')
      await type('slow')
      await state('loading')
      await click('[aria-label="Clear search"]')
      await state('initial')
      await new Promise(r=>setTimeout(r,1800))
      await state('initial')
      await type('adventure', false)
      await state('results')
      assert.equal(requests.at(-1).q, 'adventure', 'Typing debounces without Enter')
    }
    await key('Escape')
    await wait("!document.querySelector('.leaflet-dialog')")
    assert.equal(await evaluate("document.querySelector('.catalogue-stage > .catalogue-spread-status').textContent"), canonical)
    assert(await evaluate("document.activeElement.matches('[data-find-a-set]')"), 'Close restores opener focus')
    const afterBook = await evaluate("document.querySelector('.book-shell').getBoundingClientRect().toJSON()")
    assert.equal(afterBook.width, book.width); assert.equal(afterBook.height, book.height)
    await click('[data-find-a-set]')
    await state('initial')
    assert.equal(await input(), '', 'Explicit close ends session')
    await evaluate("document.querySelector('[data-find-a-set]').click();document.querySelector('[data-find-a-set]').click()")
    assert.equal(await evaluate("document.querySelectorAll('.leaflet-dialog').length"), 1)
    await click('[aria-label="Close leaflet"]')
    await wait("!document.querySelector('.leaflet-dialog')")
    console.log('PASS', live ? 'LIVE API' : 'CONTROLLED HTTP', width, 'states / pagination / Details return / book preservation / focus / close')
  }
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await click('[data-find-a-set]')
  await state('initial')
  assert.equal(await evaluate("document.querySelector('.leaflet-dialog').getAnimations().length"), 0)
  await key('Escape')
  await wait("!document.querySelector('.leaflet-dialog')")
  assert.deepEqual(errors, [], 'No uncaught browser exceptions')
  writeFileSync(dir + '/requests.json', JSON.stringify(requests, null, 2))
  console.log('PASS reduced motion and browser exceptions; screenshots:', dir)
} finally {
  clearTimeout(deadline)
  socket?.close(); browser.kill(); server.closeAllConnections(); server.close()
}
