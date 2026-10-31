import { describe, it, expect } from 'vitest'
import { FontRegistry } from '../src/fonts/registry.js'
import { testFontProvider } from './helpers/fonts.js'
import { buildInlineItems, type InlineItem } from '../src/layout/inline.js'
import { breakLines } from '../src/layout/linebreak.js'
import type { FontSpec } from '../src/fonts/metrics.js'

const baseFont: FontSpec = {
  family: 'THSarabunIT9',
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
    const font = await fonts.get('THSarabunIT9', false, false)
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
})
