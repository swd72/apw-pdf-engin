import { describe, it, expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import type { DocumentDef } from '@apw-pdf/core'
import { memo } from '@apw-pdf/templates'
import { docToText, textToDoc, buildSaveRecord } from './editorSync.js'

afterEach(() => {
  cleanup()
})

describe('editorSync', () => {
  it('docToText then textToDoc round-trips memo.document', () => {
    const text = docToText(memo.document)
    const result = textToDoc(text)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.doc).toEqual(memo.document)
    }
  })

  it('textToDoc returns issues for invalid JSON and for schema-invalid documents', () => {
    const invalidJsonResult = textToDoc('{"version": 1, "blocks": [')
    expect(invalidJsonResult.ok).toBe(false)
    if (!invalidJsonResult.ok) {
      expect(invalidJsonResult.issues.length).toBeGreaterThan(0)
      expect(invalidJsonResult.issues[0]?.message).toBeDefined()
    }

    const invalidDocResult = textToDoc(
      JSON.stringify({
        version: 1,
        page: { size: 'A4' },
        blocks: [{ type: 'unsupported-block-type-xyz' }],
      }),
    )
    expect(invalidDocResult.ok).toBe(false)
    if (!invalidDocResult.ok) {
      expect(invalidDocResult.issues.length).toBeGreaterThan(0)
      expect(invalidDocResult.issues[0]?.path).toBeDefined()
      expect(invalidDocResult.issues[0]?.message).toBeDefined()
    }
  })

  it('switching to JSON with a schema-invalid doc shows its text', () => {
    const schemaInvalidDoc = {
      version: 1,
      page: { size: 'A4' },
      font: { family: 'Sarabun', size: '16pt' },
      blocks: [
        {
          type: 'invalid-type-switch-test',
          customField: 'test-value-123',
        },
      ],
    } as unknown as DocumentDef

    const text = docToText(schemaInvalidDoc)
    expect(text).toContain('invalid-type-switch-test')
    expect(text).toContain('test-value-123')
    expect(JSON.parse(text)).toEqual(schemaInvalidDoc)
  })

  it('switching back to Visual is blocked while the text is invalid', () => {
    const invalidDocText = JSON.stringify({
      version: 1,
      page: { size: 'A4' },
      font: { family: 'Sarabun', size: '16pt' },
      blocks: [{ type: 'invalid-type-switch-test' }],
    })

    const res = textToDoc(invalidDocText)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.issues.length).toBeGreaterThan(0)
    }

    const brokenJsonText = '{ bad json text'
    const brokenRes = textToDoc(brokenJsonText)
    expect(brokenRes.ok).toBe(false)
    if (!brokenRes.ok) {
      expect(brokenRes.issues.length).toBeGreaterThan(0)
    }
  })

  it('save payload carries inferJsonSchema(data)', () => {
    const data = {
      title: 'Tax Invoice',
      customer: {
        name: 'Apiwat',
        taxId: '1234567890123',
      },
      items: [
        { name: 'Item A', qty: 2, price: 150 },
        { name: 'Item B', qty: 1, price: 300 },
      ],
      isPaid: false,
    }

    const record = buildSaveRecord({
      name: 'invoice-template',
      description: 'Official invoice template',
      doc: memo.document,
      data,
    })

    expect(record.name).toBe('invoice-template')
    expect(record.description).toBe('Official invoice template')
    expect(record.document).toEqual(memo.document)
    expect(record.example).toEqual(data)
    expect(record.dataSchema).toEqual({
      type: 'object',
      properties: {
        title: { type: 'string' },
        customer: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            taxId: { type: 'string' },
          },
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              qty: { type: 'number' },
              price: { type: 'number' },
            },
          },
        },
        isPaid: { type: 'boolean' },
      },
    })

    const recordWithoutDesc = buildSaveRecord({
      name: 'blank-template',
      doc: memo.document,
      data: {},
    })
    expect(recordWithoutDesc.description).toBe('Template blank-template')
  })
})
