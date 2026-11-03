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
}

const PREVIEW_ASSETS = { garuda: '/assets/garuda-placeholder.png' }

export function PreviewPane({
  doc,
  data,
  scale = 1,
  client,
  templateName = 'template',
}: PreviewPaneProps) {
  const lastGoodDoc = useRef<unknown | null>(null)
  const lastGoodData = useRef<unknown | null>(null)

  if (doc !== null && doc !== undefined) {
    lastGoodDoc.current = doc
  }
  if (data !== null && data !== undefined) {
    lastGoodData.current = data
  }

  const effectiveDoc = lastGoodDoc.current
  const effectiveData = lastGoodData.current ?? {}

  return (
    <ApwPdfProvider
      fontBaseUrl="/fonts"
      wasmUrl="/harfbuzz-subset.wasm"
      assets={PREVIEW_ASSETS}
      worker={client ? undefined : true}
      client={client}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: '#f1f3f5',
            borderBottom: '1px solid #dee2e6',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '14px' }}>PDF Preview</div>
          {effectiveDoc && (
            <PdfDownloadButton
              doc={effectiveDoc}
              data={effectiveData}
              fileName={`${templateName}.pdf`}
              style={{
                padding: '6px 12px',
                background: '#0d6efd',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              ดาวน์โหลด PDF
            </PdfDownloadButton>
          )}
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
            background: '#525659',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          {effectiveDoc ? (
            <div
              style={{
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
                background: '#fff',
                minHeight: '200px',
              }}
            >
              <PdfPreview
                doc={effectiveDoc}
                data={effectiveData}
                scale={scale}
                debounceMs={0}
              />
            </div>
          ) : (
            <div style={{ color: '#ccc', marginTop: '40px' }}>
              No template loaded
            </div>
          )}
        </div>
      </div>
    </ApwPdfProvider>
  )
}
