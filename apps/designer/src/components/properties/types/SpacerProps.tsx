import React from 'react'
import type { Length, SpacerBlock } from '@apw-pdf/core'
import type { EditorState } from '../../../editor/useEditorState.js'
import type { BlockPath } from '../../../editor/docModel.js'
import { Section } from '../Section.js'
import { Field } from '../Field.js'
import { LengthInput } from '../../../ui/LengthInput.js'
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
          {isLines ? (
            <input
              id="spacer-height"
              type="text"
              aria-label="Spacer height"
              className="ui-input"
              value={String((block.height as { lines: number }).lines)}
              onChange={(e) => {
                const num = parseInt(e.target.value, 10)
                commitBlockPatch(state, path, block, {
                  height: { lines: Number.isNaN(num) || num <= 0 ? 1 : num },
                })
              }}
              placeholder="จำนวนบรรทัด เช่น 1"
            />
          ) : (
            <LengthInput
              id="spacer-height"
              aria-label="Spacer height"
              defaultUnit="pt"
              value={block.height as Length | undefined}
              onChange={(next) =>
                commitBlockPatch(state, path, block, { height: next })
              }
            />
          )}
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
