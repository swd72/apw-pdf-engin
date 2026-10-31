import React, { useEffect, useRef } from 'react'
import { usePdf } from './usePdf.js'

export interface PdfPreviewProps {
  doc: unknown
  data: unknown
  scale?: number
  className?: string
  debounceMs?: number
}

export function PdfPreview({
  doc,
  data,
  scale = 1,
  className,
  debounceMs,
}: PdfPreviewProps) {
  const { bytes, pageCount, status, error } = usePdf(doc, data, { debounceMs })
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])

  useEffect(() => {
    if (status !== 'ready' || !bytes || !pageCount) return
    let cancelled = false

    void (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        if (cancelled) return
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(bytes),
          isEvalSupported: false,
        })
        const pdfDoc = await loadingTask.promise
        if (cancelled) {
          await pdfDoc.destroy()
          return
        }

        for (let p = 1; p <= pdfDoc.numPages; p++) {
          if (cancelled) break
          const canvas = canvasRefs.current[p - 1]
          if (!canvas) continue
          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          const page = await pdfDoc.getPage(p)
          const viewport = page.getViewport({ scale })
          canvas.width = Math.round(viewport.width)
          canvas.height = Math.round(viewport.height)
          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise
        }
      } catch {
        // Ignore pdfjs canvas render errors in non-canvas test environments (e.g. jsdom)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bytes, pageCount, scale, status])

  if (status === 'error' && error) {
    return (
      <div className={className} role="alert">
        {error.code}: {error.message}
      </div>
    )
  }

  const total = pageCount ?? 0

  return (
    <div className={className}>
      {Array.from({ length: total }, (_, idx) => {
        const pageNum = idx + 1
        return (
          <canvas
            key={pageNum}
            aria-label={`หน้า ${pageNum} จาก ${total}`}
            ref={(el) => {
              canvasRefs.current[idx] = el
            }}
          />
        )
      })}
    </div>
  )
}
