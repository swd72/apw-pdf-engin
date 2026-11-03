import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import {
  clampPanels,
  defaultPanels,
  loadPanels,
  savePanels,
  DEFAULT_PANEL_LIMITS,
  type PanelState,
} from './panelSizing.js'

export interface SplitWorkspaceProps {
  storageKey: string
  left: ReactNode
  centre: ReactNode
  right: ReactNode
  leftRail?: ReactNode
  rightRail?: ReactNode
}

const FALLBACK_CONTAINER_WIDTH = 1280

function samePanels(a: PanelState, b: PanelState): boolean {
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.leftCollapsed === b.leftCollapsed &&
    a.rightCollapsed === b.rightCollapsed
  )
}

function getInitialWidth(saved: PanelState | null): number {
  const winW =
    typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : FALLBACK_CONTAINER_WIDTH
  if (saved) {
    const needed =
      (saved.leftCollapsed ? DEFAULT_PANEL_LIMITS.collapsed : saved.left) +
      (saved.rightCollapsed ? DEFAULT_PANEL_LIMITS.collapsed : saved.right) +
      DEFAULT_PANEL_LIMITS.centre
    return Math.max(winW, needed, FALLBACK_CONTAINER_WIDTH)
  }
  return winW >= 1100 ? winW : FALLBACK_CONTAINER_WIDTH
}

function readElementWidth(el: HTMLElement): number {
  if (el.clientWidth > 0) return el.clientWidth
  if (el.offsetWidth > 0) return el.offsetWidth
  if (typeof el.getBoundingClientRect === 'function') {
    const rectW = el.getBoundingClientRect().width
    if (rectW > 0) return rectW
  }
  return 0
}

