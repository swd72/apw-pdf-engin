import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { Block, DocumentDef } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import {
  listChildren,
  canMoveInto,
  type BlockPath,
} from '../../editor/docModel.js'
import { PRESETS, type PresetDescriptor } from '../../editor/presets.js'
import { OutlineRow } from './OutlineRow.js'
import { QuickAdd } from './QuickAdd.js'

export interface OutlineTreeProps {
  state: EditorState
  onFocusProperties?(): void
  onEditJson?(path: BlockPath): void
}

const ROOT_LIST_PATH: BlockPath = ['blocks']

let activeDraggedOutlinePath: BlockPath | null = null

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

function isSamePath(a: BlockPath | null, b: BlockPath): boolean {
  if (!a || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function flattenDocPaths(doc: DocumentDef): BlockPath[] {
  const result: BlockPath[] = []
  function walkList(listPath: BlockPath) {
    const list = (getIn(doc, listPath) as Block[] | undefined) ?? []
    list.forEach((block, idx) => {
      const path: BlockPath = [...listPath, idx]
      result.push(path)
      const containers = listChildren(block)
      for (const container of containers) {
        walkList([...path, ...container.key])
      }
    })
  }
  if (doc && Array.isArray(doc.blocks)) {
    walkList(ROOT_LIST_PATH)
  }
  return result
}

function readDraggedPath(e: React.DragEvent): BlockPath | null {
  if (e.dataTransfer) {
    try {
      const raw =
        e.dataTransfer.getData('application/json') ||
        e.dataTransfer.getData('text/plain')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          return parsed as BlockPath
        }
      }
    } catch {
      // Fall back to module state if DataTransfer stub fails
    }
  }
  return activeDraggedOutlinePath
}

