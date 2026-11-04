import { describe, it, expect } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { FONT_FAMILIES, fontFileName } from '../src/index.js'
import { fontsDir } from '../src/node.js'
import { ApwPdfError } from '@apw-pdf/core'

describe('@apw-pdf/fonts', () => {
  it('lists the 2 bundled SIPA font families', () => {
    expect(FONT_FAMILIES).toEqual([
      'THSarabunNew',
      'THSarabunPSK',
    ])
  })

  it('maps family + style flags to filename', () => {
    expect(fontFileName('THSarabunNew', false, false)).toBe('THSarabunNew-Regular.ttf')
    expect(fontFileName('THSarabunNew', true, false)).toBe('THSarabunNew-Bold.ttf')
    expect(fontFileName('THSarabunNew', false, true)).toBe('THSarabunNew-Italic.ttf')
    expect(fontFileName('THSarabunNew', true, true)).toBe('THSarabunNew-BoldItalic.ttf')
  })

  it('throws FONT_NOT_FOUND on unknown family', () => {
    expect(() => fontFileName('ComicSans', false, false)).toThrowError(ApwPdfError)
    try {
      fontFileName('ComicSans', false, false)
    } catch (e) {
      expect((e as ApwPdfError).code).toBe('FONT_NOT_FOUND')
    }
  })

  it('every family x 4 variants exists on disk and is non-empty', () => {
    expect(existsSync(fontsDir)).toBe(true)
    for (const family of FONT_FAMILIES) {
      for (const bold of [false, true]) {
        for (const italic of [false, true]) {
          const p = join(fontsDir, fontFileName(family, bold, italic))
          expect(existsSync(p), `missing ${p}`).toBe(true)
          expect(statSync(p).size).toBeGreaterThan(10_000)
        }
      }
    }
  })
})
