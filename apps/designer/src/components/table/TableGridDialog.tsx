import React, { useState, useMemo } from 'react'
import type { TableBlock, Cell } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import { getBlock, type BlockPath } from '../../editor/docModel.js'
import { scopeAt } from '../../editor/bindings.js'
import { Menu } from '../../ui/Menu.js'
import { Chip } from '../../ui/Chip.js'
import { BindableInput } from '../properties/VariablePicker.js'
import { commitBlockPatch } from '../properties/shared.js'
import { Dialog } from './Dialog.js'

export interface TableGridDialogProps {
  path: BlockPath
  state: EditorState
  onClose(): void
}

type CellSection = 'header' | 'body' | 'footer'

interface ActiveCell {
  section: CellSection
  row: number
  col: number
}

export function TableGridDialog({
  path,
  state,
  onClose,
}: TableGridDialogProps) {
  const { doc, data } = state
  const rawBlock = getBlock(doc, path)
  const block =
    rawBlock && rawBlock.type === 'table' ? (rawBlock as TableBlock) : null

  const [active, setActive] = useState<ActiveCell>({
    section: 'body',
    row: 0,
    col: 0,
  })

  const pathKey = path.join('.')
  const stablePath = useMemo(() => path, [pathKey])
  const baseScope = useMemo(() => scopeAt(doc, stablePath), [doc, stablePath])

  const isEach = Boolean(
    block?.rows &&
      typeof block.rows === 'object' &&
      !Array.isArray(block.rows) &&
      'each' in block.rows,
  )

  const bodyScope = useMemo(() => {
    if (!block || !isEach) return baseScope
    const eachRows = block.rows as { each: string; as: string; cells: Cell[] }
    if (eachRows.as && eachRows.each) {
      return [...baseScope, { name: eachRows.as, arrayPath: eachRows.each }]
    }
    return baseScope
  }, [block, isEach, baseScope])

  if (!block) {
    return (
      <Dialog open={true} title="แก้ไขตาราง" onClose={onClose}>
        <div className="data-view__empty">
          <p className="data-view__empty-text">ไม่พบบล็อกตารางที่เลือก</p>
        </div>
      </Dialog>
    )
  }

  const columns = block.columns ?? []
  const headerRows = block.header ?? []
  const footerRows = block.footer ?? []
  const bodyRows: Cell[][] = isEach
    ? [(block.rows as { each: string; as: string; cells: Cell[] }).cells ?? []]
    : Array.isArray(block.rows)
      ? block.rows
      : []

  const getCell = (
    section: CellSection,
    rIdx: number,
    cIdx: number,
  ): Cell | undefined => {
    const rows =
      section === 'header'
        ? headerRows
        : section === 'footer'
          ? footerRows
          : bodyRows
    return rows[rIdx]?.[cIdx]
  }

  const mutateCell = (
    section: CellSection,
    rIdx: number,
    cIdx: number,
    updater: (cell: Cell) => Cell,
  ) => {
    if (section === 'header') {
      const nextHeader = headerRows.map((row, ri) =>
        ri === rIdx
          ? row.map((cell, ci) => (ci === cIdx ? updater(cell) : cell))
          : row,
      )
      commitBlockPatch(state, path, block, { header: nextHeader })
      return
    }
    if (section === 'footer') {
      const nextFooter = footerRows.map((row, ri) =>
        ri === rIdx
          ? row.map((cell, ci) => (ci === cIdx ? updater(cell) : cell))
          : row,
      )
      commitBlockPatch(state, path, block, { footer: nextFooter })
      return
    }
    if (isEach) {
      const eachRows = block.rows as { each: string; as: string; cells: Cell[] }
      const nextCells = (eachRows.cells ?? []).map((cell, ci) =>
        ci === cIdx ? updater(cell) : cell,
      )
      commitBlockPatch(state, path, block, {
        rows: { ...eachRows, cells: nextCells },
      })
    } else if (Array.isArray(block.rows)) {
      const nextRows = block.rows.map((row, ri) =>
        ri === rIdx
          ? row.map((cell, ci) => (ci === cIdx ? updater(cell) : cell))
          : row,
      )
      commitBlockPatch(state, path, block, { rows: nextRows })
    }
  }

  const handleCellTextChange = (
    section: CellSection,
    rIdx: number,
    cIdx: number,
    nextText: string,
  ) => {
    mutateCell(section, rIdx, cIdx, (cell) => ({
      ...cell,
      text: nextText,
    }))
  }

  const handleConvertCellToBlocks = (
    section: CellSection,
    rIdx: number,
    cIdx: number,
  ) => {
    mutateCell(section, rIdx, cIdx, (cell) => {
      const textVal = cell.text ?? ''
      const copy: Cell = {
        ...cell,
        blocks: [{ type: 'paragraph', text: textVal }],
      }
      delete copy.text
      return copy
    })
  }

  const handleSpanChange = (
    section: CellSection,
    rIdx: number,
    cIdx: number,
    field: 'colSpan' | 'rowSpan',
    raw: string,
  ) => {
    const n = raw ? parseInt(raw, 10) : undefined
    mutateCell(section, rIdx, cIdx, (cell) => {
      const copy: Cell = { ...cell }
      if (!n || Number.isNaN(n) || n <= 1) {
        delete copy[field]
      } else {
        copy[field] = n
      }
      return copy
    })
  }

  const handleAddRow = (afterIndex?: number) => {
    if (isEach || !Array.isArray(block.rows)) return
    const newRow: Cell[] = columns.map(() => ({ text: '' }))
    const insertIdx =
      afterIndex !== undefined ? afterIndex + 1 : block.rows.length
    const nextRows = [
      ...block.rows.slice(0, insertIdx),
      newRow,
      ...block.rows.slice(insertIdx),
    ]
    commitBlockPatch(state, path, block, { rows: nextRows })
  }

  const handleRemoveRow = (targetRowIdx?: number) => {
    if (isEach || !Array.isArray(block.rows) || block.rows.length <= 1) return
    const idxToRemove =
      targetRowIdx !== undefined
        ? targetRowIdx
        : Math.min(active.row, block.rows.length - 1)
    const nextRows = block.rows.filter((_, i) => i !== idxToRemove)
    commitBlockPatch(state, path, block, { rows: nextRows })
    setActive((prev) => ({
      ...prev,
      row: Math.max(0, Math.min(prev.row, nextRows.length - 1)),
    }))
  }

  const handleMoveRow = (rowIdx: number, delta: -1 | 1) => {
    if (isEach || !Array.isArray(block.rows)) return
    const targetIdx = rowIdx + delta
    if (targetIdx < 0 || targetIdx >= block.rows.length) return
    const nextRows = [...block.rows]
    const item = nextRows[rowIdx]!
    nextRows[rowIdx] = nextRows[targetIdx]!
    nextRows[targetIdx] = item
    commitBlockPatch(state, path, block, { rows: nextRows })
    setActive((prev) => ({ ...prev, row: targetIdx }))
  }

  const handleAddColumn = (afterColIdx?: number) => {
    const insertIdx =
      afterColIdx !== undefined ? afterColIdx + 1 : columns.length
    const nextCols = [
      ...columns.slice(0, insertIdx),
      { width: '*' as const },
      ...columns.slice(insertIdx),
    ]

    const insertCellInRow = (row: Cell[]) => [
      ...row.slice(0, insertIdx),
      { text: '' },
      ...row.slice(insertIdx),
    ]

    let nextRows: TableBlock['rows'] = block.rows
    if (Array.isArray(block.rows)) {
      nextRows = block.rows.map(insertCellInRow)
    } else if (isEach) {
      const eachRows = block.rows as { each: string; as: string; cells: Cell[] }
      nextRows = {
        ...eachRows,
        cells: insertCellInRow(eachRows.cells ?? []),
      }
    }

    const patch: Record<string, unknown> = {
      columns: nextCols,
      rows: nextRows,
    }
    if (Array.isArray(block.header)) {
      patch.header = block.header.map(insertCellInRow)
    }
    if (Array.isArray(block.footer)) {
      patch.footer = block.footer.map(insertCellInRow)
    }
    commitBlockPatch(state, path, block, patch)
  }

  const handleRemoveColumn = (targetColIdx?: number) => {
    if (columns.length <= 1) return
    const idxToRemove =
      targetColIdx !== undefined
        ? targetColIdx
        : Math.min(active.col, columns.length - 1)

    const nextCols = columns.filter((_, i) => i !== idxToRemove)
    const removeCellInRow = (row: Cell[]) =>
      row.filter((_, i) => i !== idxToRemove)

    let nextRows: TableBlock['rows'] = block.rows
    if (Array.isArray(block.rows)) {
      nextRows = block.rows.map(removeCellInRow)
    } else if (isEach) {
      const eachRows = block.rows as { each: string; as: string; cells: Cell[] }
      nextRows = {
        ...eachRows,
        cells: removeCellInRow(eachRows.cells ?? []),
      }
    }

    const patch: Record<string, unknown> = {
      columns: nextCols,
      rows: nextRows,
    }
    if (Array.isArray(block.header)) {
      patch.header = block.header.map(removeCellInRow)
    }
    if (Array.isArray(block.footer)) {
      patch.footer = block.footer.map(removeCellInRow)
    }
    commitBlockPatch(state, path, block, patch)
    setActive((prev) => ({
      ...prev,
      col: Math.max(0, Math.min(prev.col, nextCols.length - 1)),
    }))
  }

  const handleMoveColumn = (colIdx: number, delta: -1 | 1) => {
    const targetIdx = colIdx + delta
    if (targetIdx < 0 || targetIdx >= columns.length) return

    const swapInArray = <T,>(arr: T[]): T[] => {
      const copy = [...arr]
      const item = copy[colIdx]!
      copy[colIdx] = copy[targetIdx]!
      copy[targetIdx] = item
      return copy
    }

    const nextCols = swapInArray(columns)
    let nextRows: TableBlock['rows'] = block.rows
    if (Array.isArray(block.rows)) {
      nextRows = block.rows.map(swapInArray)
    } else if (isEach) {
      const eachRows = block.rows as { each: string; as: string; cells: Cell[] }
      nextRows = {
        ...eachRows,
        cells: swapInArray(eachRows.cells ?? []),
      }
    }

    const patch: Record<string, unknown> = {
      columns: nextCols,
      rows: nextRows,
    }
    if (Array.isArray(block.header)) {
      patch.header = block.header.map(swapInArray)
    }
    if (Array.isArray(block.footer)) {
      patch.footer = block.footer.map(swapInArray)
    }
    commitBlockPatch(state, path, block, patch)
    setActive((prev) => ({ ...prev, col: targetIdx }))
  }

  const activeCell = getCell(active.section, active.row, active.col)

  const renderCell = (
    section: CellSection,
    rIdx: number,
    cIdx: number,
    cell: Cell,
  ) => {
    const isCellActive =
      active.section === section && active.row === rIdx && active.col === cIdx
    const sectionPrefix =
      section === 'header'
        ? 'Header'
        : section === 'footer'
          ? 'Footer'
          : 'Body'
    const cellAriaLabel = `${sectionPrefix} cell ${rIdx + 1},${cIdx + 1}`
    const scopeForCell = section === 'body' ? bodyScope : baseScope

    const cellMenuItems = [
      ...(!cell.blocks
        ? [
            {
              label: 'แปลงเซลล์เป็นบล็อก',
              onSelect: () => handleConvertCellToBlocks(section, rIdx, cIdx),
            },
          ]
        : []),
      ...(section === 'body' && !isEach
        ? [
            {
              label: 'เพิ่มแถวด้านล่าง',
              onSelect: () => handleAddRow(rIdx),
            },
            {
              label: 'ย้ายแถวขึ้น',
              disabled: rIdx <= 0,
              onSelect: () => handleMoveRow(rIdx, -1),
            },
            {
              label: 'ย้ายแถวลง',
              disabled: rIdx >= bodyRows.length - 1,
              onSelect: () => handleMoveRow(rIdx, 1),
            },
            {
              label: 'ลบแถวนี้',
              danger: true,
              disabled: bodyRows.length <= 1,
              onSelect: () => handleRemoveRow(rIdx),
            },
          ]
        : []),
      {
        label: 'เพิ่มคอลัมน์ด้านขวา',
        onSelect: () => handleAddColumn(cIdx),
      },
      {
        label: 'ย้ายคอลัมน์ซ้าย',
        disabled: cIdx <= 0,
        onSelect: () => handleMoveColumn(cIdx, -1),
      },
      {
        label: 'ย้ายคอลัมน์ขวา',
        disabled: cIdx >= columns.length - 1,
        onSelect: () => handleMoveColumn(cIdx, 1),
      },
      {
        label: 'ลบคอลัมน์นี้',
        danger: true,
        disabled: columns.length <= 1,
        onSelect: () => handleRemoveColumn(cIdx),
      },
    ]

    return (
      <td
        key={`${section}-${rIdx}-${cIdx}`}
        colSpan={cell.colSpan}
        rowSpan={cell.rowSpan}
        className={isCellActive ? 'table-grid__cell--active' : undefined}
        onClick={() => setActive({ section, row: rIdx, col: cIdx })}
        onFocusCapture={() => setActive({ section, row: rIdx, col: cIdx })}
      >
        <div className="table-grid__cell-inner">
          <div className="table-grid__cell-input">
            {Array.isArray(cell.blocks) ? (
              <Chip tone="accent">บล็อกย่อย ({cell.blocks.length})</Chip>
            ) : (
              <BindableInput
                aria-label={cellAriaLabel}
                value={cell.text ?? ''}
                onChange={(next) =>
                  handleCellTextChange(section, rIdx, cIdx, next)
                }
                data={data}
                scope={scopeForCell}
              />
            )}
          </div>
          <div className="table-grid__cell-handle">
            <Menu
              label={`ตัวเลือกเซลล์ ${rIdx + 1},${cIdx + 1}`}
              items={cellMenuItems}
            />
          </div>
        </div>
      </td>
    )
  }

  return (
    <Dialog open={true} title="แก้ไขตาราง" onClose={onClose}>
      <div className="table-grid-dialog">
        <div className="table-grid-dialog__toolbar">
          <div className="table-grid-dialog__toolbar-group">
            <button
              type="button"
              className="ui-btn"
              aria-label="Add row"
              disabled={isEach}
              onClick={() => handleAddRow()}
            >
              + เพิ่มแถว
            </button>
            <button
              type="button"
              className="ui-btn"
              aria-label="Remove row"
              disabled={isEach || bodyRows.length <= 1}
              onClick={() => handleRemoveRow()}
            >
              ลบแถว
            </button>
            <button
              type="button"
              className="ui-btn"
              aria-label="Add column"
              onClick={() => handleAddColumn()}
            >
              + เพิ่มคอลัมน์
            </button>
            <button
              type="button"
              className="ui-btn"
              aria-label="Remove column"
              disabled={columns.length <= 1}
              onClick={() => handleRemoveColumn()}
            >
              ลบคอลัมน์
            </button>
          </div>

          <div className="table-grid-dialog__toolbar-group">
            {activeCell && !Array.isArray(activeCell.blocks) && (
              <button
                type="button"
                className="ui-btn"
                aria-label="แปลงเซลล์เป็นบล็อก"
                onClick={() =>
                  handleConvertCellToBlocks(
                    active.section,
                    active.row,
                    active.col,
                  )
                }
              >
                แปลงเซลล์เป็นบล็อก
              </button>
            )}
          </div>
        </div>

        {isEach && (
          <div className="table-grid-dialog__note">
            แถวเนื้อหาผูกกับอาเรย์{' '}
            <strong>
              {(block.rows as { each: string; as: string }).each}
            </strong>{' '}
            (ตัวแปรลูป:{' '}
            <strong>{(block.rows as { each: string; as: string }).as}</strong>)
            — แก้ไขแถวต้นแบบ 1 แถวด้านล่าง
          </div>
        )}

        <div className="table-grid-dialog__scroll">
          {columns.length === 0 ? (
            <div className="data-view__empty">
              <p className="data-view__empty-text">ยังไม่มีคอลัมน์ในตาราง</p>
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                onClick={() => handleAddColumn()}
              >
                + เพิ่มคอลัมน์แรก
              </button>
            </div>
          ) : (
            <table className="table-grid">
              <thead>
                <tr>
                  {columns.map((col, cIdx) => (
                    <th key={cIdx}>
                      คอลัมน์ {cIdx + 1} ({String(col.width ?? '*')})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {headerRows.map((row, rIdx) => (
                  <tr key={`header-${rIdx}`}>
                    {row.map((cell, cIdx) =>
                      renderCell('header', rIdx, cIdx, cell),
                    )}
                  </tr>
                ))}
                {bodyRows.map((row, rIdx) => (
                  <tr key={`body-${rIdx}`}>
                    {row.map((cell, cIdx) =>
                      renderCell('body', rIdx, cIdx, cell),
                    )}
                  </tr>
                ))}
                {footerRows.map((row, rIdx) => (
                  <tr key={`footer-${rIdx}`}>
                    {row.map((cell, cIdx) =>
                      renderCell('footer', rIdx, cIdx, cell),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {activeCell && (
          <div className="table-grid-dialog__inspector">
            <span>
              เซลล์ที่เลือก: {active.section} [{active.row + 1},{' '}
              {active.col + 1}]
            </span>
            <div className="table-grid-dialog__toolbar-group">
              <label>
                รวมคอลัมน์ (colSpan){' '}
                <input
                  type="number"
                  min={1}
                  aria-label="Col span"
                  className="ui-input table-grid-dialog__span-input"
                  value={activeCell.colSpan ?? 1}
                  onChange={(e) =>
                    handleSpanChange(
                      active.section,
                      active.row,
                      active.col,
                      'colSpan',
                      e.target.value,
                    )
                  }
                />
              </label>
              <label>
                รวมแถว (rowSpan){' '}
                <input
                  type="number"
                  min={1}
                  aria-label="Row span"
                  className="ui-input table-grid-dialog__span-input"
                  value={activeCell.rowSpan ?? 1}
                  onChange={(e) =>
                    handleSpanChange(
                      active.section,
                      active.row,
                      active.col,
                      'rowSpan',
                      e.target.value,
                    )
                  }
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
