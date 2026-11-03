import React, { useMemo } from 'react'
import type { Block, Rect } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import {
  listChildren,
  canMoveInto,
  type BlockPath,
} from '../../editor/docModel.js'
import { IconButton } from '../../ui/IconButton.js'
import { Menu, type MenuItem } from '../../ui/Menu.js'
import { UpIcon, DownIcon, CopyIcon, TrashIcon } from '../../ui/icons.js'
import { toolbarPlacement } from './overlayGeometry.js'

export const DEFAULT_TOOLBAR_SIZE = { w: 160, h: 32 }

export interface FloatingToolbarProps {
  editor: EditorState
  path: BlockPath
  box: Rect
  stage: { w: number; h: number }
  toolbarSize?: { w: number; h: number }
  onEditJson?(path: BlockPath): void
}

function getIn(obj: unknown, path: BlockPath): unknown {
  let curr: any = obj
  for (const seg of path) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined
    }
    curr = curr[seg]
  }
  return curr
}

export function FloatingToolbar({
  editor,
  path,
  box,
  stage,
  toolbarSize = DEFAULT_TOOLBAR_SIZE,
  onEditJson,
}: FloatingToolbarProps) {
  const {
    doc,
    moveSelected,
    moveSelectedInto,
    moveSelectedOut,
    duplicateSelected,
    removeSelected,
  } = editor

  const parentListPath = useMemo(() => path.slice(0, -1), [path])
  const index = path[path.length - 1]
  const parentList = useMemo(
    () => (getIn(doc, parentListPath) as Block[] | undefined) ?? [],
    [doc, parentListPath],
  )

  const isFirst = typeof index !== 'number' || index <= 0
  const isLast = typeof index !== 'number' || index >= parentList.length - 1
  const canMoveOut = parentListPath.length > 1

  let canMoveIntoPrev = false
  let targetListPath: BlockPath | null = null
  if (typeof index === 'number' && index > 0) {
    const prevBlock = parentList[index - 1]
    if (prevBlock) {
      const prevChildren = listChildren(prevBlock)
      if (prevChildren.length > 0) {
        targetListPath = [
          ...parentListPath,
          index - 1,
          ...prevChildren[prevChildren.length - 1]!.key,
        ]
        canMoveIntoPrev = canMoveInto(doc, path, targetListPath)
      }
    }
  }

  const menuItems = useMemo<MenuItem[]>(
    () => [
      {
        label: 'Move into previous',
        disabled: !canMoveIntoPrev,
        onSelect: () => {
          if (targetListPath) {
            moveSelectedInto(targetListPath)
          }
        },
      },
      {
        label: 'Move out',
        disabled: !canMoveOut,
        onSelect: () => {
          moveSelectedOut()
        },
      },
      {
        label: 'Edit JSON',
        onSelect: () => {
          onEditJson?.(path)
        },
      },
    ],
    [
      canMoveIntoPrev,
      canMoveOut,
      targetListPath,
      path,
      moveSelectedInto,
      moveSelectedOut,
      onEditJson,
    ],
  )

  const pos = toolbarPlacement(box, toolbarSize, stage)

  return (
    <div
      role="toolbar"
      aria-label="เครื่องมือบล็อก"
      data-placement={pos.placement}
      className="stage-toolbar"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <IconButton
        label="Move up"
        icon={<UpIcon size={16} />}
        disabled={isFirst}
        onClick={() => moveSelected(-1)}
      />
      <IconButton
        label="Move down"
        icon={<DownIcon size={16} />}
        disabled={isLast}
        onClick={() => moveSelected(1)}
      />
      <IconButton
        label="Duplicate"
        icon={<CopyIcon size={16} />}
        onClick={() => duplicateSelected()}
      />
      <IconButton
        label="Delete"
        icon={<TrashIcon size={16} />}
        danger
        onClick={() => removeSelected()}
      />
      <Menu label="ตัวเลือกบล็อก" items={menuItems} />
    </div>
  )
}
