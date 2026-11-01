import { describe, it, expect } from 'vitest'
import { FontRegistry } from '../src/fonts/registry.js'
import { singleLineHeight, lineBox } from '../src/fonts/metrics.js'
import { testFontProvider } from './helpers/fonts.js'
import type { FontProvider } from '../src/fonts/provider.js'
import { ApwPdfError } from '../src/errors.js'

const FONT_FAMILIES = ['THSarabunIT9', 'THSarabunNew', 'THSarabunPSK', 'THNiramitIT9'] as const

describe('font registry, metrics, and shaping', () => {
  const reg = FontRegistry.create(testFontProvider())

  it('reads TH SarabunIT9 metrics', async () => {
    const f = await reg.get('THSarabunIT9', false, false)
    expect(f.metrics).toMatchObject({
      upem: 1000,
      winAscent: 850,
      winDescent: 250,
      hheaAscender: 850,
      hheaDescender: -250,
      hheaLineGap: 30,
    })
  })

  it('single line height follows GDI formula', () => {
    const m = {
      upem: 1000,
      winAscent: 850,
      winDescent: 250,
      hheaAscender: 850,
      hheaDescender: -250,
      hheaLineGap: 30,
    }
    expect(singleLineHeight(m, 16)).toBeCloseTo(18.08, 4)
  })

  it('computes lineBox for single, multiple, exactly 35pt, and atLeast', () => {
    const m = {
      upem: 1000,
      winAscent: 850,
      winDescent: 250,
      hheaAscender: 850,
      hheaDescender: -250,
      hheaLineGap: 30,
    }
    expect(lineBox(m, 29, { exactly: 35 })).toEqual({
      height: 35,
      ascent: expect.closeTo(27.045, 3),
    })
    expect(lineBox(m, 16, 'single').height).toBeCloseTo(18.08, 4)
    expect(lineBox(m, 16, { multiple: 1.5 }).height).toBeCloseTo(18.08 * 1.5, 4)
    expect(lineBox(m, 16, { atLeast: 24 }).height).toBe(24)
  })

  it('shapes stacked Thai marks with zero-advance marks', async () => {
    const f = await reg.get('THSarabunIT9', false, false)
    const r = f.shape('ปี่', 16)
    expect(r.glyphs.length).toBe(3)
    expect(r.glyphs[1]!.advance).toBe(0)
    expect(r.glyphs[2]!.advance).toBe(0)
    expect(r.glyphs.every((g) => g.cluster === 0)).toBe(true)
    expect(r.width).toBeCloseTo((428 / 1000) * 16, 4)
  })

  it('substitutes descenderless GSUB base glyphs for ญ and ฐ before below-vowels ุ/ู (Gap 4)', async () => {
    const f = await reg.get('THSarabunIT9', false, false)
    const yoNormal = f.shape('ญะ', 16).glyphs[0]!.id
    const yoShortU = f.shape('ญุ', 16).glyphs[0]!.id
    const yoShortUu = f.shape('ญู', 16).glyphs[0]!.id
    expect(yoShortU).not.toBe(yoNormal)
    expect(yoShortUu).toBe(yoShortU)

    const thoNormal = f.shape('ฐะ', 16).glyphs[0]!.id
    const thoShortU = f.shape('ฐุ', 16).glyphs[0]!.id
    const thoShortUu = f.shape('ฐู', 16).glyphs[0]!.id
    expect(thoShortU).not.toBe(thoNormal)
    expect(thoShortUu).toBe(thoShortU)
  })

  it.each(['ที่', 'น้ำ', 'กุ้ง', 'ญาติ', 'ฐาน', 'ปั้น'])(
    'shapes %s in every bundled family without missing glyphs',
    async (w) => {
      for (const fam of FONT_FAMILIES) {
        const font = await reg.get(fam, false, false)
        expect(font.shape(w, 16).missing).toEqual([])
      }
    },
  )

  it('reports missing glyphs (Review Focus 4)', async () => {
    const f = await reg.get('THSarabunIT9', false, false)
    expect(f.shape('ก✅中', 16).missing).toEqual(['✅', '中'])
  })

  it('falls back when style file missing and emits FONT_STYLE_FALLBACK warning', async () => {
    const base = testFontProvider()
    const fallbackProvider: FontProvider = {
      async load(family, style) {
        if (style.italic) {
          throw new ApwPdfError('FONT_NOT_FOUND', 'No italic')
        }
        return base.load(family, style)
      },
    }
    const r2 = FontRegistry.create(fallbackProvider)
    const f = await r2.get('THSarabunIT9', false, true)
    expect(f.family).toBe('THSarabunIT9')
    expect(f.italic).toBe(false)
    expect(r2.warnings).toEqual([
      expect.objectContaining({ code: 'FONT_STYLE_FALLBACK' }),
    ])
  })

  it('throws FONT_NOT_FOUND for unknown family', async () => {
    await expect(reg.get('UnknownFont', false, false)).rejects.toThrow(
      expect.objectContaining({ code: 'FONT_NOT_FOUND' }),
    )
  })
})
