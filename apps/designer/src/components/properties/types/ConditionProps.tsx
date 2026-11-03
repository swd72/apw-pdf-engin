import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { IfBlock } from '@apw-pdf/core'
import type { EditorState } from '../../../editor/useEditorState.js'
import type { BlockPath } from '../../../editor/docModel.js'
import { Section } from '../Section.js'
import { Field } from '../Field.js'
import { AddProperty, type AddPropertyOption } from '../AddProperty.js'
import { commitBlockPatch, isPropertySet } from '../shared.js'

export interface ConditionPropsProps {
  block: IfBlock
  path: BlockPath
  state: EditorState
}

export function ConditionProps({ block, path, state }: ConditionPropsProps) {
  const [revealed, setRevealed] = useState<string[]>([])
  const pathKey = path.join('.')
  const prevPathKeyRef = useRef(pathKey)

  useEffect(() => {
    if (prevPathKeyRef.current !== pathKey) {
      prevPathKeyRef.current = pathKey
      setRevealed([])
    }
  }, [pathKey])

  const hasElse = isPropertySet(block, 'else') || revealed.includes('else')

  const addOptions = useMemo<AddPropertyOption[]>(() => {
    if (hasElse) return []
    return [
      {
        key: 'else',
        label: 'บล็อกกรณีเงื่อนไขเป็นเท็จ (else)',
        add: () => {
          setRevealed((prev) => [...prev, 'else'])
          commitBlockPatch(state, path, block, { else: [] })
        },
      },
    ]
  }, [hasElse, block, path, state])

  return (
    <div className="properties-panel__body">
      <Section title="การผูกข้อมูล (Data binding)">
        <Field label="นิพจน์เงื่อนไข (test)" htmlFor="if-test">
          <input
            id="if-test"
            type="text"
            aria-label="Test expression"
            className="ui-input"
            style={{ fontFamily: 'var(--font-mono)' }}
            value={block.test ?? ''}
            onChange={(e) =>
              commitBlockPatch(state, path, block, { test: e.target.value })
            }
            placeholder="เช่น active && count > 0"
          />
        </Field>

        {hasElse && (
          <Field
            label="กรณีเป็นเท็จ (else)"
            onReset={() => {
              setRevealed((prev) => prev.filter((k) => k !== 'else'))
              commitBlockPatch(state, path, block, { else: undefined })
            }}
          >
            <span className="add-property__key">
              เปิดใช้งานบล็อก else ({block.else?.length ?? 0} บล็อกย่อย)
            </span>
          </Field>
        )}
      </Section>

      <AddProperty options={addOptions} />
    </div>
  )
}
