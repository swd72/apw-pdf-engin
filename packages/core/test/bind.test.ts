import { describe, it, expect } from 'vitest'
import { parseExpression, evaluate } from '../src/bind/expr.js'
import { renderString } from '../src/bind/template.js'
import { bindDocument } from '../src/bind/bind.js'
import type { DocumentDef } from '../src/schema.js'

const baseDoc: DocumentDef = {
  version: 1,
  page: {
    size: 'A4',
    margin: { top: '1.5cm', bottom: '2cm', left: '3cm', right: '2cm' },
  },
  font: { family: 'THSarabunIT9', size: '16pt' },
  blocks: [],
}

describe('expressions, filters, and binding', () => {
  it('binds dot paths and filters', () => {
    const res = renderString(
      '{{a.b | number:2}} {{amt | baht}} {{d | thaiDate:"short"}} {{s | upper}} {{missing | default:"-"}} {{p | prefix:"โทร "}}',
      { a: { b: 1250.5 }, amt: 1, d: '2026-10-31', s: 'ab', p: '02' },
      { strict: true, path: 'blocks[0].text' },
    )
    expect(res.value).toBe('1,250.50 หนึ่งบาทถ้วน 31 ต.ค. 69 AB - โทร 02')
    expect(res.warnings).toEqual([])
  })

  it('strict missing var throws; non-strict warns and returns empty string', () => {
    expect(() =>
      bindDocument(
        { ...baseDoc, blocks: [{ type: 'paragraph', text: '{{nope}}' }] },
        {},
        { strict: true },
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'MISSING_VARIABLE',
        path: 'blocks[0].text',
      }),
    )

    const nonStrict = bindDocument(
      { ...baseDoc, blocks: [{ type: 'paragraph', text: 'x={{nope}}' }] },
      {},
      { strict: false },
    )
    expect(nonStrict.doc.blocks[0]).toMatchObject({ type: 'paragraph', text: 'x=' })
    expect(nonStrict.warnings).toEqual([
      expect.objectContaining({
        code: 'MISSING_VARIABLE',
        path: 'blocks[0].text',
      }),
    ])
  })

  it('evaluates expressions safely', () => {
    expect(
      evaluate(parseExpression("type == 'sick' && days >= 2"), {
        type: 'sick',
        days: 3,
      }),
    ).toBe(true)
    expect(evaluate(parseExpression('!(a < 1) || b'), { a: 0, b: true })).toBe(true)
    expect(evaluate(parseExpression('a != "he\\"llo" && c <= 5 && d > 1'), { a: 'x', c: 5, d: 2 })).toBe(true)
  })

  it('rejects code execution and prototype access in expressions and paths', () => {
    expect(() => parseExpression("constructor.constructor('x')()")).toThrow(
      expect.objectContaining({ code: 'EXPRESSION_INVALID' }),
    )
    expect(() => parseExpression('a.__proto__ == 1')).toThrow(
      expect.objectContaining({ code: 'EXPRESSION_INVALID' }),
    )
    expect(() => parseExpression('a.prototype == 1')).toThrow(
      expect.objectContaining({ code: 'EXPRESSION_INVALID' }),
    )
    expect(() =>
      renderString('{{a.__proto__}}', { a: {} }, { strict: true, path: 'blocks[0].text' }),
    ).toThrow(expect.objectContaining({ code: 'EXPRESSION_INVALID' }))
  })

  it('expands each and if blocks (including Review Focus 1: each over [])', () => {
    const docWithEach: DocumentDef = {
      ...baseDoc,
      blocks: [
        {
          type: 'each',
          of: 'items',
          as: 'it',
          blocks: [{ type: 'paragraph', text: '{{it.name}}' }],
        },
        {
          type: 'if',
          test: 'show == true',
          then: [{ type: 'paragraph', text: 'YES' }],
          else: [{ type: 'paragraph', text: 'NO' }],
        },
      ],
    }

    const res2 = bindDocument(docWithEach, {
      items: [{ name: 'A' }, { name: 'B' }],
      show: true,
    })
    expect(res2.doc.blocks).toEqual([
      { type: 'paragraph', text: 'A' },
      { type: 'paragraph', text: 'B' },
      { type: 'paragraph', text: 'YES' },
    ])

    const resEmpty = bindDocument(docWithEach, {
      items: [],
      show: false,
    })
    expect(resEmpty.doc.blocks).toEqual([{ type: 'paragraph', text: 'NO' }])
  })

  it('expands table rows each and evaluates checkbox expressions', () => {
    const doc: DocumentDef = {
      ...baseDoc,
      blocks: [
        {
          type: 'table',
          columns: [{ width: '*' }],
          rows: {
            each: 'items',
            as: 'r',
            cells: [{ text: '{{r.qty}}' }],
          },
        },
        {
          type: 'paragraph',
          runs: [
            { checkbox: "{{type == 'sick'}}" },
            { checkbox: "{{type == 'personal'}}" },
          ],
        },
      ],
    }

    const { doc: resolved } = bindDocument(doc, {
      items: [{ qty: 10 }, { qty: 20 }],
      type: 'sick',
    })
    const tbl = resolved.blocks[0]
    expect(tbl.type).toBe('table')
    if (tbl.type === 'table') {
      expect(tbl.rows).toEqual([[{ text: '10' }], [{ text: '20' }]])
    }
    const p = resolved.blocks[1]
    expect(p.type).toBe('paragraph')
    if (p.type === 'paragraph') {
      expect(p.runs).toEqual([{ checkbox: true }, { checkbox: false }])
    }
  })

  it('numerals thai skips email and url and respects run numerals:arabic (Review Focus 2)', () => {
    const doc: DocumentDef = {
      ...baseDoc,
      numerals: 'thai',
      blocks: [
        {
          type: 'paragraph',
          text: 'ติดต่อ saraban01@moph.go.th หรือ https://a.go.th/x1 โทร 02-123-4567',
        },
        {
          type: 'paragraph',
          runs: [
            { text: 'ปี 2569 ' },
            { text: 'รหัส 1234', numerals: 'arabic' },
          ],
        },
      ],
    }
    const { doc: resolved } = bindDocument(doc, {})
    expect(resolved.blocks[0]).toMatchObject({
      type: 'paragraph',
      text: 'ติดต่อ saraban01@moph.go.th หรือ https://a.go.th/x1 โทร ๐๒-๑๒๓-๔๕๖๗',
    })
    expect(resolved.blocks[1]).toMatchObject({
      type: 'paragraph',
      runs: [{ text: 'ปี ๒๕๖๙ ' }, { text: 'รหัส 1234', numerals: 'arabic' }],
    })
  })

  it('bound values are literal and never re-bound (Review Focus 5)', () => {
    const doc: DocumentDef = {
      ...baseDoc,
      blocks: [{ type: 'paragraph', text: '{{v}}' }],
    }
    const { doc: resolved, warnings } = bindDocument(doc, {
      v: '{{secret}} <b>x</b>',
    })
    expect(resolved.blocks[0]).toMatchObject({
      type: 'paragraph',
      text: '{{secret}} <b>x</b>',
    })
    expect(warnings).toEqual([])
  })

  it('enforces iteration and payload size limits', () => {
    const manyItems = Array.from({ length: 10001 }, (_, i) => ({ name: String(i) }))
    expect(() =>
      bindDocument(
        {
          ...baseDoc,
          blocks: [
            {
              type: 'each',
              of: 'items',
              as: 'it',
              blocks: [{ type: 'paragraph', text: '{{it.name}}' }],
            },
          ],
        },
        { items: manyItems },
      ),
    ).toThrow(expect.objectContaining({ code: 'LIMIT_EXCEEDED' }))

    const hugeData = { text: 'x'.repeat(5 * 1024 * 1024 + 10) }
    expect(() => bindDocument(baseDoc, hugeData)).toThrow(
      expect.objectContaining({ code: 'LIMIT_EXCEEDED' }),
    )
  })

  it('converts Thai numerals in linear time without quadratic regex backtracking on 40k chars (S3)', () => {
    const adversarial = 'ก1'.repeat(20_000) + ' user1@example.go.th https://a.go.th/123 99'
    const start = performance.now()
    const { doc: resolved } = bindDocument(
      {
        ...baseDoc,
        numerals: 'thai',
        blocks: [{ type: 'paragraph', text: '{{v}}' }],
      },
      { v: adversarial },
    )
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(50)
    const outText = (resolved.blocks[0] as { text: string }).text
    expect(outText.endsWith(' user1@example.go.th https://a.go.th/123 ๙๙')).toBe(true)
    expect(outText.startsWith('ก๑ก๑')).toBe(true)
  })

  it('enforces 5 MB data limit in UTF-8 bytes rather than UTF-16 code units (M11)', () => {
    // 2,000,000 Thai chars is 2M UTF-16 code units (< 5M) but 6,000,000 bytes in UTF-8 (> 5 MB)
    const twoMillionThai = 'ก'.repeat(2_000_000)
    expect(() => bindDocument(baseDoc, { v: twoMillionThai })).toThrow(
      expect.objectContaining({ code: 'LIMIT_EXCEEDED' }),
    )
  })
})
