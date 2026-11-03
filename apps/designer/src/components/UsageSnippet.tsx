import React, { useState } from 'react'
import { buildSnippets } from '../lib/snippet.js'

export interface UsageSnippetProps {
  templateName: string
}

export function UsageSnippet({ templateName }: UsageSnippetProps) {
  const [copiedType, setCopiedType] = useState<'react' | 'cli' | null>(null)
  const { react, cli } = buildSnippets(templateName)

  const copyToClipboard = async (text: string, type: 'react' | 'cli') => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setCopiedType(type)
        setTimeout(() => setCopiedType(null), 2000)
      }
    } catch {
      // Ignore clipboard write failures
    }
  }

  return (
    <div
      style={{
        padding: '12px',
        background: '#f8f9fa',
        borderTop: '1px solid #dee2e6',
        fontSize: '12px',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '8px' }}>Usage Snippets</div>

      <div style={{ marginBottom: '8px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
          }}
        >
          <span style={{ fontWeight: 500 }}>CLI</span>
          <button
            type="button"
            onClick={() => copyToClipboard(cli, 'cli')}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              borderRadius: '3px',
              border: '1px solid #ced4da',
              background: '#fff',
            }}
          >
            {copiedType === 'cli' ? 'Copied!' : 'Copy CLI'}
          </button>
        </div>
        <pre
          style={{
            margin: 0,
            padding: '6px',
            background: '#e9ecef',
            borderRadius: '4px',
            overflowX: 'auto',
            fontFamily: 'monospace',
          }}
        >
          <code>{cli}</code>
        </pre>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
          }}
        >
          <span style={{ fontWeight: 500 }}>React</span>
          <button
            type="button"
            onClick={() => copyToClipboard(react, 'react')}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              borderRadius: '3px',
              border: '1px solid #ced4da',
              background: '#fff',
            }}
          >
            {copiedType === 'react' ? 'Copied!' : 'Copy React'}
          </button>
        </div>
        <pre
          style={{
            margin: 0,
            padding: '6px',
            background: '#e9ecef',
            borderRadius: '4px',
            overflowX: 'auto',
            maxHeight: '120px',
            fontFamily: 'monospace',
          }}
        >
          <code>{react}</code>
        </pre>
      </div>
    </div>
  )
}
