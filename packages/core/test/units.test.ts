import { describe, it, expect } from 'vitest'
import { toPt, pageBox, PAGE_SIZES } from '../src/units.js'

describe('units', () => {
  it('converts units to pt', () => {
    expect(toPt(12)).toBe(12)
    expect(toPt('3cm')).toBeCloseTo(85.0394, 4)
    expect(toPt('25mm')).toBeCloseTo(70.8661, 4)
    expect(toPt('1in')).toBe(72)
    expect(toPt('16pt')).toBe(16)
    expect(toPt('-1cm', { allowNegative: true })).toBeCloseTo(-28.3465, 4)
    expect(toPt(-5, { allowNegative: true })).toBe(-5)
  })

  it('rejects bad lengths', () => {
    expect(() => toPt('3 furlongs')).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID' }))
    expect(() => toPt(-1)).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID' }))
    expect(() => toPt('-1cm')).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID' }))
    expect(() => toPt(NaN)).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID' }))
  })

  it('computes A4 portrait content box for gov margins', () => {
    const b = pageBox({ size: 'A4', margin: { top: '1.5cm', bottom: '2cm', left: '3cm', right: '2cm' } })
    expect(b.width).toBeCloseTo(595.2756, 4)
    expect(b.contentWidth).toBeCloseTo(453.5433, 4)
    expect(b.contentRight).toBeCloseTo(538.5827, 4)
    expect(b.contentLeft).toBeCloseTo(85.0394, 4)
  })

  it('swaps for landscape and supports custom sizes', () => {
    expect(pageBox({ size: 'A4', orientation: 'landscape', margin: { top: 0, bottom: 0, left: 0, right: 0 } }).width).toBeCloseTo(841.8898, 4)
    expect(PAGE_SIZES.A5.width).toBeGreaterThan(0)
    expect(PAGE_SIZES.Letter.width).toBe(612)
    expect(PAGE_SIZES.Legal.height).toBe(1008)
    const custom = pageBox({ size: { width: '10cm', height: '20cm' }, margin: { top: 0, bottom: 0, left: 0, right: 0 } })
    expect(custom.width).toBeCloseTo(283.4646, 4)
  })
})
