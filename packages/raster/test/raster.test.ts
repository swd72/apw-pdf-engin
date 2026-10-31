import { describe, it, expect } from 'vitest'
import { readImageInfo } from '@apw-pdf/core'
import { createRenderer } from '@apw-pdf/node'
import { memo } from '@apw-pdf/templates'
import { rasterizePage } from '../src/index.js'

describe('rasterizePage', () => {
  it('rasterizes an A4 page at 150 dpi to a 1240×1754 px PNG', async () => {
    const renderer = await createRenderer()
    const pdfBytes = await renderer.render('memo', memo.example)
    const pngBytes = await rasterizePage(pdfBytes, 1, { dpi: 150 })
    const info = readImageInfo(pngBytes)
    expect(info.format).toBe('png')
    expect(info.width).toBe(1240)
    expect(info.height).toBe(1754)
  })

  it('clamps dpi > 200 to 200', async () => {
    const renderer = await createRenderer()
    const pdfBytes = await renderer.render('memo', memo.example)
    const png200 = await rasterizePage(pdfBytes, 1, { dpi: 200 })
    const png300 = await rasterizePage(pdfBytes, 1, { dpi: 300 })
    const info200 = readImageInfo(png200)
    const info300 = readImageInfo(png300)
    expect(info300.width).toBe(info200.width)
    expect(info300.height).toBe(info200.height)
  })

  it('throws RangeError when pageNumber is out of range (0 or > pageCount)', async () => {
    const renderer = await createRenderer()
    const pdfBytes = await renderer.render('memo', memo.example)
    await expect(rasterizePage(pdfBytes, 0)).rejects.toThrow(RangeError)
    await expect(rasterizePage(pdfBytes, 2)).rejects.toThrow(RangeError)
  })
})
