import { describe, it, expect } from 'vitest'
import {
  leaveSickPersonalMaternity,
  leaveVacation,
  templates,
} from '../src/index.js'
import { findRun, getTestPdfEngine, layoutOf } from './helpers.js'

function isCheckboxChecked(
  items: { kind: string; x?: number; y?: number; w?: number; h?: number; x1?: number; y1?: number; x2?: number; y2?: number }[],
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return items.some(
    (it) =>
      it.kind === 'line' &&
      it.x1 !== undefined &&
      it.y1 !== undefined &&
      it.x2 !== undefined &&
      it.y2 !== undefined &&
      it.x1 >= rect.x - 1 &&
      it.x2 <= rect.x + rect.w + 1 &&
      Math.min(it.y1, it.y2) >= rect.y - 1 &&
      Math.max(it.y1, it.y2) <= rect.y + rect.h + 1 &&
      Math.abs(it.y2 - it.y1) > 0.5,
  )
}

function validateAgainstSchema(
  value: unknown,
  schema: { type?: string; required?: string[]; properties?: Record<string, { type?: string }> },
): boolean {
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const obj = value as Record<string, unknown>
    for (const req of schema.required ?? []) {
      if (!(req in obj) || obj[req] === undefined) return false
    }
    if (schema.properties) {
      for (const [k, propSchema] of Object.entries(schema.properties)) {
        if (k in obj && obj[k] !== undefined && propSchema.type) {
          const v = obj[k]
          if (propSchema.type === 'array' && !Array.isArray(v)) return false
          if (propSchema.type === 'object' && (typeof v !== 'object' || v === null || Array.isArray(v))) return false
          if (propSchema.type === 'string' && typeof v !== 'string') return false
          if (propSchema.type === 'number' && typeof v !== 'number') return false
        }
      }
    }
  }
  return true
}

