import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { rasterizePage } from '@apw-pdf/raster'
import { templates } from '../src/index.js'
import { getTestPdfEngine } from './helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const goldenDir = path.resolve(__dirname, '__golden__')

describe('visual regression for templates', () => {
  it.each(Object.keys(templates))(
    'matches golden PNG for %s page 1',
    async (templateName) => {
      const tpl = templates[templateName]!
      const engine = await getTestPdfEngine()
      const { bytes: pdfBytes } = await engine.renderPdf(
        tpl.document,
        tpl.example,
        { creationDate: new Date(0) },
      )
      const pngBytes = await rasterizePage(pdfBytes, 1, { dpi: 150 })
      const goldenPath = path.join(goldenDir, `${templateName}.png`)

      if (process.env.UPDATE_GOLDEN === '1') {
        await fs.mkdir(goldenDir, { recursive: true })
        await fs.writeFile(goldenPath, pngBytes)
        return
      }

      const goldenBuf = await fs.readFile(goldenPath)
      const actualPng = PNG.sync.read(Buffer.from(pngBytes))
      const expectedPng = PNG.sync.read(goldenBuf)

      expect(actualPng.width).toBe(expectedPng.width)
      expect(actualPng.height).toBe(expectedPng.height)

      const diffPixels = pixelmatch(
        actualPng.data,
        expectedPng.data,
        undefined,
        actualPng.width,
        actualPng.height,
        { threshold: 0.1 },
      )
      const totalPixels = actualPng.width * actualPng.height
      const diffRatio = diffPixels / totalPixels
      expect(diffRatio).toBeLessThanOrEqual(0.001)
    },
  )
})
