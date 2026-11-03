import React from 'react'
import type { ImageBlock } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'
import { BindingInput } from '../BindingInput.js'
import { scopeAt } from '../../editor/bindings.js'

export interface ImageInspectorProps {
  block: ImageBlock
  path: BlockPath
  state: EditorState
}

export function ImageInspector({ block, path, state }: ImageInspectorProps) {
  const { doc, data, updateBlock } = state
  const scope = scopeAt(doc, path)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
        Image Properties
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="img-src" style={{ fontSize: '12px', fontWeight: 500 }}>
          Source (URL or asset:name)
        </label>
        <BindingInput
          id="img-src"
          aria-label="Image source"
          value={block.src ?? ''}
          onChange={(next) => updateBlock(path, { src: next })}
          data={data}
          scope={scope}
          placeholder="e.g. asset:garuda"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Width</label>
          <input
            type="text"
            aria-label="Image width"
            value={(block.width as string) ?? ''}
            onChange={(e) => updateBlock(path, { width: e.target.value || undefined })}
            placeholder="e.g. 3cm, 100pt"
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Height</label>
          <input
            type="text"
            aria-label="Image height"
            value={(block.height as string) ?? ''}
            onChange={(e) => updateBlock(path, { height: e.target.value || undefined })}
            placeholder="e.g. 3cm, 100pt"
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Align</label>
          <select
            aria-label="Image align"
            value={block.align ?? 'center'}
            onChange={(e) => updateBlock(path, { align: e.target.value as any })}
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Space After</label>
          <input
            type="text"
            aria-label="Space after"
            value={(block.spaceAfter as string) ?? ''}
            onChange={(e) => updateBlock(path, { spaceAfter: e.target.value || undefined })}
            placeholder="e.g. 12pt"
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
        </div>
      </div>
    </div>
  )
}
