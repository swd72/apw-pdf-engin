import React from 'react'
import type { SignatureBlock } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'
import { BindingInput } from '../BindingInput.js'
import { scopeAt } from '../../editor/bindings.js'

export interface SignatureInspectorProps {
  block: SignatureBlock
  path: BlockPath
  state: EditorState
}

export function SignatureInspector({ block, path, state }: SignatureInspectorProps) {
  const { doc, data, updateBlock } = state
  const scope = scopeAt(doc, path)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
        Signature Properties
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="sig-name" style={{ fontSize: '12px', fontWeight: 500 }}>
          Name
        </label>
        <BindingInput
          id="sig-name"
          aria-label="Signature name"
          value={block.name ?? ''}
          onChange={(next) => updateBlock(path, { name: next })}
          data={data}
          scope={scope}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="sig-prefix" style={{ fontSize: '12px', fontWeight: 500 }}>
          Prefix
        </label>
        <BindingInput
          id="sig-prefix"
          aria-label="Signature prefix"
          value={block.prefix ?? ''}
          onChange={(next) => updateBlock(path, { prefix: next || undefined })}
          data={data}
          scope={scope}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="sig-positions" style={{ fontSize: '12px', fontWeight: 500 }}>
          Positions (one per line)
        </label>
        <textarea
          id="sig-positions"
          aria-label="Signature positions"
          rows={3}
          value={block.positions ? block.positions.join('\n') : ''}
          onChange={(e) => {
            const lines = e.target.value
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
            updateBlock(path, { positions: lines.length > 0 ? lines : undefined })
          }}
          placeholder="e.g. Director&#10;Department of Justice"
          style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Start At</label>
          <input
            type="text"
            aria-label="Start at"
            value={String(block.startAt ?? '')}
            onChange={(e) => updateBlock(path, { startAt: e.target.value || undefined })}
            placeholder="e.g. center, 10cm"
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Lines Before</label>
          <input
            type="number"
            aria-label="Lines before"
            value={block.linesBefore ?? ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : undefined
              updateBlock(path, { linesBefore: val })
            }}
            placeholder="e.g. 2"
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
        </div>
      </div>
    </div>
  )
}
