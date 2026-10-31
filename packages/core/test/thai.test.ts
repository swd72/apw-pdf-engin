import { describe, it, expect } from 'vitest'
import { bahtText } from '../src/thai/baht.js'
import { toThaiDigits } from '../src/thai/digits.js'
import { formatNumber } from '../src/thai/number.js'
import { formatThaiDate } from '../src/thai/date.js'

describe('Thai utilities', () => {
  it.each([
    [0, 'ศูนย์บาทถ้วน'],
    [1, 'หนึ่งบาทถ้วน'],
    [11, 'สิบเอ็ดบาทถ้วน'],
    [21, 'ยี่สิบเอ็ดบาทถ้วน'],
    [101, 'หนึ่งร้อยเอ็ดบาทถ้วน'],
    [1250.5, 'หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์'],
    [1000001, 'หนึ่งล้านเอ็ดบาทถ้วน'],
    [21000000.25, 'ยี่สิบเอ็ดล้านบาทยี่สิบห้าสตางค์'],
    [10000000, 'สิบล้านบาทถ้วน'],
    [0.01, 'หนึ่งสตางค์'],
    ['1,500', 'หนึ่งพันห้าร้อยบาทถ้วน'],
  ])('bahtText(%s)', (n, s) => expect(bahtText(n)).toBe(s))

  it('bahtText rounds satang half-up', () =>
    expect(bahtText(1.005)).toBe('หนึ่งบาทหนึ่งสตางค์'))

  it('rejects invalid bahtText inputs', () => {
    expect(() => bahtText('abc')).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' }))
    expect(() => bahtText(-1)).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' }))
    expect(() => bahtText(NaN)).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' }))
    expect(() => bahtText(Infinity)).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' }))
  })

  it('thai digits', () =>
    expect(toThaiDigits('พ.ศ. 2569 เลข 0-9')).toBe('พ.ศ. ๒๕๖๙ เลข ๐-๙'))

  it('formats number', () => {
    expect(formatNumber(1250.5, 2)).toBe('1,250.50')
    expect(formatNumber('1,250.5', 0)).toBe('1,251')
    expect(() => formatNumber('nope', 2)).toThrow(expect.objectContaining({ code: 'INVALID_VALUE' }))
  })

  it('thai dates', () => {
    expect(formatThaiDate('2026-10-31', 'long')).toBe('31 ตุลาคม 2569')
    expect(formatThaiDate('2026-10-31', 'short')).toBe('31 ต.ค. 69')
    expect(formatThaiDate(new Date(2027, 0, 1), 'monthYear')).toBe('มกราคม 2570')
    expect(() => formatThaiDate('31/13/2026', 'long')).toThrow(
      expect.objectContaining({ code: 'INVALID_VALUE' }),
    )
    expect(() => formatThaiDate(new Date('invalid'), 'long')).toThrow(
      expect.objectContaining({ code: 'INVALID_VALUE' }),
    )
  })
})
