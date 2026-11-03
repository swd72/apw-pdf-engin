import { describe, it, expect } from 'vitest'
import type { Block, DocumentDef } from '@apw-pdf/core'
import { dataSourceOf } from './dataSource.js'

function createDoc(blocks: Block[]): DocumentDef {
  return {
    version: 1,
    page: {
      size: 'A4',
      margin: { top: '2cm', bottom: '2cm', left: '3cm', right: '2cm' },
    },
    font: { family: 'Sarabun', size: '16pt' },
    blocks,
  }
}

describe('dataSourceOf', () => {
  it('resolves memo body paragraph ({{p}} in each of: body, as: p) to dataPath and label', () => {
    const doc = createDoc([
      {
        type: 'each',
        of: 'body',
        as: 'p',
        blocks: [{ type: 'paragraph', text: '{{p}}' }],
      },
    ])

    expect(dataSourceOf(doc, ['blocks', 0, 'blocks', 0], [1])).toEqual({
      dataPath: ['body', 1],
      label: 'body[1]',
    })
  })

  it('resolves field access ({{item.name}} in each of: items, as: item)', () => {
    const doc = createDoc([
      {
        type: 'each',
        of: 'items',
        as: 'item',
        blocks: [{ type: 'paragraph', text: '{{ item.name }}' }],
      },
    ])

    expect(dataSourceOf(doc, ['blocks', 0, 'blocks', 0], [0])).toEqual({
      dataPath: ['items', 0, 'name'],
      label: 'items[0].name',
    })
  })

  it('resolves nested each where inner of starts with outer as (of: group.rows)', () => {
    const doc = createDoc([
      {
        type: 'each',
        of: 'groups',
        as: 'group',
        blocks: [
          {
            type: 'each',
            of: 'group.rows',
            as: 'row',
            blocks: [{ type: 'paragraph', text: '{{row.title}}' }],
          },
        ],
      },
    ])

    expect(
      dataSourceOf(doc, ['blocks', 0, 'blocks', 0, 'blocks', 0], [1, 2]),
    ).toEqual({
      dataPath: ['groups', 1, 'rows', 2, 'title'],
      label: 'groups[1].rows[2].title',
    })
  })

  it('returns repeatOf form when paragraph text uses a filter ({{p | upper}})', () => {
    const doc = createDoc([
      {
        type: 'each',
        of: 'body',
        as: 'p',
        blocks: [{ type: 'paragraph', text: '{{p | upper}}' }],
      },
    ])

    expect(dataSourceOf(doc, ['blocks', 0, 'blocks', 0], [1])).toEqual({
      repeatOf: 'body',
      itemIndex: 1,
    })
  })

  it('returns repeatOf form when paragraph mixes static text with {{p}}', () => {
    const doc = createDoc([
      {
        type: 'each',
        of: 'body',
        as: 'p',
        blocks: [{ type: 'paragraph', text: 'ข้อ {{p}}' }],
      },
    ])

    expect(dataSourceOf(doc, ['blocks', 0, 'blocks', 0], [2])).toEqual({
      repeatOf: 'body',
      itemIndex: 2,
    })
  })

  it('returns null when block is not inside a loop', () => {
    const doc = createDoc([{ type: 'paragraph', text: '{{subject}}' }])
    expect(dataSourceOf(doc, ['blocks', 0], undefined)).toBeNull()
  })
})
