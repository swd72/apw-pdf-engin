import React, { useEffect, useRef } from 'react'
import { usePdf } from './usePdf.js'

export interface PdfPreviewProps {
  doc: unknown
  data: unknown
  scale?: number
  className?: string
  pageClassName?: string
  debounceMs?: number
  onPageCountChange?: (pageCount: number) => void
}

export function PdfPreview({
  doc,
  data,
  scale = 1,
  className,
  pageClassName,
  debounceMs,
  onPageCountChange,
}: PdfPreviewProps) {
  const { bytes, pageCount, status, error } = usePdf(doc, data, { debounceMs })
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const activeRenderTaskRef = useRef<{ cancel: () => void; promise: Promise<unknown> } | null>(null)
  const activeLoadingTaskRef = useRef<{ destroy: () => Promise<void> } | null>(null)
  const onPageCountRef = useRef(onPageCountChange)
  onPageCountRef.current = onPageCountChange

  useEffect(() => {
    if (status === 'ready' && typeof pageCount === 'number' && pageCount > 0) {
      onPageCountRef.current?.(pageCount)
    }
  }, [status, pageCount])

  useEffect(() => {
    if (status !== 'ready' || !bytes || !pageCount) return
    let cancelled = false
    let currentRenderTask: { cancel: () => void; promise: Promise<unknown> } | null = null
    let currentLoadingTask: { destroy: () => Promise<void> } | null = null

    void (async () => {
      // Await previous render task cancellation before reusing canvas
      if (activeRenderTaskRef.current) {
        try {
          activeRenderTaskRef.current.cancel()
        } catch {}
        try {
          await activeRenderTaskRef.current.promise
        } catch (err: any) {
          if (err?.name !== 'RenderingCancelledException') {
            // ignore cancellation
          }
        }
      }
      if (cancelled) return

      try {
        const pdfjsLib = await import('pdfjs-dist')
        if (cancelled) return

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(bytes),
          isEvalSupported: false,
        })
        currentLoadingTask = loadingTask
        activeLoadingTaskRef.current = loadingTask

        let pdfDoc: any
        try {
          pdfDoc = await loadingTask.promise
        } catch (err: any) {
          if (cancelled || err?.name === 'RenderingCancelledException') return
          throw err
        }
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
          if (cancelled) break

          const viewport = page.getViewport({ scale })
          canvas.width = Math.round(viewport.width)
          canvas.height = Math.round(viewport.height)

          const renderTask = page.render({
            canvasContext: ctx,
            viewport,
          })
          currentRenderTask = renderTask
          activeRenderTaskRef.current = renderTask

          try {
            await renderTask.promise
          } catch (err: any) {
            if (err?.name === 'RenderingCancelledException') {
              return
            }
            throw err
          } finally {
            if (activeRenderTaskRef.current === renderTask) {
              activeRenderTaskRef.current = null
            }
            currentRenderTask = null
          }
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('[apw-pdf] preview render failed', err)
        }
      } finally {
        activeLoadingTaskRef.current = null
        currentLoadingTask = null
      }
    })()

    return () => {
      cancelled = true
      if (currentRenderTask) {
        try {
          currentRenderTask.cancel()
        } catch {}
      }
      if (currentLoadingTask) {
        try {
          void currentLoadingTask.destroy()
        } catch {}
      }
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
            className={pageClassName}
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
