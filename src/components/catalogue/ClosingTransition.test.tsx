import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClosingTransition } from './ClosingTransition'
import { ClosedCatalogue } from './ClosedCatalogue'
import { startClosingTransition } from './closingTransitionMotion'

// Only the browser lifecycle is stubbed: no CSS dimensions/angles are asserted.
function browserFixture() {
  const animations: { finished: Promise<void>; finish: () => void; cancel: ReturnType<typeof vi.fn> }[] = []
  const animate = () => {
    let resolve!: () => void
    const finished = new Promise<void>(done => { resolve = done })
    const animation = { finished, finish: () => resolve(), cancel: vi.fn() }
    animations.push(animation)
    return animation
  }
  const rectangle = (left: number, top: number, width: number, height: number) => ({
    left, top, width, height, bottom: top + height, right: left + width,
  })
  const element = (rect = rectangle(0, 0, 400, 450)) => ({
    style: { clipPath: '', maskImage: '', transformOrigin: '', backfaceVisibility: '', background: '', borderColor: '', boxShadow: '' },
    getBoundingClientRect: () => rect,
    clientLeft: 1, clientTop: 1,
    animate: vi.fn(animate), prepend: vi.fn(), remove: vi.fn(), setAttribute: vi.fn(),
  })
  const left = element()
  const backing = element(rectangle(-10, 6, 820, 463))
  const gutter = element()
  const book = {
    ...element(rectangle(0, 0, 800, 450)),
    querySelector: (selector: string) => ({
      '.book-shell__page--left': left, '.book-shell__cover': backing, '.book-shell__spine': gutter,
    })[selector],
  }
  const target = {
    ...element(rectangle(200, 0, 400, 450)),
    querySelector: () => element(rectangle(195, 5, 411, 453)),
  }
  const stage = {
    ...element(rectangle(0, 0, 1200, 900)),
    querySelector: (selector: string) => selector === '.book-shell' ? book : target,
  }
  const frame = element()
  const cover = element(rectangle(395, 5, 411, 453))
  const sheet = { ...element(), querySelector: () => cover }
  const root = {
    parentElement: stage,
    querySelector: (selector: string) => selector === '.closing-transition__frame' ? frame : sheet,
  }
  const edge = element()
  const paint = element()
  const contact = element()
  const events = new EventTarget()
  const motion = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('window', {
    matchMedia: () => motion,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  })
  vi.stubGlobal('document', { createElement: vi.fn().mockReturnValueOnce(edge).mockReturnValueOnce(paint).mockReturnValueOnce(contact) })
  const contactShadow = '0px 28px 35px -16px rgba(71, 68, 93, 0.27)'
  let frontVisible = false
  vi.stubGlobal('DOMMatrixReadOnly', class {
    m11 = frontVisible ? 1 : -1
  })
  vi.stubGlobal('getComputedStyle', (node: unknown) => ({
    boxShadow: node === backing
      ? `0px 3px 0px 0px rgb(99, 142, 137), ${contactShadow}`
      : '0px 11px 0px 0px rgb(238, 229, 210)',
    borderBottomLeftRadius: '16px 22px', borderRadius: '17px 19px 22px 19px',
    background: '#7fada6', border: '1px solid #709a95', boxSizing: 'border-box',
  }))
  let frameId = 0
  const frames = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  const tick = () => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback(0))
  }
  return {
    root: root as unknown as HTMLElement, animations, left, backing, edge, paint, contact, contactShadow, motion, events, tick,
    setFrontVisible: (visible: boolean) => { frontVisible = visible },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('Closing the physical catalogue', () => {
  it('reuses the approved cover without inventing another book or inside page', () => {
    const closed = renderToStaticMarkup(<ClosedCatalogue onOpen={() => {}} showCityBookmark={false} />)
    const markup = renderToStaticMarkup(<ClosingTransition onComplete={() => {}} />)
    expect(markup).toContain(closed.slice(closed.indexOf('<button')))
    expect(markup).toContain('aria-hidden="true" inert=""')
    expect(markup.match(/<img /g)).toHaveLength(1)
    expect(markup).not.toContain('book-shell__page')
    expect(markup).not.toContain('href="/categories/')
  })

  it('holds the settled cover across rendered frames and leaves removal to the parent handoff', async () => {
    const fixture = browserFixture()
    const complete = vi.fn()
    const cleanup = startClosingTransition(fixture.root, complete)
    expect(fixture.left.prepend).toHaveBeenCalledWith(fixture.edge)
    expect(complete).not.toHaveBeenCalled()
    fixture.animations.forEach(animation => animation.finish())
    await Promise.resolve()
    await Promise.resolve()
    fixture.tick()
    expect(complete).not.toHaveBeenCalled()
    fixture.tick()
    expect(complete).toHaveBeenCalledOnce()
    expect(fixture.edge.remove).not.toHaveBeenCalled()
    expect(fixture.animations.every(animation => animation.cancel.mock.calls.length === 0)).toBe(true)
    cleanup()
    expect(fixture.edge.remove).toHaveBeenCalledOnce()
    expect(fixture.paint.remove).toHaveBeenCalledOnce()
    expect(fixture.contact.remove).toHaveBeenCalledOnce()
    expect(fixture.backing.style.clipPath).toBe('')
    expect(fixture.backing.style.background).toBe('')
    expect(fixture.backing.style.borderColor).toBe('')
    expect(fixture.backing.style.boxShadow).toBe('')
    expect(fixture.left.style.transformOrigin).toBe('')
    expect(fixture.left.style.backfaceVisibility).toBe('')
  })

  it('occludes duplicate paint only behind the visible cover, without animating the board or shadow', () => {
    const fixture = browserFixture()
    const cleanup = startClosingTransition(fixture.root, vi.fn())
    expect(fixture.backing.prepend).toHaveBeenCalledWith(fixture.paint)
    expect(fixture.backing.animate).not.toHaveBeenCalled()
    expect(fixture.paint.animate).not.toHaveBeenCalled()
    expect(fixture.backing.style.boxShadow).toBe('none')
    expect(fixture.contact.style.boxShadow.trim()).toBe(fixture.contactShadow)
    expect(fixture.paint.style.boxShadow).not.toContain(fixture.contactShadow)
    expect(fixture.paint.style.clipPath).toBe('none')
    expect(fixture.contact.style.maskImage).toBe('none')
    fixture.setFrontVisible(true)
    fixture.tick()
    expect(fixture.paint.style.clipPath).toContain('path(evenodd,')
    expect(fixture.contact.style.maskImage).not.toBe('none')
    fixture.setFrontVisible(false)
    fixture.tick()
    expect(fixture.paint.style.clipPath).toBe('none')
    expect(fixture.contact.style.maskImage).toBe('none')
    expect(fixture.contact.style.boxShadow.trim()).toBe(fixture.contactShadow)
    expect(fixture.contact.animate).not.toHaveBeenCalled()
    cleanup()
  })

  it('cancels a pending handoff when the transition unmounts', async () => {
    const fixture = browserFixture()
    const complete = vi.fn()
    const cleanup = startClosingTransition(fixture.root, complete)
    fixture.animations.forEach(animation => animation.finish())
    await Promise.resolve()
    await Promise.resolve()
    fixture.tick()
    cleanup()
    fixture.tick()
    expect(complete).not.toHaveBeenCalled()
    expect(fixture.animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true)
  })

  it('settles once if reduced motion or a resize interrupts closing', async () => {
    const fixture = browserFixture()
    const complete = vi.fn()
    const cleanup = startClosingTransition(fixture.root, complete)
    fixture.motion.matches = true
    fixture.motion.dispatchEvent(new Event('change'))
    fixture.events.dispatchEvent(new Event('resize'))
    await Promise.resolve()
    await Promise.resolve()
    fixture.tick()
    fixture.tick()
    fixture.tick()
    expect(complete).toHaveBeenCalledOnce()
    cleanup()
  })
})
