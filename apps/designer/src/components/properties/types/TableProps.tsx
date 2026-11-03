import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { TableBlock, Cell } from '@apw-pdf/core'
import type { EditorState } from '../../../editor/useEditorState.js'
import type { BlockPath } from '../../../editor/docModel.js'
import { IconButton } from '../../../ui/IconButton.js'
import { UpIcon, DownIcon, TrashIcon, TableIcon } from '../../../ui/icons.js'
import { TableGridDialog } from '../../table/TableGridDialog.js'
import { Section } from '../Section.js'
import { Field } from '../Field.js'
import { AddProperty, type AddPropertyOption } from '../AddProperty.js'
import {
  commitBlockPatch,
  isPropertySet,
  isValidSafeIdentifier,
  listArrayPaths,
} from '../shared.js'

export interface TablePropsProps {
  block: TableBlock
  path: BlockPath
  state: EditorState
  onOpenTableEditor?(path: BlockPath): void
}

const OPTIONAL_TABLE_PROPS: Array<{ key: string; label: string }> = [
  { key: 'repeatHeader', label: 'ซ้ำหัวตารางทุกหน้า' },
  { key: 'border', label: 'เส้นขอบตาราง' },
  { key: 'cellPadding', label: 'ระยะขอบในเซลล์' },
  { key: 'allowRowSplit', label: 'อนุญาตแบ่งแถวข้ามหน้า' },
]

