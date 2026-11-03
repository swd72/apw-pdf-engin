import React from 'react'
import type { LineBlock } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'

export interface LineInspectorProps {
  block: LineBlock
  path: BlockPath
  state: EditorState
}

export function LineInspector({ block, path, state }: LineInspectorProps) {
  const { updateBlock } = state

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
        Horizontal Line Properties
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Thickness</label>
          <input
            type="text"
            aria-label="Line thickness"
            value={(block.thickness as string) ?? ''}
            onChange={(e) => updateBlock(path, { thickness: e.target.value || undefined })}
            placeholder="e.g. 1pt"
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Style</label>
          <select
            aria-label="Line style"
            value={block.style ?? 'solid'}
            onChange={(e) => updateBlock(path, { style: e.target.value as any })}
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          >
            <option value="solid">solid</option>
            <option value="dashed">dashed</option>
            <option value="dotted">dotted</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Space Before</label>
          <input
            type="text"
            aria-label="Space before"
            value={(block.spaceBefore as string) ?? ''}
            onChange={(e) => updateBlock(path, { spaceBefore: e.target.value || undefined })}
            placeholder="e.g. 6pt"
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Space After</label>
          <input
            type="text"
            aria-label="Space after"
            value={(block.spaceAfter as string) ?? ''}
            onChange={(e) => updateBlock(path, { spaceAfter: e.target.value || undefined })}
            placeholder="e.g. 6pt"
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
        </div>
      </div>
    </div>
  )
}
