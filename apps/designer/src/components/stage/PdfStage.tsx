import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react'
import {
  ApwPdfProvider,
  PdfDownloadButton,
  type RenderClient,
} from '@apw-pdf/react'
import { IconButton } from '../../ui/IconButton.js'
import { Menu, type MenuItem } from '../../ui/Menu.js'
import {
  PlusIcon,
  MinusIcon,
  FitWidthIcon,
  DownloadIcon,
} from '../../ui/icons.js'
import {
  PREVIEW_ASSETS,
  PreviewPages,
  useLastGoodPreview,
} from '../PreviewPane.js'
import {
  pageSizePt,
  resolveScale,
  stepZoomPercent,
  STAGE_PADDING,
  ZOOM_PRESETS,
  type ZoomMode,
} from './zoom.js'

export { STAGE_PADDING }

export interface PdfStageProps {
  doc: unknown | null
  data: unknown | null
  templateName?: string
  client?: RenderClient
}

export function PdfStage({
  doc,
  data,
  templateName = 'template',
  client,
}: PdfStageProps) {
  const { effectiveDoc, effectiveData } = useLastGoodPreview(doc, data)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const [mode, setMode] = useState<ZoomMode>({ kind: 'fit-width' })
  const [containerSize, setContainerSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const [pageCount, setPageCount] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)

  const pageSize = useMemo(() => pageSizePt(effectiveDoc), [effectiveDoc])

  const measureContainer = useCallback(
    (entry?: ResizeObserverEntry) => {
      const el = scrollRef.current
      if (!el) return
      const w =
        el.clientWidth > 0 ? el.clientWidth : (entry?.contentRect?.width ?? 0)
      if (!Number.isFinite(w) || w <= 0) return
      const rawH =
        el.clientHeight > 0
          ? el.clientHeight
          : (entry?.contentRect?.height ?? 0)
      const h =
        Number.isFinite(rawH) && rawH > 0
          ? rawH
          : pageSize.height + STAGE_PADDING

      setContainerSize((prev) => {
        if (prev && prev.width === w && prev.height === h) {
          return prev
        }
        return { width: w, height: h }
      })
    },
    [pageSize.height],
  )

  const handlePageCountChange = useCallback(
    (count: number) => {
      if (!Number.isFinite(count) || count <= 0) return
      setPageCount((prev) => (prev === count ? prev : count))
      setCurrentPage((prev) => {
        const clamped = Math.min(Math.max(1, prev), Math.max(1, count))
        return prev === clamped ? prev : clamped
      })
      measureContainer()
    },
    [measureContainer],
  )

  const trackedClient = useMemo<RenderClient | undefined>(() => {
    if (!client) return undefined
    return {
      render: async (req) => {
        const res = await client.render(req)
        if (res.ok && typeof res.pageCount === 'number' && res.pageCount > 0) {
          handlePageCountChange(res.pageCount)
        }
        return res
      },
      dispose: () => client.dispose(),
    }
  }, [client, handlePageCountChange])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    measureContainer()

    const onWindowResize = () => {
      measureContainer()
    }
    window.addEventListener('resize', onWindowResize)

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', onWindowResize)
      }
    }

    const observer = new ResizeObserver((entries) => {
      if (entries.length === 0) {
        measureContainer()
        return
      }
      for (const entry of entries) {
        measureContainer(entry)
      }
    })
    observer.observe(el)
    if (el.firstElementChild) {
      observer.observe(el.firstElementChild)
    }
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onWindowResize)
    }
  }, [measureContainer])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof MutationObserver === 'undefined') return

    const syncCanvasCount = () => {
      const count = el.querySelectorAll('canvas').length
      if (count > 0) {
        handlePageCountChange(count)
      }
      measureContainer()
    }

    syncCanvasCount()
    const mo = new MutationObserver(syncCanvasCount)
    mo.observe(el, { childList: true, subtree: true })
    return () => {
      mo.disconnect()
    }
  }, [handlePageCountChange, measureContainer])

  const effectiveContainer = useMemo(
    () =>
      containerSize ?? {
        width: pageSize.width + STAGE_PADDING,
        height: pageSize.height + STAGE_PADDING,
      },
    [containerSize, pageSize.width, pageSize.height],
  )

  const scale = useMemo(
    () => resolveScale(mode, effectiveContainer, pageSize, STAGE_PADDING),
    [mode, effectiveContainer, pageSize],
  )

  const effectivePercent = Math.round(scale * 100)

  const handleZoomIn = useCallback(() => {
    setMode((prev) => {
      const current =
        prev.kind === 'percent' ? prev.value : Math.round(scale * 100)
      return { kind: 'percent', value: stepZoomPercent(current, 1) }
    })
  }, [scale])

  const handleZoomOut = useCallback(() => {
    setMode((prev) => {
      const current =
        prev.kind === 'percent' ? prev.value : Math.round(scale * 100)
      return { kind: 'percent', value: stepZoomPercent(current, -1) }
    })
  }, [scale])

  const handleFitWidth = useCallback(() => {
    setMode({ kind: 'fit-width' })
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const canvases = el.querySelectorAll('canvas')
    if (canvases.length === 0) return

    const threshold = el.scrollTop + el.clientHeight * 0.35
    let active = 1
    for (let i = 0; i < canvases.length; i++) {
      const c = canvases[i]!
      if (c.offsetTop <= threshold) {
        active = i + 1
      } else {
        break
      }
    }
    setCurrentPage((prev) => (prev === active ? prev : active))
  }, [])

  const zoomMenuItems = useMemo<MenuItem[]>(
    () => [
      {
        label: 'พอดีความกว้าง (Fit width)',
        onSelect: () => setMode({ kind: 'fit-width' }),
      },
      {
        label: 'พอดีหน้า (Fit page)',
        onSelect: () => setMode({ kind: 'fit-page' }),
      },
      ...ZOOM_PRESETS.map((pct) => ({
        label: `${pct}%`,
        onSelect: () => setMode({ kind: 'percent', value: pct }),
      })),
    ],
    [],
  )

  const totalPages = Math.max(1, pageCount)
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages)

  return (
    <ApwPdfProvider
      fontBaseUrl="/fonts"
      wasmUrl="/harfbuzz-subset.wasm"
      assets={PREVIEW_ASSETS}
      worker={trackedClient ? undefined : true}
      client={trackedClient}
    >
      <div className="pdf-stage">
        <div
          ref={scrollRef}
          className="pdf-stage__canvas"
          data-zoom-mode={mode.kind}
          onScroll={handleScroll}
        >
          <PreviewPages
            effectiveDoc={effectiveDoc}
            effectiveData={effectiveData}
            scale={scale}
            onPageCountChange={handlePageCountChange}
          />
        </div>

        <div
          role="toolbar"
          aria-label="แถบเครื่องมือตัวอย่าง PDF"
          className="pdf-stage__toolbar"
        >
          <IconButton
            label="ซูมออก"
            icon={<MinusIcon />}
            onClick={handleZoomOut}
          />
          <Menu
            label="โหมดซูม"
            icon={
              <span className="pdf-stage__zoom-label">{`${effectivePercent}%`}</span>
            }
            items={zoomMenuItems}
          />
          <IconButton
            label="ซูมเข้า"
            icon={<PlusIcon />}
            onClick={handleZoomIn}
          />
          <IconButton
            label="พอดีความกว้าง"
            icon={<FitWidthIcon />}
            active={mode.kind === 'fit-width'}
            onClick={handleFitWidth}
          />

          <span className="pdf-stage__divider" aria-hidden="true" />

          <span className="pdf-stage__page-indicator" aria-live="polite">
            {`หน้า ${safeCurrentPage} / ${totalPages}`}
          </span>

          {effectiveDoc !== null && (
            <>
              <span className="pdf-stage__divider" aria-hidden="true" />
              <PdfDownloadButton
                doc={effectiveDoc}
                data={effectiveData}
                fileName={`${templateName}.pdf`}
                className="ui-btn ui-btn--ghost pdf-stage__download"
              >
                <DownloadIcon size={16} />
                <span>ดาวน์โหลด PDF</span>
              </PdfDownloadButton>
            </>
          )}
        </div>
      </div>
    </ApwPdfProvider>
  )
}
