import React from 'react'
import type { ParagraphBlock } from '@apw-pdf/core'
import type { EditorState } from '../../editor/useEditorState.js'
import type { BlockPath } from '../../editor/docModel.js'
import { BindingInput } from '../BindingInput.js'
import { scopeAt } from '../../editor/bindings.js'

export interface ParagraphInspectorProps {
  block: ParagraphBlock
  path: BlockPath
  state: EditorState
}

export function ParagraphInspector({ block, path, state }: ParagraphInspectorProps) {
  const { doc, data, updateBlock } = state
  const scope = scopeAt(doc, path)
  const styles = doc.styles ? Object.keys(doc.styles) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
        Paragraph Properties
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label htmlFor="p-text" style={{ fontSize: '12px', fontWeight: 500 }}>
          Text
        </label>
        <BindingInput
          id="p-text"
          aria-label="Paragraph text"
          multiline
          value={block.text ?? ''}
          onChange={(next) => updateBlock(path, { text: next })}
          data={data}
          scope={scope}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label htmlFor="p-align" style={{ fontSize: '12px', fontWeight: 500 }}>
            Align
          </label>
          <select
            id="p-align"
            aria-label="Align"
            value={block.align ?? 'left'}
            onChange={(e) => updateBlock(path, { align: e.target.value })}
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
            <option value="justify">justify</option>
            <option value="thaiDistributed">thaiDistributed</option>
          </select>
        </div>

        {styles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="p-style" style={{ fontSize: '12px', fontWeight: 500 }}>
              Named Style
            </label>
            <select
              id="p-style"
              aria-label="Named style"
              value={block.style ?? ''}
              onChange={(e) => updateBlock(path, { style: e.target.value || undefined })}
              style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
            >
              <option value="">(None)</option>
              {styles.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>First Line Indent</label>
          <input
            type="text"
            aria-label="First line indent"
            value={(block.firstLineIndent as string) ?? ''}
            onChange={(e) => updateBlock(path, { firstLineIndent: e.target.value || undefined })}
            placeholder="e.g. 1cm, 24pt"
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#555' }}>Left Indent</label>
          <input
            type="text"
            aria-label="Left indent"
            value={(block.indentLeft as string) ?? ''}
            onChange={(e) => updateBlock(path, { indentLeft: e.target.value || undefined })}
            placeholder="e.g. 0.5cm"
            style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          />
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '11px', color: '#555' }}>Keep Options</label>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
          <label>
            <input
              type="checkbox"
              checked={Boolean(block.keepWithNext)}
              onChange={(e) => updateBlock(path, { keepWithNext: e.target.checked || undefined })}
            />{' '}
            Keep with next
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(block.keepLinesTogether)}
              onChange={(e) => updateBlock(path, { keepLinesTogether: e.target.checked || undefined })}
            />{' '}
            Keep lines
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(block.widowControl)}
              onChange={(e) => updateBlock(path, { widowControl: e.target.checked || undefined })}
            />{' '}
            Widow control
          </label>
        </div>
      </div>
    </div>
  )
}
