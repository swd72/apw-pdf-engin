import React from 'react'
import type { SpacerBlock } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'

export interface SpacerInspectorProps {
  block: SpacerBlock
  path: BlockPath
  state: EditorState
}

export function SpacerInspector({ block, path, state }: SpacerInspectorProps) {
  const { updateBlock } = state

  const isLines = typeof block.height === 'object' && block.height !== null && 'lines' in block.height

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
        Spacer Properties
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="spacer-height" style={{ fontSize: '12px', fontWeight: 500 }}>
          Height
        </label>
        <input
          id="spacer-height"
          type="text"
          aria-label="Spacer height"
          value={isLines ? String((block.height as { lines: number }).lines) : String(block.height ?? '')}
          onChange={(e) => {
            const val = e.target.value
            if (isLines) {
              const num = parseInt(val, 10)
              updateBlock(path, { height: { lines: isNaN(num) ? 1 : num } })
            } else {
              updateBlock(path, { height: val })
            }
          }}
          placeholder="e.g. 12pt, 1cm"
          style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <label style={{ fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={isLines}
            onChange={(e) => {
              if (e.target.checked) {
                updateBlock(path, { height: { lines: 1 } })
              } else {
                updateBlock(path, { height: '12pt' })
              }
            }}
          />{' '}
          Height in lines (relative to font)
        </label>
      </div>
    </div>
  )
}
