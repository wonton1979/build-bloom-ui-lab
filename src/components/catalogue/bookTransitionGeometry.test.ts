import { describe, expect, it } from 'vitest'
import { bookTransitionGeometry } from './bookTransitionGeometry'

function mapping(frame: Keyframe) {
  const values = String(frame.transform).match(/-?[\d.]+/g)!.map(Number)
  return { x: values[0], y: values[1], sx: values[2], sy: values[3] }
}

function interpolate(frames: Keyframe[], progress: number) {
  const start = mapping(frames[0])
  const end = mapping(frames[1])
  const mix = (a: number, b: number) => a + (b - a) * progress
  return { x: mix(start.x, end.x), y: mix(start.y, end.y), sx: mix(start.sx, end.sx), sy: mix(start.sy, end.sy) }
}

describe('Book transition coordinate mapping', () => {
  // Actual large/medium/narrow browser measurements, including fractional layout rounding.
  it.each([
    [521.625, 579.578125, 521.625, 579.578125],
    [404.546875, 449.484375, 404.53125, 449.484375],
    [623.46875, 692.734375, 425.625, 472.90625],
    [520, 577.765625, 351, 390],
    [395.71875, 439.6875, 261.375, 290.40625],
  ])('keeps both faces coincident through the turn (%s × %s cover)', (cw, ch, pw, ph) => {
    const closed = { left: 240, top: 161, width: cw, height: ch }
    const book = { left: 125, top: 255, width: pw * 2, height: ph }
    const page = { ...book, width: pw }
    const geometry = bookTransitionGeometry(closed, book, page)
    const hinge = book.left + pw

    // Test the projected corners, not just matching CSS layout dimensions.
    // Cover rotates about its left edge; the real reverse page about its right.
    // Both use the same eased progress, in either playback direction.
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const cover = interpolate(geometry.coverShift, progress)
      const back = interpolate(geometry.bookShift, progress)
      for (const degrees of [0, 45, 89, 90, 91, 135, 180]) {
        const angle = degrees * Math.PI / 180
        for (const u of [0, 1]) {
          for (const v of [0, 1]) {
            const project = (width: number, height: number, perspective: number, reverse: boolean) => {
              const rotation = reverse ? Math.PI - angle : -angle
              const localX = (reverse ? -1 : 1) * width * u
              const z = -localX * Math.sin(rotation)
              const factor = 1 / (1 - z / perspective)
              return { x: localX * Math.cos(rotation) * factor, y: height / 2 + (v - 0.5) * height * factor }
            }
            const front = project(cw, ch, geometry.coverPerspective, false)
            const reverse = project(pw, ph, geometry.pagePerspective, true)
            expect(hinge + cover.x + front.x * cover.sx).toBeCloseTo(hinge + back.x + reverse.x * back.sx, 8)
            expect(book.top + cover.y + front.y * cover.sy).toBeCloseTo(book.top + back.y + reverse.y * back.sy, 8)
          }
        }
      }
    }

    const start = mapping(geometry.coverShift[0])
    expect(hinge + start.x).toBe(closed.left)
    expect(book.top + start.y).toBe(closed.top)
    expect(cw * start.sx).toBe(cw)
    expect(ch * start.sy).toBe(ch)
    const end = mapping(geometry.coverShift.at(-1)!)
    expect(cw * end.sx).toBeCloseTo(pw, 8)
    expect(ch * end.sy).toBeCloseTo(ph, 8)
    expect(mapping(geometry.bookShift.at(-1)!)).toEqual({ x: 0, y: 0, sx: 1, sy: 1 })
  })
})
