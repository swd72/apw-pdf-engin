import { describe, it, expect } from 'vitest'
import { FontRegistry } from '../src/fonts/registry.js'
import { testFontProvider } from './helpers/fonts.js'
import { pageBox } from '../src/units.js'
import { bindDocument } from '../src/bind/bind.js'
import { parseDocument } from '../src/schema.js'
import { createAnchorTable } from '../src/layout/align.js'
import { paginate, type FlowContext } from '../src/layout/flow.js'
import { readImageInfo } from '../src/images/info.js'
import { lineBox } from '../src/fonts/metrics.js'

function makeMinimalPng(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(24)
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  // IHDR length (13) + 'IHDR'
  buf.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8)
  const view = new DataView(buf.buffer)
  view.setUint32(16, width, false)
  view.setUint32(20, height, false)
  return buf
}

function makeFlowCtx(
  rawDoc: unknown,
  images: Record<string, Uint8Array> = {},
): FlowContext {
  const parsed = parseDocument(rawDoc)
  const { doc, warnings } = bindDocument(parsed, {})
  const box = pageBox(doc.page)
  const fonts = FontRegistry.create(testFontProvider())
  return {
    fonts,
    images: {
      async load(src: string) {
        const b = images[src]
        if (!b) throw new Error(`Missing test image: ${src}`)
        return b
      },
    },
    doc,
    box,
    bodyTop: () => box.margin.top,
    anchors: createAnchorTable(),
    warnings,
    imageCache: new Map(),
  }
}

const baseDocSpec = {
  version: 1 as const,
  page: {
    size: 'A4' as const,
    margin: { top: '1.5cm', bottom: '2cm', left: '3cm', right: '2cm' },
  },
  font: { family: 'THSarabunIT9', size: '16pt' },
}

