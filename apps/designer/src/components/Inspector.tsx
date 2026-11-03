import React, { useState } from 'react'
import type { Block } from '@apw-pdf/core'
import type { EditorState } from '../editor/useEditorState.js'
import { getBlock } from '../editor/docModel.js'
import { ParagraphInspector } from './inspectors/ParagraphInspector.js'
import { TableInspector } from './inspectors/TableInspector.js'
import { ColumnsInspector } from './inspectors/ColumnsInspector.js'
import { SignatureInspector } from './inspectors/SignatureInspector.js'
import { ImageInspector } from './inspectors/ImageInspector.js'
import { SpacerInspector } from './inspectors/SpacerInspector.js'
import { LineInspector } from './inspectors/LineInspector.js'
import { EachIfInspector } from './inspectors/EachIfInspector.js'
import { GenericJsonInspector } from './inspectors/GenericJsonInspector.js'

export interface InspectorProps {
  state: EditorState
}

export function Inspector({ state }: InspectorProps) {
  const { doc, selectedPath } = state
  const [tab, setTab] = useState<'form' | 'json'>('form')

  if (!selectedPath) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          color: '#888',
          fontSize: '13px',
          textAlign: 'center',
        }}
      >
        <p>Select a block in the tree to inspect its properties.</p>
      </div>
    )
  }

  const block = getBlock(doc, selectedPath)
  if (!block) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          color: '#888',
          fontSize: '13px',
          textAlign: 'center',
        }}
      >
        <p>Block not found at selected path.</p>
      </div>
    )
  }

  const renderFormInspector = (currentBlock: Block) => {
    switch (currentBlock.type) {
      case 'paragraph':
        return <ParagraphInspector block={currentBlock} path={selectedPath} state={state} />
      case 'table':
        return <TableInspector block={currentBlock} path={selectedPath} state={state} />
      case 'columns':
        return <ColumnsInspector block={currentBlock} path={selectedPath} state={state} />
      case 'signature':
        return <SignatureInspector block={currentBlock} path={selectedPath} state={state} />
      case 'image':
        return <ImageInspector block={currentBlock} path={selectedPath} state={state} />
      case 'spacer':
        return <SpacerInspector block={currentBlock} path={selectedPath} state={state} />
      case 'line':
        return <LineInspector block={currentBlock} path={selectedPath} state={state} />
      case 'each':
      case 'if':
        return <EachIfInspector block={currentBlock} path={selectedPath} state={state} />
      default:
        return <GenericJsonInspector block={currentBlock} path={selectedPath} state={state} />
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
        fontSize: '13px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #eee',
          paddingBottom: '8px',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '14px' }}>
          Inspector: <span style={{ textTransform: 'capitalize' }}>{block.type}</span>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setTab('form')}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              backgroundColor: tab === 'form' ? '#0066cc' : '#fff',
              color: tab === 'form' ? '#fff' : '#333',
              cursor: 'pointer',
            }}
          >
            Form
          </button>
          <button
            type="button"
            onClick={() => setTab('json')}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              backgroundColor: tab === 'json' ? '#0066cc' : '#fff',
              color: tab === 'json' ? '#fff' : '#333',
              cursor: 'pointer',
            }}
          >
            JSON
          </button>
        </div>
      </div>

      {tab === 'form' ? renderFormInspector(block) : (
        <GenericJsonInspector block={block} path={selectedPath} state={state} />
      )}
    </div>
  )
}
