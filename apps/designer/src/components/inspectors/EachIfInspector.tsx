import React, { useState } from 'react'
import type { EachBlock, IfBlock } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'

export interface EachIfInspectorProps {
  block: EachBlock | IfBlock
  path: BlockPath
  state: EditorState
}

function isValidSafeIdentifier(id: string): boolean {
  if (!id || typeof id !== 'string') return false
  if (id === '__proto__' || id === 'constructor' || id === 'prototype') return false
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(id)
}

export function EachIfInspector({ block, path, state }: EachIfInspectorProps) {
  const { updateBlock } = state
  const isIf = block.type === 'if'
  const [asError, setAsError] = useState<string | null>(null)

  if (isIf) {
    const ifBlock = block as IfBlock
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
          If Block Properties
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label htmlFor="if-test" style={{ fontSize: '12px', fontWeight: 500 }}>
            Test Expression
          </label>
          <input
            id="if-test"
            type="text"
            aria-label="Test expression"
            value={ifBlock.test ?? ''}
            onChange={(e) => updateBlock(path, { test: e.target.value })}
            placeholder="e.g. active && count > 0"
            style={{
              padding: '6px 8px',
              fontSize: '12px',
              fontFamily: 'monospace',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>
      </div>
    )
  }

  const eachBlock = block as EachBlock
  const handleAsChange = (val: string) => {
    if (!isValidSafeIdentifier(val)) {
      setAsError('Invalid loop variable identifier')
      return
    }
    setAsError(null)
    updateBlock(path, { as: val })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
        Each Block Properties
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="each-of" style={{ fontSize: '12px', fontWeight: 500 }}>
          Array Path (of)
        </label>
        <input
          id="each-of"
          type="text"
          aria-label="Array path"
          value={eachBlock.of ?? ''}
          onChange={(e) => updateBlock(path, { of: e.target.value })}
          placeholder="e.g. items, invoice.lines"
          style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="each-as" style={{ fontSize: '12px', fontWeight: 500 }}>
          Variable Name (as)
        </label>
        <input
          id="each-as"
          type="text"
          aria-label="Variable name"
          defaultValue={eachBlock.as ?? ''}
          onChange={(e) => handleAsChange(e.target.value)}
          placeholder="e.g. item"
          style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        {asError && (
          <span role="alert" style={{ fontSize: '11px', color: '#dc3545' }}>
            {asError}
          </span>
        )}
      </div>
    </div>
  )
}