describe('block flow and pagination', () => {
  it('reads PNG and JPEG dimensions and rejects invalid image data', () => {
    const png = makeMinimalPng(300, 330)
    expect(readImageInfo(png)).toEqual({ format: 'png', width: 300, height: 330 })

    // Minimal JPEG with SOF0 marker (FF C0)
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x64,
      0x00, 0xc8, 0x01, 0x01, 0x11, 0x00,
    ])
    expect(readImageInfo(jpeg)).toEqual({ format: 'jpeg', width: 200, height: 100 })

    expect(() => readImageInfo(new Uint8Array([1, 2, 3]))).toThrow(
      expect.objectContaining({ code: 'IMAGE_LOAD_FAILED' }),
    )
  })

  it('flows 80 1-line paragraphs to second page with first item at 42.52 + ascent', async () => {
    const blocks = Array.from({ length: 80 }, (_, i) => ({
      type: 'paragraph' as const,
      text: `บรรทัดที่ ${i + 1}`,
    }))
    const ctx = makeFlowCtx({ ...baseDocSpec, blocks })
    const pages = await paginate(ctx.doc.blocks, ctx)
    expect(pages.length).toBe(2)

    const f = await ctx.fonts.get('THSarabunIT9', false, false)
    const { ascent } = lineBox(f.metrics, 16, 'single')
    const firstOnPage2 = pages[1]!.items.find((it) => it.kind === 'glyphs')!
    expect(firstOnPage2.y).toBeCloseTo(42.5197 + ascent, 2)
  })

  it('drops spaceBefore at top of page after auto break, keeps after pageBreak', async () => {
    const blocksAuto = Array.from({ length: 42 }, (_, i) => ({
      type: 'paragraph' as const,
      spaceBefore: '10pt',
      text: `ย่อหน้า ${i + 1}`,
    }))
    const ctxAuto = makeFlowCtx({ ...baseDocSpec, blocks: blocksAuto })
    const pagesAuto = await paginate(ctxAuto.doc.blocks, ctxAuto)
    expect(pagesAuto.length).toBe(2)

    const f = await ctxAuto.fonts.get('THSarabunIT9', false, false)
    const { ascent } = lineBox(f.metrics, 16, 'single')
    const p2AutoFirst = pagesAuto[1]!.items.find((it) => it.kind === 'glyphs')!
    expect(p2AutoFirst.y).toBeCloseTo(42.5197 + ascent, 2)

    const ctxManual = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        { type: 'paragraph', text: 'หน้าแรก' },
        { type: 'pageBreak' },
        { type: 'paragraph', spaceBefore: '20pt', text: 'หน้าสอง' },
      ],
    })
    const pagesManual = await paginate(ctxManual.doc.blocks, ctxManual)
    expect(pagesManual.length).toBe(2)
    const p2ManualFirst = pagesManual[1]!.items.find((it) => it.kind === 'glyphs')!
    expect(p2ManualFirst.y).toBeCloseTo(42.5197 + 20 + ascent, 2)
  })

  it('enforces widow/orphan control (minimum 2 lines per part)', async () => {
    const fiveLinePara = {
      type: 'paragraph' as const,
      runs: [
        { text: 'บรรทัด 1' },
        { lineBreak: true as const },
        { text: 'บรรทัด 2' },
        { lineBreak: true as const },
        { text: 'บรรทัด 3' },
        { lineBreak: true as const },
        { text: 'บรรทัด 4' },
        { lineBreak: true as const },
        { text: 'บรรทัด 5' },
      ],
    }
    // Total body height = 841.8898 - 42.5197 - 56.6929 = 742.6772 pt
    // 1 line = 18.08 pt
    // Case 1: room for 1 line (leave ~25pt by adding spacer of 742.6772 - 25 = 717pt)
    const ctxRoom1 = makeFlowCtx({
      ...baseDocSpec,
      blocks: [{ type: 'spacer', height: '717pt' }, fiveLinePara],
    })
    const pagesRoom1 = await paginate(ctxRoom1.doc.blocks, ctxRoom1)
    expect(pagesRoom1.length).toBe(2)
    expect(pagesRoom1[0]!.items.filter((it) => it.kind === 'glyphs').length).toBe(0)
    expect(pagesRoom1[1]!.items.filter((it) => it.kind === 'glyphs').length).toBe(5)

    // Case 2: room for 3 lines (3 * 18.08 = 54.24pt; leave 60pt by spacer of 742.6772 - 60 = 682.6pt)
    const ctxRoom3 = makeFlowCtx({
      ...baseDocSpec,
      blocks: [{ type: 'spacer', height: '682pt' }, fiveLinePara],
    })
    const pagesRoom3 = await paginate(ctxRoom3.doc.blocks, ctxRoom3)
    expect(pagesRoom3.length).toBe(2)
    expect(pagesRoom3[0]!.items.filter((it) => it.kind === 'glyphs').length).toBe(3)
    expect(pagesRoom3[1]!.items.filter((it) => it.kind === 'glyphs').length).toBe(2)

    // Case 3: room for 4 lines (4 * 18.08 = 72.32pt; leave 78pt by spacer of 742.6772 - 78 = 664.6pt)
    const ctxRoom4 = makeFlowCtx({
      ...baseDocSpec,
      blocks: [{ type: 'spacer', height: '664pt' }, fiveLinePara],
    })
    const pagesRoom4 = await paginate(ctxRoom4.doc.blocks, ctxRoom4)
    expect(pagesRoom4.length).toBe(2)
    expect(pagesRoom4[0]!.items.filter((it) => it.kind === 'glyphs').length).toBe(3)
    expect(pagesRoom4[1]!.items.filter((it) => it.kind === 'glyphs').length).toBe(2)
  })

  it('honors keepWithNext and keepLinesTogether', async () => {
    const fourLinePara = {
      type: 'paragraph' as const,
      runs: [
        { text: 'ย่อหน้าถัดไป 1' },
        { lineBreak: true as const },
        { text: 'ย่อหน้าถัดไป 2' },
        { lineBreak: true as const },
        { text: 'ย่อหน้าถัดไป 3' },
        { lineBreak: true as const },
        { text: 'ย่อหน้าถัดไป 4' },
      ],
    }
    // Leave room for heading (18.08) + 1 line of next para (18.08) = 40pt (not enough for heading + 2 lines = 54.24pt)
    const ctxKeepNext = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        { type: 'spacer', height: '702pt' },
        { type: 'paragraph', text: 'หัวข้อ', keepWithNext: true },
        fourLinePara,
      ],
    })
    const pagesKeepNext = await paginate(ctxKeepNext.doc.blocks, ctxKeepNext)
    expect(pagesKeepNext.length).toBe(2)
    // Heading moved to page 2 with the next paragraph
    expect(pagesKeepNext[0]!.items.filter((it) => it.kind === 'glyphs').length).toBe(0)
    expect(pagesKeepNext[1]!.items.filter((it) => it.kind === 'glyphs')[0]).toMatchObject({
      text: 'หัวข้อ',
    })

    // keepLinesTogether moves the whole 4-line paragraph when only 2 lines fit
    const ctxKeepLines = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        { type: 'spacer', height: '700pt' },
        { ...fourLinePara, keepLinesTogether: true },
      ],
    })
    const pagesKeepLines = await paginate(ctxKeepLines.doc.blocks, ctxKeepLines)
    expect(pagesKeepLines.length).toBe(2)
    expect(pagesKeepLines[0]!.items.filter((it) => it.kind === 'glyphs').length).toBe(0)
    expect(pagesKeepLines[1]!.items.filter((it) => it.kind === 'glyphs').length).toBe(4)

    // keepWithNext chain A -> B -> C moves A, B, and C together when only A + B fit on page 1 (M4)
    const ctxChain = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        { type: 'spacer', height: '700pt' }, // leaves ~42.68pt: fits A + B (36.16pt) but not A + B + C (54.24pt)
        { type: 'paragraph', text: 'หัวข้อใหญ่ A', keepWithNext: true },
        { type: 'paragraph', text: 'หัวข้อย่อย B', keepWithNext: true },
        { type: 'paragraph', text: 'เนื้อหา C' },
      ],
    })
    const pagesChain = await paginate(ctxChain.doc.blocks, ctxChain)
    expect(pagesChain.length).toBe(2)
    expect(pagesChain[0]!.items.filter((it) => it.kind === 'glyphs').length).toBe(0)
    expect(
      pagesChain[1]!.items
        .filter((it) => it.kind === 'glyphs')
        .map((it) => (it.kind === 'glyphs' ? it.text : '')),
    ).toEqual(['หัวข้อใหญ่ A', 'หัวข้อย่อย B', 'เนื้อหา C'])
  })

  it('places anchored and inline images without anchored image consuming flow', async () => {
    const png = makeMinimalPng(300, 300)
    const ctx = makeFlowCtx(
      {
        ...baseDocSpec,
        blocks: [
          {
            type: 'image',
            src: 'asset:garuda',
            height: '1.5cm',
            anchor: { relativeTo: 'margin', x: 0, y: 0 },
          },
          { type: 'paragraph', text: 'บันทึกข้อความ' },
          {
            type: 'image',
            src: 'asset:garuda',
            width: '3cm',
            align: 'center',
          },
        ],
      },
      { 'asset:garuda': png },
    )
    const pages = await paginate(ctx.doc.blocks, ctx)
    const imgs = pages[0]!.items.filter((it) => it.kind === 'image')
    expect(imgs.length).toBe(2)
    // Anchored garuda: x = 85.04, y = 42.52, h = 42.52, w = 42.52
    expect(imgs[0]).toMatchObject({
      kind: 'image',
      x: expect.closeTo(85.0394, 2),
      y: expect.closeTo(42.5197, 2),
      h: expect.closeTo(42.5197, 2),
      w: expect.closeTo(42.5197, 2),
    })
    // Paragraph starts at y = 42.52 + ascent (anchored image did not push it down)
    const f = await ctx.fonts.get('THSarabunIT9', false, false)
    const { ascent } = lineBox(f.metrics, 16, 'single')
    const paraGlyph = pages[0]!.items.find((it) => it.kind === 'glyphs')!
    expect(paraGlyph.y).toBeCloseTo(42.5197 + ascent, 2)
    // Inline image centered: width 3cm (85.0394pt), center = 311.811 → x = 311.811 - 42.5197
    expect(imgs[1]!.x).toBeCloseTo(311.811 - 42.5197, 2)
  })

  it('lays out spacer (lines and length) and dashed line block', async () => {
    const ctx = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        { type: 'paragraph', text: 'บรรทัดแรก' },
        { type: 'spacer', height: { lines: 2 } },
        { type: 'paragraph', text: 'หลังเว้น 2 บรรทัด' },
        { type: 'spacer', height: '1cm' },
        { type: 'paragraph', text: 'หลังเว้น 1 ซม.' },
        { type: 'line', style: 'dashed', thickness: '1pt' },
      ],
    })
    const pages = await paginate(ctx.doc.blocks, ctx)
    const glyphs = pages[0]!.items.filter((it) => it.kind === 'glyphs')
    expect(glyphs[1]!.y - glyphs[0]!.y).toBeCloseTo(3 * 18.08, 2)
    expect(glyphs[2]!.y - glyphs[1]!.y).toBeCloseTo(18.08 + 28.3465, 2)

    const lineItem = pages[0]!.items.find((it) => it.kind === 'line')
    expect(lineItem).toBeDefined()
    if (lineItem && lineItem.kind === 'line') {
      expect(lineItem.x1).toBeCloseTo(85.0394, 2)
      expect(lineItem.x2).toBeCloseTo(538.5827, 2)
      expect(lineItem.dash).toBeDefined()
    }
  })

  it('throws BLOCK_TOO_TALL and LIMIT_EXCEEDED for oversized blocks, >500 pages, or >10MB image', async () => {
    const png = makeMinimalPng(100, 100)
    const ctxTall = makeFlowCtx(
      {
        ...baseDocSpec,
        blocks: [{ type: 'image', src: 'tall', height: '30cm' }],
      },
      { tall: png },
    )
    await expect(paginate(ctxTall.doc.blocks, ctxTall)).rejects.toThrow(
      expect.objectContaining({ code: 'BLOCK_TOO_TALL', path: 'blocks[0]' }),
    )

    const manyBreaks = Array.from({ length: 505 }, () => ({ type: 'pageBreak' as const }))
    const ctxMany = makeFlowCtx({ ...baseDocSpec, blocks: manyBreaks })
    await expect(paginate(ctxMany.doc.blocks, ctxMany)).rejects.toThrow(
      expect.objectContaining({ code: 'LIMIT_EXCEEDED' }),
    )

    const hugeImg = new Uint8Array(10 * 1024 * 1024 + 10)
    const ctxHugeImg = makeFlowCtx(
      {
        ...baseDocSpec,
        blocks: [{ type: 'image', src: 'huge', height: '2cm' }],
      },
      { huge: hugeImg },
    )
    await expect(paginate(ctxHugeImg.doc.blocks, ctxHugeImg)).rejects.toThrow(
      expect.objectContaining({ code: 'LIMIT_EXCEEDED' }),
    )
  })
})
