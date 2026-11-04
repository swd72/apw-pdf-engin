import React, { useMemo } from 'react'
import type { Block, Rect } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import {
  getBlock,
  listChildren,
  canMoveInto,
  loopMoveGuardTitle,
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

  let outerListPath: BlockPath | null = null
  if (parentListPath.length > 1) {
    for (let k = path.length - 1; k >= 1; k--) {
      const sub = path.slice(0, k)
      if (getBlock(doc, sub)) {
        outerListPath = sub.slice(0, -1)
        break
      }
    }
  }
  const moveOutGuardTitle = outerListPath
    ? loopMoveGuardTitle(doc, path, outerListPath)
    : undefined
  const canMoveOut = parentListPath.length > 1 && !moveOutGuardTitle

  let canMoveIntoPrev = false
  let targetListPath: BlockPath | null = null
  let moveIntoPrevGuardTitle: string | undefined
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
        if (canMoveInto(doc, path, targetListPath)) {
          moveIntoPrevGuardTitle = loopMoveGuardTitle(
            doc,
            path,
            targetListPath,
          )
          canMoveIntoPrev = !moveIntoPrevGuardTitle
        }
      }
    }
  }

  const menuItems = useMemo<MenuItem[]>(
    () => [
      {
        label: 'ย้ายเข้าบล็อกก่อนหน้า',
        disabled: !canMoveIntoPrev,
        title: moveIntoPrevGuardTitle,
        onSelect: () => {
          if (targetListPath) {
            moveSelectedInto(targetListPath)
          }
        },
      },
      {
        label: 'ย้ายออกนอกกลุ่ม',
        disabled: !canMoveOut,
        title: moveOutGuardTitle,
        onSelect: () => {
          moveSelectedOut()
        },
      },
      {
        label: 'แก้ JSON',
        onSelect: () => {
          onEditJson?.(path)
        },
      },
    ],
    [
      canMoveIntoPrev,
      canMoveOut,
      moveIntoPrevGuardTitle,
      moveOutGuardTitle,
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
        label="เลื่อนขึ้น"
        icon={<UpIcon size={16} />}
        disabled={isFirst}
        onClick={() => moveSelected(-1)}
      />
      <IconButton
        label="เลื่อนลง"
        icon={<DownIcon size={16} />}
        disabled={isLast}
        onClick={() => moveSelected(1)}
      />
      <IconButton
        label="ทำสำเนา"
        icon={<CopyIcon size={16} />}
        onClick={() => duplicateSelected()}
      />
      <IconButton
        label="ลบ"
        icon={<TrashIcon size={16} />}
        danger
        onClick={() => removeSelected()}
      />
      <Menu label="ตัวเลือกบล็อก" items={menuItems} />
    </div>
  )
}
