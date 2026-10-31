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

  it('renders stats table with header ประเภทลา | ลามาแล้ว | ลาครั้งนี้ | รวมเป็น and 3 body rows', async () => {
    const tree = await layoutOf(
      leaveSickPersonalMaternity,
      leaveSickPersonalMaternity.example,
    )
    expect(findRun(tree, 'ประเภทลา')).toBeDefined()
    expect(findRun(tree, 'ลามาแล้ว')).toBeDefined()
    expect(findRun(tree, 'ลาครั้งนี้')).toBeDefined()
    expect(findRun(tree, 'รวมเป็น')).toBeDefined()

    // 3 body rows: ป่วย, กิจส่วนตัว, คลอดบุตร
    expect(findRun(tree, 'ป่วย')).toBeDefined()
    expect(findRun(tree, 'กิจส่วนตัว')).toBeDefined()
    expect(findRun(tree, 'คลอดบุตร')).toBeDefined()
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
