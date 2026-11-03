import React, { useState, useMemo, useRef } from 'react'
import type { EachBlock } from '@apw-pdf/core'
import type { EditorState } from '../../../editor/useEditorState.js'
import type { BlockPath } from '../../../editor/docModel.js'
import { Section } from '../Section.js'
import { Field } from '../Field.js'
import {
  commitBlockPatch,
  isValidSafeIdentifier,
  listArrayPaths,
} from '../shared.js'

export interface RepeatPropsProps {
  block: EachBlock
  path: BlockPath
  state: EditorState
}

export function RepeatProps({ block, path, state }: RepeatPropsProps) {
  const [localAs, setLocalAs] = useState(block.as ?? '')
  const [asError, setAsError] = useState<string | null>(null)
  const prevAsRef = useRef(block.as)

  if (block.as !== prevAsRef.current) {
    prevAsRef.current = block.as
    setLocalAs(block.as ?? '')
    setAsError(null)
  }

  const arrayPaths = useMemo(() => listArrayPaths(state.data), [state.data])

  const handleAsChange = (val: string) => {
    setLocalAs(val)
    if (!isValidSafeIdentifier(val)) {
      setAsError('ชื่อตัวแปรไม่ถูกต้อง (Invalid loop variable identifier)')
      return
    }
    setAsError(null)
    commitBlockPatch(state, path, block, { as: val })
  }

  return (
    <div className="properties-panel__body">
      <Section title="การผูกข้อมูล (Data binding)">
        <Field label="อาเรย์ข้อมูล (of)" htmlFor="each-of">
          <input
            id="each-of"
            type="text"
            aria-label="Array path"
            list="repeat-array-paths"
            className="ui-input"
            value={block.of ?? ''}
            onChange={(e) =>
              commitBlockPatch(state, path, block, { of: e.target.value })
            }
            placeholder="เช่น items, invoice.lines"
          />
          <datalist id="repeat-array-paths">
            {arrayPaths.map((ap) => (
              <option key={ap} value={ap} />
            ))}
          </datalist>
        </Field>

        <Field
          label="ชื่อตัวแปรในลูป (as)"
          htmlFor="each-as"
          error={asError}
        >
          <input
            id="each-as"
            type="text"
            aria-label="Variable name"
            className="ui-input"
            value={localAs}
            onChange={(e) => handleAsChange(e.target.value)}
            placeholder="เช่น item"
          />
        </Field>
      </Section>
    </div>
  )
}
