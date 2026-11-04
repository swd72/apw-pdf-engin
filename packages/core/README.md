# @apw-pdf/core

Runtime-agnostic Thai PDF layout engine with HarfBuzz OpenType shaping, `Intl.Segmenter` Thai word breaking, Sara Am decomposition, and Thai distributed justification (`thaiDistributed`).

## Installation

```bash
pnpm add @apw-pdf/core
```

## Minimal Usage

```ts
import { createEngine } from '@apw-pdf/core'

const engine = await createEngine({
  fonts: myFontProvider,
  images: myImageProvider,
})

const tree = await engine.layout(documentDef, data)
console.log(`Laid out ${tree.pages.length} page(s)`)
```

## Documentation

See the [main repository README](https://github.com/swd72/apw-pdf-engin#readme) for full documentation, schema guide, and examples.

## License

MIT
