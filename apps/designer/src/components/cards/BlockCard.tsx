import React, { useState, type ReactNode } from 'react'
import type { Block } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import {
  getBlock,
  listChildren,
  canMoveInto,
  type BlockPath,
} from '../../editor/docModel.js'
import { IconButton } from '../../ui/IconButton.js'
import { Menu } from '../../ui/Menu.js'
import { Chip } from '../../ui/Chip.js'
import { DragIcon, UpIcon, DownIcon } from '../../ui/icons.js'
import { GenericJsonInspector } from '../inspectors/GenericJsonInspector.js'
import { blockMeta } from './blockMeta.js'

export interface BlockCardProps {
  path: BlockPath
  state: EditorState
  summary?: string
  children: ReactNode
  renderNested?: ReactNode
}

let activeDraggedPath: BlockPath | null = null

export function getActiveDraggedPath(): BlockPath | null {
  return activeDraggedPath
}

export function clearActiveDraggedPath(): void {
  activeDraggedPath = null
}

function isPathEqual(a: BlockPath | null, b: BlockPath): boolean {
  if (!a || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function isPathPrefix(prefix: BlockPath, full: BlockPath): boolean {
  if (full.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (full[i] !== prefix[i]) return false
  }
  return true
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

export function BlockCard({
  path,
  state,
  summary,
  children,
  renderNested,
}: BlockCardProps) {
  const [editingJson, setEditingJson] = useState(false)
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

  const block = getBlock(doc, path)
  if (!block) return null

  const meta = blockMeta(block.type)
  const isSelected = isPathEqual(selectedPath, path)

  const parentListPath = path.slice(0, -1)
  const index = path[path.length - 1]
  const parentList = getIn(doc, parentListPath) as Block[] | undefined

  const isFirst =
    typeof index !== 'number' || !Array.isArray(parentList) || index <= 0
  const isLast =
    typeof index !== 'number' ||
    !Array.isArray(parentList) ||
    index >= parentList.length - 1
  const canMoveOut = parentListPath.length > 1

  let canMoveIntoPrev = false
  let targetListPath: BlockPath | null = null
  if (!isFirst && typeof index === 'number' && Array.isArray(parentList)) {
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

  const blockWarnings = warnings.filter((w) => isPathPrefix(path, w.blockPath))
  const uniqueWarningPaths = Array.from(new Set(blockWarnings.map((w) => w.path)))

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation()
    activeDraggedPath = path
    const payload = JSON.stringify(path)
    if (e.dataTransfer) {
      try {
        e.dataTransfer.setData('application/json', payload)
        e.dataTransfer.setData('text/plain', payload)
      } catch {
        // Ignore if DataTransfer stub only supports one call
      }
      if ('effectAllowed' in e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
      }
    }
  }

  const handleDragEnd = () => {
    activeDraggedPath = null
  }

  const menuItems = [
    {
      label: 'Duplicate',
      onSelect: () => {
        select(path)
        duplicateSelected()
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
      label: 'Edit JSON',
      onSelect: () => {
        select(path)
        setEditingJson((v) => !v)
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
  ]

  return (
    <div
      className={`block-card ${isSelected ? 'block-card--selected' : ''}`}
      data-block-path={path.join('.')}
      onClick={(e) => {
        e.stopPropagation()
        select(path)
      }}
    >
      <div className="block-card__header">
        <div className="block-card__meta">
          <span
            className="block-card__handle"
            role="button"
            tabIndex={0}
            aria-label="ลากเพื่อย้าย"
            title="ลากเพื่อย้าย"
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <DragIcon size={18} />
          </span>
          <span className="block-card__icon">{meta.icon}</span>
          <span className="block-card__label">{meta.label}</span>
          {summary && <span className="block-card__summary">{summary}</span>}
          {uniqueWarningPaths.length > 0 && (
            <Chip tone="warn">
              ไม่พบตัวแปร: {uniqueWarningPaths.join(', ')}
            </Chip>
          )}
        </div>

        <div
          className="block-card__actions"
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton
            label="Move up"
            icon={<UpIcon size={18} />}
            disabled={isFirst}
            onClick={() => {
              select(path)
              moveSelected(-1)
            }}
          />
          <IconButton
            label="Move down"
            icon={<DownIcon size={18} />}
            disabled={isLast}
            onClick={() => {
              select(path)
              moveSelected(1)
            }}
          />
          <Menu label="ตัวเลือกบล็อก" items={menuItems} />
        </div>
      </div>

      <div className="block-card__body">{children}</div>

      {editingJson && (
        <div
          className="block-card__json"
          onClick={(e) => e.stopPropagation()}
        >
          <GenericJsonInspector block={block} path={path} state={state} />
        </div>
      )}

      {renderNested && (
        <div className="block-card__nested">{renderNested}</div>
      )}
    </div>
  )
}
