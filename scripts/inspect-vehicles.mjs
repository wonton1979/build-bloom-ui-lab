// Run against the actual Vite frontend. Uses installed Chrome; no dependencies.
// Screenshots and diagnostics go to ignored node_modules/.tmp/vehicles-inspection.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const dir = resolve('node_modules/.tmp/vehicles-inspection')
mkdirSync(dir, { recursive: true })
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
  '--user-data-dir=' + dir + '/profile', '--remote-debugging-port=0',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
const ws = await new Promise((resolve, reject) => {
  let logs = ''
  browser.stderr.on('data', b => { logs += b; const m = logs.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) resolve(m[1]) })
  browser.on('error', reject)
  browser.on('exit', () => reject(new Error('Browser exited')))
})
const socket = new WebSocket(ws)
await new Promise(r => socket.addEventListener('open', r, { once: true }))
let serial = 0
const pending = new Map()
socket.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result) } })
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })) })
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const call = (method, params) => send(method, params, sessionId)
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return
      await new Promise(r => setTimeout(r, 100))
    }
    console.log(await evaluate('document.body.innerText'))
    throw new Error('Timed out: ' + expression)
  }
  const click = async text => {
    assert(await evaluate(`(() => { const el = [...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true })()`), text)
    await evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
  }
  await call('Network.enable')
  // All three artworks are local. Never contact Cloudinary during inspection.
  await call('Network.setBlockedURLs', { urls: ['*://*.cloudinary.com/*'] })
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await call('Page.navigate', { url: process.env.VEHICLES_REVIEW_URL || 'http://127.0.0.1:5175/' })
  await waitFor("Boolean(document.querySelector('.closed-catalogue__trigger'))")
  const catalogue = await evaluate("fetch('/api/products?colorfulLifeCategory=VEHICLES&pageSize=100').then(r => r.json())")
  assert(catalogue.items.every(item => 'colorfulLifeCategory' in item), 'Running API is missing colorfulLifeCategory')
  const vehicles = catalogue.items.filter(item => item.colorfulLifeCategory === 'VEHICLES')
  const bmwAvailable = vehicles.some(item => item.legoProduct.setNumber === '42226')
  console.log('Live API BMW 42226 available:', bmwAvailable)
  await evaluate("document.querySelector('.closed-catalogue__trigger').click()")
  await waitFor("document.querySelector('[data-book-state=open]') && !document.querySelector('.opening-transition')")
  await evaluate("window.originalBook = document.querySelector('.book-shell'); window.originalRect = originalBook.getBoundingClientRect().toJSON()")
  await click('More →')
  await waitFor("Boolean(document.querySelector('a[href=\"/categories/vehicles\"]')) && !document.querySelector('.catalogue-turn')")
  await evaluate("document.querySelector('a[href=\"/categories/vehicles\"]').click()")
  await waitFor("document.querySelector('.vehicle-product--feature h3')?.textContent.includes('Time Machine')")
  await evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
  const metrics = await evaluate(`(() => {
    const artwork = [...document.querySelectorAll('.vehicle-product__art')].map(art => {
    const canvas = document.createElement('canvas'); canvas.width = art.naturalWidth; canvas.height = art.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(art, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0, partial = 0;
    for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] === 0) transparent++; else if (pixels[i] < 255) partial++; }
    return { source: art.getAttribute('src'), transparent, partial,
      backgrounds: [art, art.parentElement, art.closest('.vehicles-page'), art.closest('.spread-page')].map(e => ({ background: getComputedStyle(e).backgroundColor, image: getComputedStyle(e).backgroundImage, border: getComputedStyle(e).borderWidth })) };
    });
    return { sameBook: window.originalBook === document.querySelector('.book-shell'),
      sameGeometry: JSON.stringify(originalRect) === JSON.stringify(originalBook.getBoundingClientRect().toJSON()),
      open: document.querySelector('.catalogue-stage').dataset.bookState,
      artwork,
      text: document.querySelector('.book-shell').innerText,
      supportingOrder: [...document.querySelectorAll('.vehicle-product--supporting .vehicle-product__number')].map(e => e.textContent),
    };
  })()`)
  assert(metrics.sameBook && metrics.sameGeometry && metrics.open === 'open')
  const expectedSets = ['77256', '77245', ...(bmwAvailable ? ['42226'] : [])]
  assert.deepEqual(metrics.artwork.map(art => art.source), expectedSets.map(set => `/src/assets/categories/vehicles/vehicle-${set}-${set === '77256' ? 'feature' : 'standard'}.png`))
  assert(metrics.artwork.every(art => art.transparent > 0 && art.partial > 0))
  assert(metrics.artwork.every(art => art.backgrounds.every(x => x.background === 'rgba(0, 0, 0, 0)' && x.image === 'none' && x.border === '0px')))
  assert.deepEqual(metrics.supportingOrder, ['LEGO 77245', ...(bmwAvailable ? ['LEGO 42226'] : [])])
  for (const set of expectedSets) {
    const listing = vehicles.find(item => item.legoProduct.setNumber === set)
    assert(metrics.text.includes(listing.legoProduct.title))
    assert(metrics.text.includes(`${listing.legoProduct.pieceCount} pieces`))
  }
  if (!bmwAvailable) assert(metrics.text.includes('Set 42226 is currently unavailable.'))
  assert(await evaluate("[...document.images].every(img => !img.src.includes('cloudinary.com'))"))
  console.log(JSON.stringify(metrics, null, 2))
  for (const [width, height] of [[1440, 900], [820, 900], [390, 844]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
    await evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
    const layout = await evaluate(`({ overflow: document.documentElement.scrollWidth > innerWidth, pages: [...document.querySelectorAll('.book-shell__content')].map(e => ({ width: e.clientWidth, scrollWidth: e.scrollWidth, height: e.clientHeight, scrollHeight: e.scrollHeight })) })`)
    assert(!layout.overflow)
    assert(layout.pages.every(p => p.scrollWidth <= p.width))
    if (width === 1440) assert(layout.pages.every(p => p.scrollHeight <= p.height), 'Desktop content must fit within the physical pages')
    const shot = await call('Page.captureScreenshot', { format: 'png' })
    writeFileSync(dir + '/' + width + '.png', Buffer.from(shot.data, 'base64'))
    console.log(width, layout)
    if (width < 1000) {
      await evaluate("document.querySelectorAll('.book-shell__spread, .book-shell__content').forEach(e => e.scrollTop = e.scrollHeight)")
      const bottom = await call('Page.captureScreenshot', { format: 'png' })
      writeFileSync(dir + '/' + width + '-bottom.png', Buffer.from(bottom.data, 'base64'))
      await evaluate("document.querySelectorAll('.book-shell__spread, .book-shell__content').forEach(e => e.scrollTop = 0)")
    }
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await click('← Back to Categories')
  assert(await evaluate("Boolean(document.querySelector('a[href=\"/categories/vehicles\"]')) && originalBook === document.querySelector('.book-shell')"))
  await click('← Back')
  await waitFor("Boolean([...document.querySelectorAll('button')].find(e => e.textContent === '← Close Book')) && !document.querySelector('.catalogue-turn')")
  await click('← Close Book')
  await waitFor("document.querySelector('.catalogue-stage').dataset.bookState === 'closed'")
  await evaluate("document.querySelector('.closed-catalogue__trigger').click()")
  await waitFor("document.querySelector('.catalogue-stage').dataset.bookState === 'open' && !document.querySelector('.opening-transition')")
  console.log('PASS: Vehicles navigation, same mounted open book/geometry, real API products, alpha, responsive overflow, Back, Close, reopen.')
} finally {
  await send('Browser.close')
  socket.close()
}
