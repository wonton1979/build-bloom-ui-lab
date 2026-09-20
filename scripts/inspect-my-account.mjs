// Browser presentation/interaction checks with network fixtures in this browser only.
// No production credentials or backend mutations. Screenshots are ignored artifacts.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const dir = resolve('node_modules/.tmp/my-account-inspection')
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
    const point = await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)});const r=el.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!el.contains(document.elementFromPoint(x,y)))throw Error('Covered: '+${JSON.stringify(selector)});return {x,y};})()`)
    await call('Input.dispatchMouseEvent', { type:'mousePressed', ...point, button:'left', clickCount:1 })
    await call('Input.dispatchMouseEvent', { type:'mouseReleased', ...point, button:'left', clickCount:1 })
    await settle()
  }
  const viewport = (width,height) => call('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:width<600})
  const fill = async (selector, value) => {
    await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`)
    await settle()
  }
  const capture = async name => {
    await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
    await settle()
    const shot=await call('Page.captureScreenshot',{format:'png'})
    writeFileSync(`${dir}/${name}.png`,Buffer.from(shot.data,'base64'))
  }
  await call('Page.enable')
  await viewport(1536,1024)
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `
    sessionStorage.setItem('colorful-life:storefront:jwt','isolated-my-account-review');
    window.reviewUser={id:7,email:'review@example.test',firstName:'Alex',lastName:'Taylor',phone:'07123 456789'};
    window.reviewAddresses=[1,2,3].map((id)=>({id,recipientName:'Alex Taylor',line1:id+' Example Street',line2:null,city:'Bath',postcode:'BA1 1AA',country:'United Kingdom',phone:null,isDefaultShipping:id===1,isDefaultBilling:id===1}));
    window.reviewWrites=[];
    const originalFetch=window.fetch;
    window.fetch=(url,init)=>{
      const path=String(url).split('?')[0], method=init?.method||'GET';
      const json=(body,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}));
      if(path.includes('/users/me/addresses')){
        if(method==='GET')return json(window.reviewAddresses);
        window.reviewWrites.push({path,method});
        if(window.reviewFail)return json({error:'Please retry your address change'},500);
        const id=Number(path.split('/').at(-1));
        if(method==='DELETE'){window.reviewAddresses=window.reviewAddresses.filter(a=>a.id!==id);return Promise.resolve(new Response(null,{status:204}));}
        const data=JSON.parse(init.body);
        if(data.isDefaultShipping)window.reviewAddresses.forEach(a=>a.isDefaultShipping=false);
        if(data.isDefaultBilling)window.reviewAddresses.forEach(a=>a.isDefaultBilling=false);
        const current=window.reviewAddresses.find(a=>a.id===id);
        if(method==='PATCH'){Object.assign(current,data);return json(current);}
        const created={...data,id:Math.max(0,...window.reviewAddresses.map(a=>a.id))+1};
        if(!window.reviewAddresses.length)created.isDefaultShipping=created.isDefaultBilling=true;
        window.reviewAddresses.push(created);return json(created,201);
      }
      if(path.endsWith('/users/me')){
        if(method==='PATCH'){window.reviewWrites.push({path,method});if(window.reviewFail)return json({error:'Please retry your profile change'},500);Object.assign(window.reviewUser,JSON.parse(init.body));}
        return json(window.reviewUser);
      }
      if(path.endsWith('/cart'))return json({items:[]});
      return originalFetch(url,init);
    };
  ` })
  await call('Page.navigate', {url:process.env.STOREFRONT_URL || 'http://localhost:5173'})
  await ready('.stage-user')
  await settle()
  await click('.stage-user')
  await ready('[aria-label="Open My Account"]')
  await click('[aria-label="Open My Account"]')
  await ready('.my-account')
  await capture('initial-desktop')
  await ready('.saved-address')
  assert.equal(await evaluate("document.querySelectorAll('.saved-address').length"),3)
  await click('.account-personal-information__actions button')
  assert(await evaluate("document.querySelector('input[type=email]').readOnly"))
  await capture('edit-desktop')
  await fill('[autocomplete="given-name"]','Unsaved')
  assert.equal(await evaluate('window.reviewUser.firstName'),'Alex')
  await click('.account-personal-information__actions button:last-child')
  assert.equal(await evaluate('window.reviewWrites.length'),0)
  assert(await evaluate("document.querySelector('.account-personal-information__details').textContent.includes('Alex')"))
  await click('.account-personal-information__actions button')
  await fill('[autocomplete="given-name"]','Saved')
  await evaluate('window.reviewFail=true')
  await click('.account-personal-information__actions button[type=submit]')
  await ready('.personal-information [role=alert]')
  assert.equal(await evaluate("document.querySelector('[autocomplete=given-name]').value"),'Saved')
  assert.equal(await evaluate('window.reviewUser.firstName'),'Alex')
  await capture('profile-error')
  await evaluate('window.reviewFail=false')
  await click('.account-personal-information__actions button[type=submit]')
  await ready('.account-personal-information__details')
  assert.equal(await evaluate('window.reviewUser.firstName'),'Saved')
  for(const [w,h] of [[1536,1024],[1024,900],[768,1024],[390,844],[320,700]]) {
    await viewport(w,h)
    await evaluate("document.querySelector('.account-modal__surface').scrollTop=0")
    await settle()
    const metrics=await evaluate(`(()=>{const el=document.querySelector('.account-modal__surface');return {overflow:el.scrollWidth>el.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth,images:[...el.querySelectorAll('img')].every(i=>i.naturalWidth>0)}})()`)
    assert(!metrics.overflow && !metrics.pageOverflow && metrics.images, JSON.stringify({w,...metrics}))
    await capture('account-'+w)
    await evaluate("document.querySelector('.account-modal__surface').scrollTop=99999")
    await capture('footer-'+w)
    console.log(w,metrics)
  }
  await viewport(1536,1024)
  await click('.saved-addresses__heading > button')
  await ready('.saved-addresses__form')
  await capture('address-form')
  assert(await evaluate("document.activeElement === document.querySelector('.saved-addresses__form input')"),'Address draft is not focused')
  await click('.saved-addresses__form-actions button:last-child')
  await click('.saved-address:nth-child(2) .saved-address__actions > button:first-child')
  assert(await evaluate("document.querySelector('.saved-address:nth-child(2) .saved-address__defaults').textContent.includes('Default Delivery')"))
  await click('.saved-address:nth-child(2) .saved-address__actions > button:first-child')
  assert(await evaluate("document.querySelector('.saved-address:nth-child(2) .saved-address__defaults').textContent.includes('Default Billing')"))
  await click('.saved-address:nth-child(2) .saved-address__edit-actions > button:first-child')
  await ready('.saved-addresses__form')
  await fill('.saved-addresses__form input','Changed recipient')
  await evaluate('window.reviewFail=true')
  await click('.saved-addresses__form-actions button[type=submit]')
  await ready('.saved-addresses [role=alert]')
  assert.equal(await evaluate("document.querySelector('.saved-addresses__form input').value"),'Changed recipient')
  await capture('address-error')
  await evaluate('window.reviewFail=false')
  await click('.saved-addresses__form-actions button[type=submit]')
  await settle()
  assert(await evaluate("document.querySelector('.saved-address:nth-child(2)').textContent.includes('Changed recipient')"))
  // Reopening with an empty book exercises the existing zero-state and add form.
  await click('.my-account__back')
  await evaluate('window.reviewAddresses=[]')
  await click('[aria-label="Open My Account"]')
  await ready('.saved-addresses__notice')
  await settle()
  assert(await evaluate("document.querySelector('.saved-addresses__notice').textContent.includes('No saved addresses')"))
  await capture('empty-address-book')
  await click('.saved-addresses__heading > button')
  for(const [i,value] of ['Alex Taylor','10 Example Lane','','Bath','BA1 1AA','GB',''].entries()) await fill(`.saved-addresses__form label:nth-of-type(${i+1}) input`,value)
  await click('.saved-addresses__form-actions button[type=submit]')
  await ready('.saved-address')
  assert.equal(await evaluate("document.querySelectorAll('.saved-address__defaults span').length"),2)
  await click('.saved-address__delete')
  await ready('.saved-addresses__notice')
  assert(await evaluate("document.querySelector('.saved-addresses__notice').textContent.includes('No saved addresses')"))
  await click('.my-account__back')
  await ready('[aria-label="Open My Account"]')
  await click('[aria-label="Close account dialog"]')
  assert(!await evaluate("Boolean(document.querySelector('.account-modal'))"))
  assert.equal(await evaluate("sessionStorage.getItem('colorful-life:storefront:jwt')"),'isolated-my-account-review')
  console.log('PASS: My Account responsive layout/artwork; profile edit/cancel/save/failure; address add/edit/defaults/delete/failure and empty state; Back, X and session preservation (mocked network).')
  await send('Browser.close')
} finally { clearTimeout(timeout); socket?.close(); browser.kill() }
