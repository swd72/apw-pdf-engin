import { describe, it, expect, test } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { memo } from '@apw-pdf/templates'
import { createRenderer } from '../src/index.js'

describe('createRenderer', () => {
  it('renders memo by template name and writes file via renderToFile', async () => {
    const renderer = await createRenderer()
    const bytes = await renderer.render('memo', memo.example)
    const header = new TextDecoder('latin1').decode(bytes.subarray(0, 5))
    expect(header).toBe('%PDF-')

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apw-pdf-render-'))
    const outFile = path.join(tmpDir, 'out.pdf')
    const res = await renderer.renderToFile('memo', memo.example, outFile)
    expect(res.pageCount).toBe(1)
    expect(res.warnings).toEqual([])
    const stat = await fs.stat(outFile)
    expect(stat.size).toBeGreaterThan(1000)
  })

  test.skipIf(Boolean(process.env.CI_SLOW))(
    'performance: memo 1 page < 200ms (median of 5) and 20-page memo < 1500ms after warm-up',
    async () => {
      const renderer = await createRenderer()
      // Warm-up render
      await renderer.render('memo', memo.example)

      const times: number[] = []
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now()
        await renderer.render('memo', memo.example)
        times.push(performance.now() - t0)
      }
      times.sort((a, b) => a - b)
      const median = times[2]!
      expect(median).toBeLessThan(200)

      // 20-page memo
      const baseExample = memo.example as Record<string, unknown>
      const longBody = Array.from(
        { length: 220 },
        (_, idx) =>
          `ข้อที่ ${idx + 1} ด้วยกลุ่มงานบริหารทั่วไป สำนักงานเลขานุการกรม มีความประสงค์ขออนุมัติจัดซื้อวัสดุสำนักงานและครุภัณฑ์คอมพิวเตอร์เพื่อใช้ในการปฏิบัติราชการประจำปีงบประมาณ พ.ศ. ๒๕๗๐ จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ`,
      )
      const tStart20 = performance.now()
      const res20 = await renderer.render('memo', {
        ...baseExample,
        body: longBody,
      })
      const elapsed20 = performance.now() - tStart20
      expect(res20.byteLength).toBeGreaterThan(5000)
      expect(elapsed20).toBeLessThan(1500)
    },
  )
})
