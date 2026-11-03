export function buildSnippets(name: string): { react: string; cli: string } {
  const react = `import { PdfDownloadButton, ApwPdfProvider } from '@apw-pdf/react'
import template from './templates/${name}.json'

export function PrintButton({ data }: { data: unknown }) {
  return (
    <ApwPdfProvider fontBaseUrl="/fonts" wasmUrl="/harfbuzz-subset.wasm" worker>
      <PdfDownloadButton
        doc={template.document}
        data={data}
        fileName="${name}.pdf"
      >
        ดาวน์โหลด PDF (${name}.pdf)
      </PdfDownloadButton>
    </ApwPdfProvider>
  )
}`

  const cli = `apw-pdf render ${name} data.json -o out.pdf`

  return { react, cli }
}
