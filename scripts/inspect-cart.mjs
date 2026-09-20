// Run against the local Vite storefront. All authenticated/profile and filled
// content fixtures live only in this isolated browser, never in production code.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const dir = resolve('node_modules/.tmp/cart-inspection')
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
  const viewport = (width,height) => call('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:width<600})
  await call('Page.enable')
  await viewport(1765,864)
  await call('Page.navigate', {url:process.env.STOREFRONT_URL || 'http://localhost:5173'})
  await ready('.stage-cart')
  await click('.stage-cart')
  assert(await evaluate("document.querySelector('.guest-cart-bubble')?.textContent.includes('use your cart')"), 'Guest hint changed')
  assert(!await evaluate("Boolean(document.querySelector('.cart-modal'))"), 'Guest opened authenticated Cart')
  await click('.guest-cart-bubble')
  await ready('.account-modal')
  await click('[aria-label="Close account dialog"]')

  await call('Page.addScriptToEvaluateOnNewDocument', {source:`
    sessionStorage.setItem('colorful-life:storefront:jwt','isolated-cart-review');
    const originalFetch=window.fetch;
    window.fetch=(url,init)=>String(url).endsWith('/users/me')
      ? Promise.resolve(new Response(JSON.stringify({id:1,email:'cart-review@example.test',firstName:null,lastName:null,phone:null}),{status:200,headers:{'Content-Type':'application/json'}}))
      : originalFetch(url,init);
  `})
  await call('Page.reload')
  await ready('.stage-cart')
  await settle()
  await click('.stage-cart')
  await ready('.cart-modal')
  assert(await evaluate("document.activeElement.getAttribute('aria-label')==='Close shopping cart'"), 'Initial focus missing')
  await call('Input.dispatchKeyEvent', {type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8})
  await settle()
  assert(await evaluate("document.activeElement.textContent==='Continue Shopping'"), 'Shift Tab did not wrap')
  await call('Input.dispatchKeyEvent', {type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
  await settle()
  assert(await evaluate("document.activeElement.getAttribute('aria-label')==='Close shopping cart'"), 'Tab did not wrap')

  const capture = async (state,width,height) => {
    await viewport(width,height)
    await settle()
    await evaluate("document.querySelector('.cart-modal__scroll').scrollTop=0")
    await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
    const metrics = await evaluate(`(() => {
      const surface=document.querySelector('.cart-modal__surface');
      const scroll=surface.querySelector('.cart-modal__scroll');
      const footer=surface.querySelector('.cart-modal__footer');
      const s=surface.getBoundingClientRect(),f=footer.parentElement.getBoundingClientRect();
      const imageBox=footer.getBoundingClientRect();
      const border=parseFloat(getComputedStyle(surface).borderLeftWidth);
      const arts=[...surface.querySelectorAll('img')].map(i=>({src:i.getAttribute('src'),natural:[i.naturalWidth,i.naturalHeight],box:[i.width,i.height],pointerEvents:getComputedStyle(i).pointerEvents}));
      return {horizontalOverflow:surface.scrollWidth>surface.clientWidth||scroll.scrollWidth>scroll.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth,height:surface.clientHeight,scrollHeight:scroll.scrollHeight,footerGaps:[f.left-s.left-border,s.right-f.right-border,s.bottom-f.bottom-border],footerRatioError:Math.abs(imageBox.width/imageBox.height-footer.naturalWidth/footer.naturalHeight),arts};
    })()`)
    assert(!metrics.horizontalOverflow && !metrics.pageOverflow,'Horizontal overflow')
    assert(metrics.footerGaps.every(gap=>Math.abs(gap)<1),'Footer does not meet shell edges')
    assert(metrics.footerRatioError<0.01,'Footer aspect ratio changed')
    assert(metrics.arts.every(i=>i.natural[0]>0 && i.pointerEvents==='none'),'Artwork missing or intercepting controls')
    const shot = await call('Page.captureScreenshot', {format:'png'})
    writeFileSync(`${dir}/${state}-${width}.png`,Buffer.from(shot.data,'base64'))
    await evaluate("document.querySelector('.cart-modal__scroll').scrollTop=document.querySelector('.cart-modal__scroll').scrollHeight")
    await settle()
    const lower = await call('Page.captureScreenshot', {format:'png'})
    writeFileSync(`${dir}/${state}-${width}-bottom.png`,Buffer.from(lower.data,'base64'))
    console.log(state,width,JSON.stringify(metrics))
  }
  for(const [w,h] of [[1765,864],[820,900],[390,844],[320,568]]) await capture('empty',w,h)
  await viewport(1765,864)
  await click('.cart-modal__action')
  assert(!await evaluate("Boolean(document.querySelector('.cart-modal'))"),'Continue Shopping did not close')
  assert(await evaluate("document.activeElement.textContent==='Cart' || document.activeElement.classList.contains('stage-cart')"),'Focus not restored')
  await viewport(320,568)
  await click('.mobile-quick-controls button:last-child')
  await ready('.cart-modal')
  await click('.cart-modal__close')
  assert(!await evaluate("Boolean(document.querySelector('.cart-modal'))"),'X did not close')
  assert(await evaluate("sessionStorage.getItem('colorful-life:storefront:jwt')==='isolated-cart-review'"),'Closing Cart changed auth')
  await viewport(1765,864)
  await click('.stage-cart')
  await ready('.cart-modal')
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  await settle()
  assert(!await evaluate("Boolean(document.querySelector('.cart-modal'))"),'Escape failed')
  await click('.stage-cart')
  await call('Input.dispatchMouseEvent',{type:'mousePressed',x:10,y:10,button:'left',clickCount:1})
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:10,y:10,button:'left',clickCount:1})
  await settle()
  assert(!await evaluate("Boolean(document.querySelector('.cart-modal'))"),'Backdrop failed')

  // Render the real filled presentation in an isolated root. No invented cart
  // model, prices, orders or checkout are connected to the storefront.
  await evaluate(`(async()=>{
    const react=await import('/node_modules/.vite/deps/react.js');
    const h=(react.default || react).createElement;
    const dom=await import('/node_modules/.vite/deps/react-dom_client.js');
    const createRoot=(dom.default || dom).createRoot;
    const {CartModal}=await import('/src/components/cart/CartModal.tsx');
    const host=document.createElement('div');document.body.append(host);
    document.getElementById('root').inert=true;
    window.cartReviewRoot=createRoot(host);window.cartReviewActionCount=0;
    window.cartReviewRoot.render(h(CartModal,{onClose:()=>{window.cartReviewRoot.unmount();host.remove();document.getElementById('root').inert=false},content:{kind:'filled',
      items:h('p',null,'Cart item content — isolated presentation fixture.'),
      summary:h('p',null,'Summary content supplied by the future cart integration.'),
      actions:h('button',{type:'button',className:'cart-modal__action',onClick:()=>window.cartReviewActionCount++},'Test supplied action')
    }}));
  })()`)
  await ready('.cart-modal__page--filled')
  for(const [w,h] of [[1765,864],[820,900],[390,844],[320,568]]) await capture('filled-fixture',w,h)
  await click('.cart-modal__action')
  assert.equal(await evaluate('window.cartReviewActionCount'),1,'Supplied action callback failed')
  await click('.cart-modal__close')
  assert(!await evaluate("Boolean(document.querySelector('.cart-modal'))"),'Filled X failed')
  console.log('PASS: guest guard/hint/account invitation; authenticated empty Cart; X, backdrop, Escape, Continue Shopping; focus trap/restore; mobile reopen; session retained; filled slots/action. All fixture data isolated in browser.')
  await send('Browser.close')
} finally { clearTimeout(timeout); socket?.close(); browser.kill() }
