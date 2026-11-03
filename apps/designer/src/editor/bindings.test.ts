import { describe, it, expect } from 'vitest'
import type { DocumentDef } from '@apw-pdf/core'
import { memo } from '@apw-pdf/templates'
import {
  scanBindings,
  unresolved,
  scopeAt,
  FILTER_NAMES,
} from './bindings.js'

function createDoc(blocks: DocumentDef['blocks']): DocumentDef {
  return {
    version: 1,
    page: memo.document.page,
    font: memo.document.font,
    blocks,
  }
}

describe('bindings', () => {
  it('scanBindings finds {{x}} in paragraph text, runs, table cells and nested columns', () => {
    const doc = createDoc([
      {
        type: 'paragraph',
        text: 'Hello {{name}}',
      },
      {
        type: 'paragraph',
        runs: [
          { text: 'Code: {{code}}' },
          { fill: '{{dots}}', width: 'toTab' },
        ],
      },
      {
        type: 'table',
        columns: [{ width: '*' }],
        header: [[{ text: '{{head}}' }]],
        rows: [[{ text: '{{cell}}' }]],
      },
      {
        type: 'columns',
        columns: [
          {
            width: '*',
            blocks: [{ type: 'paragraph', text: '{{col}}' }],
          },
        ],
      },
    ])

    const bindings = scanBindings(doc)
    const paths = bindings.map((b) => b.path)
    expect(paths).toContain('name')
    expect(paths).toContain('code')
    expect(paths).toContain('dots')
    expect(paths).toContain('head')
    expect(paths).toContain('cell')
    expect(paths).toContain('col')
  })

  it('scanBindings parses filter and args ("date | thaiDate:\'long\'")', () => {
    const doc = createDoc([
      {
        type: 'paragraph',
        text: "{{ date | thaiDate:'long' }}",
      },
    ])

    const bindings = scanBindings(doc)
    expect(bindings).toHaveLength(1)
    expect(bindings[0]?.path).toBe('date')
    expect(bindings[0]?.filter).toBe("thaiDate:'long'")
    expect(bindings[0]?.expr).toBe("date | thaiDate:'long'")
  })

  it('scanBindings reads paths from if.test', () => {
    const doc = createDoc([
      {
        type: 'if',
        test: 'score >= 50 && isPassed',
        then: [],
      },
    ])

    const bindings = scanBindings(doc)
    const paths = bindings.map((b) => b.path)
    expect(paths).toContain('score')
    expect(paths).toContain('isPassed')
    expect(bindings.every((b) => b.field === 'test')).toBe(true)
  })

  it('unresolved reports a variable missing from data', () => {
    const doc = createDoc([
      {
        type: 'paragraph',
        text: 'Value is {{missing}}',
      },
    ])
    const data = { existing: 123 }

    const issues = unresolved(doc, data)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.path).toBe('missing')
  })

  it('unresolved does not flag loop variable fields inside an each block or a table each', () => {
    const doc = createDoc([
      {
        type: 'each',
        of: 'items',
        as: 'item',
        blocks: [
          {
            type: 'paragraph',
            text: '{{item.name}}',
          },
        ],
      },
      {
        type: 'table',
        columns: [{ width: '*' }],
        rows: {
          each: 'rows',
          as: 'r',
          cells: [{ text: '{{r.total}}' }],
        },
      },
    ])

    const data = {
      items: [{ name: 'Item 1' }],
      rows: [{ total: 100 }],
    }

    const issues = unresolved(doc, data)
    expect(issues).toEqual([])
  })

  it('unresolved flags the loop variable used outside its loop', () => {
    const doc = createDoc([
      {
        type: 'each',
        of: 'items',
        as: 'item',
        blocks: [],
      },
      {
        type: 'paragraph',
        text: 'Outside: {{item.name}}',
      },
    ])
    const data = {
      items: [{ name: 'Item 1' }],
    }

    const issues = unresolved(doc, data)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.path).toBe('item.name')
  })

  it('unresolved is empty when every path exists', () => {
    const doc = createDoc([
      {
        type: 'paragraph',
        text: '{{user.name}} is {{user.age}} years old',
      },
    ])
    const data = {
      user: {
        name: 'Alice',
        age: 30,
      },
    }

    const issues = unresolved(doc, data)
    expect(issues).toEqual([])
  })

  it('scopeAt returns the each variable with its array path', () => {
    const doc = createDoc([
      {
        type: 'each',
        of: 'users',
        as: 'u',
        blocks: [
          {
            type: 'paragraph',
            text: 'Hello',
          },
        ],
      },
    ])

    const scope = scopeAt(doc, ['blocks', 0, 'blocks', 0])
    expect(scope).toEqual([{ name: 'u', arrayPath: 'users' }])
  })
})
