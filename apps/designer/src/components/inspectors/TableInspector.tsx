import React, { useState, useEffect } from 'react'
import type { TableBlock, Cell } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'

export interface TableInspectorProps {
  block: TableBlock
  path: BlockPath
  state: EditorState
}

function isValidSafeIdentifier(id: string): boolean {
  if (!id || typeof id !== 'string') return false
  if (id === '__proto__' || id === 'constructor' || id === 'prototype') return false
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(id)
}

export function TableInspector({ block, path, state }: TableInspectorProps) {
  const { updateBlock } = state

  const isEachProp = Boolean(
    block.rows && typeof block.rows === 'object' && !Array.isArray(block.rows) && 'each' in block.rows,
  )

  const [mode, setMode] = useState<'fixed' | 'each'>(isEachProp ? 'each' : 'fixed')
  const [eachPath, setEachPath] = useState(isEachProp ? (block.rows as any).each ?? '' : '')
  const [asId, setAsId] = useState(isEachProp ? (block.rows as any).as ?? '' : '')
  const [asError, setAsError] = useState<string | null>(null)

  useEffect(() => {
    if (isEachProp) {
      setMode('each')
      setEachPath((block.rows as any).each ?? '')
      setAsId((block.rows as any).as ?? '')
    }
  }, [block.rows, isEachProp])

  const isEachMode = mode === 'each' || isEachProp

  const getEffectiveCells = (): Cell[] => {
    if (isEachProp && (block.rows as any).cells) {
      return (block.rows as any).cells
    }
    return (block.columns || []).map(() => ({ text: '' }))
  }

  const handleAddColumn = () => {
    const currentCols = block.columns || []
    const newCols = [...currentCols, { width: '*' as const }]

    let newRows = block.rows
    if (Array.isArray(newRows)) {
      newRows = newRows.map((row) => [...row, { text: '' }])
    } else if (newRows && 'cells' in newRows) {
      newRows = {
        ...newRows,
        cells: [...newRows.cells, { text: '' }],
      }
    }

    let newHeader = block.header
    if (Array.isArray(newHeader)) {
      newHeader = newHeader.map((row) => [...row, { text: '' }])
    }

    updateBlock(path, {
      columns: newCols,
      rows: newRows,
      ...(newHeader ? { header: newHeader } : {}),
    })
  }

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMode = e.target.value as 'fixed' | 'each'
    setMode(nextMode)
    if (nextMode === 'each') {
      const defaultEach = eachPath || 'items'
      const defaultAs = asId || 'item'
      setEachPath(defaultEach)
      setAsId(defaultAs)
      const cells: Cell[] = (block.columns || []).map(() => ({ text: '' }))
      updateBlock(path, {
        rows: {
          each: defaultEach,
          as: defaultAs,
          cells,
        },
      })
    } else {
      const row: Cell[] = (block.columns || []).map(() => ({ text: '' }))
      updateBlock(path, {
        rows: [row],
      })
    }
  }

  const handleEachChange = (val: string) => {
    setEachPath(val)
    if (isEachMode) {
      updateBlock(path, {
        rows: {
          each: val,
          as: asId || 'item',
          cells: getEffectiveCells(),
        },
      })
    }
  }

  const handleAsChange = (val: string) => {
    setAsId(val)
    if (!isValidSafeIdentifier(val)) {
      setAsError('Invalid loop variable identifier')
      return
    }
    setAsError(null)

    if (isEachMode) {
      updateBlock(path, {
        rows: {
          each: eachPath || 'items',
          as: val,
          cells: getEffectiveCells(),
        },
      })
    }
  }

  const handleConvertCell = (rIdx: number, cIdx: number) => {
    if (Array.isArray(block.rows)) {
      const rowsCopy = block.rows.map((row, rowI) => {
        if (rowI !== rIdx) return row
        return row.map((cell, colI) => {
          if (colI !== cIdx) return cell
          const textVal = cell.text ?? ''
          const nextCell: Cell = {
            ...cell,
            blocks: [{ type: 'paragraph' as const, text: textVal }],
          }
          delete nextCell.text
          return nextCell
        })
      })
      updateBlock(path, { rows: rowsCopy })
    } else if (isEachMode) {
      const eachRows = block.rows as { each: string; as: string; cells: Cell[] }
      const cellsCopy = eachRows.cells.map((cell, colI) => {
        if (colI !== cIdx) return cell
        const textVal = cell.text ?? ''
        const nextCell: Cell = {
          ...cell,
          blocks: [{ type: 'paragraph' as const, text: textVal }],
        }
        delete nextCell.text
        return nextCell
      })
      updateBlock(path, {
        rows: {
          ...eachRows,
          cells: cellsCopy,
        },
      })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
        Table Properties
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', fontWeight: 500 }}>
            Columns ({block.columns?.length ?? 0})
          </label>
          <button
            type="button"
            aria-label="Add column"
            onClick={handleAddColumn}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              backgroundColor: '#e7f3ff',
              border: '1px solid #70b5ff',
              borderRadius: '3px',
              color: '#0066cc',
              cursor: 'pointer',
            }}
          >
            + Add column
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {block.columns?.map((col, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                padding: '4px 6px',
                backgroundColor: '#f8f9fa',
                borderRadius: '3px',
              }}
            >
              <span>Col {idx + 1}:</span>
              <input
                type="text"
                aria-label={`Column ${idx + 1} width`}
                value={String(col.width ?? '*')}
                onChange={(e) => {
                  const newCols = [...block.columns]
                  newCols[idx] = { ...newCols[idx]!, width: e.target.value as any }
                  updateBlock(path, { columns: newCols })
                }}
                style={{ width: '60px', padding: '2px 4px', fontSize: '11px', border: '1px solid #ccc' }}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor="tbl-mode" style={{ fontSize: '12px', fontWeight: 500 }}>
          Body Mode
        </label>
        <select
          id="tbl-mode"
          aria-label="Body mode"
          value={isEachMode ? 'each' : 'fixed'}
          onChange={handleModeChange}
          style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
        >
          <option value="fixed">Fixed rows</option>
          <option value="each">each</option>
        </select>
      </div>

      {isEachMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#f0f7ff', padding: '8px', borderRadius: '4px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label htmlFor="tbl-each" style={{ fontSize: '11px', fontWeight: 500 }}>
              Each array path
            </label>
            <input
              id="tbl-each"
              type="text"
              aria-label="Each array path"
              value={eachPath}
              onChange={(e) => handleEachChange(e.target.value)}
              placeholder="e.g. items"
              style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label htmlFor="tbl-as" style={{ fontSize: '11px', fontWeight: 500 }}>
              Loop variable (as)
            </label>
            <input
              id="tbl-as"
              type="text"
              aria-label="Loop variable (as)"
              value={asId}
              onChange={(e) => handleAsChange(e.target.value)}
              placeholder="e.g. item"
              style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
            />
            {asError && (
              <span role="alert" style={{ fontSize: '11px', color: '#dc3545' }}>
                {asError}
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', fontWeight: 500 }}>Cell Operations</label>
        {Array.isArray(block.rows) &&
          block.rows.map((row, rIdx) => (
            <div key={rIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {row.map((cell, cIdx) => (
                <div
                  key={cIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    padding: '3px 6px',
                    backgroundColor: '#fafafa',
                    border: '1px solid #eee',
                    borderRadius: '3px',
                  }}
                >
                  <span>
                    Cell [{rIdx + 1}, {cIdx + 1}]: {cell.blocks ? '(blocks)' : cell.text ?? ''}
                  </span>
                  {!cell.blocks && (
                    <button
                      type="button"
                      aria-label="Convert cell to blocks"
                      onClick={() => handleConvertCell(rIdx, cIdx)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      Convert cell to blocks
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}

        {isEachMode &&
          (block.rows as { cells: Cell[] }).cells?.map((cell, cIdx) => (
            <div
              key={cIdx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                padding: '3px 6px',
                backgroundColor: '#fafafa',
                border: '1px solid #eee',
                borderRadius: '3px',
              }}
            >
              <span>
                Col {cIdx + 1}: {cell.blocks ? '(blocks)' : cell.text ?? ''}
              </span>
              {!cell.blocks && (
                <button
                  type="button"
                  aria-label="Convert cell to blocks"
                  onClick={() => handleConvertCell(0, cIdx)}
                  style={{
                    padding: '2px 6px',
                    fontSize: '10px',
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  Convert cell to blocks
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
