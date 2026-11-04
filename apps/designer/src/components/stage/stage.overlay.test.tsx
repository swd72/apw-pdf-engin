// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import type { Block, DocumentDef, PageInfo } from '@apw-pdf/core'
import type { RenderClient, RenderResponse } from '@apw-pdf/react'
import { useEditorState, type EditorState } from '../../editor/useEditorState.js'
import { StageOverlay } from './StageOverlay.js'
import { PdfStage } from './PdfStage.js'

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn(async () => ({
        getViewport: vi.fn(() => ({ width: 100, height: 100 })),
        render: vi.fn(() => ({
          promise: Promise.resolve(),
          cancel: vi.fn(),
        })),
      })),
      destroy: vi.fn(async () => {}),
    }),
    destroy: vi.fn(async () => {}),
  })),
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createDoc(blocks: Block[]): DocumentDef {
  return {
    version: 1,
    page: {
      size: 'A4',
      margin: { top: '2cm', bottom: '2cm', left: '3cm', right: '2cm' },
    },
    font: { family: 'Sarabun', size: '16pt' },
    blocks,
  }
}

const EMPTY_DATA: Record<string, unknown> = {}
const NOOP = () => {}

const BASE_PAGE: PageInfo = {
  width: 595,
  height: 842,
  content: { x: 85, y: 56, w: 453, h: 730 },
  boxes: [
    { path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 },
    { path: 'blocks[1].blocks[0]', x: 85, y: 100, w: 453, h: 20 },
    { path: 'blocks[1].blocks[0]', x: 85, y: 130, w: 453, h: 20 },
  ],
}

function OverlayHarness({
  initialDoc,
  page = BASE_PAGE,
  scale = 1,
  showGuides = true,
  onState,
}: {
  initialDoc: DocumentDef
  page?: PageInfo
  scale?: number
  showGuides?: boolean
  onState?: (s: EditorState) => void
}) {
  const initial = React.useMemo(
    () => ({ doc: initialDoc, data: EMPTY_DATA }),
    [initialDoc],
  )
  const editor = useEditorState(initial, NOOP)
  onState?.(editor)
  return (
    <StageOverlay
      pageIndex={0}
      scale={scale}
      page={page}
      editor={editor}
      showGuides={showGuides}
    />
  )
}