export function TableProps({
  block,
  path,
  state,
  onOpenTableEditor,
}: TablePropsProps) {
  const isEachProp = Boolean(
    block.rows &&
      typeof block.rows === 'object' &&
      !Array.isArray(block.rows) &&
      'each' in block.rows,
  )

  const [revealed, setRevealed] = useState<string[]>([])
  const [gridOpen, setGridOpen] = useState(false)
  const [localAs, setLocalAs] = useState(
    isEachProp ? ((block.rows as any).as ?? '') : 'item',
  )
  const [asError, setAsError] = useState<string | null>(null)

  const pathKey = path.join('.')
  const prevPathKeyRef = useRef(pathKey)
  const prevRowsRef = useRef(block.rows)

  useEffect(() => {
    if (prevPathKeyRef.current !== pathKey) {
      prevPathKeyRef.current = pathKey
      setRevealed([])
      setAsError(null)
    }
  }, [pathKey])

  if (block.rows !== prevRowsRef.current) {
    prevRowsRef.current = block.rows
    if (isEachProp) {
      setLocalAs((block.rows as any).as ?? '')
      setAsError(null)
    }
  }

  const arrayPaths = useMemo(() => listArrayPaths(state.data), [state.data])

  const isShown = (key: string): boolean =>
    isPropertySet(block, key) || revealed.includes(key)

  const resetKey = (key: string) => {
    setRevealed((prev) => prev.filter((k) => k !== key))
    commitBlockPatch(state, path, block, { [key]: undefined })
  }

  const getEffectiveCells = (): Cell[] => {
    if (isEachProp && Array.isArray((block.rows as any).cells)) {
      return (block.rows as any).cells
    }
    return (block.columns ?? []).map(() => ({ text: '' }))
  }

  const handleAddColumn = () => {
    const currentCols = block.columns ?? []
    const nextCols = [...currentCols, { width: '*' as const }]

    let nextRows = block.rows
    if (Array.isArray(nextRows)) {
      nextRows = nextRows.map((row) => [...row, { text: '' }])
    } else if (nextRows && 'cells' in nextRows) {
      nextRows = {
        ...nextRows,
        cells: [...nextRows.cells, { text: '' }],
      }
    }

    const patch: Record<string, unknown> = {
      columns: nextCols,
      rows: nextRows,
    }
    if (Array.isArray(block.header)) {
      patch.header = block.header.map((row) => [...row, { text: '' }])
    }
    if (Array.isArray(block.footer)) {
      patch.footer = block.footer.map((row) => [...row, { text: '' }])
    }
    commitBlockPatch(state, path, block, patch)
  }

  const handleRemoveColumn = (idx: number) => {
    if ((block.columns?.length ?? 0) <= 1) return
    const nextCols = block.columns.filter((_, i) => i !== idx)
    const removeAt = (row: Cell[]) => row.filter((_, i) => i !== idx)

    let nextRows = block.rows
    if (Array.isArray(nextRows)) {
      nextRows = nextRows.map(removeAt)
    } else if (nextRows && 'cells' in nextRows) {
      nextRows = {
        ...nextRows,
        cells: removeAt(nextRows.cells),
      }
    }

    const patch: Record<string, unknown> = {
      columns: nextCols,
      rows: nextRows,
    }
    if (Array.isArray(block.header)) {
      patch.header = block.header.map(removeAt)
    }
    if (Array.isArray(block.footer)) {
      patch.footer = block.footer.map(removeAt)
    }
    commitBlockPatch(state, path, block, patch)
  }

  const handleMoveColumn = (idx: number, delta: -1 | 1) => {
    const cols = block.columns ?? []
    const target = idx + delta
    if (target < 0 || target >= cols.length) return

    const swap = <T,>(arr: T[]): T[] => {
      const copy = [...arr]
      const item = copy[idx]!
      copy[idx] = copy[target]!
      copy[target] = item
      return copy
    }

    const nextCols = swap(cols)
    let nextRows = block.rows
    if (Array.isArray(nextRows)) {
      nextRows = nextRows.map(swap)
    } else if (nextRows && 'cells' in nextRows) {
      nextRows = {
        ...nextRows,
        cells: swap(nextRows.cells),
      }
    }

    const patch: Record<string, unknown> = {
      columns: nextCols,
      rows: nextRows,
    }
    if (Array.isArray(block.header)) {
      patch.header = block.header.map(swap)
    }
    if (Array.isArray(block.footer)) {
      patch.footer = block.footer.map(swap)
    }
    commitBlockPatch(state, path, block, patch)
  }

  const handleModeChange = (nextMode: 'fixed' | 'each') => {
    setAsError(null)
    if (nextMode === 'each') {
      const defaultEach = arrayPaths[0] || 'items'
      const defaultAs = isValidSafeIdentifier(localAs) ? localAs : 'item'
      setLocalAs(defaultAs)
      const cells: Cell[] = (block.columns ?? []).map(() => ({ text: '' }))
      commitBlockPatch(state, path, block, {
        rows: {
          each: defaultEach,
          as: defaultAs,
          cells,
        },
      })
    } else {
      const row: Cell[] = (block.columns ?? []).map(() => ({ text: '' }))
      commitBlockPatch(state, path, block, {
        rows: [row],
      })
    }
  }

  const handleEachChange = (val: string) => {
    if (!isEachProp) return
    const currentEach = block.rows as { each: string; as: string; cells: Cell[] }
    commitBlockPatch(state, path, block, {
      rows: {
        each: val,
        as: currentEach.as || 'item',
        cells: getEffectiveCells(),
      },
    })
  }

  const handleAsChange = (val: string) => {
    setLocalAs(val)
    if (!isValidSafeIdentifier(val)) {
      setAsError('ชื่อตัวแปรลูปไม่ถูกต้อง (Invalid loop variable identifier)')
      return
    }
    setAsError(null)
    if (!isEachProp) return
    const currentEach = block.rows as { each: string; as: string; cells: Cell[] }
    commitBlockPatch(state, path, block, {
      rows: {
        each: currentEach.each || 'items',
        as: val,
        cells: getEffectiveCells(),
      },
    })
  }

  const hasHeader = Array.isArray(block.header) && block.header.length > 0
  const hasFooter = Array.isArray(block.footer) && block.footer.length > 0

  const toggleHeader = (checked: boolean) => {
    if (checked) {
      const row: Cell[] = (block.columns ?? []).map(() => ({ text: '' }))
      commitBlockPatch(state, path, block, { header: [row] })
    } else {
      commitBlockPatch(state, path, block, { header: undefined })
    }
  }

  const toggleFooter = (checked: boolean) => {
    if (checked) {
      const row: Cell[] = (block.columns ?? []).map(() => ({ text: '' }))
      commitBlockPatch(state, path, block, { footer: [row] })
    } else {
      commitBlockPatch(state, path, block, { footer: undefined })
    }
  }

  const addOptions = useMemo<AddPropertyOption[]>(() => {
    return OPTIONAL_TABLE_PROPS.filter(
      (p) => !isPropertySet(block, p.key) && !revealed.includes(p.key),
    ).map((p) => ({
      key: p.key,
      label: p.label,
      add: () => setRevealed((prev) => [...prev, p.key]),
    }))
  }, [block, revealed])

  const hasAdvanced =
    isShown('repeatHeader') ||
    isShown('border') ||
    isShown('cellPadding') ||
    isShown('allowRowSplit')

  return (
    <div className="properties-panel__body">
      <Section title="เนื้อหา (Content)">
        <button
          type="button"
          className="ui-btn ui-btn--primary"
          aria-label="แก้ไขตาราง"
          style={{ width: '100%' }}
          onClick={() => {
            onOpenTableEditor?.(path)
            setGridOpen(true)
          }}
        >
          <TableIcon size={16} />
          แก้ไขตาราง
        </button>

        <div className="prop-row-2">
          <label className="prop-checkbox">
            <input
              type="checkbox"
              aria-label="Show header"
              checked={hasHeader}
              onChange={(e) => toggleHeader(e.target.checked)}
            />
            แถวส่วนหัว (Header)
          </label>
          <label className="prop-checkbox">
            <input
              type="checkbox"
              aria-label="Show footer"
              checked={hasFooter}
              onChange={(e) => toggleFooter(e.target.checked)}
            />
            แถวส่วนท้าย (Footer)
          </label>
        </div>
      </Section>

      <Section title="การจัดวางคอลัมน์ (Layout)">
        <Field label={`คอลัมน์ (${block.columns?.length ?? 0})`}>
          <div className="prop-col-list">
            {(block.columns ?? []).map((col, idx) => (
              <div key={idx} className="prop-col-row">
                <input
                  type="text"
                  aria-label={`Column ${idx + 1} width`}
                  className="ui-input"
                  value={String(col.width ?? '*')}
                  onChange={(e) => {
                    const nextCols = [...block.columns]
                    nextCols[idx] = {
                      ...nextCols[idx]!,
                      width: e.target.value as any,
                    }
                    commitBlockPatch(state, path, block, { columns: nextCols })
                  }}
                  placeholder="*, 30%, 3cm"
                />

                <select
                  aria-label={`Column ${idx + 1} align`}
                  className="ui-select"
                  value={col.align ?? ''}
                  onChange={(e) => {
                    const nextCols = [...block.columns]
                    const colCopy = { ...nextCols[idx]! }
                    if (!e.target.value) {
                      delete colCopy.align
                    } else {
                      colCopy.align = e.target.value
                    }
                    nextCols[idx] = colCopy
                    commitBlockPatch(state, path, block, { columns: nextCols })
                  }}
                >
                  <option value="">ค่าเริ่มต้น</option>
                  <option value="left">ชิดซ้าย (left)</option>
                  <option value="center">กึ่งกลาง (center)</option>
                  <option value="right">ชิดขวา (right)</option>
                </select>

                <div className="prop-col-actions">
                  <IconButton
                    label={`Move column ${idx + 1} up`}
                    icon={<UpIcon size={14} />}
                    disabled={idx <= 0}
                    onClick={() => handleMoveColumn(idx, -1)}
                  />
                  <IconButton
                    label={`Move column ${idx + 1} down`}
                    icon={<DownIcon size={14} />}
                    disabled={idx >= (block.columns?.length ?? 0) - 1}
                    onClick={() => handleMoveColumn(idx, 1)}
                  />
                  {(block.columns?.length ?? 0) > 1 && (
                    <IconButton
                      label={`Remove column ${idx + 1}`}
                      icon={<TrashIcon size={14} />}
                      danger
                      onClick={() => handleRemoveColumn(idx)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            aria-label="Add column"
            onClick={handleAddColumn}
          >
            + เพิ่มคอลัมน์
          </button>
        </Field>
      </Section>

      <Section title="การผูกข้อมูลแถว (Data binding)">
        <Field label="แหล่งที่มาของแถว (rows)" htmlFor="tbl-mode">
          <select
            id="tbl-mode"
            aria-label="Body mode"
            className="ui-select"
            value={isEachProp ? 'each' : 'fixed'}
            onChange={(e) =>
              handleModeChange(e.target.value as 'fixed' | 'each')
            }
          >
            <option value="fixed">แถวคงที่ (Fixed rows)</option>
            <option value="each">ดึงจากอาเรย์ข้อมูล (each)</option>
          </select>
        </Field>

        {isEachProp && (
          <>
            <Field label="อาเรย์ข้อมูล (each)" htmlFor="tbl-each">
              <input
                id="tbl-each"
                type="text"
                aria-label="Each array path"
                list="table-array-paths"
                className="ui-input"
                value={(block.rows as any).each ?? ''}
                onChange={(e) => handleEachChange(e.target.value)}
                placeholder="เช่น items"
              />
              <datalist id="table-array-paths">
                {arrayPaths.map((ap) => (
                  <option key={ap} value={ap} />
                ))}
              </datalist>
            </Field>

            <Field
              label="ตัวแปรแต่ละแถว (as)"
              htmlFor="tbl-as"
              error={asError}
            >
              <input
                id="tbl-as"
                type="text"
                aria-label="Loop variable (as)"
                className="ui-input"
                value={localAs}
                onChange={(e) => handleAsChange(e.target.value)}
                placeholder="เช่น item"
              />
            </Field>
          </>
        )}
      </Section>

      {hasAdvanced && (
        <Section title="ขั้นสูง (Advanced)">
          {isShown('repeatHeader') && (
            <Field
              label="ซ้ำหัวตารางทุกหน้า (repeatHeader)"
              onReset={() => resetKey('repeatHeader')}
            >
              <label className="prop-checkbox">
                <input
                  type="checkbox"
                  aria-label="Repeat header"
                  checked={Boolean(block.repeatHeader)}
                  onChange={(e) =>
                    commitBlockPatch(state, path, block, {
                      repeatHeader: e.target.checked || undefined,
                    })
                  }
                />
                แสดงหัวตารางซ้ำเมื่อขึ้นหน้าใหม่
              </label>
            </Field>
          )}

          {isShown('border') && (
            <Field
              label="เส้นขอบตาราง (border)"
              onReset={() => resetKey('border')}
            >
              <label className="prop-checkbox">
                <input
                  type="checkbox"
                  aria-label="Table border"
                  checked={Boolean(block.border ?? true)}
                  onChange={(e) =>
                    commitBlockPatch(state, path, block, {
                      border: e.target.checked,
                    })
                  }
                />
                แสดงเส้นขอบตาราง
              </label>
            </Field>
          )}

          {isShown('cellPadding') && (
            <Field
              label="ระยะขอบในเซลล์ (cellPadding)"
              htmlFor="tbl-padding"
              onReset={() => resetKey('cellPadding')}
            >
              <input
                id="tbl-padding"
                type="text"
                aria-label="Cell padding"
                className="ui-input"
                value={(block.cellPadding as string) ?? ''}
                onChange={(e) =>
                  commitBlockPatch(state, path, block, {
                    cellPadding:
                      e.target.value === '' ? undefined : e.target.value,
                  })
                }
                placeholder="เช่น 4pt, 2mm"
              />
            </Field>
          )}

          {isShown('allowRowSplit') && (
            <Field
              label="อนุญาตแบ่งแถวข้ามหน้า (allowRowSplit)"
              onReset={() => resetKey('allowRowSplit')}
            >
              <label className="prop-checkbox">
                <input
                  type="checkbox"
                  aria-label="Allow row split"
                  checked={Boolean(block.allowRowSplit)}
                  onChange={(e) =>
                    commitBlockPatch(state, path, block, {
                      allowRowSplit: e.target.checked || undefined,
                    })
                  }
                />
                อนุญาตให้แบ่งเนื้อหาในแถวข้ามหน้าได้
              </label>
            </Field>
          )}
        </Section>
      )}

      <AddProperty options={addOptions} />

      {gridOpen && (
        <TableGridDialog
          path={path}
          state={state}
          onClose={() => setGridOpen(false)}
        />
      )}
    </div>
  )
}
