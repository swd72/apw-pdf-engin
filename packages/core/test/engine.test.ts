import { describe, it, expect } from 'vitest'
import { createEngine } from '../src/engine.js'
import { testFontProvider } from './helpers/fonts.js'
import { singleLineHeight, lineBox } from '../src/fonts/metrics.js'

const baseDocSpec = {
  version: 1 as const,
  page: {
    size: 'A4' as const,
    margin: { top: '1.5cm', bottom: '2cm', left: '3cm', right: '2cm' },
  },
  font: { family: 'THSarabunIT9', size: '16pt' },
}

describe('signature, page numbers, and createEngine', () => {
  it('lays out signature geometry with startAt:center, linesBefore:4, and centered positions', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const tree = await engine.layout(
      {
        ...baseDocSpec,
        blocks: [
          { type: 'paragraph', text: 'จึงเรียนมาเพื่อโปรดพิจารณา' },
          {
            type: 'signature',
            startAt: 'center',
            linesBefore: 4,
            name: 'นายสมชาย ใจดี',
            positions: ['ผู้อำนวยการกองคลัง', 'ปฏิบัติราชการแทนอธิบดี'],
          },
        ],
      },
      {},
    )
    const glyphs = tree.pages[0]!.items.filter((it) => it.kind === 'glyphs')
    expect(glyphs.length).toBe(4)

    const bodyLine = glyphs[0]!
    const nameLine = glyphs[1]!
    const pos1Line = glyphs[2]!
    const pos2Line = glyphs[3]!

    expect(nameLine.text).toBe('(นายสมชาย ใจดี)')
    // First glyph of "(" at center of content area = 311.811
    expect(nameLine.x).toBeCloseTo(311.811, 2)

    // Name baseline is 4 * 18.08 below previous baseline
    expect(nameLine.y - bodyLine.y).toBeCloseTo(4 * 18.08, 2)

    // Each position line's center equals the name line's center (±0.01)
    const nameW = nameLine.glyphs.reduce((s, g) => s + g.advance, 0)
    const nameCenter = nameLine.x + nameW / 2
    const pos1W = pos1Line.glyphs.reduce((s, g) => s + g.advance, 0)
    const pos1Center = pos1Line.x + pos1W / 2
    const pos2W = pos2Line.glyphs.reduce((s, g) => s + g.advance, 0)
    const pos2Center = pos2Line.x + pos2W / 2

    expect(pos1Center).toBeCloseTo(nameCenter, 2)
    expect(pos2Center).toBeCloseTo(nameCenter, 2)
  })

  it('pulls minLinesBefore (default 3) body lines to next page when signature overflows', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    // 40 1-line paragraphs take 40 * 18.08 = 723.2pt (fits in 742.68pt page 1),
    // leaving 19.48pt so the signature block (4 * 18.08 + 18.08 = 90.4pt) overflows to page 2
    const paras = Array.from({ length: 40 }, (_, i) => ({
      type: 'paragraph' as const,
      text: `บรรทัดเนื้อหาที่ ${i + 1}`,
    }))
    const tree = await engine.layout(
      {
        ...baseDocSpec,
        blocks: [
          ...paras,
          {
            type: 'signature',
            linesBefore: 4,
            name: 'นายสมชาย ใจดี',
            positions: ['ผู้อำนวยการ'],
          },
        ],
      },
      {},
    )
    expect(tree.pages.length).toBe(2)
    // Page 1 ended earlier (37 lines instead of 40)
    const p1Glyphs = tree.pages[0]!.items.filter((it) => it.kind === 'glyphs')
    expect(p1Glyphs.length).toBe(37)

    // Page 2 has 3 pulled body lines before the signature
    const p2Glyphs = tree.pages[1]!.items.filter(
      (it) => it.kind === 'glyphs' && it.sourcePath.startsWith('blocks['),
    )
    expect(p2Glyphs[0]!.text).toBe('บรรทัดเนื้อหาที่ 38')
    expect(p2Glyphs[1]!.text).toBe('บรรทัดเนื้อหาที่ 39')
    expect(p2Glyphs[2]!.text).toBe('บรรทัดเนื้อหาที่ 40')
    expect(p2Glyphs[3]!.text).toBe('(นายสมชาย ใจดี)')
  })

  it('renders page numbers from page 2 with Thai numerals and pushes page-2 body down to 52.38pt', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const paras = Array.from({ length: 50 }, (_, i) => ({
      type: 'paragraph' as const,
      text: `ย่อหน้าที่ ${i + 1}`,
    }))
    const tree = await engine.layout(
      {
        ...baseDocSpec,
        numerals: 'thai',
        blocks: paras,
      },
      {},
    )
    expect(tree.pages.length).toBe(2)

    // Page 1 has no page number
    const p1HasPageNum = tree.pages[0]!.items.some(
      (it) => it.kind === 'glyphs' && it.text.includes('- '),
    )
    expect(p1HasPageNum).toBe(false)

    // Page 2 has '- ๒ -' centered at x = 311.81, 15pt, top at offset 1.25cm (35.433pt)
    const p2PageNum = tree.pages[1]!.items.find(
      (it) => it.kind === 'glyphs' && it.text === '- ๒ -',
    )
    expect(p2PageNum).toBeDefined()
    if (p2PageNum && p2PageNum.kind === 'glyphs') {
      expect(p2PageNum.size).toBe(15)
      const w = p2PageNum.glyphs.reduce((s, g) => s + g.advance, 0)
      expect(p2PageNum.x + w / 2).toBeCloseTo(311.811, 2)

      const f = await engine.fonts.get('THSarabunIT9', false, false)
      const box15 = lineBox(f.metrics, 15, 'single')
      expect(p2PageNum.y).toBeCloseTo(35.4331 + box15.ascent, 2)

      // Page-2 body starts at max(42.52, 35.4331 + singleLineHeight(15)) = 52.3831 (±0.01)
      const box16 = lineBox(f.metrics, 16, 'single')
      const expectedBodyTop = Math.max(42.5197, 35.4331 + singleLineHeight(f.metrics, 15))
      expect(expectedBodyTop).toBeCloseTo(52.38, 2)

      const firstBodyGlyph = tree.pages[1]!.items.find(
        (it) => it.kind === 'glyphs' && it.text !== '- ๒ -',
      )!
      expect(firstBodyGlyph.y).toBeCloseTo(expectedBodyTop + box16.ascent, 2)
    }
  })

  it('resolves {pageNumber:true} and {pageCount:true} inline items after pagination', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const tree = await engine.layout(
      {
        ...baseDocSpec,
        blocks: [
          {
            type: 'paragraph',
            runs: [
              { text: 'หน้า ' },
              { pageNumber: true },
              { text: ' จาก ' },
              { pageCount: true },
            ],
          },
          { type: 'pageBreak' },
          {
            type: 'paragraph',
            runs: [
              { text: 'หน้า ' },
              { pageNumber: true },
              { text: ' จาก ' },
              { pageCount: true },
            ],
          },
        ],
      },
      {},
    )
    const p1Texts = tree.pages[0]!.items
      .filter((it) => it.kind === 'glyphs')
      .map((it) => (it.kind === 'glyphs' ? it.text : ''))
      .join('')
    const p2Texts = tree.pages[1]!.items
      .filter((it) => it.kind === 'glyphs' && it.sourcePath.startsWith('blocks['))
      .map((it) => (it.kind === 'glyphs' ? it.text : ''))
      .join('')
    expect(p1Texts).toBe('หน้า 1 จาก 2')
    expect(p2Texts).toBe('หน้า 2 จาก 2')
  })

  it('validate returns issues without throwing', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const res = engine.validate(
      {
        ...baseDocSpec,
        blocks: [
          { type: 'paragraph', text: 'ok' },
          { type: 'paragraph', text: 'ok2' },
          { type: 'paragraph', text: '{{missingVar}}' },
        ],
      },
      {},
    )
    expect(res).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'MISSING_VARIABLE',
          path: 'blocks[2].text',
        }),
      ],
    })
  })

  it('produces deterministic deep-equal LayoutTrees across repeated runs', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const doc = {
      ...baseDocSpec,
      blocks: [
        { type: 'paragraph', text: 'สวัสดี {{name}}' },
        { type: 'signature', name: 'นายสมชาย ใจดี', positions: ['ผอ.'] },
      ],
    }
    const t1 = await engine.layout(doc, { name: 'โลก' })
    const t2 = await engine.layout(doc, { name: 'โลก' })
    expect(t1).toEqual(t2)
  })
})
