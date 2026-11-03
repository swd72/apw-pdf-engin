import React, { useState, useRef, useMemo } from 'react'
import { listPaths } from '../editor/dataModel.js'
import { FILTER_NAMES } from '../editor/bindings.js'

export interface BindingInputProps {
  value: string
  onChange(next: string): void
  data: unknown
  scope?: Array<{ name: string; arrayPath: string }>
  multiline?: boolean
  unresolved?: string[]
  placeholder?: string
  'aria-label'?: string
  id?: string
  rows?: number
}

function lookupArray(data: unknown, dotPath: string): unknown[] | null {
  if (!data || typeof data !== 'object') return null
  let curr: any = data
  for (const seg of dotPath.split('.')) {
    if (curr === null || curr === undefined || typeof curr !== 'object') return null
    curr = curr[seg]
  }
  return Array.isArray(curr) ? curr : null
}

export function BindingInput({
  value,
  onChange,
  data,
  scope,
  multiline = false,
  unresolved,
  placeholder,
  'aria-label': ariaLabel,
  id,
  rows = 3,
}: BindingInputProps) {
  const [localText, setLocalText] = useState(value)
  const prevPropValueRef = useRef(value)

  if (value !== prevPropValueRef.current) {
    prevPropValueRef.current = value
    setLocalText(value)
  }

  const textToInspect = localText

  const { isSuggesting, mode, candidates, prefix, openIdx, pipeIdx } = useMemo(() => {
    const oIdx = textToInspect.lastIndexOf('{{')
    if (oIdx === -1) {
      return { isSuggesting: false, mode: 'none' as const, candidates: [], prefix: '', openIdx: -1, pipeIdx: -1 }
    }
    const remainder = textToInspect.slice(oIdx + 2)
    if (remainder.includes('}}')) {
      return { isSuggesting: false, mode: 'none' as const, candidates: [], prefix: '', openIdx: -1, pipeIdx: -1 }
    }

    if (remainder.includes('|')) {
      const pIdx = remainder.lastIndexOf('|')
      const pfx = remainder.slice(pIdx + 1).trim()
      const cands = pfx
        ? FILTER_NAMES.filter((f) => f.toLowerCase().includes(pfx.toLowerCase()))
        : FILTER_NAMES
      return {
        isSuggesting: true,
        mode: 'filter' as const,
        candidates: cands,
        prefix: pfx,
        openIdx: oIdx,
        pipeIdx: pIdx,
      }
    } else {
      const pfx = remainder.trim()
      const paths = listPaths(data)
      const candSet = new Set<string>()

      for (const p of paths) {
        candSet.add(p.path)
      }

      if (scope) {
        for (const s of scope) {
          const match = paths.find((p) => p.path === s.arrayPath)
          if (match?.rowFields) {
            for (const rf of match.rowFields) {
              candSet.add(`${s.name}.${rf}`)
            }
          }
          const arr = lookupArray(data, s.arrayPath)
          if (arr && arr.length > 0 && arr[0] && typeof arr[0] === 'object') {
            for (const k of Object.keys(arr[0] as Record<string, unknown>)) {
              candSet.add(`${s.name}.${k}`)
            }
          }
        }
      }

      const allCands = Array.from(candSet)
      const cands = pfx
        ? allCands.filter((c) => c.toLowerCase().includes(pfx.toLowerCase()))
        : allCands

      return {
        isSuggesting: true,
        mode: 'path' as const,
        candidates: cands,
        prefix: pfx,
        openIdx: oIdx,
        pipeIdx: -1,
      }
    }
  }, [textToInspect, data, scope])

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e.target.value
    setLocalText(next)
    onChange(next)
  }

  const handleSelectOption = (cand: string) => {
    if (mode === 'filter') {
      const remainder = textToInspect.slice(openIdx + 2)
      const beforePipe = textToInspect.slice(0, openIdx + 2 + pipeIdx + 1)
      const next = `${beforePipe} ${cand}}}`
      setLocalText(next)
      onChange(next)
    } else if (mode === 'path') {
      const before = textToInspect.slice(0, openIdx + 2)
      const next = `${before}${cand}}}`
      setLocalText(next)
      onChange(next)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {multiline ? (
        <textarea
          id={id}
          aria-label={ariaLabel}
          rows={rows}
          value={localText}
          onChange={handleTextChange}
          placeholder={placeholder}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            fontSize: '13px',
            padding: '6px 8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      ) : (
        <input
          id={id}
          type="text"
          aria-label={ariaLabel}
          value={localText}
          onChange={handleTextChange}
          placeholder={placeholder}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            fontSize: '13px',
            padding: '6px 8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      )}

      {isSuggesting && candidates.length > 0 && (
        <ul
          role="listbox"
          aria-label="Suggestions"
          style={{
            position: 'absolute',
            zIndex: 1000,
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '160px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            margin: '2px 0 0 0',
            padding: '4px 0',
            listStyle: 'none',
          }}
        >
          {candidates.map((cand) => (
            <li
              key={cand}
              role="option"
              aria-selected={false}
              onClick={() => handleSelectOption(cand)}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'monospace',
                borderBottom: '1px solid #f0f0f0',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor = '#e8f0fe'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
              }}
            >
              {cand}
            </li>
          ))}
        </ul>
      )}

      {unresolved && unresolved.length > 0 && (
        <div
          role="status"
          style={{
            fontSize: '11px',
            color: '#d9534f',
            marginTop: '4px',
            lineHeight: 1.3,
          }}
        >
          Unresolved: {unresolved.join(', ')}
        </div>
      )}
    </div>
  )
}
