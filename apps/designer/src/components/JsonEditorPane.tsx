import React, { useEffect, useRef } from 'react'
import { json } from '@codemirror/lang-json'
import { linter, setDiagnostics, type Diagnostic } from '@codemirror/lint'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import type { EditorPaneProps } from './EditorPane.js'
import type { Issue } from '../lib/validate.js'

export function alignCompletion(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos)
  const lineText = line.text
  const beforeCursor = lineText.slice(0, context.pos - line.from)

  const match = /"align"\s*:\s*"([^"]*)$/.exec(beforeCursor)
  if (!match) return null

  const word = context.matchBefore(/[\w]*/)
  const from = word ? word.from : context.pos

  return {
    from,
    options: [
      { label: 'thaiDistributed', type: 'keyword' },
      { label: 'left', type: 'keyword' },
      { label: 'center', type: 'keyword' },
      { label: 'right', type: 'keyword' },
      { label: 'justify', type: 'keyword' },
    ],
  }
}

function issuesToDiagnostics(view: EditorView, issues: Issue[]): Diagnostic[] {
  const doc = view.state.doc
  return issues.map((issue) => {
    const lineNo = Math.max(1, Math.min(issue.line ?? 1, doc.lines))
    const line = doc.line(lineNo)
    return {
      from: line.from,
      to: line.to,
      severity: 'error',
      message: issue.path ? `${issue.path}: ${issue.message}` : issue.message,
    }
  })
}

export function JsonEditorPane({
  value,
  onChange,
  issues,
  readOnly = false,
}: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const readOnlyCompartmentRef = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    const readOnlyCompartment = readOnlyCompartmentRef.current

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        json(),
        autocompletion({ override: [alignCompletion] }),
        readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
        linter((view) => issuesToDiagnostics(view, issues)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '13px',
            fontFamily: 'monospace',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
        }),
      ],
    })

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    })

    viewRef.current = view
    ;(containerRef.current as any)._cmView = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // Sync value
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const cur = view.state.doc.toString()
    if (cur !== value) {
      view.dispatch({
        changes: { from: 0, to: cur.length, insert: value },
      })
    }
  }, [value])

  // Sync readOnly
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(
        EditorState.readOnly.of(readOnly),
      ),
    })
  }, [readOnly])

  // Sync lint issues
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const diags = issuesToDiagnostics(view, issues)
    view.dispatch(setDiagnostics(view.state, diags))
  }, [issues])

  return (
    <div
      ref={containerRef}
      data-testid="json-editor-pane"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '350px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    />
  )
}
