import React, { useState, useEffect } from 'react'
import { blockSchema, type Block } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'

export interface GenericJsonInspectorProps {
  block: Block
  path: BlockPath
  state: EditorState
}

export function GenericJsonInspector({ block, path, state }: GenericJsonInspectorProps) {
  const { replaceBlock } = state
  const [text, setText] = useState(() => JSON.stringify(block, null, 2))
  const [issues, setIssues] = useState<string[]>([])

  useEffect(() => {
    setText(JSON.stringify(block, null, 2))
    setIssues([])
  }, [block])

  const handleApply = () => {
    try {
      const parsed = JSON.parse(text)
      const res = blockSchema.safeParse(parsed)
      if (res.success) {
        setIssues([])
        replaceBlock(path, res.data)
      } else {
        const msgs = res.error.issues.map((i) =>
          i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message,
        )
        setIssues(msgs.length > 0 ? msgs : ['Invalid block schema'])
      }
    } catch (err: any) {
      setIssues([`Invalid JSON: ${err?.message || 'Syntax error'}`])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
        JSON Block Inspector
      </div>

      <textarea
        aria-label="Block JSON"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: 'monospace',
          fontSize: '12px',
          padding: '6px 8px',
          border: issues.length > 0 ? '1px solid #dc3545' : '1px solid #ccc',
          borderRadius: '4px',
        }}
      />

      {issues.length > 0 && (
        <div
          role="alert"
          style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '6px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            border: '1px solid #f5c6cb',
          }}
        >
          {issues.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          aria-label="Apply"
          onClick={handleApply}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            backgroundColor: '#0066cc',
            color: '#ffffff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}
