import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { ColumnsBlock } from '@apw-pdf/core'
import type { EditorState } from '../../../editor/useEditorState.js'
import type { BlockPath } from '../../../editor/docModel.js'
import { IconButton } from '../../../ui/IconButton.js'
import { TrashIcon } from '../../../ui/icons.js'
import { Section } from '../Section.js'
import { Field } from '../Field.js'
import { AddProperty, type AddPropertyOption } from '../AddProperty.js'
import { commitBlockPatch, isPropertySet } from '../shared.js'

export interface ColumnsPropsProps {
  block: ColumnsBlock
  path: BlockPath
  state: EditorState
}

const OPTIONAL_COLUMNS_PROPS: Array<{ key: string; label: string }> = [
  { key: 'gap', label: 'ระยะห่างระหว่างคอลัมน์' },
  { key: 'keepTogether', label: 'ห้ามแยกหน้า' },
]

export function ColumnsProps({ block, path, state }: ColumnsPropsProps) {
  const [revealed, setRevealed] = useState<string[]>([])
  const pathKey = path.join('.')
  const prevPathKeyRef = useRef(pathKey)

  useEffect(() => {
    if (prevPathKeyRef.current !== pathKey) {
      prevPathKeyRef.current = pathKey
      setRevealed([])
    }
  }, [pathKey])

  const isShown = (key: string): boolean =>
    isPropertySet(block, key) || revealed.includes(key)

  const resetKey = (key: string) => {
    setRevealed((prev) => prev.filter((k) => k !== key))
    commitBlockPatch(state, path, block, { [key]: undefined })
  }

  const handleAddColumn = () => {
    const cols = block.columns ?? []
    const nextCols = [...cols, { width: '*' as const, blocks: [] }]
    commitBlockPatch(state, path, block, { columns: nextCols })
  }

  const handleRemoveColumn = (idx: number) => {
    const cols = block.columns ?? []
    const nextCols = cols.filter((_, i) => i !== idx)
    commitBlockPatch(state, path, block, { columns: nextCols })
  }

  const addOptions = useMemo<AddPropertyOption[]>(() => {
    return OPTIONAL_COLUMNS_PROPS.filter(
      (p) => !isPropertySet(block, p.key) && !revealed.includes(p.key),
    ).map((p) => ({
      key: p.key,
      label: p.label,
      add: () => setRevealed((prev) => [...prev, p.key]),
    }))
  }, [block, revealed])

  return (
    <div className="properties-panel__body">
      <Section title="การจัดวาง (Layout)">
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
                  placeholder="*, 50%, 5cm"
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
                      colCopy.align = e.target.value as 'left' | 'right'
                    }
                    nextCols[idx] = colCopy
                    commitBlockPatch(state, path, block, { columns: nextCols })
                  }}
                >
                  <option value="">ค่าเริ่มต้น</option>
                  <option value="left">ชิดซ้าย (left)</option>
                  <option value="right">ชิดขวา (right)</option>
                </select>

                <div className="prop-col-actions">
                  {block.columns.length > 1 && (
                    <IconButton
                      label={`Remove column ${idx + 1}`}
                      icon={<TrashIcon size={16} />}
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

        {isShown('gap') && (
          <Field
            label="ระยะห่างระหว่างคอลัมน์ (gap)"
            htmlFor="cols-gap"
            onReset={() => resetKey('gap')}
          >
            <input
              id="cols-gap"
              type="text"
              aria-label="Columns gap"
              className="ui-input"
              value={(block.gap as string) ?? ''}
              onChange={(e) =>
                commitBlockPatch(state, path, block, {
                  gap: e.target.value === '' ? undefined : e.target.value,
                })
              }
              placeholder="เช่น 12pt, 1cm"
            />
          </Field>
        )}

        {isShown('keepTogether') && (
          <Field
            label="ห้ามแยกหน้า (keepTogether)"
            onReset={() => resetKey('keepTogether')}
          >
            <label className="prop-checkbox">
              <input
                type="checkbox"
                aria-label="Keep together"
                checked={Boolean(block.keepTogether)}
                onChange={(e) =>
                  commitBlockPatch(state, path, block, {
                    keepTogether: e.target.checked || undefined,
                  })
                }
              />
              แสดงคอลัมน์ในหน้าเดียวกันเสมอ
            </label>
          </Field>
        )}
      </Section>

      <AddProperty options={addOptions} />
    </div>
  )
}
