import React, { useState } from 'react'
import type { Block } from '@apw-pdf/core'
import type { EditorState } from '../editor/useEditorState.js'
import { BLOCK_TYPES } from '../editor/blockCatalog.js'
import { listChildren, canMoveInto, type BlockPath } from '../editor/docModel.js'

export interface BlockTreeProps {
  state: EditorState
}

function isPathEqual(a: BlockPath | null, b: BlockPath): boolean {
  if (!a || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function getBlockSummary(block: Block): string {
  switch (block.type) {
    case 'paragraph': {
      if (block.text) {
        return `Paragraph: ${block.text.slice(0, 24)}`
      }
      if (Array.isArray(block.runs) && block.runs.length > 0) {
        const str = block.runs.map((r) => ('text' in r ? r.text : '')).join('')
        return `Paragraph: ${str.slice(0, 24)}`
      }
      return 'Paragraph'
    }
    case 'image':
      return `Image: ${block.src ? block.src.slice(0, 24) : ''}`
    case 'table': {
      if (
        block.rows &&
        typeof block.rows === 'object' &&
        !Array.isArray(block.rows) &&
        'each' in block.rows
      ) {
        return `Table (each: ${block.rows.each})`
      }
      return `Table (${block.columns?.length ?? 0} cols)`
    }
    case 'columns':
      return `Columns (${block.columns?.length ?? 0})`
    case 'signature':
      return `Signature: ${block.name ? block.name.slice(0, 24) : ''}`
    case 'spacer':
      return typeof block.height === 'object'
        ? `Spacer (${block.height.lines} lines)`
        : `Spacer (${block.height ?? ''})`
    case 'line':
      return 'Line'
    case 'pageBreak':
      return 'Page Break'
    case 'each':
      return `Each: ${block.of} as ${block.as}`
    case 'if':
      return `If: ${block.test}`
    default:
      return (block as any).type ?? 'Block'
  }
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

function AddBlockMenu({
  listPath,
  index,
  onAdd,
}: {
  listPath: BlockPath
  index: number
  onAdd(listPath: BlockPath, index: number, type: Block['type']): void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative', margin: '4px 0 8px 0' }}>
      <button
        type="button"
        aria-label="Add block"
        onClick={() => setOpen(!open)}
        style={{
          padding: '3px 8px',
          fontSize: '11px',
          backgroundColor: '#f8f9fa',
          border: '1px dashed #6c757d',
          borderRadius: '3px',
          color: '#495057',
          cursor: 'pointer',
        }}
      >
        + Add block
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            zIndex: 100,
            top: '100%',
            left: 0,
            backgroundColor: '#ffffff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            padding: '4px 0',
            display: 'flex',
            flexDirection: 'column',
            minWidth: '130px',
          }}
        >
          {BLOCK_TYPES.map((bt) => (
            <button
              key={bt.type}
              type="button"
              role="menuitem"
              onClick={() => {
                onAdd(listPath, index, bt.type)
                setOpen(false)
              }}
              style={{
                textAlign: 'left',
                padding: '4px 10px',
                fontSize: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor = '#e8f0fe'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
              }}
            >
              {bt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function BlockTree({ state }: BlockTreeProps) {
  const { doc, selectedPath, select, removeSelected, moveSelected, moveSelectedInto, moveSelectedOut, duplicateSelected, addBlock, warnings } = state

  const renderNode = (
    block: Block,
    path: BlockPath,
    index: number,
    parentList: Block[],
    parentListPath: BlockPath,
  ) => {
    const isSelected = isPathEqual(selectedPath, path)
    const summary = getBlockSummary(block)
    const hasWarning = warnings.some((w) => isPathEqual(w.blockPath, path))

    const isFirst = index === 0
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

    const childContainers = listChildren(block)

    return (
      <div
        key={path.join('.')}
        role="treeitem"
        aria-selected={isSelected}
        style={{
          display: 'flex',
          flexDirection: 'column',
          margin: '2px 0',
        }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation()
            select(path)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: isSelected ? '#e3f2fd' : '#ffffff',
            border: isSelected ? '1px solid #90caf9' : '1px solid #e0e0e0',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: isSelected ? 600 : 400 }}>
              {summary}
            </span>
            {hasWarning && (
              <span
                role="status"
                aria-label="Unresolved binding"
                data-testid="warning-dot"
                style={{
                  color: '#e06c75',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                ●
              </span>
            )}
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Move up"
              disabled={isFirst}
              onClick={() => {
                select(path)
                moveSelected(-1)
              }}
              style={{ padding: '2px 5px', fontSize: '11px', cursor: isFirst ? 'default' : 'pointer' }}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={isLast}
              onClick={() => {
                select(path)
                moveSelected(1)
              }}
              style={{ padding: '2px 5px', fontSize: '11px', cursor: isLast ? 'default' : 'pointer' }}
            >
              ↓
            </button>
            <button
              type="button"
              aria-label="Move into previous"
              disabled={!canMoveIntoPrev}
              onClick={() => {
                select(path)
                if (targetListPath) moveSelectedInto(targetListPath)
              }}
              style={{
                padding: '2px 5px',
                fontSize: '11px',
                cursor: canMoveIntoPrev ? 'pointer' : 'default',
              }}
            >
              →
            </button>
            <button
              type="button"
              aria-label="Move out"
              disabled={!canMoveOut}
              onClick={() => {
                select(path)
                moveSelectedOut()
              }}
              style={{
                padding: '2px 5px',
                fontSize: '11px',
                cursor: canMoveOut ? 'pointer' : 'default',
              }}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Duplicate"
              onClick={() => {
                select(path)
                duplicateSelected()
              }}
              style={{ padding: '2px 5px', fontSize: '11px', cursor: 'pointer' }}
            >
              ⧉
            </button>
            <button
              type="button"
              aria-label="Delete"
              onClick={() => {
                select(path)
                removeSelected()
              }}
              style={{
                padding: '2px 5px',
                fontSize: '11px',
                color: '#dc3545',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {childContainers.length > 0 && (
          <div style={{ paddingLeft: '16px', borderLeft: '1px dashed #d0d0d0', marginLeft: '8px' }}>
            {childContainers.map((container) => {
              const childListPath: BlockPath = [...path, ...container.key]
              const childBlocks = (getIn(doc, childListPath) as Block[]) || []

              return (
                <div key={container.label} style={{ margin: '4px 0' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
                    {container.label}
                  </div>
                  {childBlocks.map((childBlock, cIdx) =>
                    renderNode(
                      childBlock,
                      [...childListPath, cIdx],
                      cIdx,
                      childBlocks,
                      childListPath,
                    ),
                  )}
                  <AddBlockMenu listPath={childListPath} index={childBlocks.length} onAdd={addBlock} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const rootBlocks = doc?.blocks ?? []

  return (
    <div
      role="tree"
      aria-label="Block Tree"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '12px',
        fontSize: '13px',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: '14px',
          borderBottom: '1px solid #eee',
          paddingBottom: '6px',
        }}
      >
        Block Tree
      </div>

      {rootBlocks.map((block, idx) =>
        renderNode(block, ['blocks', idx], idx, rootBlocks, ['blocks']),
      )}

      <AddBlockMenu listPath={['blocks']} index={rootBlocks.length} onAdd={addBlock} />
    </div>
  )
}
