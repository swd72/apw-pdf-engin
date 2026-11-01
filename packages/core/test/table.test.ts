import { describe, it, expect } from 'vitest'
import { FontRegistry } from '../src/fonts/registry.js'
import { testFontProvider } from './helpers/fonts.js'
import { pageBox } from '../src/units.js'
import { bindDocument } from '../src/bind/bind.js'
import { parseDocument } from '../src/schema.js'
import { createAnchorTable } from '../src/layout/align.js'
import { paginate, type FlowContext } from '../src/layout/flow.js'
import { resolveColumnWidths } from '../src/layout/table.js'
import '../src/layout/columns.js'

function makeFlowCtx(rawDoc: unknown): FlowContext {
  const parsed = parseDocument(rawDoc)
  const { doc, warnings } = bindDocument(parsed, {})
  const box = pageBox(doc.page)
  const fonts = FontRegistry.create(testFontProvider())
  return {
    fonts,
    images: {
      async load() {
        throw new Error('no images')
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

describe('tables and columns', () => {
  it('resolves fixed, percentage, and star column widths', () => {
    const widths = resolveColumnWidths(['2cm', '50%', '*'], 453.5433)
    expect(widths[0]).toBeCloseTo(56.6929, 2)
    expect(widths[1]).toBeCloseTo(226.7717, 2)
    expect(widths[2]).toBeCloseTo(170.0787, 2)
  })

  it('draws cell borders and applies default padding (3pt left/right, 1pt top)', async () => {
    const ctx = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        {
          type: 'table',
          columns: [{ width: '5cm' }, { width: '5cm' }],
          rows: [[{ text: 'ก' }, { text: 'ข' }]],
        },
      ],
    })
    const pages = await paginate(ctx.doc.blocks, ctx)
    const lines = pages[0]!.items.filter((it) => it.kind === 'line')
    // 2 cells × 4 borders = 8 border lines of default width 0.5pt
    expect(lines.length).toBe(8)
    expect(lines.every((l) => l.kind === 'line' && l.width === 0.5)).toBe(true)

    const glyphs = pages[0]!.items.filter((it) => it.kind === 'glyphs')
    expect(glyphs[0]!.x).toBeCloseTo(85.0394 + 3, 2)
  })

  it('computes row height from tallest cell and centers vAlign:middle', async () => {
    const ctx = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        {
          type: 'table',
          columns: [{ width: '5cm' }, { width: '5cm' }],
          rows: [
            [
              {
                blocks: [
                  {
                    type: 'paragraph',
                    runs: [
                      { text: 'บรรทัด 1' },
                      { lineBreak: true },
                      { text: 'บรรทัด 2' },
                      { lineBreak: true },
                      { text: 'บรรทัด 3' },
                    ],
                  },
                ],
              },
              { text: 'กึ่งกลาง', vAlign: 'middle' },
            ],
          ],
        },
      ],
    })
    const pages = await paginate(ctx.doc.blocks, ctx)
    const glyphs = pages[0]!.items.filter((it) => it.kind === 'glyphs')
    const line1Y = glyphs.find((g) => g.text.includes('บรรทัด 1'))!.y
    const line2Y = glyphs.find((g) => g.text.includes('บรรทัด 2'))!.y
    const midY = glyphs.find((g) => g.text === 'กึ่งกลาง')!.y
    // 1-line middle-aligned cell in a 3-line row has the same baseline as the 2nd line!
    expect(midY).toBeCloseTo(line2Y, 2)
    expect(midY).toBeGreaterThan(line1Y)
  })

  it('supports colSpan and rowSpan', async () => {
    const ctx = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        {
          type: 'table',
          columns: [{ width: '3cm' }, { width: '3cm' }, { width: '3cm' }],
          rows: [
            [{ text: 'A', rowSpan: 2 }, { text: 'B', colSpan: 2 }],
            [{ text: 'C' }, { text: 'D' }],
          ],
        },
      ],
    })
    const pages = await paginate(ctx.doc.blocks, ctx)
    const glyphs = pages[0]!.items.filter((it) => it.kind === 'glyphs')
    const gA = glyphs.find((g) => g.text === 'A')!
    const gB = glyphs.find((g) => g.text === 'B')!
    const gC = glyphs.find((g) => g.text === 'C')!
    const gD = glyphs.find((g) => g.text === 'D')!
    expect(gA.x).toBeCloseTo(85.0394 + 3, 2)
    expect(gB.x).toBeCloseTo(85.0394 + 85.0394 + 3, 2)
    // C is in row 2, column 1 (since column 0 is occupied by A's rowSpan=2)
    expect(gC.x).toBeCloseTo(gB.x, 2)
    expect(gD.x).toBeCloseTo(85.0394 + 2 * 85.0394 + 3, 2)
  })

  it('splits between rows across pages and repeats header when repeatHeader is true', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => [{ text: `แถวที่ ${i + 1}` }])
    const ctx = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        {
          type: 'table',
          columns: [{ width: '*' }],
          header: [[{ text: 'หัวตาราง' }]],
          rows,
          repeatHeader: true,
        },
      ],
    })
    const pages = await paginate(ctx.doc.blocks, ctx)
    expect(pages.length).toBe(2)
    const p1First = pages[0]!.items.find((it) => it.kind === 'glyphs')!
    const p2First = pages[1]!.items.find((it) => it.kind === 'glyphs')!
    expect(p1First.text).toBe('หัวตาราง')
    expect(p2First.text).toBe('หัวตาราง')
  })

  it('throws BLOCK_TOO_TALL with row path when a row is taller than page and allowRowSplit is false', async () => {
    const ctx = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        {
          type: 'table',
          columns: [{ width: '*' }],
          allowRowSplit: false,
          rows: [
            [
              {
                blocks: [{ type: 'spacer', height: '30cm' }],
              },
            ],
          ],
        },
      ],
    })
    await expect(paginate(ctx.doc.blocks, ctx)).rejects.toThrow(
      expect.objectContaining({
        code: 'BLOCK_TOO_TALL',
        path: 'blocks[0].rows[0]',
      }),
    )
  })

  it('force-breaks long URL in narrow 2cm table cell within right padding (Review Focus 3)', async () => {
    const ctx = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        {
          type: 'table',
          columns: [{ width: '2cm' }],
          rows: [[{ text: 'https://example.go.th/very/long/url/inside/narrow/cell' }]],
        },
      ],
    })
    const pages = await paginate(ctx.doc.blocks, ctx)
    const cellRightMinusPad = 85.0394 + 56.6929 - 3
    const glyphs = pages[0]!.items.filter((it) => it.kind === 'glyphs')
    expect(glyphs.length).toBeGreaterThan(2)
    for (const g of glyphs) {
      if (g.kind === 'glyphs') {
        const w = g.glyphs.reduce((s, gl) => s + gl.advance, 0)
        expect(g.x + w).toBeLessThanOrEqual(cellRightMinusPad + 1e-4)
      }
    }
    expect(ctx.warnings).toEqual([
      expect.objectContaining({
        code: 'FORCED_BREAK',
        path: expect.stringContaining('.rows[0][0]'),
      }),
    ])
  })

  it('lays out side-by-side columns with gap', async () => {
    const ctx = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        {
          type: 'columns',
          gap: '6pt',
          columns: [
            {
              width: '50%',
              blocks: [{ type: 'paragraph', text: 'ซ้าย' }],
            },
            {
              width: '50%',
              blocks: [
                { type: 'paragraph', text: 'ขวา 1' },
                { type: 'paragraph', text: 'ขวา 2' },
              ],
            },
          ],
        },
        { type: 'paragraph', text: 'ถัดไป' },
      ],
    })
    const pages = await paginate(ctx.doc.blocks, ctx)
    const glyphs = pages[0]!.items.filter((it) => it.kind === 'glyphs')
    const leftG = glyphs.find((g) => g.text === 'ซ้าย')!
    const rightG = glyphs.find((g) => g.text === 'ขวา 1')!
    const afterG = glyphs.find((g) => g.text === 'ถัดไป')!

    expect(leftG.x).toBeCloseTo(85.0394, 2)
    expect(rightG.x).toBeCloseTo(85.0394 + (453.5433 - 6) / 2 + 6, 2)
    expect(rightG.y).toBeCloseTo(leftG.y, 2)
    // Next block starts after max column height (2 lines on right)
    expect(afterG.y - leftG.y).toBeCloseTo(2 * 18.08, 2)
  })

  it('right-aligns each align:right paragraph in a column individually unless column align:right is set (M7)', async () => {
    const ctx = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        {
          type: 'columns',
          gap: 0,
          columns: [
            {
              width: '50%',
              blocks: [{ type: 'paragraph', text: 'ซ้าย' }],
            },
            {
              width: '50%',
              blocks: [
                { type: 'paragraph', align: 'right', text: 'บรรทัดแรกที่ยาวกว่ามาก' },
                { type: 'paragraph', align: 'right', text: 'สั้น' },
              ],
            },
          ],
        },
      ],
    })
    const pages = await paginate(ctx.doc.blocks, ctx)
    const glyphs = pages[0]!.items.filter((it) => it.kind === 'glyphs')
    const longG = glyphs.find((g) => g.text === 'บรรทัดแรกที่ยาวกว่ามาก')!
    const shortG = glyphs.find((g) => g.text === 'สั้น')!
    const rightEdge = 85.0394 + 453.5433
    const longEnd = longG.x + longG.glyphs.reduce((s, gl) => s + gl.advance, 0)
    const shortEnd = shortG.x + shortG.glyphs.reduce((s, gl) => s + gl.advance, 0)

    // Both right-aligned paragraphs must touch the right edge of the column
    expect(longEnd).toBeCloseTo(rightEdge, 2)
    expect(shortEnd).toBeCloseTo(rightEdge, 2)
    expect(shortG.x).toBeGreaterThan(longG.x + 10)

    // With explicit column align: 'right', the block is shifted right and lines share left edge
    const ctxBlock = makeFlowCtx({
      ...baseDocSpec,
      blocks: [
        {
          type: 'columns',
          gap: 0,
          columns: [
            { width: '50%', blocks: [{ type: 'paragraph', text: 'ซ้าย' }] },
            {
              width: '50%',
              align: 'right',
              blocks: [
                { type: 'paragraph', text: 'บรรทัดแรกที่ยาวกว่ามาก' },
                { type: 'paragraph', text: 'สั้น' },
              ],
            },
          ],
        },
      ],
    })
    const pagesBlock = await paginate(ctxBlock.doc.blocks, ctxBlock)
    const glyphsBlock = pagesBlock[0]!.items.filter((it) => it.kind === 'glyphs')
    const longB = glyphsBlock.find((g) => g.text === 'บรรทัดแรกที่ยาวกว่ามาก')!
    const shortB = glyphsBlock.find((g) => g.text === 'สั้น')!
    expect(longB.x + longB.glyphs.reduce((s, gl) => s + gl.advance, 0)).toBeCloseTo(rightEdge, 2)
    expect(shortB.x).toBeCloseTo(longB.x, 2)
  })
})
