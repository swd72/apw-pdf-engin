import React from 'react'
import type { ColumnsBlock } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'

export interface ColumnsInspectorProps {
  block: ColumnsBlock
  path: BlockPath
  state: EditorState
}

export function ColumnsInspector({ block, path, state }: ColumnsInspectorProps) {
  const { updateBlock } = state

  const handleAddColumn = () => {
    const cols = block.columns || []
    const newCols = [...cols, { width: '*' as const, blocks: [] }]
    updateBlock(path, { columns: newCols })
  }

  const handleRemoveColumn = (idx: number) => {
    const cols = block.columns || []
    const newCols = cols.filter((_, i) => i !== idx)
    updateBlock(path, { columns: newCols })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
        Columns Properties
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '12px', fontWeight: 500 }}>
          Columns ({block.columns?.length ?? 0})
        </label>
        <button
          type="button"
          aria-label="Add column"
          onClick={handleAddColumn}
          style={{
            padding: '3px 8px',
            fontSize: '11px',
            backgroundColor: '#e7f3ff',
            border: '1px solid #70b5ff',
            borderRadius: '3px',
            color: '#0066cc',
            cursor: 'pointer',
          }}
        >
          + Add column
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {block.columns?.map((col, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '4px 6px',
              backgroundColor: '#f8f9fa',
              borderRadius: '3px',
            }}
          >
            <span>Col {idx + 1}:</span>
            <input
              type="text"
              aria-label={`Column ${idx + 1} width`}
              value={String(col.width ?? '*')}
              onChange={(e) => {
                const newCols = [...block.columns]
                newCols[idx] = { ...newCols[idx]!, width: e.target.value as any }
                updateBlock(path, { columns: newCols })
              }}
              style={{ width: '60px', padding: '2px 4px', fontSize: '11px', border: '1px solid #ccc' }}
            />

            <select
              aria-label={`Column ${idx + 1} align`}
              value={col.align ?? ''}
              onChange={(e) => {
                const newCols = [...block.columns]
                newCols[idx] = { ...newCols[idx]!, align: (e.target.value as any) || undefined }
                updateBlock(path, { columns: newCols })
              }}
              style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid #ccc' }}
            >
              <option value="">default</option>
              <option value="left">left</option>
              <option value="right">right</option>
            </select>

            {block.columns.length > 1 && (
              <button
                type="button"
                aria-label={`Remove column ${idx + 1}`}
                onClick={() => handleRemoveColumn(idx)}
                style={{
                  padding: '2px 5px',
                  fontSize: '10px',
                  color: '#dc3545',
                  border: '1px solid #dc3545',
                  borderRadius: '3px',
                  background: 'none',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Gap</label>
          <input
            type="text"
            aria-label="Columns gap"
            value={(block.gap as string) ?? ''}
            onChange={(e) => updateBlock(path, { gap: e.target.value || undefined })}
            placeholder="e.g. 12pt, 1cm"
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
          <label style={{ fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={Boolean(block.keepTogether)}
              onChange={(e) => updateBlock(path, { keepTogether: e.target.checked || undefined })}
            />{' '}
            Keep together
          </label>
        </div>
      </div>
    </div>
  )
}
