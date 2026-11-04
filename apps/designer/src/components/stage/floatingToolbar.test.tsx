// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { Block, DocumentDef, PageInfo } from '@apw-pdf/core'
import { useEditorState, type EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'
import { toolbarPlacement } from './overlayGeometry.js'
import { StageOverlay } from './StageOverlay.js'

afterEach(() => {
  cleanup()
})

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

function ToolbarHarness({
  initialDoc,
  page,
  initialSelected,
  editing = false,
  onEditJson,
  onState,
}: {
  initialDoc: DocumentDef
  page: PageInfo
  initialSelected: BlockPath | null
  editing?: boolean
  onEditJson?: (path: BlockPath) => void
  onState?: (s: EditorState) => void
}) {
  const initial = React.useMemo(
    () => ({ doc: initialDoc, data: EMPTY_DATA }),
    [initialDoc],
  )
  const editor = useEditorState(initial, NOOP)
  const initializedRef = React.useRef(false)
  React.useEffect(() => {
    if (!initializedRef.current && initialSelected) {
      initializedRef.current = true
      editor.select(initialSelected)
    }
  }, [editor, initialSelected])
  onState?.(editor)

  return (
    <StageOverlay
      pageIndex={0}
      scale={1}
      page={page}
      editor={editor}
      editing={editing}
      onEditJson={onEditJson}
    />
  )
}

describe('FloatingToolbar and toolbarPlacement', () => {
  it('places toolbar above when there is room, flips below at top edge, and clamps at right edge', () => {
    const above = toolbarPlacement(
      { x: 80, y: 100, w: 200, h: 24 },
      { w: 160, h: 32 },
      { w: 595, h: 842 },
    )
    expect(above).toEqual({ x: 80, y: 64, placement: 'above' })

    const below = toolbarPlacement(
      { x: 80, y: 20, w: 200, h: 24 },
      { w: 160, h: 32 },
      { w: 595, h: 842 },
    )
    expect(below).toEqual({ x: 80, y: 48, placement: 'below' })

    const clampedRight = toolbarPlacement(
      { x: 500, y: 100, w: 80, h: 24 },
      { w: 160, h: 32 },
      { w: 595, h: 842 },
    )
    expect(clampedRight).toEqual({ x: 435, y: 64, placement: 'above' })
  })

  it('clicking เลื่อนขึ้น, เลื่อนลง, ทำสำเนา, ลบ calls the editor and keeps selection as editor defines', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'แรก' },
      { type: 'paragraph', text: 'สอง' },
    ])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [
        { path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 },
        { path: 'blocks[1]', x: 85, y: 100, w: 453, h: 24 },
        { path: 'blocks[2]', x: 85, y: 140, w: 453, h: 24 },
      ],
    }

    let latestEditor: EditorState | null = null
    const { getByLabelText } = render(
      <ToolbarHarness
        initialDoc={doc}
        page={page}
        initialSelected={['blocks', 1]}
        onState={(s) => {
          latestEditor = s
        }}
      />,
    )

    fireEvent.click(getByLabelText('เลื่อนขึ้น'))
    expect(latestEditor!.selectedPath).toEqual(['blocks', 0])
    expect((latestEditor!.doc.blocks[0] as any).text).toBe('สอง')

    fireEvent.click(getByLabelText('เลื่อนลง'))
    expect(latestEditor!.selectedPath).toEqual(['blocks', 1])
    expect((latestEditor!.doc.blocks[1] as any).text).toBe('สอง')

    fireEvent.click(getByLabelText('ทำสำเนา'))
    expect(latestEditor!.doc.blocks.length).toBe(3)
    expect(latestEditor!.selectedPath).toEqual(['blocks', 2])

    fireEvent.click(getByLabelText('ลบ'))
    expect(latestEditor!.doc.blocks.length).toBe(2)
    expect(latestEditor!.selectedPath).toEqual(['blocks', 1])
  })

  it('more menu holds ย้ายเข้าบล็อกก่อนหน้า (disabled when canMoveInto is false), ย้ายออกนอกกลุ่ม, and แก้ JSON', () => {
    const doc = createDoc([
      { type: 'paragraph', text: 'ย่อหน้าทั่วไป' },
      {
        type: 'each',
        of: 'xs',
        as: 'x',
        blocks: [{ type: 'paragraph', text: 'ในลูป' }],
      },
      { type: 'paragraph', text: 'หลังลูป' },
    ])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [
        { path: 'blocks[0]', x: 85, y: 60, w: 453, h: 24 },
        { path: 'blocks[1].blocks[0]', x: 85, y: 100, w: 453, h: 24 },
        { path: 'blocks[2]', x: 85, y: 140, w: 453, h: 24 },
      ],
    }

    const onEditJson = vi.fn()
    let latestEditor: EditorState | null = null

    const { getByLabelText } = render(
      <ToolbarHarness
        initialDoc={doc}
        page={page}
        initialSelected={['blocks', 0]}
        onEditJson={onEditJson}
        onState={(s) => {
          latestEditor = s
        }}
      />,
    )

    // On blocks[0], ย้ายเข้าบล็อกก่อนหน้า and ย้ายออกนอกกลุ่ม are both disabled
    fireEvent.click(getByLabelText('ตัวเลือกบล็อก'))
    const moveIntoBtn = getByLabelText('ย้ายเข้าบล็อกก่อนหน้า') as HTMLButtonElement
    const moveOutBtn = getByLabelText('ย้ายออกนอกกลุ่ม') as HTMLButtonElement
    expect(moveIntoBtn.disabled).toBe(true)
    expect(moveOutBtn.disabled).toBe(true)

    // แก้ JSON calls onEditJson(path)
    fireEvent.click(getByLabelText('แก้ JSON'))
    expect(onEditJson).toHaveBeenCalledWith(['blocks', 0])

    // Select blocks[2] (after each block) -> ย้ายเข้าบล็อกก่อนหน้า is enabled
    const box2 = document.querySelector<HTMLElement>(
      '[data-block-path="blocks.2"]',
    )!
    fireEvent.click(box2)
    fireEvent.click(getByLabelText('ตัวเลือกบล็อก'))
    const moveIntoBtn2 = getByLabelText(
      'ย้ายเข้าบล็อกก่อนหน้า',
    ) as HTMLButtonElement
    expect(moveIntoBtn2.disabled).toBe(false)
    fireEvent.click(moveIntoBtn2)
    expect(latestEditor!.selectedPath).toEqual(['blocks', 1, 'blocks', 1])

    // Select blocks[1].blocks[0] -> ย้ายออกนอกกลุ่ม is enabled
    const nestedBox = document.querySelector<HTMLElement>(
      '[data-block-path="blocks.1.blocks.0"]',
    )!
    fireEvent.click(nestedBox)
    fireEvent.click(getByLabelText('ตัวเลือกบล็อก'))
    const moveOutBtn2 = getByLabelText('ย้ายออกนอกกลุ่ม') as HTMLButtonElement
    expect(moveOutBtn2.disabled).toBe(false)
    fireEvent.click(moveOutBtn2)
    expect(latestEditor!.selectedPath).toEqual(['blocks', 2])
  })

  it('disables ย้ายออกนอกกลุ่ม with tooltip when block inside loop references loop variable {{p}}', () => {
    const doc = createDoc([
      {
        type: 'each',
        of: 'body',
        as: 'p',
        blocks: [{ type: 'paragraph', text: '{{p}}' }],
      },
    ])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [
        { path: 'blocks[0].blocks[0]', x: 85, y: 100, w: 453, h: 20 },
      ],
    }

    const { getByLabelText } = render(
      <ToolbarHarness
        initialDoc={doc}
        page={page}
        initialSelected={['blocks', 0, 'blocks', 0]}
      />,
    )

    fireEvent.click(getByLabelText('ตัวเลือกบล็อก'))
    const moveOutBtn = getByLabelText('ย้ายออกนอกกลุ่ม') as HTMLButtonElement
    expect(moveOutBtn.disabled).toBe(true)
    expect(moveOutBtn.getAttribute('title')).toBe(
      'ใช้ตัวแปร {{p}} ของลูป body — ย้ายออกนอกลูปไม่ได้',
    )
  })

  it('renders toolbar only on the first box of the selected block and hides while inline editing', () => {
    const doc = createDoc([
      {
        type: 'each',
        of: 'xs',
        as: 'x',
        blocks: [{ type: 'paragraph', text: '{{x}}' }],
      },
    ])
    const page: PageInfo = {
      width: 595,
      height: 842,
      content: { x: 85, y: 56, w: 453, h: 730 },
      boxes: [
        { path: 'blocks[0].blocks[0]', x: 85, y: 100, w: 453, h: 20 },
        { path: 'blocks[0].blocks[0]', x: 85, y: 200, w: 453, h: 20 },
      ],
    }

    const { container, rerender } = render(
      <ToolbarHarness
        initialDoc={doc}
        page={page}
        initialSelected={['blocks', 0, 'blocks', 0]}
      />,
    )

    const toolbars = container.querySelectorAll<HTMLElement>('.stage-toolbar')
    expect(toolbars.length).toBe(1)
    expect(toolbars[0]!.style.top).toBe(`${100 - 32 - 4}px`)

    rerender(
      <ToolbarHarness
        initialDoc={doc}
        page={page}
        initialSelected={['blocks', 0, 'blocks', 0]}
        editing={true}
      />,
    )

    expect(container.querySelector('.stage-toolbar')).toBeNull()
  })
})
