import { ApwPdfError, type Warning } from '../errors.js'
import { lookupPath, validatePathSegments } from './expr.js'
import { FILTERS } from './filters.js'

function splitPipesOutsideQuotes(src: string): string[] {
  const parts: string[] = []
  let curr = ''
  let quote: string | null = null
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quote) {
      if (ch === '\\' && i + 1 < src.length) {
        curr += ch + src[i + 1]!
        i++
        continue
      }
      if (ch === quote) {
        quote = null
      }
      curr += ch
    } else {
      if (ch === '"' || ch === "'") {
        quote = ch
        curr += ch
      } else if (ch === '|') {
        parts.push(curr.trim())
        curr = ''
      } else {
        curr += ch
      }
    }
  }
  if (quote) {
    throw new ApwPdfError('EXPRESSION_INVALID', `Unterminated quote in template filter: "${src}"`)
  }
  parts.push(curr.trim())
  return parts
}

function parseFilterSpec(
  spec: string,
  path: string,
): { name: string; args: (string | number)[] } {
  const colonIdx = spec.indexOf(':')
  if (colonIdx === -1) {
    const name = spec.trim()
    if (!name || !Object.hasOwn(FILTERS, name)) {
      throw new ApwPdfError('EXPRESSION_INVALID', `Unknown filter "${name}"`, { path })
    }
    return { name, args: [] }
  }
  const name = spec.slice(0, colonIdx).trim()
  if (!name || !Object.hasOwn(FILTERS, name)) {
    throw new ApwPdfError('EXPRESSION_INVALID', `Unknown filter "${name}"`, { path })
  }
  const argRaw = spec.slice(colonIdx + 1).trim()
  if (
    (argRaw.startsWith('"') && argRaw.endsWith('"')) ||
    (argRaw.startsWith("'") && argRaw.endsWith("'"))
  ) {
    return { name, args: [argRaw.slice(1, -1)] }
  }
  const num = Number(argRaw)
  if (argRaw !== '' && Number.isFinite(num)) {
    return { name, args: [num] }
  }
  throw new ApwPdfError('EXPRESSION_INVALID', `Invalid filter argument "${argRaw}"`, { path })
}

export function renderString(
  tpl: string,
  scope: object,
  opts: { strict: boolean; path: string },
): { value: string; warnings: Warning[] } {
  const warnings: Warning[] = []
  let out = ''
  let i = 0

  while (i < tpl.length) {
    const start = tpl.indexOf('{{', i)
    if (start === -1) {
      out += tpl.slice(i)
      break
    }
    out += tpl.slice(i, start)
    const end = tpl.indexOf('}}', start + 2)
    if (end === -1) {
      throw new ApwPdfError('EXPRESSION_INVALID', 'Unclosed "{{" in template string', {
        path: opts.path,
      })
    }

    const exprBody = tpl.slice(start + 2, end).trim()
    if (!exprBody) {
      throw new ApwPdfError('EXPRESSION_INVALID', 'Empty "{{}}" in template string', {
        path: opts.path,
      })
    }

    const parts = splitPipesOutsideQuotes(exprBody)
    const rawPath = parts[0]!
    const segments = rawPath.split('.').map((s) => s.trim())
    validatePathSegments(segments, opts.path)

    const filters = parts.slice(1).map((f) => parseFilterSpec(f, opts.path))
    const { found, value: rawValue } = lookupPath(scope, segments)

    const hasFallbackFilter =
      filters.length > 0 && (filters[0]!.name === 'default' || filters[0]!.name === 'prefix')

    if (!found && !hasFallbackFilter) {
      if (opts.strict) {
        throw new ApwPdfError('MISSING_VARIABLE', `Missing variable "${rawPath}"`, {
          path: opts.path,
        })
      }
      warnings.push({
        code: 'MISSING_VARIABLE',
        message: `Missing variable "${rawPath}"`,
        path: opts.path,
      })
      i = end + 2
      continue
    }

    let current: unknown = rawValue
    for (const f of filters) {
      const fn = FILTERS[f.name]!
      try {
        current = fn(current, ...f.args)
      } catch (err) {
        if (err instanceof ApwPdfError) {
          throw new ApwPdfError(err.code, err.message, {
            path: err.path ?? opts.path,
            details: err.details,
          })
        }
        throw err
      }
    }

    out += current === null || current === undefined ? '' : String(current)
    i = end + 2
  }

  return { value: out, warnings }
}
