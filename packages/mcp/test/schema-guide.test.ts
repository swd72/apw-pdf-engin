import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILTERS, parseDocument } from '@apw-pdf/core'
import { memo } from '@apw-pdf/templates'
import { getSchemaGuide, FILTERS_SECTION } from '../src/tools.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const readmePath = path.resolve(__dirname, '../../../README.md')

describe('MCP schema guide & README validation (F2)', () => {
  it('extracts and validates every json code block from getSchemaGuide()', () => {
    const guide = getSchemaGuide()
    const jsonBlockRegex = /```json\r?\n([\s\S]*?)\r?\n```/g
    const matches = Array.from(guide.matchAll(jsonBlockRegex))

    expect(matches.length).toBeGreaterThan(0)

    for (const match of matches) {
      const code = match[1].trim()
      const parsed = JSON.parse(code)

      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        const doc = {
          ...memo.document,
          blocks: [parsed],
        }
        expect(() => parseDocument(doc)).not.toThrow()
      } else {
        const doc = {
          ...memo.document,
          blocks: [
            {
              type: 'paragraph' as const,
              runs: [parsed],
            },
          ],
        }
        expect(() => parseDocument(doc)).not.toThrow()
      }
    }
  })

  it('verifies every filter in FILTERS_SECTION table exists in core FILTERS', () => {
    const lines = FILTERS_SECTION.split(/\r?\n/)
    const filterNames: string[] = []

    for (const line of lines) {
      if (!line.trim().startsWith('|')) continue
      const cols = line.split('|').map((c) => c.trim()).filter(Boolean)
      if (cols.length < 2) continue
      if (cols[0] === 'Filter' || cols[0].startsWith('---')) continue

      // Look for backticked names in the first column e.g. `upper` / `lower` or `thaiDate`
      const backticks = Array.from(cols[0].matchAll(/`([^`]+)`/g)).map((m) => m[1])
      filterNames.push(...backticks)
    }

    expect(filterNames.length).toBeGreaterThan(0)

    for (const name of filterNames) {
      expect(Object.hasOwn(FILTERS, name), `Filter "${name}" should exist in core FILTERS`).toBe(true)
    }
  })

  it('validates all document json blocks in root README.md', () => {
    const content = fs.readFileSync(readmePath, 'utf8')
    const jsonBlockRegex = /```json\r?\n([\s\S]*?)\r?\n```/g
    const matches = Array.from(content.matchAll(jsonBlockRegex))

    let checkedDocCount = 0
    for (const match of matches) {
      const code = match[1].trim()
      let parsed: unknown
      try {
        parsed = JSON.parse(code)
      } catch {
        continue
      }

      if (!parsed || typeof parsed !== 'object') continue

      if ('blocks' in parsed) {
        expect(() => parseDocument(parsed)).not.toThrow()
        checkedDocCount++
      } else if ('document' in parsed && parsed.document && typeof parsed.document === 'object' && 'blocks' in parsed.document) {
        expect(() => parseDocument(parsed.document)).not.toThrow()
        checkedDocCount++
      }
    }

    expect(checkedDocCount).toBeGreaterThan(0)
  })
})
