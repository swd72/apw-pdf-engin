import React from 'react'
import type { SpacerBlock } from '@apw-pdf/core'
import type { EditorState } from '../../../editor/useEditorState.js'
import type { BlockPath } from '../../../editor/docModel.js'
import { Section } from '../Section.js'
import { Field } from '../Field.js'
import { commitBlockPatch } from '../shared.js'

export interface SpacerPropsProps {
  block: SpacerBlock
  path: BlockPath
  state: EditorState
}

export function SpacerProps({ block, path, state }: SpacerPropsProps) {
  const isLines =
    typeof block.height === 'object' &&
    block.height !== null &&
    'lines' in block.height

  return (
    <div className="properties-panel__body">
      <Section title="การจัดวาง (Layout)">
        <Field label="ความสูงช่องว่าง (height)" htmlFor="spacer-height">
          <input
            id="spacer-height"
            type="text"
            aria-label="Spacer height"
            className="ui-input"
            value={
              isLines
                ? String((block.height as { lines: number }).lines)
                : String(block.height ?? '')
            }
            onChange={(e) => {
              const val = e.target.value
              if (isLines) {
                const num = parseInt(val, 10)
                commitBlockPatch(state, path, block, {
                  height: { lines: Number.isNaN(num) || num <= 0 ? 1 : num },
                })
              } else {
                commitBlockPatch(state, path, block, { height: val })
              }
            }}
            placeholder={isLines ? 'จำนวนบรรทัด เช่น 1' : 'เช่น 12pt, 1cm'}
          />
        </Field>

        <label className="prop-checkbox">
          <input
            type="checkbox"
            aria-label="Height in lines"
            checked={isLines}
            onChange={(e) => {
              if (e.target.checked) {
                commitBlockPatch(state, path, block, { height: { lines: 1 } })
              } else {
                commitBlockPatch(state, path, block, { height: '12pt' })
              }
            }}
          />
          ระบุเป็นจำนวนบรรทัด (lines)
        </label>
      </Section>
    </div>
  )
}
