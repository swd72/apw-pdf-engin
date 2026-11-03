// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { SplitWorkspace } from './SplitWorkspace.js'
import { savePanels, loadPanels } from './panelSizing.js'

describe('SplitWorkspace', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    })

    class ResizeObserverMock {
      private cb: ResizeObserverCallback
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb
      }
      observe(target: Element) {
        this.cb(
          [
            {
              target,
              contentRect: { width: 1400, height: 900 } as DOMRectReadOnly,
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        )
      }
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock)

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          width: 1400,
          height: 900,
          top: 0,
          left: 0,
          right: 1400,
          bottom: 900,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    )
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1400)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1400)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('SplitWorkspace arrow keys on a splitter resize the left pane', () => {
    const { getAllByRole, getByTestId } = render(
      <SplitWorkspace
        storageKey="ws-arrow"
        left={<div>ซ้าย</div>}
        centre={<div>กลาง</div>}
        right={<div>ขวา</div>}
      />,
    )

    const leftPane = getByTestId('workspace-left')
    const initialWidth = Number.parseInt(leftPane.style.width, 10)
    expect(initialWidth).toBeGreaterThanOrEqual(220)

    const splitters = getAllByRole('separator')
    const leftSplitter = splitters[0]!
    expect(leftSplitter.getAttribute('aria-orientation')).toBe('vertical')

    fireEvent.keyDown(leftSplitter, { key: 'ArrowRight' })
    expect(leftPane.style.width).toBe(`${initialWidth + 16}px`)

    fireEvent.keyDown(leftSplitter, { key: 'ArrowRight', shiftKey: true })
    expect(leftPane.style.width).toBe(`${initialWidth + 16 + 64}px`)

    fireEvent.keyDown(leftSplitter, { key: 'ArrowLeft' })
    expect(leftPane.style.width).toBe(`${initialWidth + 64}px`)
  })

  it('SplitWorkspace double click collapses and restores a side', () => {
    const { getAllByRole, getByTestId, queryByText } = render(
      <SplitWorkspace
        storageKey="ws-collapse"
        left={<div>เนื้อหาซ้าย</div>}
        centre={<div>กลาง</div>}
        right={<div>เนื้อหาขวา</div>}
        leftRail={<div>แถบไอคอนซ้าย</div>}
      />,
    )

    const leftPane = getByTestId('workspace-left')
    const expandedWidth = leftPane.style.width
    const leftSplitter = getAllByRole('separator')[0]!

    expect(leftPane.getAttribute('data-collapsed')).toBe('false')
    expect(leftSplitter.getAttribute('aria-expanded')).toBe('true')
    expect(queryByText('เนื้อหาซ้าย')).not.toBeNull()
    expect(queryByText('แถบไอคอนซ้าย')).toBeNull()

    fireEvent.doubleClick(leftSplitter)
    expect(leftPane.style.width).toBe('44px')
    expect(leftPane.getAttribute('data-collapsed')).toBe('true')
    expect(leftSplitter.getAttribute('aria-expanded')).toBe('false')
    expect(queryByText('เนื้อหาซ้าย')).toBeNull()
    expect(queryByText('แถบไอคอนซ้าย')).not.toBeNull()
    expect(loadPanels('ws-collapse')?.leftCollapsed).toBe(true)

    fireEvent.doubleClick(leftSplitter)
    expect(leftPane.style.width).toBe(expandedWidth)
    expect(leftPane.getAttribute('data-collapsed')).toBe('false')
    expect(leftSplitter.getAttribute('aria-expanded')).toBe('true')
    expect(queryByText('เนื้อหาซ้าย')).not.toBeNull()
    expect(queryByText('แถบไอคอนซ้าย')).toBeNull()
    expect(loadPanels('ws-collapse')?.leftCollapsed).toBe(false)
  })

  it('SplitWorkspace restores saved sizes from storage', () => {
    savePanels('ws-saved', {
      left: 312,
      right: 348,
      leftCollapsed: false,
      rightCollapsed: false,
    })

    const { getByTestId } = render(
      <SplitWorkspace
        storageKey="ws-saved"
        left={<div>ซ้าย</div>}
        centre={<div>กลาง</div>}
        right={<div>ขวา</div>}
      />,
    )

    expect(getByTestId('workspace-left').style.width).toBe('312px')
    expect(getByTestId('workspace-right').style.width).toBe('348px')
  })

  it('SplitWorkspace renders the rail when collapsed', () => {
    savePanels('ws-rail', {
      left: 260,
      right: 300,
      leftCollapsed: true,
      rightCollapsed: true,
    })

    const { getByTestId, queryByText } = render(
      <SplitWorkspace
        storageKey="ws-rail"
        left={<div>พาเนลซ้ายเต็ม</div>}
        centre={<div>กลาง</div>}
        right={<div>พาเนลขวาเต็ม</div>}
        leftRail={<div>ไอคอนซ้าย</div>}
        rightRail={<div>ไอคอนขวา</div>}
      />,
    )

    expect(getByTestId('workspace-left').style.width).toBe('44px')
    expect(getByTestId('workspace-left').getAttribute('data-collapsed')).toBe('true')
    expect(getByTestId('workspace-right').style.width).toBe('44px')
    expect(getByTestId('workspace-right').getAttribute('data-collapsed')).toBe('true')
    expect(queryByText('ไอคอนซ้าย')).not.toBeNull()
    expect(queryByText('ไอคอนขวา')).not.toBeNull()
    expect(queryByText('พาเนลซ้ายเต็ม')).toBeNull()
    expect(queryByText('พาเนลขวาเต็ม')).toBeNull()
  })
})
