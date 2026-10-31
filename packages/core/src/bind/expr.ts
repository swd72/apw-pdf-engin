import { ApwPdfError } from '../errors.js'

export type ComparisonOp = '==' | '!=' | '>=' | '<=' | '>' | '<'

export type Expr =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'path'; segments: string[] }
  | { kind: 'not'; expr: Expr }
  | { kind: 'binary'; op: '&&' | '||' | ComparisonOp; left: Expr; right: Expr }

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

export function validatePathSegments(segments: string[], path?: string): void {
  if (segments.length === 0) {
    throw new ApwPdfError('EXPRESSION_INVALID', 'Empty variable path', { path })
  }
  for (const seg of segments) {
    if (!seg || FORBIDDEN_SEGMENTS.has(seg) || !/^[a-zA-Z0-9_$]+$/.test(seg)) {
      throw new ApwPdfError('EXPRESSION_INVALID', `Forbidden or invalid path segment "${seg}"`, {
        path,
      })
    }
  }
}

export function lookupPath(
  scope: unknown,
  segments: string[],
): { found: boolean; value: unknown } {
  let curr: unknown = scope
  for (const seg of segments) {
    if (curr === null || curr === undefined) {
      return { found: false, value: undefined }
    }
    if (typeof curr === 'object' && Object.prototype.hasOwnProperty.call(curr, seg)) {
      curr = (curr as Record<string, unknown>)[seg]
    } else {
      return { found: false, value: undefined }
    }
  }
  if (curr === undefined) {
    return { found: false, value: undefined }
  }
  return { found: true, value: curr }
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '||' | '&&' | '==' | '!=' | '>=' | '<=' | '>' | '<' | '!' }
  | { type: 'paren'; value: '(' | ')' }

function tokenize(src: string, path?: string): Token[] {
  if (src.length > 2000) {
    throw new ApwPdfError('LIMIT_EXCEEDED', 'Expression exceeds maximum length', { path })
  }
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]!
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch })
      i++
      continue
    }
    const twoChar = src.slice(i, i + 2)
    if (
      twoChar === '||' ||
      twoChar === '&&' ||
      twoChar === '==' ||
      twoChar === '!=' ||
      twoChar === '>=' ||
      twoChar === '<='
    ) {
      tokens.push({ type: 'op', value: twoChar })
      i += 2
      continue
    }
    if (ch === '>' || ch === '<' || ch === '!') {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }
    if (ch === '"' || ch === "'") {
      const quote = ch
      i++
      let str = ''
      let closed = false
      while (i < src.length) {
        const c = src[i]!
        if (c === '\\') {
          i++
          if (i >= src.length) {
            throw new ApwPdfError('EXPRESSION_INVALID', 'Unterminated string escape', { path })
          }
          const esc = src[i]!
          str += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc
          i++
          continue
        }
        if (c === quote) {
          closed = true
          i++
          break
        }
        str += c
        i++
      }
      if (!closed) {
        throw new ApwPdfError('EXPRESSION_INVALID', 'Unterminated string literal', { path })
      }
      tokens.push({ type: 'string', value: str })
      continue
    }
    const numMatch = /^-?\d+(?:\.\d+)?/.exec(src.slice(i))
    if (numMatch) {
      tokens.push({ type: 'number', value: Number(numMatch[0]) })
      i += numMatch[0].length
      continue
    }
    const identMatch = /^[a-zA-Z_$][a-zA-Z0-9_$.]*/.exec(src.slice(i))
    if (identMatch) {
      tokens.push({ type: 'ident', value: identMatch[0] })
      i += identMatch[0].length
      continue
    }
    throw new ApwPdfError('EXPRESSION_INVALID', `Unexpected character "${ch}" in expression`, {
      path,
    })
  }
  return tokens
}

