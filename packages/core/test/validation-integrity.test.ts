import { describe, it, expect } from 'vitest'
import { createEngine } from '../src/engine.js'
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
  font: { family: 'THSarabunIT9', size: '16pt' },
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
})
