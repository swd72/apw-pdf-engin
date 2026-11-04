import { describe, it, expect } from 'vitest'
import { FontRegistry } from '../src/fonts/registry.js'
import { testFontProvider } from './helpers/fonts.js'
import { buildInlineItems, type InlineItem } from '../src/layout/inline.js'
import { breakLines } from '../src/layout/linebreak.js'
import {
  DISTRIBUTE_WEIGHTS,
  createAnchorTable,
  naturalWidth,
  resolveTabStops,
  placeLine,
  type TabCtx,
} from '../src/layout/align.js'
import type { FontSpec } from '../src/fonts/metrics.js'

const baseFont: FontSpec = {
  family: 'THSarabunNew',
  size: 16,
  bold: false,
  italic: false,
  color: '#000000',
}

function defaultTabCtx(lineStartX = 85.04, contentRight = 538.58): TabCtx {
  return {
    lineStartX,
    tabs: [],
    defaultInterval: 36,
    contentRight,
  }
}

describe('line placement: alignment, tabs, anchors, Thai Distributed', () => {
  const fonts = FontRegistry.create(testFontProvider())

  it('aligns left, center, and right', async () => {
    const { items } = await buildInlineItems(
      { type: 'paragraph', text: 'สวัสดี' },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const tab = defaultTabCtx(85, 485)
    const nat = naturalWidth(items, tab)
    const line = { items, isLast: true, endsWithBreak: false }

    const leftRuns = placeLine(line, {
      x: 85,
      width: 400,
      align: 'left',
      tab,
      anchors: createAnchorTable(),
    })
    expect(leftRuns[0]!.x).toBeCloseTo(85, 4)

    const centerRuns = placeLine(line, {
      x: 85,
      width: 400,
      align: 'center',
      tab,
      anchors: createAnchorTable(),
    })
    expect(centerRuns[0]!.x).toBeCloseTo(85 + (400 - nat) / 2, 4)

    const rightRuns = placeLine(line, {
      x: 85,
      width: 400,
      align: 'right',
      tab,
      anchors: createAnchorTable(),
    })
    expect(rightRuns[0]!.x).toBeCloseTo(85 + 400 - nat, 4)
  })

  it('justify distributes extra space only to space items and leaves last line left-aligned', async () => {
    const { items } = await buildInlineItems(
      { type: 'paragraph', text: 'กข คง จฉ' },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const tab = defaultTabCtx(0, 200)
    const nat = naturalWidth(items, tab)
    const nonLast = { items, isLast: false, endsWithBreak: false }
    const placed = placeLine(nonLast, {
      x: 0,
      width: 200,
      align: 'justify',
      tab,
      anchors: createAnchorTable(),
    })
    const lastRun = placed[placed.length - 1]!
    const endX = lastRun.x + lastRun.glyphs.reduce((s, g) => s + g.advance, 0)
    expect(endX).toBeCloseTo(200, 2)
    // Word glyphs keep their natural advance; only space glyphs grew
    expect(placed[0]!.glyphs[0]!.advance + placed[0]!.glyphs[1]!.advance).toBeCloseTo(
      items[0]!.width,
      4,
    )

    const lastLine = { items, isLast: true, endsWithBreak: false }
    const placedLast = placeLine(lastLine, {
      x: 0,
      width: 200,
      align: 'justify',
      tab,
      anchors: createAnchorTable(),
    })
    const lastEndX =
      placedLast[placedLast.length - 1]!.x +
      placedLast[placedLast.length - 1]!.glyphs.reduce((s, g) => s + g.advance, 0)
    expect(lastEndX).toBeCloseTo(nat, 4)
  })

  it('thaiDistributed reaches right edge with 4:1 space:cluster weights and keeps mark offsets', async () => {
    expect(DISTRIBUTE_WEIGHTS).toEqual({ space: 4, cluster: 1 })
    const text =
      'ด้วยสำนักงานมีความประสงค์ขอจัดซื้อวัสดุสำนักงาน เพื่อใช้ในการปฏิบัติงานของเจ้าหน้าที่ในสังกัด'
    const { items } = await buildInlineItems(
      { type: 'paragraph', text },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const tab = defaultTabCtx(85.04, 85.04 + 300)
    const { lines } = breakLines(items, () => 300, (it) => naturalWidth(it, tab))
    expect(lines.length).toBeGreaterThan(1)

    const line0 = lines[0]!
    expect(line0.isLast).toBe(false)
    const nat0 = naturalWidth(line0.items, tab)
    const extra = 300 - nat0
    expect(extra).toBeGreaterThan(0)

    const runs = placeLine(line0, {
      x: 85.04,
      width: 300,
      align: 'thaiDistributed',
      tab,
      anchors: createAnchorTable(),
    })
    const lastRun = runs[runs.length - 1]!
    const rightEdge = lastRun.x + lastRun.glyphs.reduce((s, g) => s + g.advance, 0)
    expect(rightEdge).toBeCloseTo(85.04 + 300, 2)

    // Verify space vs cluster gap growth ratio is 4:1
    const spaceItemOrig = line0.items.find((it) => it.kind === 'space')!
    const spaceOrigW = spaceItemOrig.width
    const spaceCharIdx = runs[0]!.text.indexOf(' ')
    const spaceGlyphIdx = runs[0]!.clusters.indexOf(spaceCharIdx)
    const spaceGrowth = runs[0]!.glyphs[spaceGlyphIdx]!.advance - spaceOrigW

    const firstWordOrig = line0.items[0]! as Extract<InlineItem, { kind: 'word' }>
    const firstClusterOrigAdv = firstWordOrig.shaped.glyphs
      .filter((g) => g.cluster === 0)
      .reduce((s, g) => s + g.advance, 0)
    const firstClusterPlacedAdv = runs[0]!.glyphs
      .filter((_, idx) => runs[0]!.clusters[idx] === 0)
      .reduce((s, g) => s + g.advance, 0)
    const clusterGrowth = firstClusterPlacedAdv - firstClusterOrigAdv
    expect(spaceGrowth / clusterGrowth).toBeCloseTo(4, 3)

    // Verify exact 4:1 absolute formula: spaceGrowth = extra * 4 / totalWeight, clusterGrowth = extra * 1 / totalWeight
    let totalWeight = 0
    for (let i = 0; i < line0.items.length; i++) {
      const it = line0.items[i]!
      if (it.kind === 'space') {
        totalWeight += DISTRIBUTE_WEIGHTS.space
      } else if (it.kind === 'word') {
        const uniqueClusters = new Set(it.shaped.glyphs.map((g) => g.cluster)).size
        if (uniqueClusters > 1) {
          totalWeight += (uniqueClusters - 1) * DISTRIBUTE_WEIGHTS.cluster
        }
        const nextIt = line0.items[i + 1]
        if (nextIt && nextIt.kind === 'word' && nextIt.shaped.glyphs.length > 0) {
          totalWeight += DISTRIBUTE_WEIGHTS.cluster
        }
      }
    }
    expect(spaceGrowth).toBeCloseTo((extra * DISTRIBUTE_WEIGHTS.space) / totalWeight, 4)
    expect(clusterGrowth).toBeCloseTo((extra * DISTRIBUTE_WEIGHTS.cluster) / totalWeight, 4)

    // Verify all glyphs (especially combining marks where orig advance === 0) keep their exact original dx/dy offsets
    // and that every combining mark's rendered x-offset relative to its cluster base consonant is preserved
    const origAllGlyphs = line0.items.flatMap((it) =>
      it.kind === 'word' || it.kind === 'space' ? it.shaped.glyphs : [],
    )
    const placedAllGlyphs = runs.flatMap((r) => r.glyphs)
    expect(placedAllGlyphs.length).toBe(origAllGlyphs.length)
    let markCount = 0
    for (let i = 0; i < origAllGlyphs.length; i++) {
      if (origAllGlyphs[i]!.advance === 0) {
        markCount++
      }
      expect(placedAllGlyphs[i]!.id).toBe(origAllGlyphs[i]!.id)
      expect(placedAllGlyphs[i]!.dx).toBeCloseTo(origAllGlyphs[i]!.dx, 6)
      expect(placedAllGlyphs[i]!.dy).toBeCloseTo(origAllGlyphs[i]!.dy, 6)
    }
    expect(markCount).toBe(15)
    // Within the first cluster ('ด้', 2 glyphs at cluster 0), glyph 0 ('ด') keeps its exact natural advance
    // so glyph 1 ('้') is drawn at the exact same offset relative to 'ด', and only the last glyph of the cluster
    // carries the post-cluster extra advance
    expect(runs[0]!.glyphs[0]!.advance).toBeCloseTo(firstWordOrig.shaped.glyphs[0]!.advance, 6)
    expect(runs[0]!.glyphs[1]!.advance).toBeCloseTo(
      firstWordOrig.shaped.glyphs[1]!.advance + clusterGrowth,
      6,
    )

    // Verify last line or endsWithBreak uses natural spacing
    const lastRuns = placeLine(lines[lines.length - 1]!, {
      x: 85.04,
      width: 300,
      align: 'thaiDistributed',
      tab,
      anchors: createAnchorTable(),
    })
    const lastLineNat = naturalWidth(lines[lines.length - 1]!.items, tab)
    const lastRight =
      lastRuns[lastRuns.length - 1]!.x +
      lastRuns[lastRuns.length - 1]!.glyphs.reduce((s, g) => s + g.advance, 0)
    expect(lastRight).toBeCloseTo(85.04 + lastLineNat, 4)
  })

  it('positions left, right, and decimal tab stops and emits dotted leaders', async () => {
    const anchors = createAnchorTable()
    const tabs = resolveTabStops(
      [
        { at: '8cm', align: 'left', leader: 'dots' },
        { at: '12cm', align: 'right' },
        { at: '15cm', align: 'decimal' },
      ],
      85.04,
      anchors,
      'blocks[0]',
    )
    expect(tabs[0]!.at).toBeCloseTo(85.04 + 226.7717, 3)

    const { items } = await buildInlineItems(
      {
        type: 'paragraph',
        runs: [
          { text: 'ก' },
          { tab: true },
          { text: 'ข' },
          { tab: true },
          { text: 'ค' },
          { tab: true },
          { text: '12.34' },
        ],
      },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const tab: TabCtx = {
      lineStartX: 85.04,
      tabs,
      defaultInterval: 36,
      contentRight: 538.58,
    }
    const runs = placeLine(
      { items, isLast: true, endsWithBreak: false },
      { x: 85.04, width: 453.54, align: 'left', tab, anchors },
    )
    // Run after 1st tab ('ข') starts at indentLeftX + 8cm
    expect(runs[1]!.x).toBeCloseTo(85.04 + 226.7717, 2)
    // Run after 2nd tab ('ค') ends at indentLeftX + 12cm
    const khW = runs[2]!.glyphs.reduce((s, g) => s + g.advance, 0)
    expect(runs[2]!.x + khW).toBeCloseTo(85.04 + 340.1575, 2)
    // Run after 3rd tab ('12.34') aligns '.' at indentLeftX + 15cm
    const f = await fonts.get('THSarabunNew', false, false)
    const preDotW = f.shape('12', 16).width
    expect(runs[3]!.x + preDotW).toBeCloseTo(85.04 + 425.1969, 2)
    // Dotted leader shape emitted for first tab
    expect(runs.shapes.some((s) => s.kind === 'line' && s.dash !== undefined)).toBe(true)
  })

  it('uses default 36pt tab intervals when no tabs defined', async () => {
    const { items } = await buildInlineItems(
      { type: 'paragraph', runs: [{ text: 'ก' }, { tab: true }, { text: 'ข' }] },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const tab = defaultTabCtx(100, 500)
    const runs = placeLine(
      { items, isLast: true, endsWithBreak: false },
      { x: 100, width: 400, align: 'left', tab, anchors: createAnchorTable() },
    )
    expect(runs[1]!.x).toBeCloseTo(136, 4)
  })

  it('records anchors at start/end of cluster and resolves @anchor tab stops', async () => {
    const anchors = createAnchorTable()
    const { items } = await buildInlineItems(
      {
        type: 'paragraph',
        runs: [
          {
            text: 'บันทึกข้อความ',
            bold: true,
            size: '29pt',
            anchors: [
              { name: 'kho', index: 6, edge: 'start' },
              { name: 'moEnd', index: 12, edge: 'end' },
            ],
          },
        ],
      },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const tab = defaultTabCtx(85.04, 538.58)
    const runs = placeLine(
      { items, isLast: true, endsWithBreak: false },
      { x: 85.04, width: 453.54, align: 'center', tab, anchors },
    )
    const khoX = anchors.get('kho')
    const moEndX = anchors.get('moEnd')
    expect(khoX).toBeDefined()
    expect(moEndX).toBeDefined()

    // Verify khoX equals run.x + advance of 'บันทึก' (clusters < 6)
    const fBold = await fonts.get('THSarabunNew', true, false)
    const prefixW = fBold.shape('บันทึก', 29).width
    expect(khoX!).toBeCloseTo(runs[0]!.x + prefixW, 3)

    // Verify @kho tab stop resolution and missing anchor error
    const resolved = resolveTabStops([{ at: '@kho' }], 85.04, anchors, 'blocks[1]')
    expect(resolved[0]!.at).toBeCloseTo(khoX!, 4)
    expect(() =>
      resolveTabStops([{ at: '@missing' }], 85.04, anchors, 'blocks[1]'),
    ).toThrow(expect.objectContaining({ code: 'ANCHOR_NOT_FOUND', path: 'blocks[1]' }))
  })

  it('renders fill toEnd with dotted leader to contentRight and text aligned on top', async () => {
    const { items } = await buildInlineItems(
      {
        type: 'paragraph',
        runs: [
          { text: 'ส่วนราชการ ', bold: true, size: '20pt' },
          { fill: 'กองคลัง', width: 'toEnd', leader: 'dots', align: 'center' },
        ],
      },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const tab = defaultTabCtx(85.04, 538.58)
    const runs = placeLine(
      { items, isLast: true, endsWithBreak: false },
      { x: 85.04, width: 453.54, align: 'left', tab, anchors: createAnchorTable() },
    )
    const leaderLine = runs.shapes.find((s) => s.kind === 'line' && s.dash !== undefined)
    expect(leaderLine).toBeDefined()
    if (leaderLine && leaderLine.kind === 'line') {
      expect(leaderLine.x2).toBeCloseTo(538.58, 2)
      const fillRun = runs[runs.length - 1]!
      const fillW = fillRun.glyphs.reduce((s, g) => s + g.advance, 0)
      const expectedCenter = leaderLine.x1 + (leaderLine.x2 - leaderLine.x1 - fillW) / 2
      expect(fillRun.x).toBeCloseTo(expectedCenter, 2)
    }
  })

  it('applies thaiDistributed cluster weight after numeric fill and pageNumber items so line reaches right margin (M6)', async () => {
    const { items } = await buildInlineItems(
      {
        type: 'paragraph',
        runs: [
          { text: 'ข้อความนำ' },
          { fill: '๑๒', width: '1cm', leader: 'dots' },
          { text: 'คั่นกลาง' },
          { pageNumber: true },
          { text: 'ท้ายบรรทัด' },
        ],
      },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const tab = defaultTabCtx(85.04, 85.04 + 300)
    const runs = placeLine(
      { items, isLast: false, endsWithBreak: false },
      { x: 85.04, width: 300, align: 'thaiDistributed', tab, anchors: createAnchorTable() },
    )
    const lastRun = runs[runs.length - 1]!
    const rightEdge = lastRun.x + lastRun.glyphs.reduce((s, g) => s + g.advance, 0)
    expect(rightEdge).toBeCloseTo(85.04 + 300, 2)
  })
})
