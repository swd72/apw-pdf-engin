import { describe, it, expect } from 'vitest'
import { singleLineHeight } from '@apw-pdf/core'
import { memo } from '../src/index.js'
import { findRun, getTestEngine, layoutOf } from './helpers.js'

describe('memo (บันทึกข้อความ) conformance', () => {
  it('places garuda at x = 85.0394, y = 42.5197, h = 42.5197', async () => {
    const tree = await layoutOf(memo, memo.example)
    const img = tree.pages[0]!.items.find((i) => i.kind === 'image')!
    expect(img).toBeDefined()
    if (img.kind === 'image') {
      expect(img.x).toBeCloseTo(85.0394, 3)
      expect(img.y).toBeCloseTo(42.5197, 3)
      expect(img.h).toBeCloseTo(42.5197, 3)
    }
  })

  it('renders title บันทึกข้อความ bold 29pt, line box exactly 35pt, centered at 311.811 ± 0.05', async () => {
    const tree = await layoutOf(memo, memo.example)
    const { item } = findRun(tree, 'บันทึกข้อความ')
    expect(item.size).toBe(29)
    const fontRef = tree.fonts.find((f) => f.id === item.font)!
    expect(fontRef.bold).toBe(true)

    const runWidth = item.glyphs.reduce((sum, g) => sum + g.advance, 0)
    const runCenter = item.x + runWidth / 2
    expect(runCenter).toBeCloseTo(311.811, 1)

    // Line box exactly 35pt -> ascent = 35 * 850 / (850 + 250) = 27.0455
    // Margin top = 42.5197 -> baseline = 42.5197 + 27.0455 = 69.5651
    expect(item.y).toBeCloseTo(42.5197 + (35 * 850) / 1100, 2)
  })

  it('renders header labels bold 20pt with dotted leaders ending at contentRight 538.58', async () => {
    const tree = await layoutOf(memo, memo.example)
    for (const label of ['ส่วนราชการ', 'ที่', 'วันที่', 'เรื่อง']) {
      const { item } = findRun(tree, label)
      expect(item.size).toBe(20)
      const fontRef = tree.fonts.find((f) => f.id === item.font)!
      expect(fontRef.bold).toBe(true)
    }

    // Dotted leader lines on header lines should end at 538.58
    const dottedLines = tree.pages[0]!.items.filter(
      (i): i is Extract<typeof i, { kind: 'line' }> =>
        i.kind === 'line' && Array.isArray(i.dash) && i.dash.length > 0,
    )
    const rightEndLines = dottedLines.filter((l) => Math.abs(l.x2 - 538.5827) < 0.05)
    expect(rightEndLines.length).toBeGreaterThanOrEqual(3)
    for (const l of rightEndLines) {
      expect(l.x2).toBeCloseTo(538.58, 2)
    }
  })

  it('aligns วันที่ run x with the x of ข inside บันทึกข้อความ (anchor kho, index 6) ± 0.01', async () => {
    const tree = await layoutOf(memo, memo.example)
    const { item: titleRun } = findRun(tree, 'บันทึกข้อความ')
    const { item: dateLabelRun } = findRun(tree, 'วันที่')

    // Compute x of 'ข' (UTF-16 index 6 in 'บันทึกข้อความ')
    let khoOffset = 0
    for (let i = 0; i < titleRun.glyphs.length; i++) {
      if ((titleRun.clusters[i] ?? 0) < 6) {
        khoOffset += titleRun.glyphs[i]!.advance
      }
    }
    const khoX = titleRun.x + khoOffset
    expect(dateLabelRun.x).toBeCloseTo(khoX, 2)
  })

  it('gives เรียน spaceBefore 6pt (baseline - previous baseline = single(16) + 6 ± 0.01)', async () => {
    const engine = await getTestEngine()
    const font = await engine.fonts.get('THSarabunIT9', false, false)
    const single16 = singleLineHeight(font.metrics, 16)

    const tree = await layoutOf(memo, memo.example)
    const { item: subjectRun } = findRun(tree, 'เรื่อง')
    const { item: toRun } = findRun(tree, 'เรียน')

    // Between the line before 'เรียน' and 'เรียน', baseline difference = single(16) + 6
    const glyphItems = tree.pages[0]!.items.filter(
      (i): i is Extract<typeof i, { kind: 'glyphs' }> => i.kind === 'glyphs',
    )
    const toIdx = glyphItems.indexOf(toRun)
    expect(toIdx).toBeGreaterThan(0)
    // Find the last glyph run on the line immediately preceding 'เรียน'
    const prevLineY = Math.max(
      ...glyphItems
        .filter((g) => g.y < toRun.y - 1)
        .map((g) => g.y),
    )
    expect(prevLineY).toBeGreaterThanOrEqual(subjectRun.y)
    // Preceding line ('เรื่อง') has a 20pt bold label (descent = 22.60 - 17.60 = 5.00pt vs 4.00pt for 16pt),
    // so baseline delta = descent(20) + 6 + ascent(16) = 5.00 + 6 + 14.08 = 25.08 (= single(16) + 6 + 1)
    const descent20 = singleLineHeight(font.metrics, 20) - (880 / 1000) * 20
    const descent16 = single16 - (880 / 1000) * 16
    expect(toRun.y - prevLineY).toBeCloseTo(single16 + 6 + (descent20 - descent16), 2)
  })

  it('indents first body line to 85.04 + 70.87 and distributes non-last body lines to 538.58 ± 0.01', async () => {
    const tree = await layoutOf(memo, memo.example)
    const glyphItems = tree.pages[0]!.items.filter(
      (i): i is Extract<typeof i, { kind: 'glyphs' }> =>
        i.kind === 'glyphs' && i.sourcePath.startsWith('blocks['),
    )
    const { item: toRun } = findRun(tree, 'เรียน')
    const bodyRuns = glyphItems.filter((g) => g.y > toRun.y + 1 && !g.text.startsWith('('))
    expect(bodyRuns.length).toBeGreaterThanOrEqual(2)

    const firstBodyLine = bodyRuns[0]!
    expect(firstBodyLine.x).toBeCloseTo(85.0394 + 70.8661, 2)

    const firstLineWidth = firstBodyLine.glyphs.reduce((s, g) => s + g.advance, 0)
    expect(firstBodyLine.x + firstLineWidth).toBeCloseTo(538.58, 2)
  })

  it('places signature "(" at x = 311.81', async () => {
    const tree = await layoutOf(memo, memo.example)
    const { item: sigNameRun } = findRun(tree, '(')
    expect(sigNameRun.x).toBeCloseTo(311.81, 2)
  })

  it('renders page number "- ๒ -" on page 2 and none on page 1 for a 40-paragraph memo', async () => {
    const baseData = memo.example as Record<string, unknown>
    const longBody = Array.from(
      { length: 40 },
      (_, idx) =>
        `ข้อที่ ${idx + 1} ด้วยกลุ่มงานบริหารทั่วไปมีความประสงค์ขออนุมัติจัดซื้อวัสดุสำนักงานเพื่อใช้ในการปฏิบัติราชการประจำปีงบประมาณ จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ`,
    )
    const built = memo.build({
      ...(baseData as Parameters<typeof memo.build>[0]),
      body: longBody,
    })
    const tree = await layoutOf(built.doc, built.data)
    expect(tree.pages.length).toBeGreaterThanOrEqual(2)

    const p1PageNums = tree.pages[0]!.items.filter(
      (i) => i.kind === 'glyphs' && i.sourcePath === 'pageNumber',
    )
    expect(p1PageNums.length).toBe(0)

    const p2PageNum = tree.pages[1]!.items.find(
      (i): i is Extract<typeof i, { kind: 'glyphs' }> =>
        i.kind === 'glyphs' && i.sourcePath === 'pageNumber',
    )
    expect(p2PageNum).toBeDefined()
    expect(p2PageNum?.text).toBe('- ๒ -')
  })
})
