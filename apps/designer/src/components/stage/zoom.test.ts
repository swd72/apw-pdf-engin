import { describe, it, expect } from 'vitest'
import { pageSizePt, resolveScale } from './zoom.js'

describe('zoom', () => {
  it('pageSizePt reads A4 portrait and landscape', () => {
    const portrait = pageSizePt({
      page: {
        size: 'A4',
        orientation: 'portrait',
        margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      },
    })
    expect(portrait.width).toBeCloseTo(595.28, 1)
    expect(portrait.height).toBeCloseTo(841.89, 1)

    const landscape = pageSizePt({
      page: {
        size: 'A4',
        orientation: 'landscape',
        margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      },
    })
    expect(landscape.width).toBeCloseTo(841.89, 1)
    expect(landscape.height).toBeCloseTo(595.28, 1)

    const custom = pageSizePt({
      page: {
        size: { width: '100pt', height: '200pt' },
        orientation: 'landscape',
        margin: { top: 10, bottom: 10, left: 10, right: 10 },
      },
    })
    expect(custom).toEqual({ width: 200, height: 100 })
  })

  it('pageSizePt falls back to A4 for garbage', () => {
    const fromNull = pageSizePt(null)
    expect(fromNull.width).toBeCloseTo(595.28, 1)
    expect(fromNull.height).toBeCloseTo(841.89, 1)

    const fromBadSize = pageSizePt({ page: { size: 'UNKNOWN_SIZE' } })
    expect(fromBadSize.width).toBeCloseTo(595.28, 1)
    expect(fromBadSize.height).toBeCloseTo(841.89, 1)

    const fromBadCustom = pageSizePt({
      page: { size: { width: 'not-a-length', height: -10 } },
    })
    expect(fromBadCustom.width).toBeCloseTo(595.28, 1)
    expect(fromBadCustom.height).toBeCloseTo(841.89, 1)
  })

  it('resolveScale fit-width uses container width minus padding', () => {
    const scale = resolveScale(
      { kind: 'fit-width' },
      { width: 640, height: 900 },
      { width: 600, height: 800 },
      40,
    )
    expect(scale).toBeCloseTo(1, 4)

    const half = resolveScale(
      { kind: 'fit-width' },
      { width: 340, height: 900 },
      { width: 600, height: 800 },
      40,
    )
    expect(half).toBeCloseTo(0.5, 4)
  })

  it('resolveScale fit-page uses the smaller ratio', () => {
    const scale = resolveScale(
      { kind: 'fit-page' },
      { width: 640, height: 440 },
      { width: 600, height: 800 },
      40,
    )
    // width ratio = (640 - 40) / 600 = 1.0, height ratio = (440 - 40) / 800 = 0.5
    expect(scale).toBeCloseTo(0.5, 4)
  })

  it('resolveScale clamps to 0.25 and 2 and never returns NaN for a zero container', () => {
    const tiny = resolveScale(
      { kind: 'percent', value: 5 },
      { width: 800, height: 800 },
      { width: 600, height: 800 },
    )
    expect(tiny).toBe(0.25)

    const huge = resolveScale(
      { kind: 'percent', value: 500 },
      { width: 800, height: 800 },
      { width: 600, height: 800 },
    )
    expect(huge).toBe(2)

    const zeroFitWidth = resolveScale(
      { kind: 'fit-width' },
      { width: 0, height: 0 },
      { width: 595.28, height: 841.89 },
    )
    expect(Number.isNaN(zeroFitWidth)).toBe(false)
    expect(zeroFitWidth).toBeGreaterThanOrEqual(0.25)
    expect(zeroFitWidth).toBeLessThanOrEqual(2)

    const zeroAll = resolveScale(
      { kind: 'fit-page' },
      { width: 0, height: 0 },
      { width: 0, height: 0 },
    )
    expect(Number.isNaN(zeroAll)).toBe(false)
    expect(zeroAll).toBeGreaterThanOrEqual(0.25)
    expect(zeroAll).toBeLessThanOrEqual(2)
  })
})
