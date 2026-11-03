import { describe, it, expect } from 'vitest'
import { memo } from '@apw-pdf/templates'
import { validateDocumentText, validateJsonText } from './validate.js'

describe('validateDocumentText and validateJsonText', () => {
  it('validateDocumentText returns ok for memo.document JSON', () => {
    const text = JSON.stringify(memo.document, null, 2)
    const result = validateDocumentText(text)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeDefined()
    }
  })

  it('returns issue with path for schema-invalid document', () => {
    const badDoc = {
      version: 1,
      blocks: [
        {
          type: 'invalid-type-1234',
        },
      ],
    }
    const result = validateDocumentText(JSON.stringify(badDoc))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0]!.path).toBeDefined()
      expect(result.issues[0]!.message).toBeDefined()
    }
  })

  it('returns single issue for truncated JSON', () => {
    const truncated = '{"version": 1, "blocks": ['
    const result = validateDocumentText(truncated)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]!.path).toBe('')
      expect(result.issues[0]!.message).toContain('JSON')
    }
  })

  it('validateJsonText returns ok for valid JSON and issue for invalid JSON', () => {
    const valid = validateJsonText('{"a": 123}')
    expect(valid.ok).toBe(true)

    const invalid = validateJsonText('{"a": ')
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) {
      expect(invalid.issues).toHaveLength(1)
      expect(invalid.issues[0]!.line).toBeDefined()
    }
  })
})
