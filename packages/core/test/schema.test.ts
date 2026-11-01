import { describe, it, expect } from 'vitest'
import { parseDocument, documentSchema } from '../src/schema.js'

const baseDoc = {
  version: 1 as const,
  page: {
    size: 'A4' as const,
    margin: { top: '1.5cm', bottom: '2cm', left: '3cm', right: '2cm' },
  },
  font: { family: 'THSarabunIT9', size: '16pt' },
}

describe('schema', () => {
  it('parses minimal doc', () => {
    const doc = parseDocument({
      ...baseDoc,
      blocks: [{ type: 'paragraph', text: 'ก' }],
    })
    expect(doc.version).toBe(1)
    expect(doc.blocks.length).toBe(1)
    expect(documentSchema.safeParse(doc).success).toBe(true)
  })

  it('reports path on invalid nested field', () => {
    expect(() =>
      parseDocument({
        ...baseDoc,
        blocks: [{ type: 'paragraph', runs: [{ text: 'x', size: 'big' }] }],
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'SCHEMA_INVALID',
        path: 'blocks[0].runs[0].size',
      }),
    )
  })

  it('rejects unknown block type with path blocks[0].type', () => {
    expect(() =>
      parseDocument({
        ...baseDoc,
        blocks: [{ type: 'magic' }],
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'SCHEMA_INVALID',
        path: 'blocks[0].type',
      }),
    )
  })

  it('accepts every block type from spec §5.3', () => {
    const doc = parseDocument({
      ...baseDoc,
      meta: { title: 'Test', author: 'A', subject: 'S', keywords: ['k'] },
      numerals: 'thai',
      pageNumber: { from: 2, position: 'top-center', format: '- {n} -', size: '15pt', offset: '1.25cm' },
      styles: {
        label: { font: { bold: true, size: '20pt' }, firstLineIndent: '-1cm' },
      },
      dictionary: ['สำนักงาน'],
      assets: { garuda: 'asset:garuda' },
      blocks: [
        {
          type: 'paragraph',
          id: 'p1',
          style: 'label',
          align: 'thaiDistributed',
          firstLineIndent: '2.5cm',
          indentLeft: '0cm',
          indentRight: '0cm',
          spaceBefore: '6pt',
          spaceAfter: '0pt',
          lineSpacing: { exactly: '35pt' },
          tabs: [{ at: '8cm', align: 'left', leader: 'dots' }],
          keepWithNext: true,
          keepLinesTogether: true,
          widowControl: true,
          runs: [
            { text: 'บันทึกข้อความ', bold: true, anchors: [{ name: 'kho', index: 6, edge: 'start' }] },
            { tab: true },
            { fill: 'ข้อมูล', width: 'toEnd', leader: 'dots', align: 'left' },
            { checkbox: "{{type == 'sick'}}" },
            { lineBreak: true },
            { pageNumber: true },
            { pageCount: true },
          ],
        },
        {
          type: 'image',
          src: 'asset:garuda',
          height: '1.5cm',
          align: 'left',
          anchor: { relativeTo: 'margin', x: 0, y: 0 },
          spaceAfter: '6pt',
        },
        {
          type: 'table',
          columns: [{ width: '2cm', align: 'center' }, { width: '50%' }, { width: '*' }],
          header: [[{ text: 'H1' }, { text: 'H2' }, { text: 'H3' }]],
          rows: [[{ text: 'C1' }, { blocks: [{ type: 'paragraph', text: 'C2' }], colSpan: 2 }]],
          footer: [[{ text: 'F1', colSpan: 3 }]],
          repeatHeader: true,
          border: { width: '0.5pt', color: '#000000' },
          cellPadding: '3pt',
          allowRowSplit: false,
        },
        {
          type: 'columns',
          gap: '6pt',
          keepTogether: true,
          columns: [
            { width: '50%', blocks: [{ type: 'paragraph', text: 'ซ้าย' }] },
            { width: '50%', blocks: [{ type: 'paragraph', text: 'ขวา' }] },
          ],
        },
        {
          type: 'signature',
          startAt: 'center',
          linesBefore: 4,
          prefix: '(ลงชื่อ)',
          name: 'นายสมชาย ใจดี',
          positions: ['ผู้อำนวยการ'],
          minLinesBefore: 3,
        },
        { type: 'spacer', height: { lines: 2 } },
        { type: 'line', thickness: '1pt', style: 'dashed', spaceBefore: '2pt', spaceAfter: '2pt' },
        { type: 'pageBreak' },
        {
          type: 'each',
          of: 'items',
          as: 'it',
          blocks: [{ type: 'paragraph', text: '{{it.name}}' }],
        },
        {
          type: 'if',
          test: 'show == true',
          then: [{ type: 'paragraph', text: 'yes' }],
          else: [{ type: 'paragraph', text: 'no' }],
        },
      ],
    })
    expect(doc.blocks.length).toBe(10)
  })

  it('accepts tab at anchor ref and rejects invalid tab at', () => {
    const ok = parseDocument({
      ...baseDoc,
      blocks: [{ type: 'paragraph', text: 'x', tabs: [{ at: '@kho' }] }],
    })
    expect(ok.blocks.length).toBe(1)

    expect(() =>
      parseDocument({
        ...baseDoc,
        blocks: [{ type: 'paragraph', text: 'x', tabs: [{ at: 'kho' }] }],
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'SCHEMA_INVALID',
        path: 'blocks[0].tabs[0].at',
      }),
    )
  })

  it('rejects oversized custom page dimensions (>5000pt) and oversized font sizes (>500pt) (M10)', () => {
    expect(() =>
      parseDocument({
        ...baseDoc,
        page: {
          size: { width: '10000cm', height: '10000cm' },
          margin: baseDoc.page.margin,
        },
        blocks: [{ type: 'paragraph', text: 'x' }],
      }),
    ).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID' }))

    expect(() =>
      parseDocument({
        ...baseDoc,
        font: { family: 'THSarabunIT9', size: '1000pt' },
        blocks: [{ type: 'paragraph', text: 'x' }],
      }),
    ).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID' }))
  })
})
