import React, { useMemo } from 'react'
import type { Block } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import {
  listChildren,
  canMoveInto,
  type BlockPath,
} from '../../editor/docModel.js'
import { Menu, type MenuItem } from '../../ui/Menu.js'
import { blockMeta } from '../cards/blockMeta.js'

export interface OutlineRowProps {
  block: Block
  path: BlockPath
  level: number
  index: number
  parentList: Block[]
  parentListPath: BlockPath
  state: EditorState
  onEditJson?(path: BlockPath): void
  onDragStartRow(e: React.DragEvent, path: BlockPath): void
  onDragEndRow(): void
  onDragOverRow?(e: React.DragEvent, listPath: BlockPath, index: number): void
  onDropOnRow?(e: React.DragEvent, listPath: BlockPath, index: number): void
}

function isPathEqual(a: BlockPath | null, b: BlockPath): boolean {
  if (!a || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function getOutlineSummary(block: Block): string {
  switch (block.type) {
    case 'paragraph': {
      if (block.text) {
        return block.text
      }
      if (Array.isArray(block.runs) && block.runs.length > 0) {
        return block.runs.map((r) => ('text' in r ? r.text : '')).join('')
      }
      return ''
    }
    case 'image':
      return block.src ?? ''
    case 'table': {
      if (
        block.rows &&
        typeof block.rows === 'object' &&
        !Array.isArray(block.rows) &&
        'each' in block.rows
      ) {
        return `each: ${block.rows.each}`
      }
      return `${block.columns?.length ?? 0} คอลัมน์`
    }
    case 'columns':
      return `${block.columns?.length ?? 0} คอลัมน์`
    case 'signature':
      return block.name ?? ''
    case 'spacer':
      return typeof block.height === 'object'
        ? `${block.height.lines} บรรทัด`
        : String(block.height ?? '')
    case 'line':
    case 'pageBreak':
      return ''
    case 'each':
      return `${block.of} → ${block.as}`
    case 'if':
      return block.test ?? ''
    default:
      return 'JSON'
  }
}

export function OutlineRow({
  block,
  path,
  level,
  index,
  parentList,
  parentListPath,
  state,
  onEditJson,
  onDragStartRow,
  onDragEndRow,
  onDragOverRow,
  onDropOnRow,
}: OutlineRowProps) {
  const {
    doc,
    selectedPath,
    select,
    moveSelected,
    moveSelectedInto,
    moveSelectedOut,
    duplicateSelected,
    removeSelected,
    warnings,
  } = state

  const meta = blockMeta(block.type)
  const summary = getOutlineSummary(block)
  const isSelected = isPathEqual(selectedPath, path)
  const hasWarning = warnings.some((w) => isPathEqual(w.blockPath, path))

  const isFirst = index <= 0
  const isLast = index >= parentList.length - 1
  const canMoveOut = parentListPath.length > 1

  let canMoveIntoPrev = false
  let targetListPath: BlockPath | null = null
  if (!isFirst) {
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
        label: 'Move up',
        disabled: isFirst,
        onSelect: () => {
          select(path)
          moveSelected(-1)
        },
      },
      {
        label: 'Move down',
        disabled: isLast,
        onSelect: () => {
          select(path)
          moveSelected(1)
        },
      },
      {
        label: 'Move into previous',
        disabled: !canMoveIntoPrev,
        onSelect: () => {
          select(path)
          if (targetListPath) {
            moveSelectedInto(targetListPath)
          }
        },
      },
      {
        label: 'Move out',
        disabled: !canMoveOut,
        onSelect: () => {
          select(path)
          moveSelectedOut()
        },
      },
      {
        label: 'Duplicate',
        onSelect: () => {
          select(path)
          duplicateSelected()
        },
      },
      {
        label: 'Edit JSON',
        onSelect: () => {
          select(path)
          onEditJson?.(path)
        },
      },
      {
        label: 'Delete',
        danger: true,
        onSelect: () => {
          select(path)
          removeSelected()
        },
      },
    ],
    [
      isFirst,
      isLast,
      canMoveIntoPrev,
      canMoveOut,
      path,
      targetListPath,
      select,
      moveSelected,
      moveSelectedInto,
      moveSelectedOut,
      duplicateSelected,
      removeSelected,
      onEditJson,
    ],
  )

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-level={level}
      tabIndex={isSelected ? 0 : -1}
      draggable
      data-block-path={path.join('.')}
      className={`outline-row ${isSelected ? 'outline-row--selected' : ''}`}
      style={{ paddingLeft: `${(level - 1) * 16 + 8}px` }}
      onClick={(e) => {
        e.stopPropagation()
        select(path)
      }}
      onDragStart={(e) => onDragStartRow(e, path)}
      onDragEnd={onDragEndRow}
      onDragOver={(e) => onDragOverRow?.(e, parentListPath, index)}
      onDrop={(e) => onDropOnRow?.(e, parentListPath, index)}
    >
      <span className="outline-row__icon">{meta.icon}</span>
      <span className="outline-row__label">{meta.label}</span>
      {summary && <span className="outline-row__summary">{summary}</span>}

      <div className="outline-row__right">
        {hasWarning && (
          <span
            role="status"
            aria-label="Unresolved binding"
            data-testid="warning-dot"
            className="outline-row__warning-dot"
            title="ไม่พบตัวแปร"
          />
        )}
        <div
          className="outline-row__actions"
          onClick={(e) => e.stopPropagation()}
        >
          <Menu label="ตัวเลือกบล็อก" items={menuItems} />
        </div>
      </div>
    </div>
  )
}
