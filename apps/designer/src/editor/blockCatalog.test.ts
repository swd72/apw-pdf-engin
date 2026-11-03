import { describe, it, expect } from 'vitest'
import { parseDocument, type DocumentDef } from '@apw-pdf/core'
import { memo } from '@apw-pdf/templates'
import { BLOCK_TYPES } from './blockCatalog.js'

describe('blockCatalog', () => {
  it('every BLOCK_TYPES create() output passes parseDocument when placed in a minimal document', () => {
    expect(BLOCK_TYPES.length).toBe(10)

    for (const item of BLOCK_TYPES) {
      const block = item.create()
      expect(block.type).toBe(item.type)

      const doc: DocumentDef = {
        version: 1,
        page: memo.document.page,
        font: memo.document.font,
        blocks: [block],
      }

      const parsed = parseDocument(doc)
      expect(parsed).toBeDefined()
      expect(parsed.blocks[0]?.type).toBe(item.type)
    }
  })
})
