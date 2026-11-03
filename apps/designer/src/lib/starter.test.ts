import { describe, it, expect } from 'vitest'
import { parseDocument } from '@apw-pdf/core'
import { newTemplateRecord } from './starter.js'

describe('newTemplateRecord starter', () => {
  it('newTemplateRecord uses thaiDistributed and passes parseDocument', () => {
    const record = newTemplateRecord('custom-memo')
    expect(record.name).toBe('custom-memo')
    expect(record.document).toBeDefined()

    // Find the body paragraph in blocks or inside each
    const doc = record.document as any
    const eachBlock = doc.blocks.find((b: any) => b.type === 'each' && b.of === 'body')
    expect(eachBlock).toBeDefined()
    const bodyPara = eachBlock.blocks.find((b: any) => b.type === 'paragraph')
    expect(bodyPara).toBeDefined()
    expect(bodyPara.align).toBe('thaiDistributed')

    // Document passes parseDocument without throwing
    const parsed = parseDocument(record.document)
    expect(parsed).toBeDefined()
  })
})
