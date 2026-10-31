import { describe, it, expect } from 'vitest'
import { FontRegistry } from '../src/fonts/registry.js'
import { testFontProvider } from './helpers/fonts.js'
import { createAnchorTable } from '../src/layout/align.js'
import { layoutParagraph } from '../src/layout/paragraph.js'
import { singleLineHeight } from '../src/fonts/metrics.js'
import type { FontSpec } from '../src/fonts/metrics.js'

const baseFont: FontSpec = {
  family: 'THSarabunIT9',
  size: 16,
  bold: false,
  italic: false,
  color: '#000000',
}

describe('paragraph layout', () => {
  const fonts = FontRegistry.create(testFontProvider())

  it('applies indentLeft and firstLineIndent', async () => {
    const { layout } = await layoutParagraph(
      {
        type: 'paragraph',
        indentLeft: '1cm',
        firstLineIndent: '2.5cm',
        text: 'ด้วยสำนักงานมีความประสงค์ขอจัดซื้อวัสดุสำนักงาน เพื่อใช้ในการปฏิบัติงานของเจ้าหน้าที่ในสังกัดและหน่วยงานที่เกี่ยวข้องทั้งหมด',
      },
      {
        fonts,
        base: baseFont,
        dictionary: [],
        contentLeft: 85.0394,
        contentWidth: 453.5433,
        anchors: createAnchorTable(),
        path: 'blocks[0]',
      },
    )
    expect(layout.lines.length).toBeGreaterThanOrEqual(2)
    expect(layout.lines[0]!.runs[0]!.x).toBeCloseTo(85.0394 + 28.3465 + 70.8661, 2)
    expect(layout.lines[1]!.runs[0]!.x).toBeCloseTo(85.0394 + 28.3465, 2)
  })

  it('applies negative firstLineIndent (hanging indent)', async () => {
    const { layout } = await layoutParagraph(
      {
        type: 'paragraph',
        indentLeft: '2cm',
        firstLineIndent: '-1cm',
        text: 'ด้วยสำนักงานมีความประสงค์ขอจัดซื้อวัสดุสำนักงาน เพื่อใช้ในการปฏิบัติงานของเจ้าหน้าที่ในสังกัดและหน่วยงานที่เกี่ยวข้องทั้งหมด',
      },
      {
        fonts,
        base: baseFont,
        dictionary: [],
        contentLeft: 85.0394,
        contentWidth: 453.5433,
        anchors: createAnchorTable(),
        path: 'blocks[0]',
      },
    )
    expect(layout.lines.length).toBeGreaterThanOrEqual(2)
    expect(layout.lines[0]!.runs[0]!.x).toBeCloseTo(85.0394 + 28.3465, 2)
    expect(layout.lines[1]!.runs[0]!.x).toBeCloseTo(85.0394 + 56.6929, 2)
  })

  it('uses tallest run on a line for line height', async () => {
    const f20 = await fonts.get('THSarabunIT9', true, false)
    const { layout } = await layoutParagraph(
      {
        type: 'paragraph',
        runs: [
          { text: 'ป้ายชื่อ ', bold: true, size: '20pt' },
          { text: 'ข้อความปกติ 16pt', size: '16pt' },
        ],
      },
      {
        fonts,
        base: baseFont,
        dictionary: [],
        contentLeft: 85.04,
        contentWidth: 453.54,
        anchors: createAnchorTable(),
        path: 'blocks[0]',
      },
    )
    expect(layout.lines[0]!.height).toBeCloseTo(singleLineHeight(f20.metrics, 20), 4)
  })

  it('uses constant height for exactly lineSpacing', async () => {
    const { layout } = await layoutParagraph(
      {
        type: 'paragraph',
        font: { size: '29pt', bold: true },
        lineSpacing: { exactly: '35pt' },
        text: 'บันทึกข้อความ',
      },
      {
        fonts,
        base: baseFont,
        dictionary: [],
        contentLeft: 85.04,
        contentWidth: 453.54,
        anchors: createAnchorTable(),
        path: 'blocks[0]',
      },
    )
    expect(layout.lines[0]!.height).toBe(35)
  })

  it('renders empty paragraph as 1 line of Single height without NaN (Review Focus 1)', async () => {
    const { layout } = await layoutParagraph(
      {
        type: 'paragraph',
        text: '',
      },
      {
        fonts,
        base: baseFont,
        dictionary: [],
        contentLeft: 85.04,
        contentWidth: 453.54,
        anchors: createAnchorTable(),
        path: 'blocks[0]',
      },
    )
    expect(layout.lines.length).toBe(1)
    expect(layout.lines[0]!.height).toBeCloseTo(18.08, 4)
    expect(Number.isNaN(layout.lines[0]!.ascent)).toBe(false)
    expect(Number.isNaN(layout.spaceBefore)).toBe(false)
    expect(Number.isNaN(layout.spaceAfter)).toBe(false)
  })

  it('merges named style and allows block props to override style', async () => {
    const { layout } = await layoutParagraph(
      {
        type: 'paragraph',
        style: 'label',
        align: 'center',
        text: 'หัวเรื่อง',
      },
      {
        fonts,
        base: baseFont,
        styles: {
          label: {
            align: 'left',
            spaceBefore: '6pt',
            font: { size: '20pt', bold: true },
          },
        },
        dictionary: [],
        contentLeft: 85.04,
        contentWidth: 453.54,
        anchors: createAnchorTable(),
        path: 'blocks[0]',
      },
    )
    expect(layout.spaceBefore).toBe(6)
    expect(layout.lines[0]!.runs[0]!.size).toBe(20)
    expect(layout.lines[0]!.runs[0]!.font.bold).toBe(true)
    // Centered (overrides style's align: 'left')
    expect(layout.lines[0]!.runs[0]!.x).toBeGreaterThan(200)
  })
})
