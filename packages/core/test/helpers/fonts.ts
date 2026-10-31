import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ApwPdfError } from '../../src/errors.js'
import type { FontProvider } from '../../src/fonts/provider.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fontsFilesDir = path.resolve(__dirname, '../../../fonts/files')

const KNOWN_FAMILIES = new Set([
  'THSarabunIT9',
  'THSarabunNew',
  'THSarabunPSK',
  'THNiramitIT9',
])

export function testFontProvider(): FontProvider {
  return {
    async load(family: string, style: { bold: boolean; italic: boolean }): Promise<Uint8Array> {
      if (!KNOWN_FAMILIES.has(family)) {
        throw new ApwPdfError('FONT_NOT_FOUND', `Unknown font family "${family}"`)
      }
      const suffix =
        style.bold && style.italic
          ? 'BoldItalic'
          : style.bold
            ? 'Bold'
            : style.italic
              ? 'Italic'
              : 'Regular'
      const filePath = path.join(fontsFilesDir, `${family}-${suffix}.ttf`)
      const buf = await fs.readFile(filePath)
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    },
  }
}
