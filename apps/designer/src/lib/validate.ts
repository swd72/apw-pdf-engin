import { ApwPdfError, formatZodPath, parseDocument } from '@apw-pdf/core'

export interface Issue {
  path: string
  message: string
  line?: number
}

function extractJsonLine(err: Error, text: string): number {
  const lineMatch = /(?:line|row)\s+(\d+)/i.exec(err.message)
  if (lineMatch && lineMatch[1]) {
    return parseInt(lineMatch[1], 10)
  }
  const posMatch = /(?:position|at position|at)\s+(\d+)/i.exec(err.message)
  if (posMatch && posMatch[1]) {
    const pos = parseInt(posMatch[1], 10)
    if (!isNaN(pos) && pos >= 0) {
      return text.slice(0, pos).split('\n').length
    }
  }
  return 1
}

function findPathLine(text: string, pathStr: string): number | undefined {
  if (!pathStr) return undefined
  const parts = pathStr.split(/[.\[\]]+/).filter(Boolean)
  const lastKey = parts[parts.length - 1]
  if (!lastKey || /^\d+$/.test(lastKey)) return undefined

  const lines = text.split('\n')
  const escaped = lastKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`"${escaped}"\\s*:`)

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i]!)) {
      return i + 1
    }
  }
  return undefined
}

export function validateJsonText(
  text: string,
): { ok: true; value: unknown } | { ok: false; issues: Issue[] } {
  try {
    const value = JSON.parse(text)
    return { ok: true, value }
  } catch (err: any) {
    const line = extractJsonLine(err, text)
    return {
      ok: false,
      issues: [
        {
          path: '',
          message: err?.message ?? 'Invalid JSON',
          line,
        },
      ],
    }
  }
}

export function validateDocumentText(
  text: string,
): { ok: true; value: unknown } | { ok: false; issues: Issue[] } {
  const jsonRes = validateJsonText(text)
  if (!jsonRes.ok) {
    return jsonRes
  }

  try {
    const doc = parseDocument(jsonRes.value)
    return { ok: true, value: doc }
  } catch (err: any) {
    const issues: Issue[] = []
    if (err && err.name === 'ApwPdfError' && Array.isArray(err.details)) {
      for (const item of err.details) {
        const p = Array.isArray(item.path)
          ? formatZodPath(item.path)
          : (item.path ?? err.path ?? '')
        const line = findPathLine(text, p)
        issues.push({
          path: p,
          message: item.message,
          line,
        })
      }
    }
    if (issues.length === 0) {
      const p = err?.path ?? ''
      const line = findPathLine(text, p)
      issues.push({
        path: p,
        message: err?.message ?? 'Invalid document schema',
        line,
      })
    }
    return { ok: false, issues }
  }
}
