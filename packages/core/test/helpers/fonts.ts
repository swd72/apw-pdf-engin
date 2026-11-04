import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ApwPdfError } from '../../src/errors.js'
import type { FontProvider } from '../../src/fonts/provider.js'

const here = dirname(fileURLToPath(import.meta.url))
export const testFontsDir = join(here, '../../../fonts/files')

const KNOWN_FAMILIES = new Set([
  'THSarabunNew',
  'THSarabunPSK',
])

export function testFontProvider(): FontProvider {
  return {
    async load(family, { bold, italic }) {
      if (!KNOWN_FAMILIES.has(family)) {
        throw new ApwPdfError('FONT_NOT_FOUND', `Unknown font family "${family}"`)
      }
      const style =
        bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular'
      const file = join(testFontsDir, `${family}-${style}.ttf`)
      try {
        const buf = await readFile(file)
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
      } catch (cause) {
        throw new ApwPdfError('FONT_NOT_FOUND', `Missing font file ${file}`, undefined, {
          cause,
        })
      }
    },
  }
}