export function SplitWorkspace({
  storageKey,
  left,
  centre,
  right,
  leftRail,
  rightRail,
}: SplitWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hadInitialSavedRef = useRef<boolean>(false)
  const containerWidthRef = useRef<number>(FALLBACK_CONTAINER_WIDTH)

  const [panels, setPanels] = useState<PanelState>(() => {
    const saved = loadPanels(storageKey)
    const initialW = getInitialWidth(saved)
    containerWidthRef.current = initialW
    if (saved) {
      hadInitialSavedRef.current = true
      return clampPanels(saved, initialW)
    }
    return defaultPanels(initialW)
  })

  const panelsRef = useRef<PanelState>(panels)
  panelsRef.current = panels

  const [dragging, setDragging] = useState<'left' | 'right' | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let initializedFromWidth = false

    const handleWidth = (w: number) => {
      if (w <= 0) return
      containerWidthRef.current = w

      setPanels((prev) => {
        const next =
          !initializedFromWidth && !hadInitialSavedRef.current
            ? defaultPanels(w)
            : clampPanels(prev, w)
        initializedFromWidth = true
        panelsRef.current = next
        return samePanels(prev, next) ? prev : next
      })
    }

    const measured = readElementWidth(el)
    if (measured > 0) {
      handleWidth(measured)
    }

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect?.width || readElementWidth(el)
        if (w > 0) {
          handleWidth(w)
        }
      }
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [])

  const applyAndPersist = useCallback(
    (updater: (prev: PanelState) => PanelState) => {
      setPanels((prev) => {
        const next = updater(prev)
        panelsRef.current = next
        savePanels(storageKey, next)
        return samePanels(prev, next) ? prev : next
      })
    },
    [storageKey],
  )

  const toggleLeftCollapse = useCallback(() => {
    applyAndPersist((prev) =>
      clampPanels(
        { ...prev, leftCollapsed: !prev.leftCollapsed },
        containerWidthRef.current,
        undefined,
        'left',
      ),
    )
  }, [applyAndPersist])

  const toggleRightCollapse = useCallback(() => {
    applyAndPersist((prev) =>
      clampPanels(
        { ...prev, rightCollapsed: !prev.rightCollapsed },
        containerWidthRef.current,
        undefined,
        'right',
      ),
    )
  }, [applyAndPersist])

  const handleLeftKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        toggleLeftCollapse()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const step = e.shiftKey ? 64 : 16
        const delta = e.key === 'ArrowRight' ? step : -step
        applyAndPersist((prev) =>
          clampPanels(
            {
              ...prev,
              leftCollapsed: false,
              left: prev.left + delta,
            },
            containerWidthRef.current,
            undefined,
            'left',
          ),
        )
      }
    },
    [applyAndPersist, toggleLeftCollapse],
  )

  const handleRightKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        toggleRightCollapse()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const step = e.shiftKey ? 64 : 16
        const delta = e.key === 'ArrowLeft' ? step : -step
        applyAndPersist((prev) =>
          clampPanels(
            {
              ...prev,
              rightCollapsed: false,
              right: prev.right + delta,
            },
            containerWidthRef.current,
            undefined,
            'right',
          ),
        )
      }
    },
    [applyAndPersist, toggleRightCollapse],
  )

  const startDrag = useCallback(
    (side: 'left' | 'right', e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.button !== undefined) return
      e.preventDefault()
      dragCleanupRef.current?.()

      const startX = e.clientX
      const startState = panelsRef.current
      setDragging(side)

      const onMove = (moveEvt: PointerEvent) => {
        const dx = moveEvt.clientX - startX
        const candidate: PanelState =
          side === 'left'
            ? {
                ...startState,
                leftCollapsed: false,
                left: startState.left + dx,
              }
            : {
                ...startState,
                rightCollapsed: false,
                right: startState.right - dx,
              }
        const clamped = clampPanels(
          candidate,
          containerWidthRef.current,
          undefined,
          side,
        )
        panelsRef.current = clamped
        setPanels((prev) => (samePanels(prev, clamped) ? prev : clamped))
      }

      const cleanup = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        dragCleanupRef.current = null
      }

      const onUp = () => {
        cleanup()
        setDragging(null)
        savePanels(storageKey, panelsRef.current)
      }

      dragCleanupRef.current = cleanup
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [storageKey],
  )

  const leftWidth = panels.leftCollapsed
    ? DEFAULT_PANEL_LIMITS.collapsed
    : panels.left
  const rightWidth = panels.rightCollapsed
    ? DEFAULT_PANEL_LIMITS.collapsed
    : panels.right

  return (
    <div ref={containerRef} className="split-workspace">
      <div
        data-testid="workspace-left"
        data-collapsed={panels.leftCollapsed ? 'true' : 'false'}
        className={`split-workspace__pane split-workspace__pane--left ${
          panels.leftCollapsed ? 'split-workspace__pane--collapsed' : ''
        }`}
        style={{ width: `${leftWidth}px` }}
      >
        {panels.leftCollapsed ? leftRail : left}
      </div>

      <div
        role="separator"
        aria-label="ปรับขนาดพาเนลซ้าย"
        aria-orientation="vertical"
        aria-expanded={!panels.leftCollapsed}
        aria-valuenow={leftWidth}
        aria-valuemin={DEFAULT_PANEL_LIMITS.side}
        tabIndex={0}
        className={`split-workspace__splitter ${
          dragging === 'left' ? 'split-workspace__splitter--active' : ''
        }`}
        onKeyDown={handleLeftKeyDown}
        onDoubleClick={toggleLeftCollapse}
        onPointerDown={(e) => startDrag('left', e)}
      />

      <div data-testid="workspace-centre" className="split-workspace__centre">
        {centre}
      </div>

      <div
        role="separator"
        aria-label="ปรับขนาดพาเนลขวา"
        aria-orientation="vertical"
        aria-expanded={!panels.rightCollapsed}
        aria-valuenow={rightWidth}
        aria-valuemin={DEFAULT_PANEL_LIMITS.side}
        tabIndex={0}
        className={`split-workspace__splitter ${
          dragging === 'right' ? 'split-workspace__splitter--active' : ''
        }`}
        onKeyDown={handleRightKeyDown}
        onDoubleClick={toggleRightCollapse}
        onPointerDown={(e) => startDrag('right', e)}
      />

      <div
        data-testid="workspace-right"
        data-collapsed={panels.rightCollapsed ? 'true' : 'false'}
        className={`split-workspace__pane split-workspace__pane--right ${
          panels.rightCollapsed ? 'split-workspace__pane--collapsed' : ''
        }`}
        style={{ width: `${rightWidth}px` }}
      >
        {panels.rightCollapsed ? rightRail : right}
      </div>
    </div>
  )
}
