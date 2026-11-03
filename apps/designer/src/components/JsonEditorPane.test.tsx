// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { EditorView } from '@codemirror/view'
import { JsonEditorPane, alignCompletion } from './JsonEditorPane.js'

describe('JsonEditorPane', () => {
  afterEach(() => {
    cleanup()
  })

  it('align completion lists thaiDistributed', () => {
    const mockContext = {
      state: {
        doc: {
          lineAt: (_pos: number) => ({
            from: 10,
            to: 30,
            text: '    "align": "',
          }),
        },
      },
      pos: 24,
      matchBefore: vi.fn(() => null),
    }

    const result = alignCompletion(mockContext as any)
    expect(result).toBeDefined()
    expect(result?.options).toBeDefined()
    const thaiOpt = result?.options.find((opt: any) => opt.label === 'thaiDistributed')
    expect(thaiOpt).toBeDefined()
  })

  it('JsonEditorPane calls onChange when text changes', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <JsonEditorPane value="{}" onChange={onChange} issues={[]} />,
    )

    const pane = getByTestId('json-editor-pane') as any
    expect(pane._cmView).toBeDefined()
    const view = pane._cmView as EditorView

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: '{"hello": "world"}' },
    })

    expect(onChange).toHaveBeenCalledWith('{"hello": "world"}')
  })

  it('renders without crashing with issues containing line numbers', () => {
    const issues = [
      { path: 'blocks[0]', message: 'Invalid block', line: 1 },
      { path: 'meta.title', message: 'Title missing', line: 2 },
    ]

    const { getByTestId } = render(
      <JsonEditorPane
        value={'{\n  "version": 1\n}'}
        onChange={vi.fn()}
        issues={issues}
      />,
    )

    const pane = getByTestId('json-editor-pane')
    expect(pane).toBeDefined()
  })
})
