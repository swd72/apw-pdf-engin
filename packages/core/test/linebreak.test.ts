import { describe, it, expect } from 'vitest'
import { FontRegistry } from '../src/fonts/registry.js'
import { testFontProvider } from './helpers/fonts.js'
import { buildInlineItems, type InlineItem } from '../src/layout/inline.js'
import { breakLines } from '../src/layout/linebreak.js'
import type { FontSpec } from '../src/fonts/metrics.js'

const baseFont: FontSpec = {
  family: 'THSarabunNew',
  size: 16,
  bold: false,
  italic: false,
  color: '#000000',
}

function sumWidth(items: InlineItem[]): number {
  return items.reduce((acc, it) => acc + it.width, 0)
}

describe('inline items and greedy line breaking', () => {
  const fonts = FontRegistry.create(testFontProvider())

  it('fills lines greedily', async () => {
    const text = 'ทดสอบ '.repeat(30).trim()
    const { items } = await buildInlineItems(
      { type: 'paragraph', text },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const { lines, warnings } = breakLines(items, () => 200, sumWidth)
    expect(warnings).toEqual([])
    expect(lines.length).toBeGreaterThan(2)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const w = sumWidth(line.items)
      expect(w).toBeLessThanOrEqual(200)
      if (i < lines.length - 1) {
        const nextFirst = lines[i + 1]!.items[0]!
        // Adding space + next word (or next word) would exceed 200
        const spaceW = line.items[0]!.font.shape(' ', 16).width
        expect(w + spaceW + nextFirst.width).toBeGreaterThan(200)
      }
    }
    expect(lines[lines.length - 1]!.isLast).toBe(true)
  })

  it('trailing spaces hang and do not cause early break', async () => {
    const font = await fonts.get('THSarabunNew', false, false)
    const wordW = font.shape('กขคง', 16).width
    const { items } = await buildInlineItems(
      { type: 'paragraph', text: 'กขคง   กขคง' },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    // Line width just fits 'กขคง' (plus a tiny epsilon), so 'กขคง   ' should fit on line 0 with spaces dropped
    const { lines } = breakLines(items, () => wordW + 0.01, sumWidth)
    expect(lines.length).toBe(2)
    expect(lines[0]!.items.map((it) => (it.kind === 'word' ? it.text : ''))).toEqual(['กขคง'])
    expect(lines[0]!.items.every((it) => it.kind !== 'space')).toBe(true)
    expect(lines[1]!.items.map((it) => (it.kind === 'word' ? it.text : ''))).toEqual(['กขคง'])
  })

  it('force-breaks unbreakable long strings at grapheme boundaries (Review Focus 3)', async () => {
    const url = 'https://example.go.th/very/long/path/without/spaces'
    const { items } = await buildInlineItems(
      { type: 'paragraph', text: url },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const { lines, warnings } = breakLines(items, () => 40, sumWidth)
    expect(lines.length).toBeGreaterThan(3)
    for (const line of lines) {
      expect(sumWidth(line.items)).toBeLessThanOrEqual(40)
    }
    const reconstructed = lines
      .flatMap((l) => l.items.map((it) => (it.kind === 'word' ? it.text : '')))
      .join('')
    expect(reconstructed).toBe(url)
    expect(warnings).toEqual([
      expect.objectContaining({ code: 'FORCED_BREAK', path: 'blocks[0]' }),
    ])
  })

  it('handles explicit lineBreak', async () => {
    const { items } = await buildInlineItems(
      {
        type: 'paragraph',
        runs: [{ text: 'บรรทัดหนึ่ง' }, { lineBreak: true }, { text: 'บรรทัดสอง' }],
      },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const { lines } = breakLines(items, () => 400, sumWidth)
    expect(lines.length).toBe(2)
    expect(lines[0]!.endsWithBreak).toBe(true)
    expect(lines[0]!.isLast).toBe(false)
    expect(lines[1]!.endsWithBreak).toBe(false)
    expect(lines[1]!.isLast).toBe(true)
  })

  it('respects per-line widthFor(lineIndex)', async () => {
    const { items } = await buildInlineItems(
      { type: 'paragraph', text: 'ทดสอบ '.repeat(15).trim() },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    const { lines } = breakLines(
      items,
      (idx) => (idx === 0 ? 100 : 200),
      sumWidth,
    )
    expect(sumWidth(lines[0]!.items)).toBeLessThanOrEqual(100)
    expect(sumWidth(lines[1]!.items)).toBeGreaterThan(100)
    expect(sumWidth(lines[1]!.items)).toBeLessThanOrEqual(200)
  })

  it('shapes mixed runs with their own fonts', async () => {
    const { items } = await buildInlineItems(
      {
        type: 'paragraph',
        runs: [{ text: 'หัวข้อ', bold: true }, { text: 'เนื้อหา', bold: false }],
      },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    expect(items.length).toBe(2)
    expect(items[0]!.kind === 'word' && items[0]!.font.bold).toBe(true)
    expect(items[1]!.kind === 'word' && items[1]!.font.bold).toBe(false)
  })

  it('produces 1 empty line for empty paragraph (Review Focus 1)', async () => {
    const { items } = await buildInlineItems(
      { type: 'paragraph', text: '' },
      { fonts, base: baseFont, dictionary: [], path: 'blocks[0]' },
    )
    expect(items).toEqual([])
    const { lines } = breakLines(items, () => 400, sumWidth)
    expect(lines).toEqual([{ items: [], isLast: true, endsWithBreak: false }])
  })

  it('wraps long fill text across lines with leader on remaining width of last line and warns on unbreakable token (C1)', async () => {
    const { layoutParagraph } = await import('../src/layout/paragraph.js')
    const { createAnchorTable } = await import('../src/layout/align.js')
    const longSubject =
      'ขออนุมัติจัดซื้อวัสดุสำนักงานประจำไตรมาสที่ ๑ เพื่อใช้ในการปฏิบัติราชการของกลุ่มงานบริหารทั่วไป สำนักงานเลขานุการกรม ประจำปีงบประมาณ พ.ศ. ๒๕๗๐ ครั้งที่ ๑'
    expect(longSubject.length).toBeGreaterThanOrEqual(140)

    const { layout, warnings } = await layoutParagraph(
      {
        type: 'paragraph',
        runs: [
          { text: 'เรื่อง', bold: true, size: '20pt' },
          { text: '  ' },
          { fill: longSubject, width: 'toEnd', leader: 'dots' },
        ],
      },
      {
        fonts,
        base: baseFont,
        dictionary: [],
        contentLeft: 85.0394,
        contentWidth: 453.5433,
        anchors: createAnchorTable(),
        path: 'blocks[4]',
      },
    )

    expect(warnings).toEqual([])
    expect(layout.lines.length).toBeGreaterThanOrEqual(2)
    // Line 0 starts with 'เรื่อง' and already includes fill words on the same line
    expect(layout.lines[0]!.runs[0]!.text).toContain('เรื่อง')
    expect(layout.lines[0]!.runs.map((r) => r.text).join('')).toContain('ขออนุมัติ')

    const contentRight = 85.0394 + 453.5433
    for (const line of layout.lines) {
      for (const run of line.runs) {
        const endX = run.x + run.glyphs.reduce((s, g) => s + g.advance, 0)
        expect(endX).toBeLessThanOrEqual(contentRight + 0.05)
      }
    }

    // Last line has dotted leader under remaining width to contentRight
    const lastLine = layout.lines[layout.lines.length - 1]!
    const lastTextEndX = Math.max(
      ...lastLine.runs.map((r) => r.x + r.glyphs.reduce((s, g) => s + g.advance, 0)),
    )
    const lastLeader = lastLine.shapes.find((s) => s.kind === 'line' && s.dash !== undefined)
    expect(lastLeader).toBeDefined()
    if (lastLeader && lastLeader.kind === 'line') {
      expect(lastLeader.x1).toBeCloseTo(lastTextEndX, 2)
      expect(lastLeader.x2).toBeCloseTo(contentRight, 2)
    }

    // Unbreakable single token inside fill emits FORCED_BREAK and stays within contentRight
    const longToken = 'https://example.go.th/' + 'a'.repeat(120)
    const { layout: forcedLayout, warnings: forcedWarnings } = await layoutParagraph(
      {
        type: 'paragraph',
        runs: [
          { text: 'เรื่อง  ' },
          { fill: longToken, width: 'toEnd', leader: 'dots' },
        ],
      },
      {
        fonts,
        base: baseFont,
        dictionary: [],
        contentLeft: 85.0394,
        contentWidth: 453.5433,
        anchors: createAnchorTable(),
        path: 'blocks[5]',
      },
    )
    expect(forcedWarnings).toEqual([
      expect.objectContaining({ code: 'FORCED_BREAK', path: 'blocks[5]' }),
    ])
    for (const line of forcedLayout.lines) {
      for (const run of line.runs) {
        const endX = run.x + run.glyphs.reduce((s, g) => s + g.advance, 0)
        expect(endX).toBeLessThanOrEqual(contentRight + 0.05)
      }
    }
  })
})
