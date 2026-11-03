import { memo } from '@apw-pdf/templates'
import type { TemplateRecord } from '../../server/templateStore.js'

export function newTemplateRecord(name: string): TemplateRecord {
  const doc = JSON.parse(JSON.stringify(memo.document))

  // Ensure thaiDistributed on body paragraph(s)
  if (Array.isArray(doc.blocks)) {
    for (const block of doc.blocks) {
      if (block.type === 'each' && Array.isArray(block.blocks)) {
        for (const sub of block.blocks) {
          if (sub.type === 'paragraph') {
            sub.align = 'thaiDistributed'
          }
        }
      }
    }
  }

  return {
    name,
    description: `Template ${name}`,
    document: doc,
    dataSchema: JSON.parse(JSON.stringify(memo.dataSchema)),
    example: JSON.parse(JSON.stringify(memo.example)),
  }
}
