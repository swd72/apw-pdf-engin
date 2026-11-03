import React, { useState, type ReactNode } from 'react'
import type { Block } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import { canMoveInto, type BlockPath } from '../../editor/docModel.js'
import { BlockPicker } from './BlockPicker.js'
import { InsertLine } from './InsertLine.js'
import { getActiveDraggedPath, clearActiveDraggedPath } from './BlockCard.js'

export interface DocumentViewProps {
  state: EditorState
  renderCard(path: BlockPath, block: Block): ReactNode
  listPath?: BlockPath
}

const ROOT_LIST_PATH: BlockPath = ['blocks']

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

function isSameListPath(a: BlockPath, b: BlockPath): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function readDraggedPathFromEvent(e: React.DragEvent): BlockPath | null {
  if (e.dataTransfer) {
    const raw =
      e.dataTransfer.getData('application/json') ||
      e.dataTransfer.getData('text/plain')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          return parsed as BlockPath
        }
      } catch {
        // Ignore invalid JSON payload
      }
    }
  }
  return getActiveDraggedPath()
}

export function DocumentView({
  state,
  renderCard,
  listPath = ROOT_LIST_PATH,
}: DocumentViewProps) {
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null)
  const blocks = (getIn(state.doc, listPath) as Block[] | undefined) ?? []
  const isRoot = listPath.length === 1 && listPath[0] === 'blocks'

  const handleDragOverSlot = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer && 'dropEffect' in e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    if (activeDropIndex !== slotIndex) {
      setActiveDropIndex(slotIndex)
    }
  }

  const handleDragLeaveSlot = (slotIndex: number) => {
    if (activeDropIndex === slotIndex) {
      setActiveDropIndex(null)
    }
  }

  const handleDropOnSlot = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveDropIndex(null)

    const from = readDraggedPathFromEvent(e)
    clearActiveDraggedPath()
    if (!from || from.length === 0) return

    if (!canMoveInto(state.doc, from, listPath)) {
      return
    }

    const fromParent = from.slice(0, -1)
    const fromIdx = from[from.length - 1]
    let targetIndex = slotIndex

    if (
      isSameListPath(fromParent, listPath) &&
      typeof fromIdx === 'number' &&
      slotIndex > fromIdx
    ) {
      targetIndex = slotIndex - 1
    }

    const maxAfterRemoval =
      isSameListPath(fromParent, listPath)
        ? Math.max(0, blocks.length - 1)
        : blocks.length
    const clampedIndex = Math.max(0, Math.min(targetIndex, maxAfterRemoval))

    state.moveBlockTo(from, listPath, clampedIndex)
  }

  if (blocks.length === 0 && isRoot) {
    return (
      <div
        className="doc-view"
        data-drop-index={0}
        onDragOver={(e) => handleDragOverSlot(e, 0)}
        onDragLeave={() => handleDragLeaveSlot(0)}
        onDrop={(e) => handleDropOnSlot(e, 0)}
      >
        <div className="doc-view__empty">
          <p className="doc-view__empty-title">เริ่มต้นด้วยการเพิ่มบล็อกแรก</p>
          <p className="doc-view__empty-subtitle">
            เลือกชนิดบล็อกด้านล่างเพื่อเริ่มสร้างเอกสาร
          </p>
          <BlockPicker onPick={(type) => state.addBlock(listPath, 0, type)} />
        </div>
      </div>
    )
  }

  return (
    <div className={isRoot ? 'doc-view' : 'doc-view--nested'}>
      <div
        data-drop-index={0}
        className={activeDropIndex === 0 ? 'insert-line--drop-active' : undefined}
        onDragOver={(e) => handleDragOverSlot(e, 0)}
        onDragLeave={() => handleDragLeaveSlot(0)}
        onDrop={(e) => handleDropOnSlot(e, 0)}
      >
        <InsertLine onPick={(type) => state.addBlock(listPath, 0, type)} />
      </div>

      {blocks.map((block, idx) => {
        const blockPath: BlockPath = [...listPath, idx]
        const nextSlot = idx + 1
        return (
          <React.Fragment key={blockPath.join('.')}>
            <div
              onDragOver={(e) => handleDragOverSlot(e, nextSlot)}
              onDrop={(e) => handleDropOnSlot(e, nextSlot)}
            >
              {renderCard(blockPath, block)}
            </div>
            <div
              data-drop-index={nextSlot}
              className={
                activeDropIndex === nextSlot ? 'insert-line--drop-active' : undefined
              }
              onDragOver={(e) => handleDragOverSlot(e, nextSlot)}
              onDragLeave={() => handleDragLeaveSlot(nextSlot)}
              onDrop={(e) => handleDropOnSlot(e, nextSlot)}
            >
              <InsertLine
                onPick={(type) => state.addBlock(listPath, nextSlot, type)}
              />
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
