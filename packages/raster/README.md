# @apw-pdf/raster

PDF-to-PNG page rasterizer for Node.js built on `pdfjs-dist` and `@napi-rs/canvas`. Useful for visual regression testing and generating document page previews.

> **Note:** Importing `@apw-pdf/raster` polyfills `globalThis.DOMMatrix`, `globalThis.ImageData`, and `globalThis.Path2D` using `@napi-rs/canvas` when not already defined.

## Installation

```bash
pnpm add @apw-pdf/raster
```

## Minimal Usage

```ts
import { writeFile } from 'node:fs/promises'
import { rasterizePage } from '@apw-pdf/raster'

const pngBytes = await rasterizePage(pdfBytes, 1, { dpi: 150 })
await writeFile('page-1.png', pngBytes)
```

## Documentation

See the [main repository README](https://github.com/swd72/apw-pdf-engin#readme) for full documentation.

## License

MIT
