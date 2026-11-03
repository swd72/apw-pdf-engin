import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { LineBlock } from '@apw-pdf/core'
import type { EditorState } from '../../../editor/useEditorState.js'
import type { BlockPath } from '../../../editor/docModel.js'
import { Section } from '../Section.js'
import { Field } from '../Field.js'
import { AddProperty, type AddPropertyOption } from '../AddProperty.js'
import { commitBlockPatch, isPropertySet } from '../shared.js'

export interface LinePropsProps {
  block: LineBlock
  path: BlockPath
  state: EditorState
}

const OPTIONAL_LINE_PROPS: Array<{ key: string; label: string }> = [
  { key: 'spaceBefore', label: 'ระยะก่อนหน้า' },
  { key: 'spaceAfter', label: 'ระยะหลัง' },
]

export function LineProps({ block, path, state }: LinePropsProps) {
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

  const addOptions = useMemo<AddPropertyOption[]>(() => {
    return OPTIONAL_LINE_PROPS.filter(
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
        <div className="prop-row-2">
          <Field
            label="ความหนา (thickness)"
            htmlFor="line-thickness"
            onReset={
              isPropertySet(block, 'thickness')
                ? () => resetKey('thickness')
                : undefined
            }
          >
            <input
              id="line-thickness"
              type="text"
              aria-label="Line thickness"
              className="ui-input"
              value={(block.thickness as string) ?? ''}
              onChange={(e) =>
                commitBlockPatch(state, path, block, {
                  thickness:
                    e.target.value === '' ? undefined : e.target.value,
                })
              }
              placeholder="เช่น 1pt"
            />
          </Field>

          <Field
            label="รูปแบบเส้น (style)"
            htmlFor="line-style"
            onReset={
              isPropertySet(block, 'style')
                ? () => resetKey('style')
                : undefined
            }
          >
            <select
              id="line-style"
              aria-label="Line style"
              className="ui-select"
              value={block.style ?? 'solid'}
              onChange={(e) =>
                commitBlockPatch(state, path, block, {
                  style: e.target.value as LineBlock['style'],
                })
              }
            >
              <option value="solid">ทึบ (solid)</option>
              <option value="dashed">ประยาว (dashed)</option>
              <option value="dotted">จุดไข่ปลา (dotted)</option>
            </select>
          </Field>
        </div>

        {isShown('spaceBefore') && (
          <Field
            label="ระยะก่อนหน้า (spaceBefore)"
            htmlFor="line-space-before"
            onReset={() => resetKey('spaceBefore')}
          >
            <input
              id="line-space-before"
              type="text"
              aria-label="Space before"
              className="ui-input"
              value={(block.spaceBefore as string) ?? ''}
              onChange={(e) =>
                commitBlockPatch(state, path, block, {
                  spaceBefore:
                    e.target.value === '' ? undefined : e.target.value,
                })
              }
              placeholder="เช่น 6pt"
            />
          </Field>
        )}

        {isShown('spaceAfter') && (
          <Field
            label="ระยะหลัง (spaceAfter)"
            htmlFor="line-space-after"
            onReset={() => resetKey('spaceAfter')}
          >
            <input
              id="line-space-after"
              type="text"
              aria-label="Space after"
              className="ui-input"
              value={(block.spaceAfter as string) ?? ''}
              onChange={(e) =>
                commitBlockPatch(state, path, block, {
                  spaceAfter:
                    e.target.value === '' ? undefined : e.target.value,
                })
              }
              placeholder="เช่น 6pt"
            />
          </Field>
        )}
      </Section>

      <AddProperty options={addOptions} />
    </div>
  )
}
