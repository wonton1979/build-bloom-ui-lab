// Inspect the real local storefront. Explicit DOM fixtures stress future product occupancy.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'

const dir = resolve('node_modules/.tmp/category-leaflet-inspection')
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
mkdirSync(dir, { recursive: true })
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-gpu-sandbox', '--no-first-run', '--disable-background-networking',
  '--user-data-dir=' + dir + '/profile', '--remote-debugging-port=0',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
let socket
const stopBrowser = () => { if (browser.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }) }
const timeout = setTimeout(() => { stopBrowser(); process.exitCode = 1 }, process.argv.includes('--friends-layout') ? 240000 : 150000)
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
  if (process.argv.includes('--city-visual-fixture')) {
    const category = { id: 880, name: 'City', subtitle: 'Big adventures on every street', description: 'Explore a bustling city.', imageUrl: null, thumbnailUrl: null }
    const artwork = color => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='240' viewBox='0 0 360 240'%3E%3Crect width='360' height='240' rx='18' fill='%23${color}'/%3E%3Cpath d='M55 185h250M90 180l35-82 38 82m38 0 32-62 32 62' fill='none' stroke='%23ffffff' stroke-width='14' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E`
    const products = [
      ['Jet vs. Car', '60489', true, '5ab9d0'],
      ['Jet vs. Car', '60489', false, '5ab9d0'],
      ['Cement Mixer', '60478', false, 'e58b4e'],
    ].map(([title, setNumber, isFeatureProduct, color], index) => ({
      id: 8801 + index, isRetired: false, setNumber, title,
      description: `City ${title} building set.`, theme: 'City', ageRecommendation: '5+', pieceCount: 100 + index * 40,
      category, catalogueArtworkUrl: artwork(color), catalogueArtworkPublicId: null,
      productImages: [], isFeatureProduct,
      offers: [{ id: 9901 + index, legoProductId: 8801 + index, condition: 'NEW', usedLifecycle: null,
        damageDescription: null, originalPrice: '24.99', salePrice: null, effectivePrice: '24.99',
        currentStock: 2, availableStock: 2, active: true, usedConditionPhotos: [] }],
    }))
    const source = `(() => {
      const category = ${JSON.stringify(category)}, items = ${JSON.stringify(products)}, originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.endsWith('/categories')) return Promise.resolve(new Response(JSON.stringify([category]), { headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('/products?')) return Promise.resolve(new Response(JSON.stringify({ items, pagination: { page: 1, pageSize: 100, totalItems: items.length, totalPages: 1 } }), { headers: { 'Content-Type': 'application/json' } }));
        return originalFetch(input, init);
      };
    })()`
    await call('Page.addScriptToEvaluateOnNewDocument', { source })
  }
  if (process.argv.includes('--disney-visual-fixture')) {
    const category = { id: 881, name: 'Disney', subtitle: 'Build a little wonder', description: 'Discover a storybook world.', imageUrl: null, thumbnailUrl: null }
    const artwork = color => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='240' viewBox='0 0 360 240'%3E%3Crect width='360' height='240' rx='18' fill='%23${color}'/%3E%3Cpath d='M55 185h250M90 180l35-82 38 82m38 0 32-62 32 62' fill='none' stroke='%23ffffff' stroke-width='14' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E`
    const products = [
      ['Enchanted Castle', '43200', true, '8e77b5'],
      ['Moonlit Bookshop', '43201', false, 'e6a8b9'],
      ['Garden Carriage', '43202', false, '77aeb0'],
    ].map(([title, setNumber, isFeatureProduct, color], index) => ({
      id: 8811 + index, isRetired: false, setNumber, title,
      description: `${title} building set.`, theme: 'Disney', ageRecommendation: '6+', pieceCount: 180 + index * 45,
      category, catalogueArtworkUrl: artwork(color), catalogueArtworkPublicId: null,
      productImages: [], isFeatureProduct,
      offers: [{ id: 9911 + index, legoProductId: 8811 + index, condition: 'NEW', usedLifecycle: null,
        damageDescription: null, originalPrice: '34.99', salePrice: null, effectivePrice: '34.99',
        currentStock: 2, availableStock: 2, active: true, usedConditionPhotos: [] }],
    }))
    const source = `(() => {
      const category = ${JSON.stringify(category)}, items = ${JSON.stringify(products)}, originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.endsWith('/categories')) return Promise.resolve(new Response(JSON.stringify([category]), { headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('/products?')) return Promise.resolve(new Response(JSON.stringify({ items, pagination: { page: 1, pageSize: 100, totalItems: items.length, totalPages: 1 } }), { headers: { 'Content-Type': 'application/json' } }));
        return originalFetch(input, init);
      };
    })()`
    await call('Page.addScriptToEvaluateOnNewDocument', { source })
  }
  if (process.argv.includes('--friends-layout')) {
    const inspectFriends = () => evaluate(`(() => {
      const sheet=document.querySelector('.leaflet'), area=sheet?.querySelector('.leaflet__print-area'), grid=sheet?.querySelector('.leaflet__products--friends-collection');
      const rect=element=>element?.getBoundingClientRect().toJSON() ?? null;
      const image=sheet?.querySelector('.leaflet__environment'), imageRect=image?.getBoundingClientRect();
      const scale=imageRect?Math.min(imageRect.width/image.naturalWidth,imageRect.height/image.naturalHeight):0;
      const painted=imageRect?{left:imageRect.left+(imageRect.width-image.naturalWidth*scale)/2,top:imageRect.top+(imageRect.height-image.naturalHeight*scale)/2,width:image.naturalWidth*scale,height:image.naturalHeight*scale}:null;
      const featured=sheet?.querySelector('.leaflet__friends-story > .leaflet-product--featured');
      const products=grid?[...grid.children]:[];
      const rows=[];
      for(const product of products){const top=product.getBoundingClientRect().top;let row=rows.find(item=>Math.abs(item.top-top)<1);if(!row)rows.push(row={top,count:0});row.count++;}
      const tracks=grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:0;
      return {side:sheet?.dataset.side,environment:image?.getAttribute('src'),natural:image?{width:image.naturalWidth,height:image.naturalHeight}:null,
        environmentVisible:image?getComputedStyle(image).display!=='none':false,painted,area:rect(area),heading:rect(area?.querySelector('.leaflet__collection-heading')),
        frontStory:rect(sheet?.querySelector('.leaflet__friends-layout')),featuredCount:sheet?.querySelectorAll('.leaflet-product--featured').length,featured:rect(featured),art:rect(featured?.querySelector('.leaflet-product__art')),artImage:rect(featured?.querySelector('.leaflet-product__art img')),
        copy:rect(featured?.querySelector('.leaflet-product__copy')),turn:rect(sheet?.querySelector('.leaflet__turn')),close:rect(sheet?.querySelector('[aria-label="Close leaflet"]')),
        grid:rect(grid),trackCount:tracks,logicalColumns:tracks===6?3:tracks,productCount:products.length,products:products.map(rect),rows,
        gridBottom:products.length?Math.max(...products.map(product=>product.getBoundingClientRect().bottom)):null,
        areaScrolls:area?area.scrollHeight>area.clientHeight+1:false,viewportScrolls:document.documentElement.scrollWidth>innerWidth};
    })()`)
    const records={}
    for(const [width,height] of [[390,844],[600,844],[601,844],[768,1024],[900,768],[901,768],[950,768],[1024,768],[1100,800],[1200,800],[1280,800],[1440,900],[1920,1080],[2560,1440]]) {
      await viewport(width,height)
      await call('Page.navigate',{url:frontendUrl+'/categories/friends'})
      await ready('.category-opening__invitation button')
      await idle()
      await click('.category-opening__invitation button')
      await ready('.leaflet-dialog[open]')
      await evaluate("Promise.all(document.querySelector('.leaflet-dialog').getAnimations().map(animation=>animation.finished.catch(()=>{})))")
      await evaluate('Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))')
      const front=await inspectFriends()
      await screenshot('friends-front-'+width+'x'+height)
      assert(front.environment?.includes('/friends/environment-desktop.png'),width+': Friends front resolves its supplied environment ('+front.environment+')')
      assert.equal(front.featuredCount,1,width+': exactly one Friends featured product is present')
      assert.equal(front.productCount,0,width+': the front does not render a normal product grid')
      assert.equal(front.viewportScrolls,false,width+': front has no horizontal page overflow')
      if(width>=901) {
        assert.equal(front.environmentVisible,true,width+': desktop front environment is visible')
        const safe={left:front.painted.left+front.painted.width*.28,right:front.painted.left+front.painted.width*.79,
          top:front.painted.top+front.painted.height*.32,bottom:front.painted.top+front.painted.height*.88}
        for(const part of [front.art,front.copy]) {
          assert(part.left>=safe.left&&part.right<=safe.right&&part.top>=safe.top&&part.bottom<=safe.bottom,width+': featured content stays inside Friends front clearing '+JSON.stringify({part,safe}))
          const turn=front.turn
          assert(!(part.left<turn.right&&part.right>turn.left&&part.top<turn.bottom&&part.bottom>turn.top),width+': featured content clears Turn over '+JSON.stringify({part,turn}))
        }
      } else assert.equal(front.environmentVisible,false,width+': small-screen environment behavior stays on the existing system')
      await click('.leaflet__turn')
      await ready('.leaflet[data-side=back]:not([aria-busy=true])')
      const back=await inspectFriends()
      assert.equal(back.heading,null,width+': Friends reverse does not render a heading block')
      assert(back.environment?.includes('/friends/environment-desktop-back.png'),width+': Friends reverse resolves its supplied environment')
      assert(back.productCount<=11,width+': shared collection selection stays within eleven products')
      assert.equal(back.viewportScrolls,false,width+': reverse has no horizontal page overflow')
      if(width>=901) {
        assert.equal(back.logicalColumns,3,width+': Friends reverse uses three product columns on desktop')
        assert.equal(back.areaScrolls,false,width+': Friends reverse does not scroll')
        const safe={left:back.painted.left+back.painted.width*.18,right:back.painted.left+back.painted.width*.84,
          top:back.painted.top+back.painted.height*.28,bottom:back.painted.top+back.painted.height*.80}
        assert(back.products.every(product=>product.left>=safe.left&&product.right<=safe.right&&product.top>=safe.top&&product.bottom<=safe.bottom),width+': visible products stay inside Friends back clearing '+JSON.stringify({products:back.products,safe}))
        await screenshot('friends-back-'+width+'x'+height)
        const originalMarkup=await evaluate("document.querySelector('.leaflet__products--friends-collection').innerHTML")
        back.fixtures={}
        for(const count of [1,2,3,6,9,11]) {
          await evaluate(`(() => {
            const grid=document.querySelector('.leaflet__products--friends-collection');
            grid.innerHTML=${JSON.stringify(originalMarkup)};
            const pool=[...grid.children];
            grid.replaceChildren(...Array.from({length:${count}},(_,index)=>pool[index%pool.length].cloneNode(true)));
          })()`)
          const fixture=await inspectFriends()
          const fits=await evaluate(`(() => {
            const grid=document.querySelector('.leaflet__products--friends-collection'),nodes=[...grid.children],box=element=>element.getBoundingClientRect(),positions=nodes.map(box),turn=box(document.querySelector('.leaflet__turn'));
            const overlaps=(a,b)=>a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;
            const lastRow=positions.filter(position=>Math.abs(position.top-positions.at(-1).top)<1),gridBox=box(grid);
            return {productOverlap:positions.some((a,i)=>positions.slice(i+1).some(b=>overlaps(a,b))),turnOverlap:positions.some(a=>overlaps(a,turn)),
              lastRowCentered:Math.abs((lastRow[0].left+lastRow.at(-1).right)/2-(gridBox.left+gridBox.right)/2)<2,
              copyOverflow:nodes.some(node=>{const copy=node.querySelector('.leaflet-product__copy');return copy.scrollWidth>copy.clientWidth+1}),
              items:nodes.map(node=>({id:node.dataset.leafletProduct,art:box(node.querySelector('.leaflet-product__art')).toJSON(),image:node.querySelector('img')?.getAttribute('src'),copy:box(node.querySelector('.leaflet-product__copy')).toJSON(),titleSize:getComputedStyle(node.querySelector('h3')).fontSize}))};
          })()`)
          if([3,6,9,11].includes(count)) await screenshot('friends-back-'+width+'x'+height+'-'+count+'-products')
          assert.equal(fixture.productCount,count,width+': fixture occupancy '+count)
          assert.deepEqual(fixture.rows.map(row=>row.count),Array.from({length:Math.ceil(count/3)},(_,index)=>Math.min(3,count-index*3)),width+': three-column collection rows')
          assert.equal(fits.lastRowCentered,true,width+': incomplete final row is balanced')
          assert.equal(fits.productOverlap,false,width+': products never overlap')
          assert.equal(fits.turnOverlap,false,width+': products clear Turn over '+JSON.stringify({count,products:fixture.products,turn:fixture.turn}))
          assert.equal(fits.copyOverflow,false,width+': readable copy fits its column')
          assert.equal(fixture.areaScrolls,false,width+': no collection scroll')
          assert(fixture.products.every(product=>product.left>=safe.left&&product.right<=safe.right&&product.top>=safe.top&&product.bottom<=safe.bottom),width+': '+count+' products fit Friends clearing '+JSON.stringify({products:fixture.products,safe}))
          back.fixtures[count]={...fixture,...fits}
        }
        await evaluate(`document.querySelector('.leaflet__products--friends-collection').innerHTML=${JSON.stringify(originalMarkup)}`)

      } else {
        assert.equal(back.logicalColumns,2,width+': smaller Friends reverse keeps the existing two-column responsive layout')
        const originalMarkup=await evaluate("document.querySelector('.leaflet__products--friends-collection').innerHTML")
        await evaluate(`(() => { const grid=document.querySelector('.leaflet__products--friends-collection'),pool=[...grid.children];grid.replaceChildren(...Array.from({length:11},(_,index)=>pool[index%pool.length].cloneNode(true))); })()`)
        const full=await inspectFriends()
        assert.deepEqual(full.rows.map(row=>row.count),[2,2,2,2,2,1],width+': small-screen capacity remains eleven')
        assert.equal(full.areaScrolls,false,width+': eleven mobile products fit without collection scrolling')
        assert.equal(full.viewportScrolls,false,width+': eleven mobile products do not overflow horizontally')
        assert(full.gridBottom<full.turn.top,width+': mobile collection clears navigation')
        await screenshot('friends-back-'+width+'x'+height+'-11-products')
        back.full=full
        await evaluate(`document.querySelector('.leaflet__products--friends-collection').innerHTML=${JSON.stringify(originalMarkup)}`)

      }
      if(width<901) await screenshot('friends-back-'+width+'x'+height)
      await click('.leaflet__turn')
      await ready('.leaflet[data-side=front]:not([aria-busy=true])')
      assert((await inspectFriends()).environment?.includes('/friends/environment-desktop.png'),width+': returning restores Friends front artwork')
      records[width+'x'+height]={front,back}
      console.log('Friends '+width+'x'+height,JSON.stringify({front:{visible:front.environmentVisible,story:front.frontStory,art:front.art,copy:front.copy},back:{columns:back.logicalColumns,count:back.productCount,heading:back.heading,grid:back.grid,turn:back.turn}}))
      await click('[aria-label="Close leaflet"]')
    }
    writeFileSync(dir+'/friends-layout.json',JSON.stringify(records,null,2))
  } else if (process.argv.includes('--star-wars-layout')) {
    const view = async () => evaluate(`(() => {
      const sheet=document.querySelector('.leaflet'), area=sheet?.querySelector('.leaflet__print-area'), grid=sheet?.querySelector('.leaflet__products--collection');
      const rect=element=>element?.getBoundingClientRect().toJSON() ?? null;
      const image=sheet?.querySelector('.leaflet__environment'), heading=area?.querySelector('h1');
      const products=grid?[...grid.children]:[];
      const firstRowTop=products[0]?.getBoundingClientRect().top;
      const frontGrid=sheet?.querySelector('.leaflet__star-wars-featured-build'), frontItems=frontGrid?[...frontGrid.children].filter(item=>item.matches('.leaflet-product')):[];
      const imageRect=image?.getBoundingClientRect();
      const scale=imageRect?Math.min(imageRect.width/image.naturalWidth,imageRect.height/image.naturalHeight):0;
      const painted=imageRect?{left:imageRect.left+(imageRect.width-image.naturalWidth*scale)/2,top:imageRect.top+(imageRect.height-image.naturalHeight*scale)/2,width:image.naturalWidth*scale,height:image.naturalHeight*scale}:null;
      return {side:sheet?.dataset.side,environment:image?.getAttribute('src'),heading:heading?.textContent,
        area:rect(area),headingBox:rect(heading),description:rect(area?.querySelector('.leaflet__editorial')),
        featuredArt:rect(sheet?.querySelector('.leaflet-product--featured .leaflet-product__art')),
        featuredCopy:rect(sheet?.querySelector('.leaflet-product--featured .leaflet-product__copy')),
        featuredProduct:rect(sheet?.querySelector('.leaflet__star-wars-featured-build > .leaflet-product')),
        frontGrid:rect(frontGrid),listingGridCount:sheet?.querySelectorAll('.leaflet__products').length ?? 0,frontSlotCount:sheet?.querySelectorAll('.leaflet__star-wars-featured-slot').length ?? 0,frontProductCount:frontItems.length,frontProductIds:frontItems.map(item=>Number(item.dataset.leafletProduct)),frontItems:frontItems.map(rect),painted,
        grid:rect(grid),gridColumns:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:0,
        productCount:products.length,productIds:products.map(item=>Number(item.dataset.leafletProduct)),products:products.map(rect),firstRowCount:products.filter(item=>item.getBoundingClientRect().top===firstRowTop).length,
        firstProduct:rect(products[0]),lastProduct:rect(products.at(-1)),turn:rect(sheet?.querySelector('.leaflet__turn')),
        close:rect(sheet?.querySelector('[aria-label="Close leaflet"]')),
        areaScrolls:area?area.scrollHeight>area.clientHeight:false,viewportScrolls:document.documentElement.scrollWidth>innerWidth};
    })()`)
    const records={}
    for(const [width,height] of [[1024,768],[1100,800],[1200,800],[1280,800],[1366,768],[1440,900],[1600,900],[1920,1080],[2560,1440]]) {
      await viewport(width,height)
      await call('Page.navigate',{url:frontendUrl+'/categories/star-wars'})
      await ready('.category-opening__invitation button')
      await idle()
      await evaluate("document.querySelector('.category-opening__invitation button').scrollIntoView({block:'nearest'})")
      await settle()
      await click('.category-opening__invitation button')
      await ready('.leaflet-dialog[open]')
      await evaluate("Promise.all(document.querySelector('.leaflet-dialog').getAnimations().map(animation=>animation.finished.catch(()=>{})))")
      await evaluate('Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))')
      const front=await view()
      assert(front.environment?.endsWith('/environment-desktop.png'),width+': Star Wars front uses its environment artwork')
      assert.equal(front.frontProductCount,1,width+': the front contains only the Featured Build')
      assert.equal(front.frontProductIds.length,1,width+': exactly one product has rendered on the front')
      assert.equal(front.frontSlotCount,0,width+': no reserved product slots remain')
      assert.equal(front.listingGridCount,0,width+': no listing grid appears on the front')
      assert.equal(front.headingBox,null,width+': no Star Wars theme heading remains on the front')
      assert.equal(front.description,null,width+': no Star Wars introduction remains on the front')
      await screenshot('star-wars-front-'+width+'x'+height)
      assert(front.featuredProduct.left>=front.painted.left+front.painted.width*.24 && front.featuredProduct.right<=front.painted.left+front.painted.width*.9 && front.featuredProduct.top>=front.painted.top+front.painted.height*.28,width+': featured build starts inside the clear cream area '+JSON.stringify({painted:front.painted,product:front.featuredProduct}))
      assert.equal(front.areaScrolls,false,width+': Star Wars front fits without scrolling')
      const featured=await evaluate(`(() => {
        const sheet=document.querySelector('.leaflet'), product=sheet.querySelector('.leaflet__star-wars-featured-build > .leaflet-product');
        const rect=element=>element?.getBoundingClientRect().toJSON() ?? null;
        const art=product?.querySelector('.leaflet-product__art'),copy=product?.querySelector('.leaflet-product__copy');
        const turn=sheet.querySelector('.leaflet__turn');
        return {product:rect(product),art:rect(art),copy:rect(copy),turn:rect(turn),
          copyParts:[...copy.querySelectorAll('.leaflet-product__set,h3,.leaflet-product__facts,.leaflet-product__purchase,.leaflet-product__copy > button')].map(rect),
          overflow:[art,copy,...copy.querySelectorAll('.leaflet-product__set,h3,.leaflet-product__facts,.leaflet-product__purchase,.leaflet-product__copy > button')].some(element=>element.scrollWidth>element.clientWidth+1),
          scroller:document.documentElement.scrollWidth>innerWidth};
      })()`)
      const safe={left:front.painted.left+front.painted.width*.24,right:front.painted.left+front.painted.width*.9,
        top:front.painted.top+front.painted.height*.28,bottom:Math.min(front.turn.top-8,front.painted.top+front.painted.height*.78)}
      assert.equal(featured.overflow,false,width+': single feature artwork and copy do not clip')
      assert.equal(featured.scroller,false,width+': single feature introduces no horizontal page overflow')
      assert(featured.product.left>=safe.left&&featured.product.right<=safe.right&&featured.product.top>=safe.top&&featured.product.bottom<=safe.bottom,
        width+': complete feature remains in the open cream area '+JSON.stringify({product:featured.product,safe}))
      for(const part of [featured.art,...featured.copyParts]) {
        const r=part,t=featured.turn
        assert(!(r.left<t.right&&r.right>t.left&&r.top<t.bottom&&r.bottom>t.top),width+': feature clears Turn over')
      }
      await screenshot('star-wars-front-'+width+'x'+height)
      await click('.leaflet__turn')
      await ready('.leaflet[data-side=back]:not([aria-busy=true])')
      const back=await view()
      assert(back.environment?.endsWith('/environment-desktop-back.png'),width+': Star Wars back uses its environment artwork')
      assert(back.productIds.every(id=>!front.frontProductIds.includes(id)),width+': the Featured Build does not repeat on the reverse')
      assert.equal(back.gridColumns,2,width+': Star Wars reverse remains two columns')
      assert(back.productCount<=11,width+': Star Wars reverse stays within the shared product cap')
      assert.equal(back.areaScrolls,false,width+': Star Wars reverse does not scroll')
      assert(back.headingBox.top>=back.painted.top+back.painted.height*.2,width+': reverse heading clears the upper artwork')
      assert(back.products.every(item=>item.left>=back.painted.left+back.painted.width*.22-4 && item.right<=back.painted.left+back.painted.width*.78+4 && item.top>=back.painted.top+back.painted.height*.2-4 && item.bottom<=back.painted.top+back.painted.height*.84+4),width+': reverse products remain in the central opening '+JSON.stringify({painted:back.painted,products:back.products}))
      assert(Math.abs(back.close.top-front.close.top)<.5,width+': shared Close position switches neither side unexpectedly')
      await screenshot('star-wars-back-'+width+'x'+height)
      const sevenProductFixture=await evaluate(`(() => {
        const grid=document.querySelector('.leaflet__products--star-wars-collection'),turn=document.querySelector('.leaflet__turn'),original=[...grid.children];
        window.__starWarsOriginalProducts=original;
        grid.replaceChildren(...Array.from({length:7},(_,index)=>original[index%original.length].cloneNode(true)));
        const products=[...grid.children].map(element=>element.getBoundingClientRect()),turnBox=turn.getBoundingClientRect(),gridBox=grid.getBoundingClientRect();
        const rows=[];for(const item of products){let row=rows.find(value=>Math.abs(value.top-item.top)<1);if(!row)rows.push(row={top:item.top,count:0,items:[]});row.count++;row.items.push(item);}
        const overlap=(a,b)=>a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;
        const result={rows:rows.map(row=>row.count),products:products.map(item=>item.toJSON()),grid:gridBox.toJSON(),turn:turnBox.toJSON(),
          productOverlap:products.some((a,index)=>products.slice(index+1).some(b=>overlap(a,b))),turnOverlap:products.some(item=>overlap(item,turnBox)),
          areaScrolls:grid.scrollHeight>grid.clientHeight+1,artHeight:parseFloat(getComputedStyle(grid.querySelector('.leaflet-product__art')).height)};
        return result;
      })()`)
      assert.deepEqual(sevenProductFixture.rows,[2,2,2,1],width+': seven Star Wars products form 2-2-2-1 rows '+JSON.stringify(sevenProductFixture))
      assert.equal(sevenProductFixture.productOverlap,false,width+': seven Star Wars products do not overlap')
      assert.equal(sevenProductFixture.turnOverlap,false,width+': seven Star Wars products clear Turn over')
      assert.equal(sevenProductFixture.areaScrolls,false,width+': seven Star Wars products do not introduce scrolling '+JSON.stringify(sevenProductFixture))
      assert(sevenProductFixture.products.every(item=>item.left>=back.painted.left+back.painted.width*.22-4 && item.right<=back.painted.left+back.painted.width*.78+4 && item.top>=back.painted.top+back.painted.height*.2-4 && item.bottom<=back.painted.top+back.painted.height*.84+4),width+': seven Star Wars products stay in the central opening '+JSON.stringify({painted:back.painted,products:sevenProductFixture.products}))
      await screenshot('star-wars-back-'+width+'x'+height+'-7-products')
      await evaluate("(() => { const grid=document.querySelector('.leaflet__products--star-wars-collection');grid.replaceChildren(...window.__starWarsOriginalProducts);delete window.__starWarsOriginalProducts; })()")
      const twoProductRow=await evaluate(`(() => {
        const grid=document.querySelector('.leaflet__products--star-wars-collection'),turn=document.querySelector('.leaflet__turn');
        const original=[...grid.children];
        grid.replaceChildren(...original.slice(0,2));
        const items=[...grid.children].map(element=>element.getBoundingClientRect()),turnBox=turn.getBoundingClientRect();
        const result={columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,rowCount:new Set(items.map(item=>item.top)).size,
          overlap:items.some(item=>item.left<turnBox.right&&item.right>turnBox.left&&item.top<turnBox.bottom&&item.bottom>turnBox.top),items:items.map(item=>item.toJSON())};
        grid.replaceChildren(...original);
        return result;
      })()`)
      assert.equal(twoProductRow.columns,2,width+': Star Wars reverse uses two product columns')
      assert.equal(twoProductRow.rowCount,1,width+': two Star Wars products share one row')
      assert.equal(twoProductRow.overlap,false,width+': two Star Wars products remain clear of Turn over')
      await click('.leaflet__turn')
      await ready('.leaflet[data-side=front]:not([aria-busy=true])')
      assert((await view()).environment?.endsWith('/environment-desktop.png'),width+': return turn restores Star Wars front artwork')
      records[width+'x'+height]={front,featured,back}
      console.log('Star Wars leaflet at '+width+'px',JSON.stringify(records[width+'x'+height]))
      await click('[aria-label="Close leaflet"]')
    }
    writeFileSync(dir+'/star-wars-layout.json',JSON.stringify(records,null,2))
  } else if (process.argv.includes('--vehicles-layout')) {
    // Real browser regression checks: jsdom cannot measure CSS layout or the
    // reflow caused by hiding category content when a native dialog opens.
    const bookGeometry = () => evaluate(`(() => {
      const chain = selector => {
        const result = [];
        for (let element = document.querySelector(selector); element; element = element.parentElement) {
          const style = getComputedStyle(element);
          result.push({ node: element.tagName + '.' + element.className,
            rect: element.getBoundingClientRect().toJSON(),
            scroll: [element.scrollLeft, element.scrollTop],
            layout: Object.fromEntries(['display', 'position', 'width', 'height', 'padding', 'margin', 'transform', 'overflow', 'flex', 'align-items'].map(key => [key, style.getPropertyValue(key)])) });
        }
        return result;
      };
      return { feature: chain('.category-opening-feature .vehicle-product__art img'),
        editorial: chain('.category-opening__art-space img'),
        viewport: [innerWidth, innerHeight, document.documentElement.clientWidth, scrollX, scrollY] };
    })()`)
    const featureGeometry = () => evaluate(`(() => {
      const sheet = document.querySelector('.leaflet');
      const box = element => element.getBoundingClientRect().toJSON();
      const fitted = image => {
        const rect = box(image), scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
        const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
        return { left: rect.x + (rect.width - width) / 2, right: rect.x + (rect.width + width) / 2,
          top: rect.y + (rect.height - height) / 2, bottom: rect.y + (rect.height + height) / 2, width, height };
      };
      const art = sheet.querySelector('.leaflet-product__art img'), copy = sheet.querySelector('.leaflet-product__copy');
      const turn = sheet.querySelector('.leaflet__turn'), title = copy.querySelector('h3');
      const closeButton = sheet.querySelector('[aria-label="Close leaflet"]');
      const close = box(closeButton), closeInlineTop = closeButton.style.getPropertyValue('top'), closeInlinePriority = closeButton.style.getPropertyPriority('top');
      closeButton.style.setProperty('top', 'calc(50% - var(--leaflet-navigation-height) * .42 - 30px)', 'important');
      const closeBaseTop = box(closeButton).top;
      if (closeInlineTop) closeButton.style.setProperty('top', closeInlineTop, closeInlinePriority);
      else closeButton.style.removeProperty('top');
      const sheetBounds = box(sheet);
      const environment = sheet.querySelector('.leaflet__environment');
      return { image: fitted(art), copy: box(copy), textLeft: box(copy.firstElementChild).left,
        title: box(title), titleFont: parseFloat(getComputedStyle(title).fontSize),
        turn: box(turn), close, closeBaseTop, closeCenterX: close.left + close.width / 2,
        sheet: sheetBounds, sheetCenterX: sheetBounds.left + sheetBounds.width / 2,
        environment: getComputedStyle(environment).display === 'none' ? null : fitted(environment),
        stacked: innerWidth <= 600, desktop: innerWidth >= 901, xl: innerWidth >= 1400, viewportHeight: innerHeight,
        viewportOverflow: document.documentElement.scrollWidth > innerWidth,
        copyOverflow: copy.scrollWidth > copy.clientWidth };
    })()`)
    const checkFeature = (geometry, label) => {
      const { image, copy, textLeft, turn, sheet } = geometry
      if (!geometry.stacked) assert(textLeft - image.right >= 4, label + ': artwork and copy have a visible horizontal gap')
      else assert(copy.top >= image.bottom, label + ': narrow layout deliberately stacks the copy')
      assert(turn.top >= copy.bottom + 4, label + ': Turn over is below the copy')
      assert(!geometry.viewportOverflow && !geometry.copyOverflow, label + ': text fits without horizontal overflow')
      if (geometry.xl) assert(geometry.close.top >= 0 && geometry.close.bottom <= geometry.viewportHeight, label + ': XL close remains fully visible in the viewport')
      assert(geometry.titleFont >= 13 && geometry.title.width >= 170, label + ': title has readable type and usable width')
      assert(image.left >= sheet.left && image.right <= sheet.right && turn.bottom <= sheet.bottom, label + ': content stays on the sheet')
      if (geometry.environment) {
        const paper = geometry.environment
        assert(turn.bottom <= paper.top + paper.height * .83, label + ': Turn over clears the bottom foreground')
      }
    }
    const sizes = [[390,844],[600,844],[601,844],[768,1024],[900,768],[901,768],[950,768],[1000,768],
      [1100,768],[1101,768],[1150,768],[1199,768],[1200,768],[1280,800],
      [1400,900],[1440,900],[1600,900],[1800,1080],[1829,1080],[1830,1080],
      [1900,1080],[1901,1080],[1920,1080],[1920,768]]
    const results = {}
    for (const [width,height] of sizes) {
      await viewport(width,height)
      await call('Page.navigate',{url:frontendUrl+'/categories/vehicles'})
      await ready('.category-opening__invitation button')
      await evaluate('Promise.all([...document.images].map(image => image.decode().catch(() => {})))')
      await evaluate("document.querySelector('.category-opening__invitation button').scrollIntoView({block:'nearest'})")
      await settle()
      const before = await bookGeometry()
      assert(before.feature.length > 0, 'Loaded category feature is required')
      for (let opening = 0; opening < 3; opening++) {
        await click('.category-opening__invitation button')
        await ready('.leaflet-dialog[open]')
        await evaluate("Promise.all(document.querySelector('.leaflet-dialog').getAnimations().map(animation => animation.finished.catch(() => {})))")
        assert.deepEqual(await bookGeometry(), before, width + ': opening preserves every category ancestor exactly')
        if (opening === 0) {
          await screenshot('vehicles-layout-'+width+'x'+height)
          const geometry = await featureGeometry()
          checkFeature(geometry, width+'x'+height)
          const frontCloseTop = geometry.close.top
          if (geometry.desktop) assert(Math.abs(geometry.closeCenterX-geometry.sheetCenterX)<0.5, width + ': front close remains horizontally centred')
          results[width+'x'+height] = geometry
          await click('.leaflet__turn')
          await ready('.leaflet[data-side=back]:not([aria-busy=true])')
          assert.deepEqual(await bookGeometry(), before, width + ': back also preserves category geometry')
          const backPosition = await evaluate(`(() => {
            const sheet=document.querySelector('.leaflet'), area=sheet.querySelector('.leaflet__print-area--vehicles-back'), grid=sheet.querySelector('.leaflet__products--vehicles-collection');
          const box=element=>element.getBoundingClientRect().toJSON();
          const heading=area.querySelector('.leaflet__collection-heading'), current={headingTop:box(heading).top,firstProductTop:box(grid.firstElementChild).top};
            const closeButton=sheet.querySelector('[aria-label="Close leaflet"]'), closeInlineTop=closeButton.style.getPropertyValue('top'), closeInlinePriority=closeButton.style.getPropertyPriority('top');
            const closeOffset=innerWidth>=901 && innerWidth<=1399 ? 70 : 30;
            closeButton.style.setProperty('top', 'calc(50% - var(--leaflet-navigation-height) * .42 - ' + closeOffset + 'px)', 'important');
            const closeBaseTop=box(closeButton).top;
            if(closeInlineTop) closeButton.style.setProperty('top',closeInlineTop,closeInlinePriority); else closeButton.style.removeProperty('top');
            area.style.setProperty('--vehicles-back-content-drop','0px','important');
            const baseline={headingTop:box(heading).top,firstProductTop:box(grid.firstElementChild).top};
            area.style.removeProperty('--vehicles-back-content-drop');
            const closeBounds=box(closeButton), sheetBounds=box(sheet);
            return { closeTop:closeBounds.top, closeBaseTop,
              sheetTop:sheetBounds.top,
              closeCenterX:closeBounds.left+closeBounds.width/2, sheetCenterX:sheetBounds.left+sheetBounds.width/2,
              headingTop:current.headingTop,firstProductTop:current.firstProductTop,
              headingDrop:current.headingTop-baseline.headingTop,firstProductDrop:current.firstProductTop-baseline.firstProductTop,
              contentDrop:getComputedStyle(area).getPropertyValue('--vehicles-back-content-drop').trim() };
          })()`)
          if (width >= 901) assert(Math.abs(backPosition.closeCenterX-backPosition.sheetCenterX)<0.5, width + ': back close remains horizontally centred')
          if (width >= 901 && width <= 1399) {
            assert(backPosition.closeTop <= frontCloseTop - 39, width + ': back close button is 40px above the unchanged front position')
            assert(Math.abs(backPosition.headingDrop-backPosition.firstProductDrop)<0.5, width + ': heading and products move together')
            if (backPosition.contentDrop === '44px') {
              assert(Math.abs(backPosition.headingDrop-44)<0.5, width + ': sparse collection content keeps its 44px downward shift')
            } else if (width >= 1200) {
              assert(Math.abs(backPosition.headingDrop-24)<0.5, width + ': denser LG collection keeps its 24px downward shift')
            } else {
              assert(backPosition.headingDrop>=3 && backPosition.headingDrop<=16, width + ': denser collection keeps its responsive 3px–16px downward shift')
            }
            if (width <= 1199) {
              assert(Math.abs(geometry.close.top-geometry.closeBaseTop)<0.5, width + ': MD front close position remains unchanged')
              assert(Math.abs(backPosition.closeTop-backPosition.closeBaseTop)<0.5, width + ': MD back close position remains unchanged')
            } else {
              assert(Math.abs(geometry.close.top-geometry.closeBaseTop+30)<0.5, width + ': LG front close moves upward 30px')
              assert(Math.abs(backPosition.closeTop-backPosition.closeBaseTop+30)<0.5, width + ': LG back close moves upward 30px')
            }
          } else {
            if (width >= 1400) {
              const expectedTop=Math.max(geometry.closeBaseTop-75,geometry.sheet.top-25)
              assert(Math.abs(geometry.close.top-expectedTop)<2, width + ': XL front close is raised and capped above the leaflet')
              assert(Math.abs(backPosition.closeTop-expectedTop)<2, width + ': XL back close is raised and capped above the leaflet')
              assert(Math.abs(backPosition.closeTop-frontCloseTop)<0.5, width + ': XL front and back close positions match')
            }
          }
          if ([950,1100,1280,1440].includes(width)) console.log('Vehicles reverse positions at '+width+'px', JSON.stringify({frontCloseTop,...backPosition}))
          if ([950,1100,1280,1440].includes(width)) await screenshot('vehicles-back-live-'+width+'x'+height)
          if (width === 600 || width === 601) {
            const columns = await evaluate(`(() => {const grid=document.querySelector('.leaflet__products--collection'), first=[...grid.children].filter(item=>item.getBoundingClientRect().top===grid.firstElementChild.getBoundingClientRect().top);return new Set(first.map(item=>item.getBoundingClientRect().left)).size;})()`)
            assert.equal(columns, 2, width + ': Vehicles reverse keeps the existing small-screen two-column layout')
            await screenshot('vehicles-back-'+width+'x'+height)
          }
          if ([950,1100,1280,1440].includes(width)) {
            const reverse = await evaluate(`(() => {
              const sheet=document.querySelector('.leaflet'), area=sheet.querySelector('.leaflet__print-area'), grid=sheet.querySelector('.leaflet__products--collection');
              const box=element=>element.getBoundingClientRect().toJSON();
              const originalCount=grid.children.length;
              const capacities=[];
              for (const count of [9,10,11]) {
                while(grid.children.length<count) grid.append(grid.children[(grid.children.length-originalCount)%originalCount].cloneNode(true));
                const products=[...grid.children].map(box), turn=box(sheet.querySelector('.leaflet__turn'));
                capacities.push({count,products,turn,scrolls:getComputedStyle(area).overflowY!=='hidden'});
              }
              const environment=sheet.querySelector('.leaflet__environment'), image=box(environment);
              const scale=Math.min(image.width/environment.naturalWidth,image.height/environment.naturalHeight);
              const painted={left:image.left+(image.width-environment.naturalWidth*scale)/2,top:image.top+(image.height-environment.naturalHeight*scale)/2,
                width:environment.naturalWidth*scale,height:environment.naturalHeight*scale};
              const products=[...grid.children].map(box), firstRow=products.filter(product=>product.top===products[0].top);
              const lastRow=products.filter(product=>product.top===products.at(-1).top);
              const firstProductTop=box(grid.firstElementChild).top;
              area.style.setProperty('--vehicles-back-content-drop','0px','important');
              const firstProductBaseline=box(grid.firstElementChild).top;
              area.style.removeProperty('--vehicles-back-content-drop');
              return { environment: sheet.querySelector('.leaflet__environment').src, heading: area.querySelector('h1')?.textContent,
                contentDrop: getComputedStyle(sheet.querySelector('.leaflet__print-area--vehicles-back')).getPropertyValue('--vehicles-back-content-drop').trim(),
                firstProductTop, firstProductDrop: firstProductTop-firstProductBaseline,
                capacities,
                count: originalCount, columns: new Set(firstRow.map(product=>product.left)).size,
                products, area: box(area), painted, turn: box(sheet.querySelector('.leaflet__turn')),
                lastRowCentered: Math.abs((lastRow[0].left+lastRow.at(-1).right)/2-(box(grid).left+box(grid).right)/2)<2,
                scrolls: getComputedStyle(area).overflowY!=='hidden',
                sheetBackground: getComputedStyle(sheet).backgroundColor, panelBackground: grid && getComputedStyle(grid).backgroundColor,
                productBackground: grid && getComputedStyle(grid.firstElementChild).backgroundColor,
                productBorder: grid && getComputedStyle(grid.firstElementChild).borderWidth,
                productShadow: grid && getComputedStyle(grid.firstElementChild).boxShadow };
            })()`)
            if (width !== 1440) {
              await screenshot('vehicles-back-11-'+width+'x'+height)
              console.log('Vehicles reverse bounds at '+width+'px', JSON.stringify(reverse))
            }
            assert(reverse.products.every(product => product.left >= reverse.painted.left + reverse.painted.width * .2 && product.right <= reverse.painted.left + reverse.painted.width * .8 && product.top >= reverse.painted.top + reverse.painted.height * .15 && product.bottom <= reverse.painted.top + reverse.painted.height * .85), width + ': eleven products stay inside the clear central paper area')
            assert(reverse.products.every(product => product.right <= reverse.turn.left || product.left >= reverse.turn.right || product.bottom <= reverse.turn.top || product.top >= reverse.turn.bottom), width + ': Turn over does not overlap a product')
            assert(!reverse.scrolls, width + ': the desktop collection does not scroll')
            for (const capacity of reverse.capacities) {
              assert(capacity.products.every(product => product.left >= reverse.painted.left + reverse.painted.width * .2 && product.right <= reverse.painted.left + reverse.painted.width * .8 && product.top >= reverse.painted.top + reverse.painted.height * .15 && product.bottom <= reverse.painted.top + reverse.painted.height * .85), width + ': '+capacity.count+' products stay inside the clear central paper area')
              assert(capacity.products.every(product => product.right <= capacity.turn.left || product.left >= capacity.turn.right || product.bottom <= capacity.turn.top || product.top >= capacity.turn.bottom), width + ': '+capacity.count+' products do not overlap Turn over')
              assert(!capacity.scrolls, width + ': '+capacity.count+' products do not introduce scrolling')
            }
            if (width !== 1440) assert(reverse.firstProductDrop > 0, width + ': eleven-product layout retains a positive downward content adjustment')
            if (width === 1440) {
              assert(reverse.environment.endsWith('/environment-desktop-back.png'), 'Vehicles reverse uses its prepared environment asset')
              assert.equal(reverse.heading, 'The Vehicles Collection', 'Vehicles reverse has one collection heading')
              assert(reverse.count > 0 && reverse.count <= 11, 'Vehicles reverse shows at most eleven catalogue products')
              assert.equal(reverse.columns, 3, 'Desktop Vehicles reverse uses the shared three-column grid')
              assert.equal(reverse.products.length, 11, 'Eleven products fit in the desktop grid')
              assert.equal(new Set(reverse.products.map(product => product.top)).size, 4, 'Eleven products occupy four rows')
              assert(reverse.lastRowCentered, 'The final two products are balanced at the centre of the last row')
              assert.equal(reverse.productBackground, 'rgba(0, 0, 0, 0)', 'Collection units sit directly on the environment paper')
              assert.equal(reverse.productBorder, '0px', 'Collection units have no card border')
              assert.equal(reverse.productShadow, 'none', 'Collection units have no card shadow')
              await screenshot('vehicles-back-11-1440x900')
              console.log('PASS Vehicles reverse environment, heading, eleven-product layout, and frameless product treatment', JSON.stringify(reverse))
            } else {
              assert.equal(reverse.columns, 3, width + ': md/lg Vehicles reverse uses three collection columns')
              await screenshot('vehicles-back-11-'+width+'x'+height)
              console.log('PASS Vehicles reverse capacity geometry at '+width+'px', JSON.stringify({columns:reverse.columns, productBottom:Math.max(...reverse.products.map(product=>product.bottom)), paintedBottom:reverse.painted.top+reverse.painted.height*.85, turn:reverse.turn}))
            }
          }
          await click('.leaflet__turn')
          await ready('.leaflet[data-side=front]:not([aria-busy=true])')
          const restoredCloseTop = await evaluate(`document.querySelector('.leaflet [aria-label="Close leaflet"]').getBoundingClientRect().top`)
          assert(Math.abs(restoredCloseTop-frontCloseTop)<0.5, width + ': front close position is restored after back-to-front flip')
        }
        await click('[aria-label="Close leaflet"]')
        assert.deepEqual(await bookGeometry(), before, width + ': closing preserves every category ancestor exactly')
        assert(await evaluate("document.activeElement === document.querySelector('.category-opening__invitation button')"), 'Focus returns to the visible opener')
      }
      console.log('PASS Vehicles layout and three pixel-stable open/close cycles at '+width+'x'+height)
    }
    // Sweep between the representative sizes as well as across the exact CSS boundaries.
    await click('.category-opening__invitation button')
    await ready('.leaflet-dialog[open]')
    await evaluate("Promise.all(document.querySelector('.leaflet-dialog').getAnimations().map(animation => animation.finished.catch(() => {})))")
    for (const height of [768,1080]) for (let width = 901; width <= 1920; width += 25) {
      await viewport(width,height)
      await settle()
      checkFeature(await featureGeometry(), width+'x'+height)
    }
    await click('.leaflet-product__copy > button')
    await ready('[data-detail-listing-id]')
    assert.equal(await evaluate("document.querySelectorAll('.leaflet-dialog').length"), 0, 'Details use the existing product flow')
    await viewport(1440,900)
    await call('Page.navigate',{url:frontendUrl+'/categories/harry-potter'})
    await ready('.category-opening__invitation button')
    await evaluate('Promise.all([...document.images].map(image => image.decode().catch(() => {})))')
    await evaluate("document.querySelector('.category-opening__invitation button').scrollIntoView({block:'nearest'})")
    await settle()
    const harryPotterBefore = await bookGeometry()
    await click('.category-opening__invitation button')
    await ready('.leaflet-dialog[open]')
    assert.deepEqual(await bookGeometry(), harryPotterBefore, 'Shared visibility fix preserves Harry Potter category geometry')
    assert.equal(await evaluate("document.querySelectorAll('.leaflet__vehicles-layout').length"), 0, 'Vehicles layout is theme-scoped')
    await click('.leaflet__turn')
    await ready('.leaflet[data-side=back]:not([aria-busy=true])')
    await click('[aria-label="Close leaflet"]')
    assert.deepEqual(await bookGeometry(), harryPotterBefore, 'Harry Potter close preserves category geometry')
    writeFileSync(dir+'/vehicles-layout.json',JSON.stringify(results,null,2))
    console.log('PASS continuous width sweep, existing details flow, Harry Potter flip/close, and focus restoration')
  } else if (process.argv.includes('--city-layout')) {
    const sizes = [[1920,1080],[1440,900],[1280,800],[1200,800],[1024,768],[901,768],[900,768],[820,1000],[600,844],[390,844]]
    const results = {}
    for (const [width,height] of sizes) {
      await viewport(width,height)
      await call('Page.navigate',{url:frontendUrl+'/categories/city'})
      await ready('.category-opening__invitation button')
      await evaluate("document.querySelector('.category-opening__invitation button').click()")
      await ready('.leaflet-dialog[open]')
      await evaluate("Promise.all(document.querySelector('.leaflet-dialog').getAnimations().map(animation=>animation.finished.catch(()=>{})))")
      await settle()
      await evaluate('Promise.all([...document.images].map(image => image.decode().catch(() => {})))')
      const front = await evaluate(`(() => {
        const sheet=document.querySelector('.leaflet'), area=sheet.querySelector('.leaflet__print-area'), product=sheet.querySelector('.leaflet-product--featured');
        const box=element=>element?.getBoundingClientRect().toJSON()??null, art=product?.querySelector('.leaflet-product__art'), copy=product?.querySelector('.leaflet-product__copy');
        const imageNode=art?.querySelector('img'),layout=sheet.querySelector('.leaflet__city-layout');
        const image=sheet.querySelector('.leaflet__environment'), imageBox=box(image), scale=image?Math.min(imageBox.width/image.naturalWidth,imageBox.height/image.naturalHeight):0;
        const painted=image?{left:imageBox.left+(imageBox.width-image.naturalWidth*scale)/2,top:imageBox.top+(imageBox.height-image.naturalHeight*scale)/2,width:image.naturalWidth*scale,height:image.naturalHeight*scale}:null;
        return {side:sheet.dataset.side,environment:image?.getAttribute('src'),featureId:product?.dataset.leafletProduct,title:copy?.querySelector('h3')?.textContent,
          layout:box(layout),story:box(sheet.querySelector('.leaflet__vehicles-story')),art:box(art),productImage:imageNode?{src:imageNode.src,naturalWidth:imageNode.naturalWidth,naturalHeight:imageNode.naturalHeight}:null,copy:box(copy),area:box(area),turn:box(sheet.querySelector('.leaflet__turn')),painted,
          areaOverflow:area.scrollWidth>area.clientWidth,viewportOverflow:document.documentElement.scrollWidth>innerWidth,
          titleFont:copy?parseFloat(getComputedStyle(copy.querySelector('h3')).fontSize):0,artWidth:art?.clientWidth,artHeight:art?.clientHeight};
      })()`)
      console.log('City front measured bounds '+width+'x'+height,JSON.stringify(front))
      assert(front.environment?.endsWith('/city/environment-desktop.png'),width+': front resolves the London artwork')
      assert(front.featureId,width+': real featured product is rendered')
      assert(!front.areaOverflow&&!front.viewportOverflow,width+': front has no horizontal overflow')
      if(width>=901) {
        await screenshot('city-front-'+width+'x'+height)
        if(width>=1100 && process.argv.includes('--city-front-layout')) {
          assert(front.art.left>=front.painted.left+front.painted.width*.22&&front.art.right<=front.painted.left+front.painted.width*.83,width+': featured artwork stays in the London opening')
          assert(front.copy.left>=front.painted.left+front.painted.width*.22&&front.copy.right<=front.painted.left+front.painted.width*.83,width+': featured copy stays in the London opening')
          assert(front.art.right+8<=front.copy.left,width+': featured image and text do not collide')
          assert(front.copy.bottom+8<=front.turn.top,width+': featured text clears the turn control')
        }
        if(!front.productImage?.naturalWidth) console.warn(width+': remote catalogue artwork did not load in the local inspection browser')
      } else await screenshot('city-front-responsive-'+width+'x'+height)
      await click('.leaflet__turn')
      await ready('.leaflet[data-side=back]:not([aria-busy=true])')
      await settle()
      await evaluate('Promise.all([...document.images].map(image => image.decode().catch(() => {})))')
      const back=await evaluate(`(() => {
        const sheet=document.querySelector('.leaflet'),area=sheet.querySelector('.leaflet__print-area--city-back'),grid=sheet.querySelector('.leaflet__products--city-collection'),layout=sheet.querySelector('.leaflet__city-back-layout'),artboard=sheet.querySelector('.leaflet__city-back-artboard');
        const box=element=>element?.getBoundingClientRect().toJSON()??null,image=sheet.querySelector('.leaflet__environment'),ir=box(image);
        const scale=image?Math.min(ir.width/image.naturalWidth,ir.height/image.naturalHeight):0;
        const painted=image?{left:ir.left+(ir.width-image.naturalWidth*scale)/2,top:ir.top+(ir.height-image.naturalHeight*scale)/2,width:image.naturalWidth*scale,height:image.naturalHeight*scale}:null;
        const slots=grid?[...grid.querySelectorAll(':scope > .leaflet__city-row')].map(row=>({slot:Number(row.dataset.cityRow),count:row.querySelectorAll('.leaflet-product--browse').length,box:box(row)})):[];
        const products=grid?[...grid.querySelectorAll('.leaflet-product--browse')].map(item=>({slot:Number(item.closest('.leaflet__city-row')?.dataset.cityRow),box:box(item),art:box(item.querySelector('.leaflet-product__art')),copy:box(item.querySelector('.leaflet-product__copy')),title:item.querySelector('h3')?.textContent,titleFont:parseFloat(getComputedStyle(item.querySelector('h3')).fontSize)})):[];
        const rows=[];for(const item of products){let row=rows.find(value=>Math.abs(value.top-item.box.top)<2);if(!row)rows.push(row={top:item.box.top,count:0});row.count++;}
        return {side:sheet.dataset.side,environment:image?.getAttribute('src'),count:products.length,rows,slots,headingPresent:!!area.querySelector('.leaflet__collection-heading'),layout:box(layout),artboard:box(artboard),productsArea:box(grid),products,area:box(area),footer:box(sheet.querySelector('.leaflet__footer')),turn:box(sheet.querySelector('.leaflet__turn')),painted,
          areaOverflow:area.scrollWidth>area.clientWidth,viewportOverflow:document.documentElement.scrollWidth>innerWidth,areaScrolls:area.scrollHeight>area.clientHeight};
      })()`)
      console.log('City reverse measured bounds '+width+'x'+height,JSON.stringify(back))
      assert(back.environment?.endsWith('/city/environment-desktop-back.png'),width+': reverse resolves the York artwork')
      assert(back.count===2,width+': back uses the two actual non-feature City products')
      assert.equal(back.headingPresent,false,width+': the City back has no collection heading or subtitle')
      assert(!back.viewportOverflow,width+': reverse has no horizontal page overflow')
      assert(!back.areaScrolls,width+': the two-product collection does not scroll within the artwork')
      assert(back.products.every(item=>item.box.left>=back.area.left&&item.box.right<=back.area.right),width+': products stay inside the print area')
      if(width>=901) {
        await screenshot('city-back-'+width+'x'+height)
        const close=(a,b,tolerance=2)=>Math.abs(a-b)<=tolerance
        assert(back.artboard&&close(back.artboard.left,back.painted.left)&&close(back.artboard.top,back.painted.top)&&close(back.artboard.width,back.painted.width)&&close(back.artboard.height,back.painted.height),width+': content artboard exactly matches the rendered York painting')
        assert(close((back.area.left-back.artboard.left)/back.artboard.width,.24,.01)&&close((back.area.top-back.artboard.top)/back.artboard.height,.34,.01)&&close(back.area.width/back.artboard.width,.60,.01)&&close(back.area.height/back.artboard.height,.52,.01),width+': pale safe-area bounds keep the same artwork-relative proportions')
        assert(close((back.turn.left-back.artboard.left)/back.artboard.width,.72,.02)&&close((back.turn.top-back.artboard.top)/back.artboard.height,.75,.02),width+': Turn over remains anchored to the York composition')
        assert(back.products.every(item=>item.box.left>=back.painted.left+back.painted.width*.22&&item.box.right<=back.painted.left+back.painted.width*.90&&item.box.top>=back.painted.top+back.painted.height*.30&&item.box.bottom<=back.painted.top+back.painted.height*.80),width+': products stay within the York paper opening')
        assert.deepEqual(back.slots.map(slot=>[slot.slot,slot.count]),[[1,2]],width+': two products occupy only the fixed first 2-item row')
        assert(back.slots[0].box.top<back.area.top+back.area.height*.08,width+': the first occupied row starts at the top of the safe area')
        assert(back.products.every(item=>item.box.top<back.area.top+back.area.height*.32),width+': two products stay near the top with the unused safe area below')
        assert.equal(back.rows.length,1,width+': the two real reverse products share the first desktop row')
        assert(close((back.products[0].box.left+back.products[0].box.right+back.products[1].box.left+back.products[1].box.right)/4,(back.artboard.left+back.artboard.right)/2,4),width+': the first row remains horizontally balanced around the painting')
        assert(back.products.every(item=>item.box.bottom<=back.turn.top||item.box.top>=back.turn.bottom||item.box.right<=back.turn.left||item.box.left>=back.turn.right),width+': products clear the turn control')
        if(width===1440) {
          const stress=await evaluate(`(() => {
            const grid=document.querySelector('.leaflet__products--city-collection'),original=grid.innerHTML,pool=[...grid.querySelectorAll('.leaflet-product--browse')],counts=[2,3,4,2];let cursor=0;
            grid.replaceChildren(...counts.map((count,index)=>{const row=document.createElement('div');row.className='leaflet__city-row leaflet__city-row--'+(index+1);row.dataset.cityRow=String(index+1);for(let item=0;item<count;item++)row.append(pool[cursor++%pool.length].cloneNode(true));return row;}));
            const box=node=>node.getBoundingClientRect().toJSON(),slots=[...grid.querySelectorAll(':scope > .leaflet__city-row')].map(row=>({slot:Number(row.dataset.cityRow),count:row.querySelectorAll('.leaflet-product--browse').length,box:box(row),products:[...row.querySelectorAll('.leaflet-product--browse')].map(box)})),products=[...grid.querySelectorAll('.leaflet-product--browse')].map(box),area=document.querySelector('.leaflet__print-area--city-back'),turn=document.querySelector('.leaflet__turn');
            const overlaps=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
            return {original,slots,products,area:box(area),turn:box(turn),areaScrolls:area.scrollHeight>area.clientHeight,productOverlap:products.some((a,index)=>products.slice(index+1).some(b=>overlaps(a,b))),turnOverlap:products.some(product=>overlaps(product,box(turn)))};
          })()`)
          const originalBackMarkup=stress.original
          delete stress.original
          await screenshot('city-back-'+width+'x'+height+'-11-slots')
          assert.deepEqual(stress.slots.map(slot=>[slot.slot,slot.count]),[[1,2],[2,3],[3,4],[4,2]],width+': eleven products fill the fixed 2 / 3 / 4 / 2 rows')
          assert(stress.slots.every((slot,index)=>slot.products.every(product=>product.left>=stress.area.left&&product.right<=stress.area.right)&&(index===0||slot.box.top>stress.slots[index-1].box.top)),width+': every fixed row stays inside the York opening and runs top-to-bottom')
          assert.equal(stress.productOverlap,false,width+': the eleven-slot composition has no product collisions')
          assert.equal(stress.turnOverlap,false,width+': the eleven-slot composition clears Turn over')
          assert.equal(stress.areaScrolls,false,width+': the eleven-slot composition fits without scrolling')
          await evaluate(`document.querySelector('.leaflet__products--city-collection').innerHTML=${JSON.stringify(originalBackMarkup)}`)
          console.log('City fixed-slot stress layout '+width+'x'+height,JSON.stringify(stress))
        }
      } else if(width<=600) {
        assert.equal(back.rows.length,2,width+': the narrow reverse stacks products for readable copy')
        assert(back.turn.left>back.area.left+back.area.width*.5,width+': the mobile turn control stays right-aligned in the footer')
      } else {
        assert.equal(back.rows.length,1,width+': tablet reverse keeps two products side by side')
        assert(back.turn.left>back.area.left+back.area.width*.5,width+': the tablet turn control stays right-aligned in the footer')
      }
      if(width<901) await screenshot('city-responsive-'+width+'x'+height)
      results[width+'x'+height]={front,back}
      console.log('City leaflet geometry '+width+'x'+height,JSON.stringify({front,back}))
      await click('[aria-label="Close leaflet"]')
    }
    writeFileSync(dir+'/city-layout.json',JSON.stringify(results,null,2))
    console.log('PASS City London/York artwork, real featured product, fixed top-first two-product row, responsive overflow and artwork bounds')
  } else if (process.argv.includes('--disney-layout')) {
    const sizes = [[1920,1080],[1440,900],[1280,800],[1200,800],[1024,768],[901,768],[900,768],[820,1000],[600,844],[390,844]]
    const results = {}
    for (const [width,height] of sizes) {
      await viewport(width,height)
      await call('Page.navigate',{url:frontendUrl+'/categories/disney'})
      await ready('.category-opening__invitation button')
      await evaluate("document.querySelector('.category-opening__invitation button').click()")
      await ready('.leaflet-dialog[open]')
      await evaluate("Promise.all(document.querySelector('.leaflet-dialog').getAnimations().map(animation=>animation.finished.catch(()=>{})))")
      await settle()
      await evaluate('Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))')
      const front=await evaluate(`(() => {
        const sheet=document.querySelector('.leaflet'),image=sheet.querySelector('.leaflet__environment'),area=sheet.querySelector('.leaflet__print-area--disney-front'),artboard=sheet.querySelector('.leaflet__disney-artboard'),product=sheet.querySelector('.leaflet__disney-story > .leaflet-product--featured');
        const box=element=>element?.getBoundingClientRect().toJSON()??null,ir=box(image),scale=image?Math.min(ir.width/image.naturalWidth,ir.height/image.naturalHeight):0;
        const painted=image?{left:ir.left+(ir.width-image.naturalWidth*scale)/2,top:ir.top+(ir.height-image.naturalHeight*scale)/2,width:image.naturalWidth*scale,height:image.naturalHeight*scale}:null;
        return {side:sheet.dataset.side,environment:image?.getAttribute('src'),visible:image?getComputedStyle(image).display!=='none':false,natural:image?{width:image.naturalWidth,height:image.naturalHeight}:null,
          painted,artboard:box(artboard),area:box(area),featured:box(product),art:box(product?.querySelector('.leaflet-product__art')),copy:box(product?.querySelector('.leaflet-product__copy')),
          featureId:product?.dataset.leafletProduct,title:product?.querySelector('h3')?.textContent,turn:box(sheet.querySelector('.leaflet__turn')),
          areaOverflow:area?area.scrollWidth>area.clientWidth+1:false,areaScrolls:area?area.scrollHeight>area.clientHeight+1:false,viewportOverflow:document.documentElement.scrollWidth>innerWidth};
      })()`)
      await screenshot('disney-front-'+width+'x'+height)
      console.log('Disney front measured bounds '+width+'x'+height,JSON.stringify(front))
      assert(front.environment?.endsWith('/disney/environment-desktop.png'),width+': front resolves the supplied fairytale artwork')
      assert.equal(front.featureId,'8811',width+': featured product comes from the Disney catalogue fixture')
      assert.equal(front.title,'Enchanted Castle',width+': featured product title remains visible')
      assert.equal(front.viewportOverflow,false,width+': front has no horizontal page overflow')
      if(width>=901) {
        assert.equal(front.visible,true,width+': desktop front shows its environment')
        assert(front.artboard&&Math.abs(front.artboard.left-front.painted.left)<2&&Math.abs(front.artboard.top-front.painted.top)<2&&Math.abs(front.artboard.width-front.painted.width)<2&&Math.abs(front.artboard.height-front.painted.height)<2,width+': front content artboard tracks the contained painting')
        assert(front.art.left>=front.painted.left+front.painted.width*.2&&front.art.right<=front.painted.left+front.painted.width*.8&&front.art.top>=front.painted.top+front.painted.height*.39&&front.art.bottom<=front.painted.top+front.painted.height*.78,width+': featured artwork stays within the pastel opening')
        assert(front.copy.left>=front.painted.left+front.painted.width*.2&&front.copy.right<=front.painted.left+front.painted.width*.8&&front.copy.top>=front.painted.top+front.painted.height*.39&&front.copy.bottom<=front.painted.top+front.painted.height*.78,width+': featured information stays within the pastel opening')
        assert(front.copy.right+8<=front.turn.left||front.turn.right+8<=front.copy.left||front.copy.bottom+8<=front.turn.top||front.turn.bottom+8<=front.copy.top,width+': featured copy clears the turn control')
      }
      await click('.leaflet__turn')
      await ready('.leaflet[data-side="back"]:not([aria-busy="true"])')
      await settle()
      await evaluate('Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))')
      const back=await evaluate(`(() => {
        const sheet=document.querySelector('.leaflet'),image=sheet.querySelector('.leaflet__environment'),area=sheet.querySelector('.leaflet__print-area--disney-back'),grid=sheet.querySelector('.leaflet__products--disney-collection'),artboard=sheet.querySelector('.leaflet__disney-back-artboard');
        const box=element=>element?.getBoundingClientRect().toJSON()??null,ir=box(image),scale=image?Math.min(ir.width/image.naturalWidth,ir.height/image.naturalHeight):0;
        const painted=image?{left:ir.left+(ir.width-image.naturalWidth*scale)/2,top:ir.top+(ir.height-image.naturalHeight*scale)/2,width:image.naturalWidth*scale,height:image.naturalHeight*scale}:null;
        const slots=grid?[...grid.querySelectorAll(':scope > .leaflet__disney-row')].map(row=>({row:Number(row.dataset.disneyRow),count:row.querySelectorAll('.leaflet-product--browse').length,box:box(row)})):[];
        const products=grid?[...grid.querySelectorAll('.leaflet-product--browse')].map(item=>({box:box(item),image:box(item.querySelector('.leaflet-product__art')),copy:box(item.querySelector('.leaflet-product__copy')),title:item.querySelector('h3')?.textContent})):[];
        const rows=[];for(const item of products){let row=rows.find(value=>Math.abs(value.top-item.box.top)<2);if(!row)rows.push(row={top:item.box.top,count:0});row.count++;}
        return {side:sheet.dataset.side,environment:image?.getAttribute('src'),visible:image?getComputedStyle(image).display!=='none':false,natural:image?{width:image.naturalWidth,height:image.naturalHeight}:null,
          painted,artboard:box(artboard),area:box(area),grid:box(grid),slots,products,rows,heading:!!area?.querySelector('.leaflet__collection-heading'),turn:box(sheet.querySelector('.leaflet__turn')),
          areaOverflow:area?area.scrollWidth>area.clientWidth+1:false,areaScrolls:area?area.scrollHeight>area.clientHeight+1:false,viewportOverflow:document.documentElement.scrollWidth>innerWidth};
      })()`)
      await screenshot('disney-back-'+width+'x'+height)
      console.log('Disney back measured bounds '+width+'x'+height,JSON.stringify(back))
      assert(back.environment?.endsWith('/disney/environment-desktop-back.png'),width+': back resolves the separate garden artwork')
      assert.equal(back.heading,false,width+': the back has no collection heading')
      assert.deepEqual(back.slots.map(slot=>[slot.row,slot.count]),[[1,2]],width+': two products occupy only the first fixed slot row')
      assert.equal(back.viewportOverflow,false,width+': back has no horizontal page overflow')
      if(width>=901) {
        assert.equal(back.visible,true,width+': desktop back shows its environment')
        assert(back.artboard&&Math.abs(back.artboard.left-back.painted.left)<2&&Math.abs(back.artboard.top-back.painted.top)<2&&Math.abs(back.artboard.width-back.painted.width)<2&&Math.abs(back.artboard.height-back.painted.height)<2,width+': back content artboard tracks the contained painting')
        assert(Math.abs((back.area.left-back.artboard.left)/back.artboard.width-.20)<.01&&Math.abs((back.area.top-back.artboard.top)/back.artboard.height-.40)<.01&&Math.abs(back.area.width/back.artboard.width-.60)<.01&&Math.abs(back.area.height/back.artboard.height-.47)<.01,width+': back products remain in the same artwork-relative clearing')
        assert(back.products.every(item=>item.box.left>=back.area.left&&item.box.right<=back.area.right&&item.box.top>=back.area.top&&item.box.bottom<=back.area.bottom),width+': back products stay inside the safe area')
        assert(back.products.every(item=>item.box.top<back.area.top+back.area.height*.32),width+': the two products remain in the top row with the opening below')
        assert(back.slots[0].box.top<back.area.top+1,width+': the first fixed track stays anchored at the top of the opening')
        assert(back.products.every(item=>item.box.bottom<=back.turn.top||item.box.top>=back.turn.bottom||item.box.right<=back.turn.left||item.box.left>=back.turn.right),width+': products clear the turn control')
      } else if(width<=600) assert.equal(back.rows.length,2,width+': mobile stacks products for readable copy')
      else assert.equal(back.rows.length,1,width+': tablet keeps the two products side by side')
      results[width+'x'+height]={front,back}
      await click('[aria-label="Close leaflet"]')
    }
    writeFileSync(dir+'/disney-layout.json',JSON.stringify(results,null,2))
    console.log('PASS Disney front/back artwork, feature and collection, fixed top-first row and five responsive classes')
  } else if (process.argv.includes('--handoff')) {
    const beforeFix = process.argv.includes('--before')
    const measure = root => evaluate(`(() => {
      const root=document.querySelector(${JSON.stringify(root)});
      const rect=selector=>{const el=root.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
      const image=root.querySelector('.category-opening__art-space img');
      return {art:rect('.category-opening__art-space img'),invitation:rect('.category-opening__invitation'),
        editorial:rect('.category-opening'),wrapper:rect('.spread-page'),
        navigation:rect('.spread-page__navigation'),image:image && {complete:image.complete,width:image.naturalWidth,height:image.naturalHeight}};
    })()`)
    for(const [width,height] of [[1440,900],[1280,800],[820,1000]]) {
      await viewport(width,height)
      for(const slug of ['creator','vehicles']) {
        await call('Page.navigate',{url:frontendUrl+'/categories/'+slug})
        await ready('.category-opening__invitation')
        await backToOrigin()
        await click(`a[href="/categories/${slug}"]`)
        await evaluate("document.querySelector('.catalogue-turn').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=759.99999})")
        for(let i=0;i<70;i++) {
          if(await evaluate("Boolean(document.querySelector('.catalogue-turn__face--back .category-opening__invitation'))")) break
          await new Promise(r=>setTimeout(r,100))
        }
        await evaluate("Promise.all([...document.querySelectorAll('.catalogue-turn img')].map(i=>i.decode().catch(()=>{})))")
        const before=await measure('.catalogue-turn__face--back')
        await screenshot('handoff-'+(beforeFix?'before-fix-':'fixed-')+slug+'-'+width+'-turn')
        await evaluate("document.querySelector('.catalogue-turn').getAnimations({subtree:true}).forEach(a=>a.finish())")
        await idle()
        const after=await measure('.book-shell__spread > .book-shell__page--left')
        await screenshot('handoff-'+(beforeFix?'before-fix-':'fixed-')+slug+'-'+width+'-live')
        console.log('HANDOFF',slug,width,JSON.stringify({before,after}))
        if(!beforeFix) for(const name of ['art','invitation']) {
          assert(before[name] && after[name],name+' must exist')
          for(const axis of ['x','y','width','height']) assert(Math.abs(before[name][axis]-after[name][axis])<.1,`${slug} ${width} ${name}.${axis} must stay stable: ${before[name][axis]} -> ${after[name][axis]}`)
        }
      }
    }
    console.log(beforeFix ? 'Recorded pre-fix destination/live geometry' : 'PASS measured destination/live handoff geometry')
  } else if (process.argv.includes('--navigation')) {
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
    const categoryListingIds = await evaluate("fetch('/api/categories').then(r=>r.json()).then(async categories=>{const name=document.querySelector('.category-opening h1').textContent;const category=categories.find(c=>c.name===name);const response=await fetch('/api/products?categoryId='+category.id+'&pageSize=100');const items=(await response.json()).items.sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id-b.id);const feature=items.find(i=>i.isFeatureProduct);return {imageUrl:category.imageUrl,featureId:feature?.id,others:items.filter(i=>i.id!==feature?.id).map(i=>i.id)};})")
    assert.equal(await evaluate("document.querySelector('.category-opening__art-space img')?.getAttribute('src') ?? null"),categoryListingIds.imageUrl ?? null,'Category artwork follows current backend data')
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
} finally { clearTimeout(timeout); socket?.close(); stopBrowser() }
