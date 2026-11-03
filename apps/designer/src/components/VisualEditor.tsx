import React, { useMemo } from 'react'
import type { DocumentDef } from '@apw-pdf/core'
import { useEditorState } from '../editor/useEditorState.js'
import { BlockTree } from './BlockTree.js'
import { DataPanel } from './DataPanel.js'
import { Inspector } from './Inspector.js'

export interface VisualEditorProps {
  doc: DocumentDef
  data: unknown
  onChange(next: { doc: DocumentDef; data: unknown }): void
}

export function VisualEditor({ doc, data, onChange }: VisualEditorProps) {
  const initial = useMemo(() => ({ doc, data }), [doc, data])
  const state = useEditorState(initial, onChange)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 1fr)',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {/* Left Column: Stack BlockTree above DataPanel */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: '1fr 1fr',
          height: '100%',
          minWidth: 0,
          borderRight: '1px solid #dee2e6',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            overflowY: 'auto',
            borderBottom: '1px solid #dee2e6',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <BlockTree state={state} />
        </div>
        <div
          style={{
            overflowY: 'auto',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <DataPanel data={state.data} onChange={state.setData} />
        </div>
      </div>

      {/* Right Column: Block Inspector */}
      <div
        style={{
          overflowY: 'auto',
          height: '100%',
          minWidth: 0,
        }}
      >
        <Inspector state={state} />
      </div>
    </div>
  )
}
