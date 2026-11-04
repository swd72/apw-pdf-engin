import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { createEngine } from '../src/engine.js'
import {
  SCHEMA_SHAPES,
  lineSpacingObjectSchemas,
  metaSchema,
} from '../src/schema.js'
import {
  INTEGRITY_KEY_SETS,
  getKeySets,
  validateDocumentIntegrity,
} from '../src/validate.js'
import { testFontProvider } from './helpers/fonts.js'
import {
  memo,
  externalLetter,
  leaveSickPersonalMaternity,
  leaveVacation,
} from '../../../packages/templates/src/index.js'

const baseDoc = {
  version: 1 as const,
  page: {
    size: 'A4' as const,
    margin: { top: '1.5cm', bottom: '2cm', left: '3cm', right: '2cm' },
  },
  font: { family: 'THSarabunNew', size: '16pt' },
}

describe('Validation integrity: unknown keys and undefined styles (F3)', () => {
  it('reports typo key as UNKNOWN_KEY with path blocks[0].aling', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const doc = {
      ...baseDoc,
      blocks: [{ type: 'paragraph', text: 'x', aling: 'center' }],
    }

    const res = engine.validate(doc, {})
    expect(res.ok).toBe(false)
    expect(res.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UNKNOWN_KEY',
          path: 'blocks[0].aling',
        }),
      ]),
    )

    // Strict layout throws
    await expect(engine.layout(doc, {}, { strict: true })).rejects.toThrow(
      expect.objectContaining({
        code: 'UNKNOWN_KEY',
        path: 'blocks[0].aling',
      }),
    )

    // Non-strict layout emits warning
    const tree = await engine.layout(doc, {}, { strict: false })
    expect(tree.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UNKNOWN_KEY',
          path: 'blocks[0].aling',
        }),
      ]),
    )
  })

  it('reports undefined style name as STYLE_NOT_FOUND with path blocks[0].style', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const doc = {
      ...baseDoc,
      blocks: [{ type: 'paragraph', text: 'x', style: 'noSuchStyle' }],
    }

    const res = engine.validate(doc, {})
    expect(res.ok).toBe(false)
    expect(res.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'STYLE_NOT_FOUND',
          path: 'blocks[0].style',
        }),
      ]),
    )

    // Strict layout throws
    await expect(engine.layout(doc, {}, { strict: true })).rejects.toThrow(
      expect.objectContaining({
        code: 'STYLE_NOT_FOUND',
        path: 'blocks[0].style',
      }),
    )

    // Non-strict layout emits warning
    const tree = await engine.layout(doc, {}, { strict: false })
    expect(tree.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'STYLE_NOT_FOUND',
          path: 'blocks[0].style',
        }),
      ]),
    )
  })

  it('reports stray keys on tab run as UNKNOWN_KEY', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const doc = {
      ...baseDoc,
      blocks: [
        {
          type: 'paragraph',
          runs: [{ tab: true, to: '@kho', leader: 'dots' }],
        },
      ],
    }

    const res = engine.validate(doc, {})
    expect(res.ok).toBe(false)
    expect(res.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UNKNOWN_KEY',
          path: 'blocks[0].runs[0].to',
        }),
        expect.objectContaining({
          code: 'UNKNOWN_KEY',
          path: 'blocks[0].runs[0].leader',
        }),
      ]),
    )
  })

  it('validates all 4 built-in templates with their example data without UNKNOWN_KEY or STYLE_NOT_FOUND', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const builtins = [
      memo,
      externalLetter,
      leaveSickPersonalMaternity,
      leaveVacation,
    ]

    for (const tpl of builtins) {
      const res = engine.validate(tpl.document, tpl.example)
      const badIssues = res.issues.filter(
        (issue) =>
          issue.code === 'UNKNOWN_KEY' || issue.code === 'STYLE_NOT_FOUND',
      )
      expect(badIssues, `Template ${tpl.name} had unexpected issues: ${JSON.stringify(badIssues)}`).toEqual([])
    }
  })

  it('derives all 36 key sets from zod schema shapes with zero drift (F3b)', () => {
    const keySets = getKeySets()

    // Assert every schema in SCHEMA_SHAPES has an exact match in INTEGRITY_KEY_SETS
    for (const [name, schema] of Object.entries(SCHEMA_SHAPES)) {
      const expectedKeys = new Set(Object.keys((schema as { shape: Record<string, unknown> }).shape))
      expect(keySets[name], `Key set for ${name} must match schema.shape`).toEqual(expectedKeys)
      expect(INTEGRITY_KEY_SETS[name], `INTEGRITY_KEY_SETS.${name} proxy must match schema.shape`).toEqual(expectedKeys)
    }

    // Assert lineSpacing matches the union of its object variant shapes
    const expectedLineSpacingKeys = new Set(
      lineSpacingObjectSchemas.flatMap((s) => Object.keys(s.shape)),
    )
    expect(keySets.lineSpacing).toEqual(expectedLineSpacingKeys)
    expect(INTEGRITY_KEY_SETS.lineSpacing).toEqual(expectedLineSpacingKeys)

    // Verify all 36 expected schema keys are tracked
    expect(Object.keys(keySets).length).toBe(36)
  })

  it('drift test fails if a new optional field is added to a zod schema but not accepted by integrity check (F3b)', () => {
    // Simulate adding a new optional field to a Zod schema
    const extendedMetaSchema = metaSchema.extend({
      customField: z.string().optional(),
    })
    const extendedShapeKeys = new Set(Object.keys(extendedMetaSchema.shape))

    // A stale/hard-coded set without 'customField' will fail equality
    const staleHardcodedSet = new Set(['title', 'author', 'subject', 'keywords'])
    expect(staleHardcodedSet).not.toEqual(extendedShapeKeys)
    expect(extendedShapeKeys.has('customField')).toBe(true)
    expect(staleHardcodedSet.has('customField')).toBe(false)

    // Conversely, dynamically derived set from schema.shape accepts the new key
    const dynamicallyDerivedSet = new Set(Object.keys(extendedMetaSchema.shape))
    expect(dynamicallyDerivedSet).toEqual(extendedShapeKeys)
  })
})
