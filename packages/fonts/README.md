# @apw-pdf/fonts

Bundled SIPA Thai TrueType fonts (`Regular`, `Bold`, `Italic`, `BoldItalic`) and font lookup helpers for `@apw-pdf`.

## Bundled Font Families

| Family ID | Display Name | License |
|---|---|---|
| `THSarabunNew` | TH Sarabun New | DIP-SIPA Font License (see `LICENSE-SIPA.txt`) |
| `THSarabunPSK` | TH Sarabun PSK | DIP-SIPA Font License (see `LICENSE-SIPA.txt`) |

> **Note:** `THSarabunIT9` and `THNiramitIT9` are **not** bundled or redistributed in `@apw-pdf/fonts`. If your organization requires those fonts, you must supply the `.ttf` files yourself.

## Installation

```bash
pnpm add @apw-pdf/fonts
```

## Minimal Usage

```ts
import { join } from 'node:path'
import { FONT_FAMILIES, fontFileName } from '@apw-pdf/fonts'
import { fontsDir } from '@apw-pdf/fonts/node'

console.log(FONT_FAMILIES) // ['THSarabunNew', 'THSarabunPSK']
console.log(fontFileName('THSarabunNew', false, false)) // 'THSarabunNew-Regular.ttf'
console.log(fontsDir) // absolute path to bundled files/ directory
console.log(join(fontsDir, fontFileName('THSarabunNew', true, false))) // absolute path to THSarabunNew-Bold.ttf
```

## Supplying External Fonts (e.g. `THSarabunIT9`)

`fontFileName()` in `@apw-pdf/fonts` (and `fsFontProvider()` in `@apw-pdf/node`) only resolves the built-in `FONT_FAMILIES` (`THSarabunNew` and `THSarabunPSK`). There is no dynamic family registration API in `@apw-pdf/fonts` or `@apw-pdf/node`.

To use a user-supplied font such as `THSarabunIT9` with `@apw-pdf/core` and `@apw-pdf/pdf`, provide a custom `FontProvider` that reads your `.ttf` files by family and style:

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { FontProvider } from '@apw-pdf/core'
import { fontsDir } from '@apw-pdf/fonts/node'

export function customFsFontProvider(dirs: string[]): FontProvider {
  return {
    async load(family, { bold, italic }) {
      const style = bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular'
      const fileName = `${family}-${style}.ttf`
      for (const dir of dirs) {
        try {
          const buf = await readFile(join(dir, fileName))
          return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
        } catch {
          // try next directory
        }
      }
      throw new Error(`Font file "${fileName}" not found`)
    },
  }
}

// Search your local directory first, then fall back to bundled @apw-pdf/fonts:
const fonts = customFsFontProvider(['./my-fonts', fontsDir])
```

## Documentation

See the [main repository README](https://github.com/swd72/apw-pdf-engin#readme) for full documentation.

## License

Code is licensed under MIT (`LICENSE`). Bundled SIPA fonts are distributed under the DIP-SIPA Font License (`LICENSE-SIPA.txt`).
