# @apw-pdf/pdf

PDF 1.7 writer for `@apw-pdf` built on `pdf-lib` and `hb-subset.wasm`. Embeds subsetted `CIDFontType2` TrueType fonts with `/ToUnicode` CMaps and `/ActualText` tagging for accurate Thai copy/paste and search.

## Installation

```bash
pnpm add @apw-pdf/pdf @apw-pdf/core
```

## Minimal Usage

```ts
import { createPdfEngine } from '@apw-pdf/pdf'

const engine = await createPdfEngine({
  fonts: myFontProvider,
  images: myImageProvider,
  subsetWasm: hbSubsetWasmBytes,
})

const { bytes, pageCount, warnings } = await engine.renderPdf(documentDef, data)
```

## Documentation

See the [main repository README](https://github.com/swd72/apw-pdf-engin#readme) for full documentation.

## License

MIT
