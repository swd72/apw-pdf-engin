import { describe, it, expect } from 'vitest'
import { createEngine } from '../src/engine.js'
import { blockKeyOf } from '../src/layout/boxes.js'
import { testFontProvider } from './helpers/fonts.js'

function makeMinimalPng(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(24)
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  buf.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8)
  const view = new DataView(buf.buffer)
  view.setUint32(16, width, false)
  view.setUint32(20, height, false)
  return buf
}

const baseDocSpec = {
  version: 1 as const,
  page: {
    size: 'A4' as const,
    margin: { top: '1.5cm', bottom: '2cm', left: '3cm', right: '2cm' },
  },
  font: { family: 'THSarabunIT9', size: '16pt' },
}

describe('block boxes and blockKeyOf', () => {
  it('top-level paragraph gets one box at content left/width', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const tree = await engine.layout(
      {
        ...baseDocSpec,
        blocks: [{ type: 'paragraph', text: 'สวัสดีครับ' }],
      },
      {},
    )
    const page = tree.pages[0]!
    expect(page.boxes.length).toBe(1)
    const box = page.boxes[0]!
    expect(box.path).toBe('blocks[0]')
    expect(box.x).toBe(page.content.x)
    expect(box.w).toBe(page.content.w)
    expect(box.h).toBeGreaterThan(0)
  })

  it('content box matches page margins', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const tree = await engine.layout(
      {
        version: 1,
        page: {
          size: 'A4',
          margin: { top: '2.5cm', left: '3cm', right: '2cm', bottom: '2cm' },
        },
        font: { family: 'THSarabunIT9', size: '16pt' },
        blocks: [{ type: 'paragraph', text: 'เนื้อหา' }],
      },
      {},
    )
    const { content } = tree.pages[0]!
    expect(content.x).toBeCloseTo(85.04, 2)
    expect(content.y).toBeCloseTo(70.87, 2)
    expect(content.w).toBeCloseTo(595.28 - 85.04 - 56.69, 1)
  })

  it('blocks inside each keep the source path', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const tree = await engine.layout(
      {
        ...baseDocSpec,
        blocks: [
          { type: 'paragraph', text: 'a' },
          {
            type: 'each',
            of: 'xs',
            as: 'x',
            blocks: [{ type: 'paragraph', text: '{{x}}' }],
          },
        ],
      },
      { xs: ['1', '2', '3'] },
    )
    const boxes = tree.pages[0]!.boxes
    const nonLoopBox = boxes.find((b) => b.path === 'blocks[0]')
    expect(nonLoopBox?.inst).toBeUndefined()
    const loopBoxes = boxes.filter((b) => b.path === 'blocks[1].blocks[0]')
    expect(loopBoxes.length).toBe(3)
    expect(loopBoxes.map((b) => b.inst)).toEqual([[0], [1], [2]])
    expect(boxes.some((b) => b.path === 'blocks[2]' || b.path === 'blocks[3]')).toBe(false)
  })

  it('nested each inside each produces multi-element inst [i, j]', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const tree = await engine.layout(
      {
        ...baseDocSpec,
        blocks: [
          {
            type: 'each',
            of: 'groups',
            as: 'g',
            blocks: [
              {
                type: 'each',
                of: 'g.rows',
                as: 'r',
                blocks: [{ type: 'paragraph', text: '{{r}}' }],
              },
            ],
          },
        ],
      },
      {
        groups: [{ rows: ['a', 'b'] }, { rows: ['c'] }],
      },
    )
    const boxes = tree.pages[0]!.boxes.filter(
      (b) => b.path === 'blocks[0].blocks[0].blocks[0]',
    )
    expect(boxes.map((b) => b.inst)).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
    ])
  })

  it('if branches use then/else paths', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const doc = {
      ...baseDocSpec,
      blocks: [
        {
          type: 'if',
          test: 'flag',
          then: [{ type: 'paragraph', text: 'กรณีจริง' }],
          else: [{ type: 'paragraph', text: 'กรณีเท็จ' }],
        },
      ],
    }
    const treeTrue = await engine.layout(doc, { flag: true })
    expect(treeTrue.pages[0]!.boxes.map((b) => b.path)).toEqual(['blocks[0].then[0]'])

    const treeFalse = await engine.layout(doc, { flag: false })
    expect(treeFalse.pages[0]!.boxes.map((b) => b.path)).toEqual(['blocks[0].else[0]'])
  })

  it('nested column blocks get their own box inside the parent', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const tree = await engine.layout(
      {
        ...baseDocSpec,
        blocks: [
          {
            type: 'columns',
            columns: [
              { width: '50%', blocks: [{ type: 'paragraph', text: 'คอลัมน์ซ้าย' }] },
              { width: '50%', blocks: [{ type: 'paragraph', text: 'คอลัมน์ขวา' }] },
            ],
          },
        ],
      },
      {},
    )
    const boxes = tree.pages[0]!.boxes
    const parentBox = boxes.find((b) => b.path === 'blocks[0]')
    const leftBox = boxes.find((b) => b.path === 'blocks[0].columns[0].blocks[0]')
    const rightBox = boxes.find((b) => b.path === 'blocks[0].columns[1].blocks[0]')

    expect(parentBox).toBeDefined()
    expect(leftBox).toBeDefined()
    expect(rightBox).toBeDefined()

    if (parentBox && leftBox && rightBox) {
      expect(leftBox.x).toBeGreaterThanOrEqual(parentBox.x - 1e-3)
      expect(leftBox.x + leftBox.w).toBeLessThanOrEqual(parentBox.x + parentBox.w + 1e-3)
      expect(rightBox.x).toBeGreaterThanOrEqual(parentBox.x - 1e-3)
      expect(rightBox.x + rightBox.w).toBeLessThanOrEqual(parentBox.x + parentBox.w + 1e-3)
      expect(leftBox.x + leftBox.w).toBeLessThanOrEqual(rightBox.x + 1e-3)
    }
  })

  it('each inside columns keeps source path', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const tree = await engine.layout(
      {
        ...baseDocSpec,
        blocks: [
          {
            type: 'columns',
            columns: [
              {
                width: '50%',
                blocks: [
                  {
                    type: 'each',
                    of: 'xs',
                    as: 'x',
                    blocks: [{ type: 'paragraph', text: '{{x}}' }],
                  },
                ],
              },
              {
                width: '50%',
                blocks: [{ type: 'paragraph', text: 'ขวา' }],
              },
            ],
          },
        ],
      },
      { xs: ['บรรทัดแรก', 'บรรทัดสอง', 'บรรทัดสาม'] },
    )
    const itemBoxes = tree.pages[0]!.boxes.filter(
      (b) => b.path === 'blocks[0].columns[0].blocks[0].blocks[0]',
    )
    expect(itemBoxes.length).toBe(3)
    expect(itemBoxes.map((b) => b.inst)).toEqual([[0], [1], [2]])
    expect(itemBoxes[0]!.y).toBeLessThan(itemBoxes[1]!.y)
    expect(itemBoxes[1]!.y).toBeLessThan(itemBoxes[2]!.y)
  })

  it('paragraph split across pages yields one box per page', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const runs = Array.from({ length: 55 }, (_, i) => [
      ...(i > 0 ? [{ lineBreak: true as const }] : []),
      { text: `บรรทัดที่ ${i + 1}` },
    ]).flat()

    const tree = await engine.layout(
      {
        ...baseDocSpec,
        blocks: [{ type: 'paragraph', runs }],
      },
      {},
    )
    expect(tree.pages.length).toBe(2)

    for (const page of tree.pages) {
      const pBoxes = page.boxes.filter((b) => b.path === 'blocks[0]')
      expect(pBoxes.length).toBe(1)
      const box = pBoxes[0]!
      expect(box.x).toBeGreaterThanOrEqual(page.content.x - 1e-3)
      expect(box.y).toBeGreaterThanOrEqual(page.content.y - 1e-3)
      expect(box.x + box.w).toBeLessThanOrEqual(page.content.x + page.content.w + 1e-3)
      expect(box.y + box.h).toBeLessThanOrEqual(page.content.y + page.content.h + 1e-3)
    }
  })

  it('table cells get cell boxes', async () => {
    const engine = await createEngine({ fonts: testFontProvider() })
    const tree = await engine.layout(
      {
        ...baseDocSpec,
        blocks: [
          {
            type: 'table',
            columns: [{ width: '50%' }, { width: '50%' }],
            header: [[{ text: 'หัว 1' }, { text: 'หัว 2' }]],
            rows: [[{ text: 'ข้อมูล 1' }, { text: 'ข้อมูล 2' }]],
          },
        ],
      },
      {},
    )
    const paths = tree.pages[0]!.boxes.map((b) => b.path)
    expect(paths).toContain('blocks[0]')
    expect(paths).toContain('blocks[0].header[0][0]')
    expect(paths).toContain('blocks[0].rows[0][1]')
  })

  it('anchored image gets a box', async () => {
    const png = makeMinimalPng(300, 300)
    const engine = await createEngine({
      fonts: testFontProvider(),
      images: {
        async load() {
          return png
        },
      },
    })
    const tree = await engine.layout(
      {
        ...baseDocSpec,
        blocks: [
          {
            type: 'image',
            src: 'asset:garuda',
            height: '1.5cm',
            anchor: { relativeTo: 'margin', x: 0, y: 0 },
          },
          { type: 'paragraph', text: 'บันทึกข้อความ' },
        ],
      },
      {},
    )
    const page = tree.pages[0]!
    const imgItem = page.items.find((it) => it.kind === 'image')
    const imgBox = page.boxes.find((b) => b.path === 'blocks[0]')
    expect(imgItem).toBeDefined()
    expect(imgBox).toBeDefined()
    if (imgItem && imgItem.kind === 'image' && imgBox) {
      expect(imgBox).toEqual({
        path: 'blocks[0]',
        x: imgItem.x,
        y: imgItem.y,
        w: imgItem.w,
        h: imgItem.h,
      })
    }
  })

  it('extracts owning block key with blockKeyOf', () => {
    const cases: [string, string | null][] = [
      ['blocks[2].text', 'blocks[2]'],
      ['blocks[2].runs[1]', 'blocks[2]'],
      ['blocks[0].columns[1].blocks[0].runs[0]', 'blocks[0].columns[1].blocks[0]'],
      ['blocks[3].rows[0][1]', 'blocks[3].rows[0][1]'],
      ['blocks[3].rows[0][1].blocks[0].text', 'blocks[3].rows[0][1].blocks[0]'],
      ['blocks[1].then[0].positions[0]', 'blocks[1].then[0]'],
      ['pageNumber', null],
    ]
    for (const [input, expected] of cases) {
      expect(blockKeyOf(input)).toBe(expected)
    }
  })
})
