# @apw-pdf/react

React components (`<ApwPdfProvider>`, `<PdfPreview>`, `<PdfDownloadButton>`), `usePdf` hook, and Web Worker renderer for `@apw-pdf`.

## Installation

```bash
pnpm add @apw-pdf/react @apw-pdf/templates @apw-pdf/fonts react react-dom
```

## Minimal Usage

```tsx
import { ApwPdfProvider, PdfPreview, PdfDownloadButton } from '@apw-pdf/react'
import { memo } from '@apw-pdf/templates'

export function MemoPreview() {
  return (
    <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/harfbuzz-subset.wasm" worker>
      <PdfDownloadButton
        doc={memo.document}
        data={memo.example}
        fileName="memo.pdf"
      >
        Download PDF
      </PdfDownloadButton>

      <PdfPreview
        doc={memo.document}
        data={memo.example}
        scale={1.25}
      />
    </ApwPdfProvider>
  )
}
```

## Documentation

See the [main repository README](https://github.com/swd72/apw-pdf-engin#readme) for full documentation and Vite asset setup.

## License

MIT
