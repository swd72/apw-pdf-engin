import React, { useState, useRef } from 'react'
import { blockSchema, type Block } from '@apw-pdf/core'
import type { EditorState } from '../../../editor/useEditorState.js'
import type { BlockPath } from '../../../editor/docModel.js'
import { Section } from '../Section.js'
import { Field } from '../Field.js'

export interface JsonPropsProps {
  block: Block
  path: BlockPath
  state: EditorState
}

export function JsonProps({ block, path, state }: JsonPropsProps) {
  const { replaceBlock } = state
  const [text, setText] = useState(() => JSON.stringify(block, null, 2))
  const [issues, setIssues] = useState<string[]>([])
  const prevBlockRef = useRef(block)

  if (block !== prevBlockRef.current) {
    prevBlockRef.current = block
    setText(JSON.stringify(block, null, 2))
    setIssues([])
  }

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
    <div className="properties-panel__body">
      <Section title="แก้ไข JSON ของบล็อก">
        <Field label="JSON">
          <textarea
            aria-label="Block JSON"
            className="ui-textarea"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
          />
        </Field>

        {issues.length > 0 && (
          <div role="alert" className="prop-field__error">
            {issues.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
        )}

        <div>
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            aria-label="Apply"
            onClick={handleApply}
          >
            นำไปใช้ (Apply)
          </button>
        </div>
      </Section>
    </div>
  )
}