export function parseExpression(src: string, path?: string): Expr {
  const tokens = tokenize(src.trim(), path)
  if (tokens.length === 0) {
    throw new ApwPdfError('EXPRESSION_INVALID', 'Empty expression', { path })
  }

  let pos = 0
  let depth = 0

  function peek(): Token | undefined {
    return tokens[pos]
  }

  function consume(): Token {
    const t = tokens[pos]
    if (!t) {
      throw new ApwPdfError('EXPRESSION_INVALID', 'Unexpected end of expression', { path })
    }
    pos++
    return t
  }

  function parseOr(): Expr {
    depth++
    if (depth > 50) {
      throw new ApwPdfError('LIMIT_EXCEEDED', 'Expression nesting too deep', { path })
    }
    let left = parseAnd()
    while (peek()?.type === 'op' && peek()?.value === '||') {
      consume()
      const right = parseAnd()
      left = { kind: 'binary', op: '||', left, right }
    }
    depth--
    return left
  }

  function parseAnd(): Expr {
    let left = parseUnary()
    while (peek()?.type === 'op' && peek()?.value === '&&') {
      consume()
      const right = parseUnary()
      left = { kind: 'binary', op: '&&', left, right }
    }
    return left
  }

  function parseUnary(): Expr {
    if (peek()?.type === 'op' && peek()?.value === '!') {
      consume()
      return { kind: 'not', expr: parseUnary() }
    }
    return parseCmp()
  }

  function parseCmp(): Expr {
    const left = parsePrimary()
    const t = peek()
    if (
      t?.type === 'op' &&
      (t.value === '==' ||
        t.value === '!=' ||
        t.value === '>=' ||
        t.value === '<=' ||
        t.value === '>' ||
        t.value === '<')
    ) {
      consume()
      const right = parsePrimary()
      return { kind: 'binary', op: t.value, left, right }
    }
    return left
  }

  function parsePrimary(): Expr {
    const t = consume()
    if (t.type === 'number') {
      return { kind: 'literal', value: t.value }
    }
    if (t.type === 'string') {
      return { kind: 'literal', value: t.value }
    }
    if (t.type === 'ident') {
      if (t.value === 'true') return { kind: 'literal', value: true }
      if (t.value === 'false') return { kind: 'literal', value: false }
      if (t.value === 'null') return { kind: 'literal', value: null }
      const segments = t.value.split('.')
      validatePathSegments(segments, path)
      return { kind: 'path', segments }
    }
    if (t.type === 'paren' && t.value === '(') {
      const inner = parseOr()
      const close = consume()
      if (close.type !== 'paren' || close.value !== ')') {
        throw new ApwPdfError('EXPRESSION_INVALID', 'Expected closing ")"', { path })
      }
      return inner
    }
    throw new ApwPdfError('EXPRESSION_INVALID', `Unexpected token "${String(t.value)}"`, { path })
  }

  const expr = parseOr()
  if (pos < tokens.length) {
    throw new ApwPdfError(
      'EXPRESSION_INVALID',
      `Unexpected trailing token "${String(tokens[pos]?.value)}"`,
      { path },
    )
  }
  return expr
}

export function evaluate(expr: Expr, scope: Record<string, unknown>): unknown {
  switch (expr.kind) {
    case 'literal':
      return expr.value
    case 'path':
      return lookupPath(scope, expr.segments).value
    case 'not':
      return !Boolean(evaluate(expr.expr, scope))
    case 'binary': {
      if (expr.op === '&&') {
        return Boolean(evaluate(expr.left, scope)) && Boolean(evaluate(expr.right, scope))
      }
      if (expr.op === '||') {
        return Boolean(evaluate(expr.left, scope)) || Boolean(evaluate(expr.right, scope))
      }
      const l = evaluate(expr.left, scope)
      const r = evaluate(expr.right, scope)
      switch (expr.op) {
        case '==':
          return l === r
        case '!=':
          return l !== r
        case '>':
          return (l as number) > (r as number)
        case '<':
          return (l as number) < (r as number)
        case '>=':
          return (l as number) >= (r as number)
        case '<=':
          return (l as number) <= (r as number)
      }
    }
  }
}
