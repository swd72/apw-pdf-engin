import { describe, it, expect, test } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { memo } from '@apw-pdf/templates'
import { createRenderer } from '../src/index.js'
import { createApp } from '../../../examples/express-server/server.js'

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

  it('express server returns JSON 400 on malformed JSON, sanitizes 500 errors, and rate limits requests (M13)', async () => {
    const app = await createApp({
      maxRequestsPerWindow: 2,
      windowMs: 60_000,
      renderer: {
        async render(tpl: string) {
          if (tpl === 'memo') {
            throw new Error('C:\\secret\\db-credentials.json crashed')
          }
          return new Uint8Array([0x25, 0x50, 0x44, 0x46])
        },
      },
    } as Parameters<typeof createApp>[0])

    const server = await new Promise<import('node:http').Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s))
    })

    try {
      const addr = server.address() as { port: number }
      const base = `http://127.0.0.1:${addr.port}`

      // 1. Malformed JSON -> 400 JSON without stack trace
      const badJsonRes = await fetch(`${base}/pdf/memo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json',
      })
      expect(badJsonRes.status).toBe(400)
      const badJsonBody = (await badJsonRes.json()) as {
        code: string
        message: string
      }
      expect(badJsonBody.code).toBe('INVALID_JSON')

      // 2. Unexpected error -> generic 500 JSON without leaking internal message
      const errRes = await fetch(`${base}/pdf/memo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      expect(errRes.status).toBe(500)
      const errBody = (await errRes.json()) as { code: string; message: string }
      expect(errBody.code).toBe('INTERNAL_ERROR')
      expect(errBody.message).toBe('Internal server error')
      expect(errBody.message).not.toContain('secret')

      // 3. Second POST succeeds (within maxRequestsPerWindow: 2)
      const okRes = await fetch(`${base}/pdf/external-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      expect(okRes.status).toBe(200)

      // 4. Third POST exceeds rate limit -> 429
      const rateRes = await fetch(`${base}/pdf/external-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      expect(rateRes.status).toBe(429)
      const rateBody = (await rateRes.json()) as { code: string }
      expect(rateBody.code).toBe('RATE_LIMITED')
    } finally {
      server.close()
    }
  })
})