describe('StageOverlay and PdfStage guides/sync', () => {
  let store: Map<string, string>

  beforeEach(() => {
    vi.useFakeTimers()
    store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
    })
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => ''
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {}
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-stage-overlay')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('hover shows outline and Thai badge', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'บรรทัดแรก' },
      {
        type: 'each',
        of: 'xs',
        as: 'x',
        blocks: [{ type: 'paragraph', text: '{{x}}' }],
      },
    ])

    const { container, queryByText } = render(
      <OverlayHarness initialDoc={doc} />,
    )

    const boxes = container.querySelectorAll<HTMLElement>('.stage-box')
    expect(boxes.length).toBe(3)
    const firstBox = boxes[0]!

    expect(firstBox.classList.contains('stage-box--hover')).toBe(false)
    expect(queryByText('ข้อความ')).toBeNull()

    fireEvent.mouseEnter(firstBox)
    expect(firstBox.classList.contains('stage-box--hover')).toBe(true)
    expect(queryByText('ข้อความ')).not.toBeNull()

    fireEvent.mouseLeave(firstBox)
    expect(firstBox.classList.contains('stage-box--hover')).toBe(false)

    // Hovering a box inside an each loop shows "<label> · ซ้ำตาม <of>"
    const loopBox = boxes[1]!
    fireEvent.mouseEnter(loopBox)
    expect(loopBox.classList.contains('stage-box--hover')).toBe(true)
    expect(queryByText('ข้อความ · ซ้ำตาม xs')).not.toBeNull()
  })

  it('click selects block', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'บรรทัดแรก' },
      {
        type: 'each',
        of: 'xs',
        as: 'x',
        blocks: [{ type: 'paragraph', text: '{{x}}' }],
      },
    ])
    let latestEditor: EditorState | null = null

    const { container } = render(
      <OverlayHarness
        initialDoc={doc}
        onState={(s) => {
          latestEditor = s
        }}
      />,
    )

    const firstBox = container.querySelector<HTMLElement>(
      '[data-block-path="blocks.0"]',
    )!
    fireEvent.click(firstBox)

    expect(latestEditor!.selectedPath).toEqual(['blocks', 0])
    expect(firstBox.classList.contains('stage-box--selected')).toBe(true)
  })

  it('looped block highlights all instances', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'บรรทัดแรก' },
      {
        type: 'each',
        of: 'xs',
        as: 'x',
        blocks: [{ type: 'paragraph', text: '{{x}}' }],
      },
    ])
    let latestEditor: EditorState | null = null

    const { container } = render(
      <OverlayHarness
        initialDoc={doc}
        onState={(s) => {
          latestEditor = s
        }}
      />,
    )

    const loopBoxes = container.querySelectorAll<HTMLElement>(
      '[data-block-path="blocks.1.blocks.0"]',
    )
    expect(loopBoxes.length).toBe(2)

    fireEvent.click(loopBoxes[0]!)
    expect(latestEditor!.selectedPath).toEqual(['blocks', 1, 'blocks', 0])
    expect(loopBoxes[0]!.classList.contains('stage-box--selected')).toBe(true)
    expect(loopBoxes[1]!.classList.contains('stage-box--selected')).toBe(true)
  })

  it('click on empty overlay clears selection', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'บรรทัดแรก' }])
    let latestEditor: EditorState | null = null

    const { container } = render(
      <OverlayHarness
        initialDoc={doc}
        onState={(s) => {
          latestEditor = s
        }}
      />,
    )

    const firstBox = container.querySelector<HTMLElement>('.stage-box')!
    fireEvent.click(firstBox)
    expect(latestEditor!.selectedPath).toEqual(['blocks', 0])

    const overlay = container.querySelector<HTMLElement>('.stage-overlay')!
    fireEvent.click(overlay)
    expect(latestEditor!.selectedPath).toBeNull()
  })

  it('boxes scale with zoom', () => {
    const doc = createDoc([{ type: 'paragraph', text: 'บรรทัดแรก' }])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [{ path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 }],
    }

    const { container } = render(
      <OverlayHarness initialDoc={doc} page={page} scale={2} />,
    )

    const box = container.querySelector<HTMLElement>('.stage-box')!
    expect(box.style.left).toBe(`${2 * 85}px`)
    expect(box.style.top).toBe(`${2 * 60}px`)
    expect(box.style.width).toBe(`${2 * 453}px`)
    expect(box.style.height).toBe(`${2 * 24}px`)
  })

  it('guides toggle shows content rect and persists', async () => {
    const doc = createDoc([{ type: 'paragraph', text: 'บรรทัดแรก' }])
    const client: RenderClient = {
      render: vi.fn(
        async (): Promise<RenderResponse> => ({
          id: 1,
          ok: true,
          bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
          pageCount: 1,
          warnings: [],
          pages: [BASE_PAGE],
        }),
      ),
      dispose: vi.fn(),
    }

    function StageWithEditor() {
      const initial = React.useMemo(
        () => ({ doc, data: EMPTY_DATA }),
        [],
      )
      const editor = useEditorState(initial, NOOP)
      return (
        <PdfStage
          doc={doc}
          data={EMPTY_DATA}
          client={client}
          editor={editor}
        />
      )
    }

    const { container, getByLabelText, unmount } = render(<StageWithEditor />)

    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    expect(container.querySelector('.stage-guides')).not.toBeNull()
    const toggleBtn = getByLabelText('เส้นขอบกระดาษ')
    fireEvent.click(toggleBtn)

    expect(container.querySelector('.stage-guides')).toBeNull()
    expect(localStorage.getItem('apw-designer-guides')).toBe('0')

    unmount()

    const remounted = render(<StageWithEditor />)
    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    expect(remounted.container.querySelector('.stage-guides')).toBeNull()
  })

  it('overlay waits for matching pages (Review Focus 3)', async () => {
    const doc1 = createDoc([{ type: 'paragraph', text: 'หน้าเดียว' }])
    const doc2 = createDoc([
      { type: 'paragraph', text: 'หน้าที่หนึ่ง' },
      { type: 'image', src: 'asset:garuda' },
    ])

    const pages1: PageInfo[] = [
      {
        width: 595,
        height: 842,
        content: { x: 85, y: 56, w: 453, h: 730 },
        boxes: [{ path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 }],
      },
    ]

    const mismatchedPages2: PageInfo[] = [
      {
        width: 595,
        height: 842,
        content: { x: 85, y: 56, w: 453, h: 730 },
        boxes: [{ path: 'blocks[1]', x: 85, y: 60, w: 100, h: 100 }],
      },
      {
        width: 595,
        height: 842,
        content: { x: 85, y: 56, w: 453, h: 730 },
        boxes: [{ path: 'blocks[1]', x: 85, y: 60, w: 100, h: 100 }],
      },
    ]

    let resolveSecondRender: ((res: RenderResponse) => void) | null = null
    let callCount = 0

    const client: RenderClient = {
      render: vi.fn((): Promise<RenderResponse> => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve<RenderResponse>({
            id: 1,
            ok: true,
            bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
            pageCount: 1,
            warnings: [],
            pages: pages1,
          })
        }
        return new Promise<RenderResponse>((resolve) => {
          resolveSecondRender = resolve
        })
      }),
      dispose: vi.fn(),
    }

    function Harness({ currentDoc }: { currentDoc: DocumentDef }) {
      const initial = React.useMemo(
        () => ({ doc: currentDoc, data: EMPTY_DATA }),
        [currentDoc],
      )
      const editor = useEditorState(initial, NOOP)
      return (
        <PdfStage
          doc={currentDoc}
          data={EMPTY_DATA}
          client={client}
          editor={editor}
        />
      )
    }

    const { container, rerender } = render(<Harness currentDoc={doc1} />)

    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    expect(container.querySelectorAll('canvas').length).toBe(1)
    expect(
      container.querySelector('[data-block-path="blocks.0"]'),
    ).not.toBeNull()

    // Trigger doc change; while second render is in flight, previous pages stay with the 1 canvas
    rerender(<Harness currentDoc={doc2} />)

    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    expect(container.querySelectorAll('canvas').length).toBe(1)
    expect(
      container.querySelector('[data-block-path="blocks.0"]'),
    ).not.toBeNull()
    expect(container.querySelector('[data-block-path="blocks.1"]')).toBeNull()

    // Resolve with mismatched pageCount (1 canvas) vs pages length (2 pages)
    await act(async () => {
      resolveSecondRender?.({
        id: 2,
        ok: true,
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        pageCount: 1,
        warnings: [],
        pages: mismatchedPages2,
      })
    })

    expect(container.querySelectorAll('canvas').length).toBe(1)
    expect(
      container.querySelector('[data-block-path="blocks.0"]'),
    ).not.toBeNull()
    expect(container.querySelector('[data-block-path="blocks.1"]')).toBeNull()
  })

  it('orders larger parent boxes before smaller nested boxes so nested boxes sit on top', () => {
    const doc = createDoc([
      {
        type: 'columns',
        columns: [
          { width: '50%', blocks: [{ type: 'paragraph', text: 'ซ้าย' }] },
          { width: '50%', blocks: [{ type: 'paragraph', text: 'ขวา' }] },
        ],
      },
    ])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [
        { path: 'blocks[0].columns[0].blocks[0]', x: 85, y: 60, w: 200, h: 20 },
        { path: 'blocks[0]', x: 85, y: 60, w: 453, h: 80 },
      ],
    }

    const { container } = render(<OverlayHarness initialDoc={doc} page={page} />)
    const boxes = container.querySelectorAll<HTMLElement>('.stage-box')
    expect(boxes.length).toBe(2)
    expect(boxes[0]!.getAttribute('data-block-path')).toBe('blocks.0')
    expect(boxes[1]!.getAttribute('data-block-path')).toBe(
      'blocks.0.columns.0.blocks.0',
    )
  })

  it('scrolls stage when selection changes from outside the overlay, not when clicked on the overlay', async () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'บน' },
      { type: 'paragraph', text: 'ล่าง' },
    ])
    const tallPage: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [
        { path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 },
        { path: 'blocks[1]', x: 85, y: 700, w: 453, h: 24 },
      ],
    }
    const client: RenderClient = {
      render: vi.fn(
        async (): Promise<RenderResponse> => ({
          id: 1,
          ok: true,
          bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
          pageCount: 1,
          warnings: [],
          pages: [tallPage],
        }),
      ),
      dispose: vi.fn(),
    }

    let latestEditor: EditorState | null = null
    function StageHarness() {
      const initial = React.useMemo(
        () => ({ doc, data: EMPTY_DATA }),
        [],
      )
      const editor = useEditorState(initial, NOOP)
      latestEditor = editor
      return (
        <PdfStage
          doc={doc}
          data={EMPTY_DATA}
          client={client}
          editor={editor}
        />
      )
    }

    const { container } = render(<StageHarness />)
    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    const canvasWrap = container.querySelector<HTMLElement>(
      '.pdf-stage__canvas',
    )!
    Object.defineProperty(canvasWrap, 'clientHeight', {
      value: 300,
      configurable: true,
    })
    canvasWrap.scrollTop = 0

    // Clicking on the overlay itself must NOT scroll
    const bottomBox = container.querySelector<HTMLElement>(
      '[data-block-path="blocks.1"]',
    )!
    fireEvent.click(bottomBox)
    expect(canvasWrap.scrollTop).toBe(0)

    // Clear selection and select from outside (e.g. outline click) -> scrolls into view
    act(() => {
      latestEditor!.select(null)
    })
    act(() => {
      latestEditor!.select(['blocks', 1])
    })
    expect(canvasWrap.scrollTop).toBeGreaterThan(0)
  })

  it('shows PDF ไม่ได้อัปเดต alert and hides .stage-box, toolbar and inline editor when preview reports error with pages from an earlier render; boxes return on ready', async () => {
    const doc1 = createDoc([{ type: 'paragraph', text: 'ย่อหน้าแรก' }])
    const doc2 = createDoc([{ type: 'paragraph', text: '{{p}}' }])
    const doc3 = createDoc([{ type: 'paragraph', text: 'แก้ไขสำเร็จ' }])

    const pages1: PageInfo[] = [
      {
        width: 595,
        height: 842,
        content: { x: 85, y: 56, w: 453, h: 730 },
        boxes: [{ path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 }],
      },
    ]

    let callCount = 0
    const client: RenderClient = {
      render: vi.fn(async (): Promise<RenderResponse> => {
        callCount++
        if (callCount === 1) {
          return {
            id: 1,
            ok: true,
            bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
            pageCount: 1,
            warnings: [],
            pages: pages1,
          }
        }
        if (callCount === 2) {
          return {
            id: 2,
            ok: false,
            error: {
              code: 'MISSING_VARIABLE',
              message: 'Missing variable "p"',
            },
          }
        }
        return {
          id: 3,
          ok: true,
          bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
          pageCount: 1,
          warnings: [],
          pages: pages1,
        }
      }),
      dispose: vi.fn(),
    }

    function StaleStageHarness({ currentDoc }: { currentDoc: DocumentDef }) {
      const initial = React.useMemo(
        () => ({ doc: currentDoc, data: EMPTY_DATA }),
        [currentDoc],
      )
      const editor = useEditorState(initial, NOOP)
      return (
        <PdfStage
          doc={currentDoc}
          data={EMPTY_DATA}
          client={client}
          editor={editor}
        />
      )
    }

    const { container, rerender, queryByRole } = render(
      <StaleStageHarness currentDoc={doc1} />,
    )

    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    // First render succeeded: 1 box, guides visible, no alert
    expect(container.querySelectorAll('.stage-box').length).toBe(1)
    expect(container.querySelector('.stage-guides')).not.toBeNull()
    expect(queryByRole('alert')).toBeNull()

    // Select the box so toolbar appears
    fireEvent.click(container.querySelector<HTMLElement>('.stage-box')!)
    expect(container.querySelector('.stage-toolbar')).not.toBeNull()

    // Second render fails while old bytes/pages remain on screen
    rerender(<StaleStageHarness currentDoc={doc2} />)
    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    const alertEl = queryByRole('alert')
    expect(alertEl).not.toBeNull()
    expect(alertEl!.textContent).toBe(
      'PDF ไม่ได้อัปเดต — Missing variable "p"',
    )
    expect(container.querySelectorAll('.stage-box').length).toBe(0)
    expect(container.querySelector('.stage-toolbar')).toBeNull()
    expect(container.querySelector('.stage-inline-editor')).toBeNull()
    // Guides may stay
    expect(container.querySelector('.stage-guides')).not.toBeNull()

    // Third render succeeds -> alert disappears and boxes return
    rerender(<StaleStageHarness currentDoc={doc3} />)
    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    expect(queryByRole('alert')).toBeNull()
    expect(container.querySelectorAll('.stage-box').length).toBe(1)
  })
})
