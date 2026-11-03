import type { JSX } from 'react'
import type { Issue } from '../lib/validate.js'

export interface EditorPaneProps {
  value: string
  onChange: (next: string) => void
  issues: Issue[]
  readOnly?: boolean
}

export type EditorPane = (props: EditorPaneProps) => JSX.Element