describe('leave templates (ใบลาป่วย/กิจ/คลอด และ ใบลาพักผ่อน)', () => {
  it('renders every template example without warnings and fits each leave form on 1 page', async () => {
    const engine = await getTestPdfEngine()
    for (const [key, tpl] of Object.entries(templates)) {
      const res = await engine.renderPdf(tpl.document, tpl.example)
      expect(res.warnings, `warnings for ${key}`).toEqual([])
      expect(res.pageCount, `pageCount for ${key}`).toBe(1)
      expect(res.bytes.byteLength).toBeGreaterThan(500)
    }
  })

  it('still renders dotted leaders when all optional fields are empty', async () => {
    const minimalSick = {
      writtenAt: 'สำนักงานเลขานุการกรม',
      date: '2026-10-31',
      subject: 'ขอลาป่วย',
      to: 'ผู้อำนวยการสำนักงานเลขานุการกรม',
      name: 'นางสาวสุดา รักงาน',
      position: 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ',
      affiliation: 'กลุ่มงานเทคโนโลยีสารสนเทศ',
      leaveType: 'sick' as const,
      from: '2026-11-01',
      toDate: '2026-11-02',
      days: 2,
      contact: '๐๘ ๑๒๓๔ ๕๖๗๘',
      stats: [
        { type: 'ป่วย', taken: 2, thisTime: 2, total: 4 },
        { type: 'กิจส่วนตัว', taken: 0, thisTime: 0, total: 0 },
        { type: 'คลอดบุตร', taken: 0, thisTime: 0, total: 0 },
      ],
    }
    const tree = await layoutOf(leaveSickPersonalMaternity, minimalSick)
    const dottedLines = tree.pages[0]!.items.filter(
      (i): i is Extract<typeof i, { kind: 'line' }> =>
        i.kind === 'line' && Array.isArray(i.dash) && i.dash.length > 0,
    )
    expect(dottedLines.length).toBeGreaterThanOrEqual(10)
    for (const l of dottedLines) {
      expect(l.x2 - l.x1).toBeGreaterThan(10)
    }
  })

  it('marks the first checkbox ☑ and the others ☐ when leaveType is sick', async () => {
    const tree = await layoutOf(
      leaveSickPersonalMaternity,
      leaveSickPersonalMaternity.example,
    )
    const items = tree.pages[0]!.items
    const rects = items.filter(
      (i): i is Extract<typeof i, { kind: 'rect' }> => i.kind === 'rect',
    )
    // First 3 checkboxes are ป่วย, กิจส่วนตัว, คลอดบุตร
    expect(rects.length).toBeGreaterThanOrEqual(3)
    expect(isCheckboxChecked(items, rects[0]!)).toBe(true)
    expect(isCheckboxChecked(items, rects[1]!)).toBe(false)
    expect(isCheckboxChecked(items, rects[2]!)).toBe(false)
  })

  it('renders stats table with 4x4 grid structure, column widths, borders, and cell values, plus specific dotted leader widths (toEnd, toTab, 1cm, 6cm)', async () => {
    const tree = await layoutOf(
      leaveSickPersonalMaternity,
      leaveSickPersonalMaternity.example,
    )
    const items = tree.pages[0]!.items

    // 1. Verify specific dotted leader widths: toEnd (x2 = 538.58), toTab (x2 at 6.5cm/7.5cm/8cm tab stops), 1cm (28.35pt), and 6cm (170.08pt)
    const dottedLines = items.filter(
      (i): i is Extract<typeof i, { kind: 'line' }> =>
        i.kind === 'line' && Array.isArray(i.dash) && i.dash.length > 0,
    )
    // toEnd leaders ending at contentRight (538.5827pt)
    const toEndLeaders = dottedLines.filter(
      (l) => Math.abs(l.x2 - 538.5827) < 0.05,
    )
    expect(toEndLeaders.length).toBeGreaterThanOrEqual(6)

    // toTab leaders ending at tab stops 6cm (255.12pt), 9cm (340.16pt), 11.5cm (411.02pt)
    const toTab60 = dottedLines.find((l) => Math.abs(l.x2 - (85.0394 + 6 * 28.3465)) < 0.05)
    const toTab90 = dottedLines.find((l) => Math.abs(l.x2 - (85.0394 + 9 * 28.3465)) < 0.05)
    const toTab115 = dottedLines.find((l) => Math.abs(l.x2 - (85.0394 + 11.5 * 28.3465)) < 0.05)
    expect(toTab60).toBeDefined()
    expect(toTab90).toBeDefined()
    expect(toTab115).toBeDefined()

    // 1cm (28.3465pt) leader for days count
    const oneCmLeaders = dottedLines.filter(
      (l) => Math.abs(l.x2 - l.x1 - 28.3465) < 0.05,
    )
    expect(oneCmLeaders.length).toBeGreaterThanOrEqual(2)

    // 6cm (170.0787pt) signature leaders
    const sixCmLeaders = dottedLines.filter(
      (l) => Math.abs(l.x2 - l.x1 - 170.0787) < 0.05,
    )
    expect(sixCmLeaders.length).toBe(4)

    // 2. Verify stats table structure (4 columns: 2.2cm, 1.6cm, 1.6cm, 1.6cm x 4 rows = 16 cells)
    const h1 = findRun(tree, 'ประเภทลา').item
    const h2 = findRun(tree, 'ลามาแล้ว').item
    const h3 = findRun(tree, 'ลาครั้งนี้').item
    const h4 = findRun(tree, 'รวมเป็น').item
    expect(h1.y).toBeCloseTo(h2.y, 2)
    expect(h2.y).toBeCloseTo(h3.y, 2)
    expect(h3.y).toBeCloseTo(h4.y, 2)

    const colEdges = [
      85.0394,
      85.0394 + 62.3622,
      85.0394 + 62.3622 + 45.3543,
      85.0394 + 62.3622 + 2 * 45.3543,
      85.0394 + 62.3622 + 3 * 45.3543,
    ]
    const headerItems = [h1, h2, h3, h4]
    for (let c = 0; c < 4; c++) {
      expect(headerItems[c]!.x).toBeGreaterThanOrEqual(colEdges[c]!)
      expect(headerItems[c]!.x).toBeLessThan(colEdges[c + 1]!)
    }

    // 3 body rows: ป่วย, กิจส่วนตัว, คลอดบุตร, each with 4 cells on its row baseline
    const r1 = findRun(tree, 'ป่วย').item
    const r2 = findRun(tree, 'กิจส่วนตัว').item
    const r3 = findRun(tree, 'คลอดบุตร').item
    expect(r1.y).toBeGreaterThan(h1.y)
    expect(r2.y).toBeGreaterThan(r1.y)
    expect(r3.y).toBeGreaterThan(r2.y)

    const tableGlyphs = items.filter(
      (i): i is Extract<typeof i, { kind: 'glyphs' }> =>
        i.kind === 'glyphs' && i.x < colEdges[4]! + 1 && i.y >= h1.y - 2 && i.y <= r3.y + 5,
    )
    for (const rowRun of [r1, r2, r3]) {
      const cellsOnRow = tableGlyphs.filter((g) => Math.abs(g.y - rowRun.y) < 0.5)
      expect(cellsOnRow.length).toBe(4)
      for (let c = 0; c < 4; c++) {
        expect(cellsOnRow[c]!.x).toBeGreaterThanOrEqual(colEdges[c]!)
        expect(cellsOnRow[c]!.x).toBeLessThan(colEdges[c + 1]!)
      }
    }

    // Solid border lines for the 4x4 table (5 horizontal row edges x 4 cols = 20 + 4 rows x 8 vertical cell sides = 32 -> 52 segments)
    const solidTableLines = items.filter(
      (i): i is Extract<typeof i, { kind: 'line' }> =>
        i.kind === 'line' &&
        !i.dash &&
        i.x1 >= colEdges[0]! - 0.5 &&
        i.x2 <= colEdges[4]! + 0.5 &&
        i.y1 >= h1.y - 20 &&
        i.y2 <= r3.y + 15,
    )
    expect(solidTableLines.length).toBe(52)
  })

  it('renders 6cm dotted signature lines after (ลงชื่อ), ผู้ตรวจสอบ label, date lines, and vacation substitute position/signature (T1, T2)', async () => {
    const sickTree = await layoutOf(
      leaveSickPersonalMaternity,
      leaveSickPersonalMaternity.example,
    )
    const sickItems = sickTree.pages[0]!.items
    const signPrefixes = sickItems.filter(
      (i): i is Extract<typeof i, { kind: 'glyphs' }> =>
        i.kind === 'glyphs' && i.text === '(ลงชื่อ)',
    )
    expect(signPrefixes.length).toBe(4)

    // Each (ลงชื่อ) has a ~6cm (170.08pt) dotted signature line on the same baseline
    const dottedLines = sickItems.filter(
      (i): i is Extract<typeof i, { kind: 'line' }> =>
        i.kind === 'line' && Array.isArray(i.dash) && i.dash.length > 0,
    )
    for (const prefix of signPrefixes) {
      const sigLine = dottedLines.find(
        (l) => Math.abs(l.y1 - prefix.y) < 1 && l.x1 > prefix.x,
      )
      expect(sigLine).toBeDefined()
      expect(sigLine!.x2 - sigLine!.x1).toBeCloseTo(170.08, 0)
    }

    // Checker label ผู้ตรวจสอบ is present even when checker.position is provided
    expect(findRun(sickTree, 'ผู้ตรวจสอบ')).toBeDefined()
    expect(findRun(sickTree, 'ตำแหน่ง เจ้าพนักงานธุรการชำนาญงาน')).toBeDefined()

    // Checker, supervisor, and approver each have a วันที่ ......../......../........ line
    const dateLines = sickItems.filter(
      (i): i is Extract<typeof i, { kind: 'glyphs' }> =>
        i.kind === 'glyphs' && i.text.startsWith('วันที่ ') && i.text.includes('/'),
    )
    expect(dateLines.length).toBe(3)

    // Vacation leave binds substitute.position and renders ผู้รับมอบ signature
    const vacTree = await layoutOf(leaveVacation, leaveVacation.example)
    expect(findRun(vacTree, 'ตำแหน่ง นักวิเคราะห์นโยบายและแผนปฏิบัติการ')).toBeDefined()
    expect(findRun(vacTree, 'ผู้รับมอบ')).toBeDefined()
  })

  it('exports templates with exactly 4 keys and validates every example against its dataSchema', () => {
    const keys = Object.keys(templates)
    expect(keys).toEqual([
      'memo',
      'external-letter',
      'leave-sick-personal-maternity',
      'leave-vacation',
    ])
    expect(leaveVacation.name).toBe('leave-vacation')
    for (const [, tpl] of Object.entries(templates)) {
      expect(
        validateAgainstSchema(
          tpl.example,
          tpl.dataSchema as {
            type?: string
            required?: string[]
            properties?: Record<string, { type?: string }>
          },
        ),
      ).toBe(true)
    }
  })
})