export function OutlineTree({
  state,
  onFocusProperties,
  onEditJson,
}: OutlineTreeProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [activeDrop, setActiveDrop] = useState<{
    listKey: string
    index: number
  } | null>(null)
  const headerAddRef = useRef<HTMLDivElement | null>(null)

  const {
    doc,
    selectedPath,
    select,
    addBlock,
    insertBlocks,
    removeSelected,
    moveSelected,
    moveBlockTo,
    duplicateSelected,
  } = state

  const flatPaths = useMemo(() => flattenDocPaths(doc), [doc])

  useEffect(() => {
    if (!quickAddOpen) return

    const handlePointerDown = (e: MouseEvent) => {
      if (
        headerAddRef.current &&
        e.target instanceof Node &&
        !headerAddRef.current.contains(e.target)
      ) {
        setQuickAddOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [quickAddOpen])

  const handleInsertBlock = useCallback(
    (type: Block['type']) => {
      if (selectedPath && selectedPath.length >= 2) {
        const parentListPath = selectedPath.slice(0, -1)
        const lastIdx = selectedPath[selectedPath.length - 1]
        if (typeof lastIdx === 'number') {
          addBlock(parentListPath, lastIdx + 1, type)
          return
        }
      }
      const rootLen = Array.isArray(doc?.blocks) ? doc.blocks.length : 0
      addBlock(ROOT_LIST_PATH, rootLen, type)
    },
    [selectedPath, doc, addBlock],
  )

  const handleInsertPreset = useCallback(
    (id: PresetDescriptor['id']) => {
      const preset = PRESETS.find((p) => p.id === id)
      if (!preset) return
      const blocks = preset.create()
      if (selectedPath && selectedPath.length >= 2) {
        const parentListPath = selectedPath.slice(0, -1)
        const lastIdx = selectedPath[selectedPath.length - 1]
        if (typeof lastIdx === 'number') {
          insertBlocks(parentListPath, lastIdx + 1, blocks, preset.sampleData)
          return
        }
      }
      const rootLen = Array.isArray(doc?.blocks) ? doc.blocks.length : 0
      insertBlocks(ROOT_LIST_PATH, rootLen, blocks, preset.sampleData)
    },
    [selectedPath, doc, insertBlocks],
  )

  const handleDragStartRow = useCallback(
    (e: React.DragEvent, path: BlockPath) => {
      e.stopPropagation()
      activeDraggedOutlinePath = path
      const payload = JSON.stringify(path)
      if (e.dataTransfer) {
        try {
          e.dataTransfer.setData('application/json', payload)
          e.dataTransfer.setData('text/plain', payload)
        } catch {
          // Ignore DataTransfer stub limitations
        }
        if ('effectAllowed' in e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move'
        }
      }
    },
    [],
  )

  const handleDragEndRow = useCallback(() => {
    activeDraggedOutlinePath = null
    setActiveDrop(null)
  }, [])

  const performDrop = useCallback(
    (e: React.DragEvent, listPath: BlockPath, slotIndex: number) => {
      e.preventDefault()
      e.stopPropagation()
      setActiveDrop(null)

      const from = readDraggedPath(e)
      activeDraggedOutlinePath = null
      if (!from || from.length === 0) return

      if (!canMoveInto(doc, from, listPath)) {
        return
      }

      const blocks = (getIn(doc, listPath) as Block[] | undefined) ?? []
      const fromParent = from.slice(0, -1)
      const fromIdx = from[from.length - 1]
      let targetIndex = slotIndex

      if (
        isSamePath(fromParent, listPath) &&
        typeof fromIdx === 'number' &&
        slotIndex > fromIdx
      ) {
        targetIndex = slotIndex - 1
      }

      const maxAfterRemoval = isSamePath(fromParent, listPath)
        ? Math.max(0, blocks.length - 1)
        : blocks.length
      const clampedIndex = Math.max(0, Math.min(targetIndex, maxAfterRemoval))

      moveBlockTo(from, listPath, clampedIndex)
    },
    [doc, moveBlockTo],
  )

  const handleDragOverSlot = useCallback(
    (e: React.DragEvent, listPath: BlockPath, slotIndex: number) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer && 'dropEffect' in e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
      const listKey = listPath.join('.')
      setActiveDrop((prev) =>
        prev && prev.listKey === listKey && prev.index === slotIndex
          ? prev
          : { listKey, index: slotIndex },
      )
    },
    [],
  )

  const handleDragOverRow = useCallback(
    (e: React.DragEvent, listPath: BlockPath, rowIndex: number) => {
      const from = activeDraggedOutlinePath
      let slotIndex = rowIndex + 1
      if (
        from &&
        isSamePath(from.slice(0, -1), listPath) &&
        typeof from[from.length - 1] === 'number' &&
        (from[from.length - 1] as number) > rowIndex
      ) {
        slotIndex = rowIndex
      }
      handleDragOverSlot(e, listPath, slotIndex)
    },
    [handleDragOverSlot],
  )

  const handleDropOnRow = useCallback(
    (e: React.DragEvent, listPath: BlockPath, rowIndex: number) => {
      const from = readDraggedPath(e)
      let slotIndex = rowIndex + 1
      if (
        from &&
        isSamePath(from.slice(0, -1), listPath) &&
        typeof from[from.length - 1] === 'number' &&
        (from[from.length - 1] as number) > rowIndex
      ) {
        slotIndex = rowIndex
      }
      performDrop(e, listPath, slotIndex)
    },
    [performDrop],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT')
    ) {
      return
    }

    if (e.key === '/') {
      e.preventDefault()
      setQuickAddOpen(true)
      return
    }

    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault()
      moveSelected(-1)
      return
    }

    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault()
      moveSelected(1)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flatPaths.length === 0) return
      const currIdx = flatPaths.findIndex((p) => isSamePath(selectedPath, p))
      if (currIdx > 0) {
        select(flatPaths[currIdx - 1]!)
      } else if (currIdx === -1) {
        select(flatPaths[flatPaths.length - 1]!)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flatPaths.length === 0) return
      const currIdx = flatPaths.findIndex((p) => isSamePath(selectedPath, p))
      if (currIdx >= 0 && currIdx < flatPaths.length - 1) {
        select(flatPaths[currIdx + 1]!)
      } else if (currIdx === -1) {
        select(flatPaths[0]!)
      }
      return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      removeSelected()
      return
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault()
      duplicateSelected()
      return
    }

    if (e.key === 'Enter' && target?.tagName !== 'BUTTON') {
      e.preventDefault()
      onFocusProperties?.()
    }
  }

  const renderDropSlot = (listPath: BlockPath, slotIndex: number, level: number) => {
    const listKey = listPath.join('.')
    const isActive =
      activeDrop?.listKey === listKey && activeDrop?.index === slotIndex
    return (
      <div
        key={`drop-${listKey}-${slotIndex}`}
        data-drop-list={listKey}
        data-drop-index={slotIndex}
        className={`outline-tree__drop-slot ${isActive ? 'outline-tree__drop-slot--active' : ''}`}
        style={{ marginLeft: `${(level - 1) * 16 + 8}px` }}
        onDragOver={(e) => handleDragOverSlot(e, listPath, slotIndex)}
        onDragLeave={() => {
          setActiveDrop((prev) =>
            prev && prev.listKey === listKey && prev.index === slotIndex
              ? null
              : prev,
          )
        }}
        onDrop={(e) => performDrop(e, listPath, slotIndex)}
      />
    )
  }

  const renderBlockList = (listPath: BlockPath, level: number): React.ReactNode => {
    const blocks = (getIn(doc, listPath) as Block[] | undefined) ?? []
    return (
      <div
        className={level > 1 ? 'outline-tree__nested' : 'outline-tree__list'}
        role={level > 1 ? 'group' : undefined}
      >
        {renderDropSlot(listPath, 0, level)}
        {level === 1 && blocks.length === 0 && (
          <div className="outline-tree__empty">
            <span>ยังไม่มีบล็อก — กด + เพิ่ม</span>
          </div>
        )}
        {blocks.map((block, idx) => {
          const blockPath: BlockPath = [...listPath, idx]
          const childContainers = listChildren(block)
          return (
            <React.Fragment key={blockPath.join('.')}>
              <OutlineRow
                block={block}
                path={blockPath}
                level={level}
                index={idx}
                parentList={blocks}
                parentListPath={listPath}
                state={state}
                onEditJson={onEditJson}
                onDragStartRow={handleDragStartRow}
                onDragEndRow={handleDragEndRow}
                onDragOverRow={handleDragOverRow}
                onDropOnRow={handleDropOnRow}
              />
              {childContainers.length > 0 && (
                <div
                  className="outline-tree__children"
                  style={{ '--outline-guide-x': `${(level - 1) * 16 + 16}px` } as React.CSSProperties}
                >
                  {childContainers.map((container) => {
                    const childListPath: BlockPath = [
                      ...blockPath,
                      ...container.key,
                    ]
                    return (
                      <div
                        key={container.key.join('.')}
                        className="outline-tree__slot"
                      >
                        {childContainers.length > 1 && (
                          <div
                            className="outline-tree__slot-label"
                            style={{ paddingLeft: `${level * 16 + 8}px` }}
                          >
                            {container.label}
                          </div>
                        )}
                        {renderBlockList(childListPath, level + 1)}
                      </div>
                    )
                  })}
                </div>
              )}
              {renderDropSlot(listPath, idx + 1, level)}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  return (
    <div className="outline-panel">
      <div className="panel-header">
        <h2 className="panel-header__title">โครงสร้าง</h2>
        <div ref={headerAddRef} className="outline-panel__add-wrap">
          <button
            type="button"
            className="ui-btn ui-btn--ghost outline-panel__add-btn"
            aria-label="+ เพิ่ม"
            aria-haspopup="menu"
            aria-expanded={quickAddOpen}
            onClick={() => setQuickAddOpen((v) => !v)}
          >
            + เพิ่ม
          </button>
          {quickAddOpen && (
            <div className="outline-panel__popover">
              <QuickAdd
                onInsert={handleInsertBlock}
                onInsertPreset={handleInsertPreset}
                onClose={() => setQuickAddOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      <div
        role="tree"
        aria-label="โครงสร้าง"
        tabIndex={0}
        className="panel-body outline-tree"
        onKeyDown={handleKeyDown}
      >
        {renderBlockList(ROOT_LIST_PATH, 1)}
      </div>
    </div>
  )
}
