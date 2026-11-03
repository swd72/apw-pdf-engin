import React, { useRef } from 'react'
import {
  ApwPdfProvider,
  PdfDownloadButton,
  PdfPreview,
  type RenderClient,
} from '@apw-pdf/react'

export interface PreviewPaneProps {
  doc: unknown | null
  data: unknown | null
  scale?: number
  client?: RenderClient
  templateName?: string
  onPageCountChange?: (count: number) => void
}

export const PREVIEW_ASSETS = { garuda: '/assets/garuda-placeholder.png' }

export function useLastGoodPreview(doc: unknown | null, data: unknown | null): {
  effectiveDoc: unknown | null
  effectiveData: unknown
} {
  const lastGoodDoc = useRef<unknown | null>(null)
  const lastGoodData = useRef<unknown | null>(null)

  if (doc !== null && doc !== undefined) {
    lastGoodDoc.current = doc
  }
  if (data !== null && data !== undefined) {
    lastGoodData.current = data
  }

  return {
    effectiveDoc: lastGoodDoc.current,
    effectiveData: lastGoodData.current ?? {},
  }
}

export interface PreviewPagesProps {
  effectiveDoc: unknown | null
  effectiveData: unknown
  scale: number
  onPageCountChange?: (count: number) => void
}

export function PreviewPages({
  effectiveDoc,
  effectiveData,
  scale,
  onPageCountChange,
}: PreviewPagesProps) {
  if (!effectiveDoc) {
    return <div className="pdf-stage__empty">ยังไม่มีเทมเพลต</div>
  }

  return (
    <div className="pdf-stage__sheet-wrap" data-testid="pdf-stage-pages">
      <PdfPreview
        doc={effectiveDoc}
        data={effectiveData}
        scale={scale}
        debounceMs={0}
        className="pdf-stage__pages"
        pageClassName="pdf-stage__page"
        onPageCountChange={onPageCountChange}
      />
    </div>
  )
}

export function PreviewPane({
  doc,
  data,
  scale = 1,
  client,
  templateName = 'template',
  onPageCountChange,
}: PreviewPaneProps) {
  const { effectiveDoc, effectiveData } = useLastGoodPreview(doc, data)

  return (
    <ApwPdfProvider
      fontBaseUrl="/fonts"
      wasmUrl="/harfbuzz-subset.wasm"
      assets={PREVIEW_ASSETS}
      worker={client ? undefined : true}
      client={client}
    >
      <div className="preview-pane">
        <div className="preview-pane__header">
          <div className="preview-pane__title">PDF Preview</div>
          {effectiveDoc !== null && (
            <PdfDownloadButton
              doc={effectiveDoc}
              data={effectiveData}
              fileName={`${templateName}.pdf`}
              className="ui-btn ui-btn--primary"
            >
              ดาวน์โหลด PDF
            </PdfDownloadButton>
          )}
        </div>
        <div className="pdf-stage__canvas">
          <PreviewPages
            effectiveDoc={effectiveDoc}
            effectiveData={effectiveData}
            scale={scale}
            onPageCountChange={onPageCountChange}
          />
        </div>
      </div>
    </ApwPdfProvider>
  )
}
