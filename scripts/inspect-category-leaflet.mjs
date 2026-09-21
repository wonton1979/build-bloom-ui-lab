// Inspect the real local storefront; no injected application state or fixtures.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const dir = resolve('node_modules/.tmp/category-leaflet-inspection')
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
mkdirSync(dir, { recursive: true })
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking',
  '--user-data-dir=' + dir + '/profile', '--remote-debugging-port=0',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
let socket
const timeout = setTimeout(() => { browser.kill(); process.exitCode = 1 }, 150000)
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
      if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)})) && !document.querySelector('.catalogue-turn, .leaflet-dialog[data-closing]')`)) return
      await new Promise(r => setTimeout(r, 100))
    }
    throw Error('Missing ' + selector + '\n' + await evaluate('document.body.innerText'))
  }
  const click = async selector => {
    await evaluate("Promise.all(document.querySelector('.leaflet-dialog')?.getAnimations().map(a=>a.finished.catch(()=>{})) ?? [])")
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`)
    await settle()
    const point = await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)});const r=el.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!el.contains(document.elementFromPoint(x,y)))throw Error('Click target covered: '+${JSON.stringify(selector)});return {x,y};})()`)
    await call('Input.dispatchMouseEvent', { type:'mousePressed', ...point, button:'left', clickCount:1 })
    await call('Input.dispatchMouseEvent', { type:'mouseReleased', ...point, button:'left', clickCount:1 })
    await settle()
    if (await evaluate("Boolean(document.querySelector('.leaflet-dialog[data-closing]'))")) {
      await evaluate("Promise.all(document.querySelector('.leaflet-dialog').getAnimations().map(a=>a.finished.catch(()=>{})))")
      await settle()
    }
  }
  const viewport = (width,height) => call('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:width<600})
  const idle = async () => {
    for(let i=0;i<40;i++) {
      if(!await evaluate("Boolean(document.querySelector('.opening-transition, .closing-transition, .catalogue-turn'))")) { await settle(); return }
      await new Promise(r=>setTimeout(r,100))
    }
    throw Error('Book animation did not settle')
  }
  const backToOrigin = async () => {
    const source = () => evaluate("({index:document.querySelector('[data-product-index]')?.dataset.productIndex,detail:document.querySelector('.book-shell__spread [data-detail-listing-id]')?.dataset.detailListingId})")
    const before = await source()
    await click('.book-shell__spread > .book-shell__page--left .spread-page__navigation button')
    if (await evaluate("innerWidth>760 && !matchMedia('(prefers-reduced-motion: reduce)').matches")) {
      assert(await evaluate("Boolean(document.querySelector('.catalogue-turn'))"),'Back must use the existing page-turn overlay')
      assert.deepEqual(await source(),before,'Source state must remain until the animation handoff')
      const motion = await evaluate("(() => {const a=document.querySelector('.catalogue-turn').getAnimations()[0];return {timing:a.effect.getTiming(),frames:a.effect.getKeyframes()};})()")
      assert.equal(motion.timing.duration,760,'Existing turn duration stays locked')
      assert.equal(motion.timing.easing,'cubic-bezier(0.35, 0, 0.3, 1)')
      assert(motion.frames.at(-1).transform.includes('rotateY(180deg)'),'Back must use the backward transform')
    }
    await idle()
  }
  const screenshot = async name => {
    await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
    await settle()
    const shot = await call('Page.captureScreenshot',{format:'png'})
    writeFileSync(dir+'/'+name+'.png',Buffer.from(shot.data,'base64'))
  }

  await call('Page.enable')
  if (process.argv.includes('--navigation')) {
    const assertTurn = async direction => {
      const motion = await evaluate("(() => {const a=document.querySelector('.catalogue-turn')?.getAnimations()[0];return a && {timing:a.effect.getTiming(),frames:a.effect.getKeyframes()};})()")
      assert(motion,'Existing page-turn overlay must appear')
      assert.equal(motion.timing.duration,760)
      assert.equal(motion.timing.easing,'cubic-bezier(0.35, 0, 0.3, 1)')
      assert.equal(motion.frames.at(-1).transform,`perspective(2400px) rotateY(${direction==='forward' ? -180 : 180}deg)`)
    }
    await viewport(1440,900)
    await call('Page.navigate',{url:frontendUrl})
    await ready('.closed-catalogue__trigger')
    await click('.catalogue-stage > .closed-catalogue .closed-catalogue__trigger')
    await idle()
    await click('.front-matter__entry:not(:disabled)')
    await idle()
    const book = await evaluate("document.querySelector('.book-shell').getBoundingClientRect().toJSON()")
    for (const [slug,name] of [['harry-potter','Harry Potter'],['vehicles','Vehicles']]) {
      if(slug==='vehicles') { await click('.spread-page--right .spread-page__navigation button'); await idle() }
      const sourceStatus = await evaluate("document.querySelector('.catalogue-stage > .catalogue-spread-status').textContent")
      await click(`a[href="/categories/${slug}"]`)
      await assertTurn('forward')
      assert.equal(await evaluate("document.querySelector('.catalogue-stage > .catalogue-spread-status').textContent"),sourceStatus,'Source state must not change before handoff')
      assert(await evaluate("Boolean(document.querySelector('.catalogue-turn__face:not(.catalogue-turn__face--back) .category-entry'))"),'Turning face retains source Categories')
      await evaluate(`document.querySelector('a[href="/categories/${slug}"]').click()`)
      assert.equal(await evaluate("document.querySelectorAll('.catalogue-turn').length"),1,'Repeated click cannot schedule another turn')
      await idle()
      await ready('.category-opening h1')
      assert.equal(await evaluate("document.querySelector('.category-opening h1').textContent"),name)
      await screenshot('navigation-'+slug)
      await click('.book-shell__spread > .book-shell__page--left .spread-page__navigation button')
      await assertTurn('backward')
      assert.equal(await evaluate("document.querySelector('.catalogue-turn__face:not(.catalogue-turn__face--back) .category-opening h1').textContent"),name)
      assert.equal(await evaluate("document.querySelector('.book-shell__spread .spread-page__navigation button').textContent"),'← Back to Categories','Source navigation persists until handoff')
      await idle()
      assert.equal(await evaluate("document.querySelector('.catalogue-stage > .catalogue-spread-status').textContent"),sourceStatus)
      assert.equal(await evaluate("document.querySelectorAll('.category-opening').length"),0)
      console.log('PASS animated category round trip',name)
    }
    await click('a[href="/categories/vehicles"]')
    await idle()
    await ready('.category-opening__invitation')
    for (const [width,height] of [[1440,900],[820,1000],[390,844]]) {
      await viewport(width,height)
      await click('.category-opening__invitation button')
      const entry=await evaluate("document.querySelector('.leaflet-dialog').getAnimations()[0]?.effect.getKeyframes()")
      assert(entry,'Leaflet enter animation exists')
      assert.equal(entry[0].opacity,'0')
      assert.equal(entry[0].transform,'translateY(5px)')
      assert.equal(entry.at(-1).opacity,'1')
      assert.equal(await evaluate("document.querySelector('.leaflet-dialog').getAnimations()[0].effect.getTiming().duration"),220)
      await evaluate("document.querySelector('.category-opening__invitation button').click()")
      assert.equal(await evaluate("document.querySelectorAll('.leaflet-dialog').length"),1)
      await evaluate("Promise.all(document.querySelector('.leaflet-dialog').getAnimations().map(a=>a.finished))")
      await screenshot('leaflet-presence-'+width)
      await click('.leaflet__turn')
      await ready('.leaflet[data-side=back]:not([aria-busy=true])')
      await evaluate("document.querySelectorAll('.leaflet__toolbar button').forEach(b=>{b.click();b.click()})")
      await settle()
      assert(await evaluate("Boolean(document.querySelector('.leaflet-dialog[open][data-closing] .leaflet[inert]'))"),'Close keeps the sheet mounted but non-interactive during exit')
      const exit=await evaluate("(() => {const a=document.querySelector('.leaflet-dialog').getAnimations()[0];return {frames:a.effect.getKeyframes(),timing:a.effect.getTiming()}})()")
      assert.equal(exit.timing.duration,220)
      assert.equal(exit.frames.at(-1).opacity,'0')
      assert.equal(await evaluate("document.querySelectorAll('.catalogue-turn').length"),0)
      await evaluate("Promise.all(document.querySelector('.leaflet-dialog').getAnimations().map(a=>a.finished))")
      await settle()
      assert.equal(await evaluate("document.querySelectorAll('.leaflet-dialog').length"),0)
      assert(await evaluate("document.activeElement===document.querySelector('.category-opening__invitation button')"))
      // Escape during entry must reverse cleanly and still unmount exactly once.
      await click('.category-opening__invitation button')
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
      await settle()
      assert(await evaluate("Boolean(document.querySelector('.leaflet-dialog[data-closing]'))"))
      await evaluate("Promise.all(document.querySelector('.leaflet-dialog').getAnimations().map(a=>a.finished))")
      await settle()
      assert.equal(await evaluate("document.querySelectorAll('.leaflet-dialog').length"),0)
      console.log('PASS leaflet entry/exit, repeated clicks and turnover',width)
    }
    await viewport(1440,900)
    await click('.category-opening__invitation button')
    await click('.leaflet-product__copy button')
    await assertTurn('forward')
    await idle()
    await ready('[data-detail-listing-id]')
    await backToOrigin()
    assert.deepEqual(await evaluate("document.querySelector('.book-shell').getBoundingClientRect().toJSON()"),book)
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
    await click('.category-opening__invitation button')
    assert.equal(await evaluate("document.querySelector('.leaflet-dialog').getAnimations().length"),0)
    await click('.leaflet__toolbar button')
    assert.equal(await evaluate("document.querySelectorAll('.leaflet-dialog').length"),0)
    console.log('PASS leaflet-to-Details handoff, unchanged book geometry and reduced motion')
  } else if (process.argv.includes('--spread-layout')) {
    const before = process.argv.includes('--before')
    const records = {}
    const baseline = !before && existsSync(dir+'/spread-layout-before.json') ? JSON.parse(readFileSync(dir+'/spread-layout-before.json','utf8')) : null
    const inspect = async key => {
      await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
      const metrics = await evaluate(`(() => {
        const pages=[...document.querySelectorAll('.book-shell__spread > .book-shell__page > .book-shell__content')];
        const rect=e=>{const r=e.getBoundingClientRect();return [r.width,r.height]};
        return {pages:pages.map(p=>({height:p.clientHeight,scroll:p.scrollHeight,width:p.clientWidth,scrollWidth:p.scrollWidth})),
          art:[...document.querySelectorAll('.book-shell__spread .category-opening__art-space img,.book-shell__spread .vehicle-product__art')].map(rect),
          book:rect(document.querySelector('.book-shell')),
          emptyRight:pages[1].childElementCount===0,
          text:[...document.querySelectorAll('.book-shell__spread .vehicle-product h3')].map(e=>e.textContent)};
      })()`)
      records[key]=metrics
      console.log(key,JSON.stringify(metrics))
      if (!before) {
        assert(metrics.pages.every(p=>p.scroll<=p.height && p.scrollWidth<=p.width),'Desktop content must fit: '+key)
        if (baseline?.[key]) {
          assert.deepEqual(metrics.book,baseline[key].book,'Book geometry must remain identical')
          metrics.art.forEach((art,index)=>assert(art[0]>=baseline[key].art[index][0]-.5 && art[1]>=baseline[key].art[index][1]-.5,'Artwork must not shrink: '+key))
        }
        if (key.endsWith('products-1') && key.startsWith('vehicles')) assert(metrics.emptyRight,'Unpopulated paper must contain no heading, wrapper or navigation')
      }
      if (/vehicles|star-wars/.test(key)) await screenshot('layout-'+(before?'before-':'after-')+key)
    }
    for (const [width,height] of [[1440,900],[1280,800],[1366,768]]) {
      await viewport(width,height)
      for (const slug of ['vehicles','harry-potter','star-wars','friends','city','disney','marvel','jurassic-world','flowers-botanicals','ninjago','dc-batman','creator','others']) {
        await call('Page.navigate',{url:frontendUrl+'/categories/'+slug})
        await ready('.category-opening__description')
        await inspect(slug+'-'+width+'-opening')
        let page=0
        while (await evaluate("Boolean(document.querySelector('.book-shell__spread .spread-page--right .spread-page__navigation button'))")) {
          await click('.book-shell__spread .spread-page--right .spread-page__navigation button')
          await idle()
          await inspect(slug+'-'+width+'-products-'+page++)
        }
      }
    }
    writeFileSync(dir+'/spread-layout-'+(before?'before':'after')+'.json',JSON.stringify(records,null,2))
  } else if (process.argv.includes('--category-artwork')) {
    const phase = process.argv.includes('--before') ? 'before' : 'after'
    await viewport(1440,1000)
    await call('Page.navigate',{url:frontendUrl+'/categories/vehicles'})
    await ready('.category-opening__art-space img')
    await evaluate("document.querySelector('.category-opening__art-space img').decode()")
    for (const [width,height] of [[1440,1000],[820,1000],[390,844]]) {
      await viewport(width,height)
      await evaluate("document.querySelectorAll('.book-shell__spread,.book-shell__content').forEach(e=>e.scrollTop=0)")
      await screenshot('category-artwork-'+phase+'-'+width)
      const metrics = await evaluate(`(() => {
        const image=document.querySelector('.category-opening__art-space img');
        const description=document.querySelector('.category-opening__description').getBoundingClientRect();
        const invitation=document.querySelector('.category-opening__invitation').getBoundingClientRect();
        const r=image.getBoundingClientRect(), page=image.closest('.book-shell__content');
        return {source:image.currentSrc,natural:[image.naturalWidth,image.naturalHeight],rendered:[r.width,r.height],
          before:r.top-description.bottom,after:invitation.top-r.bottom,
          page:[page.clientHeight,page.scrollHeight],horizontalOverflow:page.scrollWidth>page.clientWidth};
      })()`)
      console.log(phase,width,JSON.stringify(metrics))
      assert(metrics.natural.every(value=>value>0),'Real production artwork must load')
      assert(!metrics.horizontalOverflow,'Artwork must remain within the paper width')
      assert(metrics.before>=0 && metrics.after>=0,'Artwork must not overlap description or invitation')
      if (phase==='after') assert(Math.abs(metrics.rendered[0]/metrics.rendered[1]-metrics.natural[0]/metrics.natural[1])<.01,'Rendered box must preserve the natural aspect ratio')
      if (width<1000) {
        await evaluate("document.querySelector('.category-opening__invitation').scrollIntoView({block:'end'})")
        await screenshot('category-artwork-'+phase+'-'+width+'-lower')
      }
      await click('.category-opening__invitation button')
      await ready('.leaflet-dialog[open]')
      await click('.leaflet__toolbar button')
      await ready('.category-opening__art-space img')
    }
    console.log('PASS live category artwork, spacing, containment and Leaflet entry')
  } else {
  await viewport(1440,1000)
  await call('Page.navigate',{url:frontendUrl+'/categories/vehicles'})
  await ready('.category-opening-feature .vehicle-product__art img')
  const expected = await evaluate("fetch('/api/categories').then(r=>r.json()).then(async categories=>{const category=categories.find(c=>c.name==='Vehicles');const response=await fetch('/api/products?categoryId='+category.id+'&pageSize=100');return (await response.json()).items;})")
  const featured = [...expected].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id-b.id).find(item=>item.isFeatureProduct)
  const bookRect = await evaluate("document.querySelector('.book-shell').getBoundingClientRect().toJSON()")
  await screenshot('category-desktop')
  const ordered = [...expected].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id-b.id)
  const storybookIds = ordered.filter(item=>item.id!==featured.id).map(item=>item.id)
  for (const [width,height] of [[1440,1000],[820,1000],[390,844]]) {
    await viewport(width,height)
    await evaluate("document.querySelector('.category-opening-feature').scrollIntoView({block:'start'})")
    await screenshot('opening-feature-'+width)
    assert.equal(await evaluate("document.querySelectorAll('.vehicle-product--feature').length"),1)
    assert.equal(await evaluate("Number(document.querySelector('.vehicle-product--feature').dataset.listingId)"),featured.id)
    assert(await evaluate("(() => {const p=document.querySelector('.vehicle-product--feature');return p.querySelector('img').getBoundingClientRect().bottom <= p.querySelector('.vehicle-product__copy').getBoundingClientRect().top;})()"),'Opening feature artwork must not overlap its metadata')
    await click('.category-opening-feature .vehicle-product__details')
    await ready('[data-detail-listing-id]')
    assert.equal(await evaluate("Number(document.querySelector('[data-detail-listing-id]').dataset.detailListingId)"),featured.id)
    await backToOrigin()
    await ready('.category-opening-feature')
    await click('.spread-page--right .spread-page__navigation button')
    await idle()
    await ready('[data-product-index]')
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.book-shell__spread [data-listing-id]')].map(e=>Number(e.dataset.listingId))"),storybookIds.slice(0,4))
    await screenshot('normal-storybook-'+width)
    const seen = []
    while (true) {
      assert.equal(await evaluate("document.querySelectorAll('.vehicle-product--feature').length"),0)
      seen.push(...await evaluate("[...document.querySelectorAll('.book-shell__spread [data-listing-id]')].map(e=>Number(e.dataset.listingId))"))
      if (!await evaluate("Boolean(document.querySelector('.spread-page--right .spread-page__navigation button'))")) break
      await click('.spread-page--right .spread-page__navigation button')
      await idle()
    }
    assert.deepEqual(seen,storybookIds,'Only remaining listings appear, once each and in stable order')
    await click('.vehicle-product__details')
    await ready('[data-detail-listing-id]')
    assert(storybookIds.includes(await evaluate("Number(document.querySelector('[data-detail-listing-id]').dataset.detailListingId)")))
    await backToOrigin()
    await ready('[data-product-index]')
    while (await evaluate("Boolean(document.querySelector('[data-product-index]'))")) {
      await backToOrigin()
      await idle()
    }
    await ready('.category-opening-feature')
    assert(await evaluate("document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.book-shell__content')].every(p=>p.scrollWidth<=p.clientWidth)"),'Storybook must retain horizontal containment')
    console.log('PASS Storybook opening feature, normal-only spreads, details and return at '+width+'px')
  }
  await viewport(1440,1000)
  assert.equal(await evaluate("document.querySelector('.category-opening h1').textContent"),'Vehicles')
  const description = await evaluate("document.querySelector('.category-opening__description').textContent")
  assert(description.includes('joy of movement'))
  await click('.category-opening__invitation button')
  await ready('.leaflet-dialog[open]')
  await screenshot('leaflet-front-desktop')
  const frontFit = await evaluate("(() => {const p=document.querySelector('.leaflet__print-area');return {scrollHeight:p.scrollHeight,clientHeight:p.clientHeight};})()")
  console.log('Desktop Front printable area:',frontFit)
  assert(frontFit.scrollHeight <= frontFit.clientHeight,'Desktop Front must genuinely fit without scrolling')
  assert(await evaluate("(() => {const p=document.querySelector('.leaflet__print-area'),r=p.getBoundingClientRect();return [...p.querySelectorAll('article, article button')].every(e=>{const b=e.getBoundingClientRect();return b.top>=r.top && b.bottom<=r.bottom;});})()"),'All desktop Front products and actions must fit visibly inside the print area')
  assert.equal(await evaluate("Number(document.querySelector('[data-leaflet-listing]').dataset.leafletListing)"),featured.id)
  const teaserIds = await evaluate("[...document.querySelectorAll('.leaflet__teasers [data-leaflet-listing]')].map(e=>Number(e.dataset.leafletListing))")
  assert.equal(teaserIds.length,Math.min(2,expected.length-1))
  assert(!teaserIds.includes(featured.id),'The featured listing must not be repeated as a teaser')
  assert(teaserIds.every(id=>expected.some(item=>item.id===id)),'Teasers must belong to the current backend category')
  await click('.leaflet__teasers .leaflet-product__copy button')
  await ready('[data-detail-listing-id]')
  assert.equal(await evaluate("Number(document.querySelector('[data-detail-listing-id]').dataset.detailListingId)"),teaserIds[0])
  await backToOrigin()
  await ready('.category-opening__invitation')
  await click('.category-opening__invitation button')
  await ready('.leaflet-dialog[open]')
  assert.equal(await evaluate("document.querySelector('.leaflet').dataset.side"),'front')
  await click('.leaflet__turn')
  assert.equal(await evaluate("document.querySelector('.leaflet__turn').disabled"),true)
  assert.equal(await evaluate("document.querySelectorAll('.catalogue-turn').length"),0,'Leaflet must not use a book-page turn')
  await screenshot('sheet-turn-desktop')
  await ready('.leaflet[data-side=back]:not([aria-busy=true])')
  await screenshot('leaflet-back-desktop')
  const expectedBackIds = [...expected].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id-b.id).filter(item=>item.id!==featured.id && !teaserIds.includes(item.id)).map(item=>item.id)
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.leaflet__products article')].map(e=>Number(e.dataset.leafletListing))"),expectedBackIds,'Back must preserve remaining order and exclude every Front product')
  assert(await evaluate("(() => {const p=document.querySelector('.leaflet__print-area');p.scrollTop=p.scrollHeight;return getComputedStyle(p).overflowY==='auto' && p.scrollHeight>p.clientHeight && p.scrollTop>0;})()"),'Multi-row Back must remain genuinely scrollable')
  await evaluate("document.querySelector('.leaflet__print-area').scrollTop=0")
  assert(await evaluate("[...document.querySelectorAll('.leaflet-product')].every(p=>p.querySelector('img').getBoundingClientRect().bottom <= p.querySelector('.leaflet-product__copy').getBoundingClientRect().top)"),'Art must not overlap product copy')
  await click('.leaflet__turn')
  await ready('.leaflet[data-side=front]:not([aria-busy=true])')
  await click('.leaflet-product__copy button')
  await ready('[data-detail-listing-id]')
  assert.deepEqual(await evaluate("document.querySelector('.book-shell').getBoundingClientRect().toJSON()"),bookRect)
  assert.equal(await evaluate("document.querySelectorAll('.leaflet-dialog').length"),0)
  await backToOrigin()
  await ready('.category-opening__invitation')
  for(const [width,height] of [[820,1000],[390,844]]) {
    await viewport(width,height)
    await screenshot('category-'+width)
    await click('.category-opening__invitation button')
    await ready('.leaflet-dialog[open]')
    await screenshot('leaflet-front-'+width)
    await click('.leaflet__turn')
    await ready('.leaflet[data-side=back]:not([aria-busy=true])')
    await screenshot('leaflet-back-'+width)
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'No horizontal overflow')
    assert(await evaluate("document.querySelector('.leaflet__print-area').scrollWidth <= document.querySelector('.leaflet__print-area').clientWidth"))
    if(width<600) {
      const selected = await evaluate("Number(document.querySelector('[data-leaflet-listing]').dataset.leafletListing)")
      await click('.leaflet-product__copy button')
      await ready('[data-detail-listing-id]')
      assert.equal(await evaluate("Number(document.querySelector('[data-detail-listing-id]').dataset.detailListingId)"),selected)
      await backToOrigin()
      await ready('.category-opening__invitation')
      await click('.category-opening__invitation button')
      await ready('.leaflet-dialog[open]')
      await evaluate("document.querySelector('.leaflet__print-area').scrollTop=10000")
      await screenshot('leaflet-front-mobile-scrolled')
      const mobileTeaser = await evaluate("Number(document.querySelector('.leaflet__teasers [data-leaflet-listing]').dataset.leafletListing)")
      await click('.leaflet__teasers .leaflet-product__copy button')
      await ready('[data-detail-listing-id]')
      assert.equal(await evaluate("Number(document.querySelector('[data-detail-listing-id]').dataset.detailListingId)"),mobileTeaser)
      await backToOrigin()
      await ready('.category-opening__invitation')
      await click('.category-opening__invitation button')
      await ready('.leaflet-dialog[open]')
      await click('.leaflet-product__copy button')
      await ready('[data-detail-listing-id]')
      assert.equal(await evaluate("Number(document.querySelector('[data-detail-listing-id]').dataset.detailListingId)"),featured.id)
      await backToOrigin()
      await ready('.category-opening__invitation')
      await click('.category-opening__invitation button')
      await ready('.leaflet-dialog[open]')
    }
    await click('.leaflet__toolbar button')
    console.log('PASS real-data leaflet '+width+'px, front/back/details/close')
  }
  await viewport(1440,1000)
  for(const slug of ['harry-potter','star-wars','friends','city','disney','marvel','jurassic-world','flowers-botanicals','ninjago','dc-batman','creator','others']) {
    await call('Page.navigate',{url:frontendUrl+'/categories/'+slug})
    await ready('.category-opening__description')
    assert((await evaluate("document.querySelector('.category-opening__description').textContent")).length>10)
    assert.equal(await evaluate("document.querySelectorAll('.category-opening__art-space img').length"),0)
    const categoryListingIds = await evaluate("fetch('/api/categories').then(r=>r.json()).then(async categories=>{const name=document.querySelector('.category-opening h1').textContent;const category=categories.find(c=>c.name===name);const response=await fetch('/api/products?categoryId='+category.id+'&pageSize=100');const items=(await response.json()).items.sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id-b.id);const feature=items.find(i=>i.isFeatureProduct);return {featureId:feature?.id,others:items.filter(i=>i.id!==feature?.id).map(i=>i.id)};})")
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.category-opening-feature [data-listing-id]')].map(e=>Number(e.dataset.listingId))"),categoryListingIds.featureId ? [categoryListingIds.featureId] : [])
    if (categoryListingIds.others.length) {
      await click('.spread-page--right .spread-page__navigation button')
      await idle()
      const seen = []
      while (true) {
        seen.push(...await evaluate("[...document.querySelectorAll('.book-shell__spread [data-listing-id]')].map(e=>Number(e.dataset.listingId))"))
        if (!await evaluate("Boolean(document.querySelector('.spread-page--right .spread-page__navigation button'))")) break
        await click('.spread-page--right .spread-page__navigation button')
        await idle()
      }
      assert.deepEqual(seen,categoryListingIds.others,'Complete normal-only Storybook collection for '+slug)
    } else {
      assert.equal(await evaluate("Boolean(document.querySelector('.spread-page--right .spread-page__navigation button'))"),false,'No artificial product page for a feature-only/empty category')
    }
    console.log('PASS backend category '+slug)
  }
  await call('Page.navigate',{url:frontendUrl})
  await ready('.closed-catalogue__trigger')
  await click('.catalogue-stage > .closed-catalogue .closed-catalogue__trigger')
  await idle()
  await click('.front-matter__entry:not(:disabled)')
  await idle()
  await click('a[href="/categories/harry-potter"]')
  await ready('.category-opening__description')
  assert.equal(await evaluate("document.querySelector('.category-opening h1').textContent"),'Harry Potter')
  await click('.category-opening__invitation button')
  await ready('.leaflet-dialog[open]')
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await click('.leaflet__turn')
  assert.equal(await evaluate("document.querySelector('.leaflet').dataset.side"),'back')
  assert.equal(await evaluate("document.querySelector('.leaflet').getAnimations().length"),0)
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  await settle()
  assert.equal(await evaluate("document.querySelectorAll('.leaflet-dialog').length"),0)
  assert(await evaluate("document.activeElement===document.querySelector('.category-opening__invitation button')"),'Focus returns to opener')
  console.log('PASS live categories, featured listing '+featured.id+', '+teaserIds.length+' Front promotions, '+expectedBackIds.length+' remaining Back listings, desktop Front fit, scrollable Back, whole-sheet flip, details handoff, category links, Escape and reduced motion')
  }
  await send('Browser.close')
} finally { clearTimeout(timeout); socket?.close(); browser.kill() }
