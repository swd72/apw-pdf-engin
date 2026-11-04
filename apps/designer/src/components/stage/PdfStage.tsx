import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react'
import type { PageInfo } from '@apw-pdf/core'
import {
  ApwPdfProvider,
  PdfDownloadButton,
  type PdfPreviewProps,
  type RenderClient,
} from '@apw-pdf/react'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'
import { IconButton } from '../../ui/IconButton.js'
import { Menu, type MenuItem } from '../../ui/Menu.js'
import {
  PlusIcon,
  MinusIcon,
  FitWidthIcon,
  DownloadIcon,
  GuidesIcon,
  UndoIcon,
  RedoIcon,
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
import { StageOverlay } from './StageOverlay.js'
import { pathKey, resolveSelection } from './sourcePath.js'

export { STAGE_PADDING }

const GUIDES_STORAGE_KEY = 'apw-designer-guides'

function readGuidesPref(): boolean {
  try {
    const v = window.localStorage.getItem(GUIDES_STORAGE_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    // ignore storage errors
  }
  return true
}

function writeGuidesPref(show: boolean): void {
  try {
    window.localStorage.setItem(GUIDES_STORAGE_KEY, show ? '1' : '0')
  } catch {
    // ignore storage errors
  }
}

export interface PdfStageProps {
  doc: unknown | null
  data: unknown | null
  templateName?: string
  client?: RenderClient
  editor?: EditorState
  onEditJson?(path: BlockPath): void
  onFocusProperties?(): void
}

export function PdfStage({
  doc,
  data,
  templateName = 'template',
  client,
  editor,
  onEditJson,
  onFocusProperties,
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
  const [pages, setPages] = useState<PageInfo[]>([])
  const pendingPagesRef = useRef<PageInfo[] | null>(null)
  const [showGuides, setShowGuides] = useState<boolean>(() => readGuidesPref())
  const [hasRendered, setHasRendered] = useState(false)
  const [staleError, setStaleError] = useState<{
    code: string
    message: string
  } | null>(null)
  const selectedFromOverlayRef = useRef<string | null>(null)
  const lastScrolledKeyRef = useRef<string | null>(null)

  const isStaleError = (hasRendered || pages.length > 0) && staleError !== null

  const handleStatusChange = useCallback<
    NonNullable<PdfPreviewProps['onStatusChange']>
  >((status, err) => {
    if (status === 'ready') {
      setHasRendered(true)
      setStaleError(null)
    } else if (status === 'error' && err) {
      setStaleError(err)
    }
  }, [])

  const pageSize = useMemo(() => pageSizePt(effectiveDoc), [effectiveDoc])

  const handleToggleGuides = useCallback(() => {
    setShowGuides((prev) => {
      const next = !prev
      writeGuidesPref(next)
      return next
    })
  }, [])

  const handleSelectFromOverlay = useCallback((path: BlockPath | null) => {
    selectedFromOverlayRef.current = path ? pathKey(path) : '__null__'
  }, [])

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

  const handlePagesChange = useCallback(
    (nextPages: PageInfo[]) => {
      pendingPagesRef.current = nextPages
      const canvasCount =
        scrollRef.current?.querySelectorAll('canvas').length ?? 0
      const expectedCount = canvasCount > 0 ? canvasCount : pageCount
      if (nextPages.length === expectedCount) {
        setPages((prev) => (prev === nextPages ? prev : nextPages))
      }
    },
    [pageCount],
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
        const pending = pendingPagesRef.current
        if (pending && pending.length === count) {
          setPages((prev) => (prev === pending ? prev : pending))
        }
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

  const selectedKey = editor?.selectedPath ? pathKey(editor.selectedPath) : ''

  const firstSelectedPageIndex = useMemo(() => {
    if (!editor || !selectedKey || isStaleError) return -1
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const p = pages[pIdx]!
      for (const b of p.boxes) {
        const resolved = resolveSelection(editor.doc, b.path)
        if (resolved && pathKey(resolved.blockPath) === selectedKey) {
          return pIdx
        }
      }
    }
    return -1
  }, [editor?.doc, selectedKey, pages, isStaleError])

  useEffect(() => {
    if (isStaleError) return
    if (!editor || !selectedKey) {
      lastScrolledKeyRef.current = null
      selectedFromOverlayRef.current = null
      return
    }
    if (selectedFromOverlayRef.current === selectedKey) {
      lastScrolledKeyRef.current = selectedKey
      selectedFromOverlayRef.current = null
      return
    }
    if (lastScrolledKeyRef.current === selectedKey) {
      return
    }

    let matchPageIdx = -1
    let matchBox: { y: number; h: number } | null = null
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const p = pages[pIdx]!
      for (const b of p.boxes) {
        const resolved = resolveSelection(editor.doc, b.path)
        if (resolved && pathKey(resolved.blockPath) === selectedKey) {
          matchPageIdx = pIdx
          matchBox = b
          break
        }
      }
      if (matchBox) break
    }

    if (!matchBox || matchPageIdx < 0) return
    lastScrolledKeyRef.current = selectedKey

    const el = scrollRef.current
    if (!el) return
    const wrappers = el.querySelectorAll<HTMLElement>('.apw-pdf-page')
    const pageEls =
      wrappers.length > 0
        ? wrappers
        : el.querySelectorAll<HTMLElement>('canvas')
    const pageEl = pageEls[matchPageIdx]
    if (!pageEl) return

    const boxTop = pageEl.offsetTop + matchBox.y * scale
    const boxBottom = boxTop + matchBox.h * scale
    const viewTop = el.scrollTop
    const viewBottom = viewTop + el.clientHeight

    if (boxTop < viewTop || (el.clientHeight > 0 && boxBottom > viewBottom)) {
      el.scrollTop = Math.max(0, boxTop - 24)
    }
  }, [editor?.doc, selectedKey, pages, scale, isStaleError])

  const renderOverlay = useCallback<
    NonNullable<PdfPreviewProps['renderOverlay']>
  >(
    (pageIndex: number, overlayScale: number, _page: PageInfo) => {
      if (!editor) return null
      const activePage = pages[pageIndex]
      if (!activePage) return null
      return (
        <StageOverlay
          pageIndex={pageIndex}
          scale={overlayScale}
          page={activePage}
          editor={editor}
          showGuides={showGuides}
          showToolbar={!isStaleError && pageIndex === firstSelectedPageIndex}
          stale={isStaleError}
          onEditJson={onEditJson}
          onFocusProperties={onFocusProperties}
          onSelectFromOverlay={handleSelectFromOverlay}
        />
      ) as ReturnType<NonNullable<PdfPreviewProps['renderOverlay']>>
    },
    [
      editor,
      pages,
      showGuides,
      isStaleError,
      firstSelectedPageIndex,
      onEditJson,
      onFocusProperties,
      handleSelectFromOverlay,
    ],
  )

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
    const wrappers = el.querySelectorAll<HTMLElement>('.apw-pdf-page')
    const items =
      wrappers.length > 0
        ? wrappers
        : el.querySelectorAll<HTMLElement>('canvas')
    if (items.length === 0) return

    const threshold = el.scrollTop + el.clientHeight * 0.35
    let active = 1
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (item.offsetTop <= threshold) {
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
        {isStaleError && staleError && (
          <div role="alert" className="pdf-stage__stale-strip">
            {`PDF ไม่ได้อัปเดต — ${staleError.message}`}
          </div>
        )}
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
            renderOverlay={editor ? renderOverlay : undefined}
            onPagesChange={editor ? handlePagesChange : undefined}
            onStatusChange={handleStatusChange}
          />
        </div>

        <div
          role="toolbar"
          aria-label="แถบเครื่องมือตัวอย่าง PDF"
          className="pdf-stage__toolbar"
        >
          <IconButton
            label="ย้อนกลับ"
            icon={<UndoIcon />}
            disabled={!editor?.canUndo}
            onClick={() => editor?.undo()}
          />
          <IconButton
            label="ทำซ้ำ"
            icon={<RedoIcon />}
            disabled={!editor?.canRedo}
            onClick={() => editor?.redo()}
          />

          <span className="pdf-stage__divider" aria-hidden="true" />

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
          <IconButton
            label="เส้นขอบกระดาษ"
            icon={<GuidesIcon />}
            active={showGuides}
            onClick={handleToggleGuides}
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
