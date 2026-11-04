import { describe, it, expect } from 'vitest'
import { lineBox } from '@apw-pdf/core'
import { externalLetter, instantiateTemplate, memo } from '../src/index.js'
import { findRun, getTestEngine, layoutOf } from './helpers.js'

describe('externalLetter (หนังสือภายนอก) conformance', () => {
  it('places garuda with h = 85.0394, centered (x + w/2 = 311.811), y = 42.5197', async () => {
    const tree = await layoutOf(externalLetter, externalLetter.example)
    const img = tree.pages[0]!.items.find((i) => i.kind === 'image')!
    expect(img).toBeDefined()
    if (img.kind === 'image') {
      expect(img.h).toBeCloseTo(85.0394, 3)
      expect(img.y).toBeCloseTo(42.5197, 3)
      expect(img.x + img.w / 2).toBeCloseTo(311.811, 2)
    }
  })

  it('places the ที่ run at x = 85.04', async () => {
    const tree = await layoutOf(externalLetter, externalLetter.example)
    const { item } = findRun(tree, 'ที่')
    expect(item.x).toBeCloseTo(85.04, 2)
  })

  it('aligns address block so longest line ends at 538.58 ± 0.05 and all lines share the same left x', async () => {
    const tree = await layoutOf(externalLetter, externalLetter.example)
    const ex = externalLetter.example as { agencyAddress: string[] }
    expect(ex.agencyAddress.length).toBeGreaterThanOrEqual(2)

    const addrRuns = ex.agencyAddress.map((line) => findRun(tree, line.slice(0, 8)).item)
    const firstLeftX = addrRuns[0]!.x
    let maxRightX = 0
    for (const r of addrRuns) {
      expect(r.x).toBeCloseTo(firstLeftX, 2)
      const w = r.glyphs.reduce((s, g) => s + g.advance, 0)
      if (r.x + w > maxRightX) {
        maxRightX = r.x + w
      }
    }
    expect(maxRightX).toBeCloseTo(538.58, 1)
  })

  it('places first date glyph at x = 311.81', async () => {
    const tree = await layoutOf(externalLetter, externalLetter.example)
    const { item: dateRun } = findRun(tree, '๓๑ ตุลาคม ๒๕๖๙')
    expect(dateRun.x).toBeCloseTo(311.81, 2)
  })

  it('gives เรื่อง / เรียน / อ้างถึง / สิ่งที่ส่งมาด้วย spaceBefore 6pt and omits อ้างถึง when reference is absent', async () => {
    const engine = await getTestEngine()
    const font = await engine.fonts.get('THSarabunNew', false, false)
    const single16 = lineBox(font.metrics, 16, externalLetter.document.font.lineSpacing).height

    const tree = await layoutOf(externalLetter, externalLetter.example)
    const { item: subjectRun } = findRun(tree, 'เรื่อง')
    const { item: toRun } = findRun(tree, 'เรียน')
    const { item: refRun } = findRun(tree, 'อ้างถึง')
    const { item: encRun } = findRun(tree, 'สิ่งที่ส่งมาด้วย')

    expect(toRun.y - subjectRun.y).toBeCloseTo(single16 + 6, 2)
    expect(refRun.y - toRun.y).toBeCloseTo(single16 + 6, 2)
    expect(encRun.y - refRun.y).toBeCloseTo(single16 + 6, 2)

    // Without reference, อ้างถึง is not rendered
    const noRefData = {
      ...(externalLetter.example as Record<string, unknown>),
      reference: undefined,
    }
    const treeNoRef = await layoutOf(externalLetter, noRefData)
    const allTexts = treeNoRef.pages[0]!.items
      .filter((i): i is Extract<typeof i, { kind: 'glyphs' }> => i.kind === 'glyphs')
      .map((g) => g.text)
    expect(allTexts.some((t) => t.startsWith('อ้างถึง'))).toBe(false)
  })

  it('places closing ขอแสดงความนับถือ at 311.81 with spaceBefore 12pt and signer baseline + 2 * single(16)', async () => {
    const engine = await getTestEngine()
    const font = await engine.fonts.get('THSarabunNew', false, false)
    const single16 = lineBox(font.metrics, 16, externalLetter.document.font.lineSpacing).height

    const tree = await layoutOf(externalLetter, externalLetter.example)
    const { item: closingRun } = findRun(tree, 'ขอแสดงความนับถือ')
    expect(closingRun.x).toBeCloseTo(311.81, 2)

    const glyphItems = tree.pages[0]!.items.filter(
      (i): i is Extract<typeof i, { kind: 'glyphs' }> => i.kind === 'glyphs',
    )
    const prevBodyY = Math.max(
      ...glyphItems.filter((g) => g.y < closingRun.y - 1).map((g) => g.y),
    )
    expect(closingRun.y - prevBodyY).toBeCloseTo(single16 + 12, 2)

    const { item: sigNameRun } = findRun(tree, '(')
    expect(sigNameRun.y - closingRun.y).toBeCloseTo(2 * single16, 2)
  })

  it('places ownerUnit lines starting at 85.04 after the signature', async () => {
    const tree = await layoutOf(externalLetter, externalLetter.example)
    const ex = externalLetter.example as { ownerUnit: { name: string } }
    const { item: ownerRun } = findRun(tree, ex.ownerUnit.name)
    const { item: sigNameRun } = findRun(tree, '(')
    expect(ownerRun.x).toBeCloseTo(85.04, 2)
    expect(ownerRun.y).toBeGreaterThan(sigNameRun.y)
  })

  it('uses 0pt spacing between body paragraphs by default and supports paragraphSpacing option (T3)', async () => {
    const engine = await getTestEngine()
    const font = await engine.fonts.get('THSarabunNew', false, false)
    const single16 = lineBox(font.metrics, 16, externalLetter.document.font.lineSpacing).height

    const treeDefault = await layoutOf(externalLetter, externalLetter.example)
    const { item: p2FirstRun } = findRun(treeDefault, 'กรมบัญชีกลางขอเรียนว่า')
    const { item: p3FirstRun } = findRun(treeDefault, 'จึงเรียนมาเพื่อโปรดทราบ')
    const glyphsDefault = treeDefault.pages[0]!.items.filter(
      (i): i is Extract<typeof i, { kind: 'glyphs' }> => i.kind === 'glyphs',
    )
    const p2LastLineY = Math.max(
      ...glyphsDefault
        .filter((g) => g.y >= p2FirstRun.y && g.y < p3FirstRun.y - 1)
        .map((g) => g.y),
    )
    expect(p3FirstRun.y - p2LastLineY).toBeCloseTo(single16, 2)

    const builtCustom = externalLetter.build({
      ...(externalLetter.example as any),
      paragraphSpacing: '6pt',
    })
    const treeCustom = await engine.layout(builtCustom.doc, builtCustom.data)
    const { item: p3CustomRun } = findRun(treeCustom, 'จึงเรียนมาเพื่อโปรดทราบ')
    const glyphsCustom = treeCustom.pages[0]!.items.filter(
      (i): i is Extract<typeof i, { kind: 'glyphs' }> => i.kind === 'glyphs',
    )
    const p2CustomLastY = Math.max(
      ...glyphsCustom
        .filter((g) => g.y < p3CustomRun.y - 1)
        .map((g) => g.y),
    )
    expect(p3CustomRun.y - p2CustomLastY).toBeCloseTo(single16 + 6, 2)
  })

  it('instantiateTemplate applies build() options and falls back to document (N1)', () => {
    const example = externalLetter.example as Record<string, unknown>
    const plain = instantiateTemplate(externalLetter, example)
    expect(plain.doc).toBe(externalLetter.document)
    expect(plain.data).toBe(example)

    const spaced = instantiateTemplate(externalLetter, { ...example, paragraphSpacing: '6pt' })
    expect(spaced.doc).not.toBe(externalLetter.document)
    const body = spaced.doc.blocks.find((b) => b.type === 'each' && b.of === 'body')
    expect(body?.type === 'each' && body.blocks[0]).toMatchObject({ spaceBefore: '6pt' })

    expect(instantiateTemplate(externalLetter, 'not-an-object').doc).toBe(externalLetter.document)
    expect(instantiateTemplate(memo, memo.example).doc).toBe(memo.document)
  })
})
