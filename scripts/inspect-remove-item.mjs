// Real Chrome interaction checks; isolated auth/cart responses only in this test
// browser. No credentials, DELETE requests or production cart mutations.
// Requires the existing Vite dev server; screenshots stay in node_modules/.tmp.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const dir = resolve('node_modules/.tmp/remove-item-inspection')
const url = process.env.STOREFRONT_URL || 'http://localhost:5173'
mkdirSync(dir, { recursive: true })
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
  '--user-data-dir=' + dir + '/profile', '--remote-debugging-port=0',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
let socket
const timeout = setTimeout(() => { browser.kill(); process.exitCode = 1 }, 55000)
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
  socket.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result) } })
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })) })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const call = (method, params) => send(method, params, sessionId)
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  const settle = () => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
  const ready = async selector => {
    for (let i = 0; i < 70; i++) {
      if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return
      await new Promise(r => setTimeout(r, 100))
    }
    throw Error('Missing ' + selector)
  }
  const click = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`)
    await settle()
    const point = await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)});const r=el.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!el.contains(document.elementFromPoint(x,y)))throw Error('Click target covered: '+${JSON.stringify(selector)});return {x,y};})()`)
    await call('Input.dispatchMouseEvent', { type:'mousePressed', ...point, button:'left', clickCount:1 })
    await call('Input.dispatchMouseEvent', { type:'mouseReleased', ...point, button:'left', clickCount:1 })
    await settle()
  }
  const key = async (key, code, windowsVirtualKeyCode, modifiers = 0) => {
    await call('Input.dispatchKeyEvent', { type:'keyDown', key, code, windowsVirtualKeyCode, modifiers })
    await call('Input.dispatchKeyEvent', { type:'keyUp', key, code, windowsVirtualKeyCode, modifiers })
    await settle()
  }
  const viewport = (width,height) => call('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:width<600})
  await call('Page.enable')
  await viewport(1440,1000)

  // Prefer current public catalogue data/artwork, without changing server state.
  const categories = await fetch(`${url}/api/categories`).then(r => r.ok ? r.json() : null).catch(() => null)
  const categoryId = categories?.find(category => category.name === 'Vehicles')?.id
  const products = categoryId ? await fetch(`${url}/api/products?categoryId=${categoryId}&page=1&pageSize=100`).then(r => r.ok ? r.json() : null).catch(() => null) : null
  const root = products?.items?.find(product => product.productImages?.length && product.offers?.length) || {
    id: 42226, title: 'Tipping Dump Truck', setNumber: '42226', description: null, theme: 'City', ageRecommendation: null, pieceCount: null,
    category: null, catalogueArtworkUrl: null, catalogueArtworkPublicId: null, isFeatureProduct: false, isRetired: false,
    productImages: [{ id: 1, url: '/src/assets/categories/vehicles/vehicle-42226-standard.png', altText: 'Tipping Dump Truck', sortOrder: 0 }],
    offers: [{ id: 42, legoProductId: 42226, condition: 'NEW', usedLifecycle: null, damageDescription: null, originalPrice: '44.99', salePrice: null,
      effectivePrice: '44.99', currentStock: 5, availableStock: 5, active: true, usedConditionPhotos: [] }],
  }
  const offer = root.offers.find(item => item.condition === 'NEW' && item.active && item.availableStock > 0)
    || root.offers.find(item => item.active && item.availableStock > 0 && item.usedLifecycle === 'AVAILABLE')
  assert(offer, 'Cart inspection requires one sellable ProductListing offer')
  console.log(products?.items?.length ? 'Using public catalogue product in isolated cart fixture' : 'Backend unavailable: using isolated presentation fixture')
  const listing = { ...offer, availableStock: 3, legoProduct: {
    id: root.id, setNumber: root.setNumber, title: root.title, description: root.description, theme: root.theme,
    ageRecommendation: root.ageRecommendation, pieceCount: root.pieceCount, category: root.category,
    catalogueArtworkUrl: root.catalogueArtworkUrl, catalogueArtworkPublicId: root.catalogueArtworkPublicId,
    productImages: root.productImages, isFeatureProduct: root.isFeatureProduct, isRetired: root.isRetired,
  } }
  const item = { productListingId: offer.id, listing, quantity: 2 }
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `
    sessionStorage.setItem('colorful-life:storefront:jwt','isolated-remove-item-review');
    window.testCartItem=${JSON.stringify(item)};
    window.cartWriteAttempts=0; window.cartQuantity=2;
    const originalFetch=window.fetch;
    window.fetch=(url,init)=>{
      const path=String(url).split('?')[0];
      const json=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
      if(path.endsWith('/users/me'))return json({id:1,email:'review@example.test',firstName:null,lastName:null,phone:null});
      if(path.endsWith('/cart') || path.includes('/cart/items')){
        if(init?.method && init.method!=='GET')window.cartWriteAttempts++;
        if(init?.method==='POST' && path.endsWith('/cart/items')) { window.cartQuantity += JSON.parse(init.body).quantity; window.cartPostSeen=true; }
        if(path.includes('/cart/items/') && init?.method==='PATCH') window.cartQuantity=JSON.parse(init.body).quantity;
        if(path.includes('/cart/items/') && init?.method==='DELETE') window.cartQuantity=0;
        if(window.providerMode && init?.method==='POST') window.cartQuantity=1;
        return json({items:window.cartQuantity ? [{productListingId:window.testCartItem.productListingId,quantity:window.cartQuantity,productListing:window.testCartItem.listing}] : []});
      }
      return originalFetch(url,init);
    };
  ` })
  await call('Page.navigate', {url})
  await ready('.stage-cart')
  await settle()
  await click('.stage-cart')
  await ready('.cart-item__remove')
  const rowBefore = await evaluate("document.querySelector('.cart-item').textContent")
  await click('.cart-item__quantity button:last-child')
  await ready('.cart-item__quantity')
  assert(await evaluate("document.querySelector('.cart-item__quantity').textContent.includes('Quantity: 3')"),'Increase did not update quantity')
  assert(await evaluate("document.querySelector('.cart-item__quantity button:last-child').disabled"),'Stock-limit plus guard missing')
  await click('.cart-item__quantity button:first-child')
  assert(await evaluate("document.querySelector('.cart-item__quantity').textContent.includes('Quantity: 2')"),'Decrease did not update quantity')
  await evaluate('window.cartWriteAttempts=0')
  await click('.cart-item__remove')
  await ready('dialog[open]')
  assert(await evaluate("document.activeElement.classList.contains('remove-item-dialog__keep')"),'Safer action not focused')
  assert.equal(await evaluate("document.querySelector('.cart-item').textContent"),rowBefore,'Opening changed cart')
  assert.equal(await evaluate('window.cartWriteAttempts'),0,'Opening mutated backend')
  await key('Tab','Tab',9,8)
  assert(await evaluate("document.activeElement.classList.contains('remove-item-dialog__remove')"),'Backward focus trap failed')
  await key('Tab','Tab',9)
  assert(await evaluate("document.activeElement.classList.contains('remove-item-dialog__keep')"),'Forward focus trap failed')

  for(const [w,h] of [[1440,1000],[390,844],[320,568]]) {
    await viewport(w,h)
    await settle()
    await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
    const metrics=await evaluate(`(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();return {width:r.width,height:r.height,overflow:d.scrollWidth>d.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth,images:[...d.querySelectorAll('img')].every(i=>i.naturalWidth>0)}})()`)
    assert(!metrics.overflow && !metrics.pageOverflow && metrics.images,'Dialog overflow or missing artwork')
    const shot=await call('Page.captureScreenshot',{format:'png'})
    writeFileSync(`${dir}/confirmation-${w}.png`,Buffer.from(shot.data,'base64'))
    console.log(w,metrics)
  }
  await click('.remove-item-dialog__keep')
  assert(!await evaluate("Boolean(document.querySelector('dialog[open]'))"),'Keep it did not dismiss')
  assert.equal(await evaluate("document.querySelector('.cart-item').textContent"),rowBefore,'Keep it changed cart')
  assert(await evaluate("document.activeElement.classList.contains('cart-item__remove')"),'Focus did not return to trigger')
  await click('.cart-item__remove')
  await key('Escape','Escape',27)
  assert(!await evaluate("Boolean(document.querySelector('dialog[open]'))"),'Escape did not cancel')
  assert(await evaluate("Boolean(document.querySelector('.cart-modal'))"),'Escape closed the underlying Cart')
  await click('.cart-item__remove')
  await evaluate("document.querySelector('.remove-item-dialog__remove').click()")
  await settle()
  await evaluate('new Promise(r=>setTimeout(r,50))')
  await settle()
  await ready('.cart-modal__page--empty')
  assert.equal(await evaluate('window.cartWriteAttempts'),1,'Confirmed Remove did not issue exactly one backend write')
  assert(!await evaluate("Boolean(document.querySelector('.cart-item'))"),'Confirmed deletion did not restore empty Cart')
  await click('.cart-modal__close')
  assert(!await evaluate("Boolean(document.querySelector('.cart-modal'))"),'Cart X failed')
  assert.equal(await evaluate("sessionStorage.getItem('colorful-life:storefront:jwt')"),'isolated-remove-item-review','Cart close changed auth')

  console.log('PASS: actual Cart quantity/confirmation rendering; safe focus; Keep it/Escape preserve cart; confirmed DELETE restores Empty Cart; Cart X preserves authentication.')
  await send('Browser.close')
} finally { clearTimeout(timeout); socket?.close(); browser.kill() }
