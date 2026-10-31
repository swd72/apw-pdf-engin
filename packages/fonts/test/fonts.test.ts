import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { FONT_FAMILIES, fontFileName } from '../src/index.js'
import { fontsDir } from '../src/node.js'

describe('@apw-pdf/fonts', () => {
  it('resolves every FONT_FAMILIES × {bold, italic} combination to a valid TrueType file', () => {
    expect(FONT_FAMILIES).toEqual([
      'THSarabunIT9',
      'THSarabunNew',
      'THSarabunPSK',
      'THNiramitIT9',
    ])
    for (const family of FONT_FAMILIES) {
      for (const bold of [false, true]) {
        for (const italic of [false, true]) {
          const name = fontFileName(family, bold, italic)
          const full = path.join(fontsDir, name)
          expect(fs.existsSync(full), `Missing font file ${full}`).toBe(true)
          const buf = fs.readFileSync(full)
          expect(buf.length).toBeGreaterThan(1000)
          // TrueType magic 00 01 00 00
          expect(buf[0]).toBe(0x00)
          expect(buf[1]).toBe(0x01)
          expect(buf[2]).toBe(0x00)
          expect(buf[3]).toBe(0x00)
        }
      }
    }
  })

  it('throws FONT_NOT_FOUND for unknown family', () => {
    expect(() => fontFileName('Comic', false, false)).toThrow(
      expect.objectContaining({ code: 'FONT_NOT_FOUND' }),
    )
  })
})
