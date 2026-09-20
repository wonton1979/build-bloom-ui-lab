// Inspect the real local storefront; no injected application state or fixtures.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const dir = resolve('node_modules/.tmp/front-matter-inspection')
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
  const idle = async () => {
    for(let i=0;i<40;i++) {
      if(!await evaluate("Boolean(document.querySelector('.opening-transition, .closing-transition, .catalogue-turn'))")) { await settle(); return }
      await new Promise(r=>setTimeout(r,100))
    }
    throw Error('Book animation did not settle')
  }
  const screenshot = async name => {
    await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
    await settle()
    const shot = await call('Page.captureScreenshot',{format:'png'})
    writeFileSync(dir+'/'+name+'.png',Buffer.from(shot.data,'base64'))
  }
  await call('Page.enable')
  await viewport(1765,864)

  await call('Page.navigate', {url:process.env.STOREFRONT_URL || 'http://localhost:5173'})
  await ready('.closed-catalogue__trigger')
  await click('.catalogue-stage > .closed-catalogue .closed-catalogue__trigger')
  await ready('.book-shell__spread .category-page, .book-shell__spread .front-matter')
  await idle()
  await screenshot('desktop')
  assert(await evaluate("Boolean(document.querySelector('.front-matter'))"))
  const book = await evaluate("document.querySelector('.book-shell').getBoundingClientRect().toJSON()")
  await click('.book-shell__spread .front-matter__entry:not(:disabled)')
  assert.equal(await evaluate("document.querySelectorAll('.catalogue-turn').length"),1,'One normal page turn')
  await idle()
  assert.equal(await evaluate("document.querySelector('.category-page__heading h2').textContent"),'Our Catalogue')
  assert.deepEqual(await evaluate("document.querySelector('.book-shell').getBoundingClientRect().toJSON()"),book,'Same physical book')
  await screenshot('catalogue-after-turn')
  await click('.book-shell__page--left .spread-page__navigation button')
  await idle()
  assert(await evaluate("Boolean(document.querySelector('.front-matter'))"))
  await click('.book-shell__page--left .spread-page__navigation button')
  await idle()
  assert.equal(await evaluate("document.querySelector('.catalogue-stage').dataset.bookState"),'closed')
  await click('.catalogue-stage > .closed-catalogue .closed-catalogue__trigger')
  await idle()
  for(const [width,height] of [[1440,1000],[1024,768],[768,1024],[390,844],[320,700]]) {
    await viewport(width,height)
    await settle()
    await evaluate("document.querySelectorAll('.book-shell__spread, .book-shell__content').forEach(e=>e.scrollTop=0)")
    await screenshot('front-'+width)
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'No horizontal page overflow')
    assert(await evaluate("[...document.querySelectorAll('.book-shell__spread .book-shell__content')].every(e=>e.scrollWidth<=e.clientWidth)"),'No horizontal page-content overflow')
    if(width<760) {
      await evaluate("document.querySelector('.front-matter--contents').scrollIntoView({block:'start'})")
      await screenshot('contents-'+width)
    }
    await click('.book-shell__spread .front-matter__entry:not(:disabled)')
    await idle()
    assert.equal(await evaluate("document.querySelector('.category-page__heading h2').textContent"),'Our Catalogue')
    await click('.book-shell__page--left .spread-page__navigation button')
    await idle()
    if(width<760) {
      await click('.book-shell__page--left .spread-page__navigation button')
      await idle()
      assert.equal(await evaluate("document.querySelector('.catalogue-stage').dataset.bookState"),'closed')
      await click('.catalogue-stage > .closed-catalogue .closed-catalogue__trigger')
      await idle()
    }
    console.log(`PASS ${width}x${height}: content fit, catalogue turn and return`)
  }
  await viewport(1440,1000)
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await click('.book-shell__spread .front-matter__entry:not(:disabled)')
  assert.equal(await evaluate("document.querySelectorAll('.catalogue-turn').length"),0)
  assert.equal(await evaluate("document.querySelector('.category-page__heading h2').textContent"),'Our Catalogue')
  console.log('PASS cover open/close/reopen, one normal turn, unchanged book geometry, reduced motion')
  await send('Browser.close')
} finally { clearTimeout(timeout); socket?.close(); browser.kill() }
