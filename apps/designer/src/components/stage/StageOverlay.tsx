import React, { useMemo, useState } from 'react'
import type { BlockBox, PageInfo } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import { getBlock, type BlockPath } from '../../editor/docModel.js'
import { blockMeta } from '../cards/blockMeta.js'
import { pathKey, resolveSelection } from './sourcePath.js'
import { hitOrder, scaleRect } from './overlayGeometry.js'
import { FloatingToolbar } from './FloatingToolbar.js'

export interface StageOverlayProps {
  pageIndex: number
  scale: number
  page: PageInfo
  editor: EditorState
  showGuides?: boolean
  showToolbar?: boolean
  editing?: boolean
  onEditJson?(path: BlockPath): void
  onSelectFromOverlay?(path: BlockPath | null): void
}

export function StageOverlay({
  pageIndex,
  scale,
  page,
  editor,
  showGuides = true,
  showToolbar = true,
  editing = false,
  onEditJson,
  onSelectFromOverlay,
}: StageOverlayProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const selectedKey = pathKey(editor.selectedPath)

  const firstSelectedBox = useMemo<{
    box: BlockBox
    blockPath: BlockPath
  } | null>(() => {
    if (!selectedKey) return null
    for (const box of page.boxes) {
      const resolved = resolveSelection(editor.doc, box.path)
      if (resolved && pathKey(resolved.blockPath) === selectedKey) {
        return { box, blockPath: resolved.blockPath }
      }
    }
    return null
  }, [page.boxes, editor.doc, selectedKey])

  const orderedBoxes = useMemo(() => hitOrder(page.boxes), [page.boxes])

  const contentRect = useMemo(
    () => scaleRect(page.content, scale),
    [page.content, scale],
  )

  const stageSize = useMemo(
    () => ({ w: page.width * scale, h: page.height * scale }),
    [page.width, page.height, scale],
  )

  const scaledSelectedBox = useMemo(
    () => (firstSelectedBox ? scaleRect(firstSelectedBox.box, scale) : null),
    [firstSelectedBox, scale],
  )

  return (
    <div
      className="stage-overlay"
      data-page-index={pageIndex}
      onClick={() => {
        onSelectFromOverlay?.(null)
        editor.select(null)
      }}
    >
      {showGuides && (
        <div
          className="stage-guides"
          style={{
            left: `${contentRect.x}px`,
            top: `${contentRect.y}px`,
            width: `${contentRect.w}px`,
            height: `${contentRect.h}px`,
          }}
        />
      )}

      {orderedBoxes.map((box, idx) => {
        const resolved = resolveSelection(editor.doc, box.path)
        if (!resolved) return null
        const block = getBlock(editor.doc, resolved.blockPath)
        if (!block) return null

        const label = blockMeta(block.type).label
        const bKey = pathKey(resolved.blockPath)
        const isSelected = Boolean(selectedKey) && bKey === selectedKey
        const isHovered = hoveredIndex === idx
        const rect = scaleRect(box, scale)

        const classes = [
          'stage-box',
          isHovered ? 'stage-box--hover' : '',
          isSelected ? 'stage-box--selected' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div
            key={`${box.path}-${idx}`}
            role="button"
            aria-label={label}
            tabIndex={-1}
            data-block-path={bKey}
            data-source-path={box.path}
            className={classes}
            style={{
              left: `${rect.x}px`,
              top: `${rect.y}px`,
              width: `${rect.w}px`,
              height: `${rect.h}px`,
            }}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() =>
              setHoveredIndex((prev) => (prev === idx ? null : prev))
            }
            onClick={(e) => {
              e.stopPropagation()
              onSelectFromOverlay?.(resolved.blockPath)
              editor.select(resolved.blockPath)
            }}
          >
            {isHovered && <span className="stage-box__badge">{label}</span>}
          </div>
        )
      })}

      {showToolbar && !editing && firstSelectedBox && scaledSelectedBox && (
        <FloatingToolbar
          editor={editor}
          path={firstSelectedBox.blockPath}
          box={scaledSelectedBox}
          stage={stageSize}
          onEditJson={onEditJson}
        />
      )}
    </div>
  )
}
