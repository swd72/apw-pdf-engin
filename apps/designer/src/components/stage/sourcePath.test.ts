import { describe, it, expect } from 'vitest'
import type { DocumentDef } from '@apw-pdf/core'
import { parseSourcePath, resolveSelection, pathKey } from './sourcePath.js'

const sampleDoc: DocumentDef = {
  version: 1,
  page: {
    size: 'A4',
    margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
  },
  font: { family: 'Sarabun', size: '16pt' },
  blocks: [
    { type: 'paragraph', text: 'ย่อหน้าแรก' },
    {
      type: 'columns',
      columns: [
        { width: '50%', blocks: [{ type: 'paragraph', text: 'ซ้าย' }] },
        { width: '50%', blocks: [{ type: 'paragraph', text: 'ขวา' }] },
      ],
    },
    {
      type: 'each',
      of: 'items',
      as: 'item',
      blocks: [{ type: 'paragraph', text: '{{item}}' }],
    },
    {
      type: 'table',
      columns: [{ width: '50%' }, { width: '50%' }],
      header: [[{ text: 'หัว 1' }, { text: 'หัว 2' }]],
      rows: [
        [
          { blocks: [{ type: 'paragraph', text: 'บล็อกในเซลล์' }] },
          { text: 'เซลล์ข้อความ' },
        ],
      ],
      footer: [[{ text: 'ท้าย 1' }, { text: 'ท้าย 2' }]],
    },
    {
      type: 'table',
      columns: [{ width: '*' }],
      rows: {
        each: 'items',
        as: 'item',
        cells: [{ text: '{{item}}' }],
      },
    },
  ],
}

describe('sourcePath', () => {
  it('parses bracket and dot paths into BlockPath', () => {
    expect(parseSourcePath('blocks[2].columns[0].blocks[1]')).toEqual([
      'blocks',
      2,
      'columns',
      0,
      'blocks',
      1,
    ])
    expect(parseSourcePath('blocks[3].rows[0][1]')).toEqual([
      'blocks',
      3,
      'rows',
      0,
      1,
    ])
    expect(parseSourcePath('blocks[0]')).toEqual(['blocks', 0])
    expect(parseSourcePath('')).toEqual([])
  })

  it('resolves paragraph and nested column paths to their owning block', () => {
    expect(resolveSelection(sampleDoc, 'blocks[0].text')).toEqual({
      blockPath: ['blocks', 0],
    })
    expect(resolveSelection(sampleDoc, 'blocks[0].runs[1]')).toEqual({
      blockPath: ['blocks', 0],
    })
    expect(
      resolveSelection(sampleDoc, 'blocks[1].columns[1].blocks[0]'),
    ).toEqual({
      blockPath: ['blocks', 1, 'columns', 1, 'blocks', 0],
    })
  })

  it('resolves each child path to the inner block', () => {
    expect(resolveSelection(sampleDoc, 'blocks[2].blocks[0]')).toEqual({
      blockPath: ['blocks', 2, 'blocks', 0],
    })
  })

  it('resolves static table cell paths with cellPath and deeper cell blocks without cellPath', () => {
    expect(resolveSelection(sampleDoc, 'blocks[3].rows[0][1]')).toEqual({
      blockPath: ['blocks', 3],
      cellPath: ['blocks', 3, 'rows', 0, 1],
    })
    expect(resolveSelection(sampleDoc, 'blocks[3].header[0][0]')).toEqual({
      blockPath: ['blocks', 3],
      cellPath: ['blocks', 3, 'header', 0, 0],
    })
    expect(resolveSelection(sampleDoc, 'blocks[3].footer[0][1]')).toEqual({
      blockPath: ['blocks', 3],
      cellPath: ['blocks', 3, 'footer', 0, 1],
    })
    expect(
      resolveSelection(sampleDoc, 'blocks[3].rows[0][0].blocks[0].text'),
    ).toEqual({
      blockPath: ['blocks', 3, 'rows', 0, 0, 'blocks', 0],
    })
  })

  it('falls back to table block with no cellPath when rows use each', () => {
    expect(resolveSelection(sampleDoc, 'blocks[4].rows[0][0]')).toEqual({
      blockPath: ['blocks', 4],
    })
  })

  it('returns null for unknown paths', () => {
    expect(resolveSelection(sampleDoc, 'pageNumber')).toBeNull()
    expect(resolveSelection(sampleDoc, 'blocks[99]')).toBeNull()
    expect(resolveSelection(sampleDoc, '')).toBeNull()
  })

  it('formats BlockPath with pathKey', () => {
    expect(pathKey(['blocks', 1, 'columns', 0, 'blocks', 0])).toBe(
      'blocks.1.columns.0.blocks.0',
    )
  })
})
