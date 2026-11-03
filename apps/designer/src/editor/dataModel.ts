export type DataPath = (string | number)[]

export interface PathInfo {
  path: string
  type: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'
  rowFields?: string[]
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function isUsableKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false
  if (FORBIDDEN_KEYS.has(key)) return false
  return /^[a-zA-Z0-9_$]+$/.test(key)
}

function getValueType(val: unknown): PathInfo['type'] {
  if (val === null) return 'null'
  if (Array.isArray(val)) return 'array'
  const t = typeof val
  if (t === 'string') return 'string'
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  return 'object'
}

export function listPaths(data: unknown): PathInfo[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return []
  }
  const result: PathInfo[] = []

  function walk(obj: Record<string, unknown>, prefix: string) {
    for (const key of Object.keys(obj)) {
      const currentPath = prefix ? `${prefix}.${key}` : key
      const val = obj[key]
      const type = getValueType(val)

      if (type === 'array') {
        const info: PathInfo = { path: currentPath, type: 'array' }
        if (
          Array.isArray(val) &&
          val.length > 0 &&
          val[0] &&
          typeof val[0] === 'object' &&
          !Array.isArray(val[0])
        ) {
          info.rowFields = Object.keys(val[0])
        }
        result.push(info)
      } else if (type === 'object') {
        result.push({ path: currentPath, type: 'object' })
        walk(val as Record<string, unknown>, currentPath)
      } else {
        result.push({ path: currentPath, type })
      }
    }
  }

  walk(data as Record<string, unknown>, '')
  return result
}

function getAtPath(data: unknown, path: DataPath): unknown {
  let curr: any = data
  for (const seg of path) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined
    }
    curr = curr[seg]
  }
  return curr
}

export function setAtPath(data: unknown, path: DataPath, value: unknown): unknown {
  if (path.length === 0) return value
  const [head, ...tail] = path
  const isIndex = typeof head === 'number'

  if (isIndex) {
    const current = Array.isArray(data) ? [...data] : []
    const idx = head as number
    const nextChild = idx < current.length ? current[idx] : undefined
    current[idx] = setAtPath(nextChild, tail, value)
    return current
  } else {
    const current =
      data && typeof data === 'object' && !Array.isArray(data)
        ? { ...(data as Record<string, unknown>) }
        : {}
    const nextChild = current[head as string]
    current[head as string] = setAtPath(nextChild, tail, value)
    return current
  }
}

export function removeAtPath(data: unknown, path: DataPath): unknown {
  if (!path || path.length === 0) return undefined
  if (data === null || data === undefined || typeof data !== 'object') return data

  const [head, ...tail] = path

  if (tail.length === 0) {
    if (Array.isArray(data) && typeof head === 'number') {
      return data.filter((_, i) => i !== head)
    }
    if (!Array.isArray(data) && typeof head === 'string') {
      const copy = { ...(data as Record<string, unknown>) }
      delete copy[head]
      return copy
    }
    return data
  }

  if (Array.isArray(data) && typeof head === 'number') {
    if (head < 0 || head >= data.length) return data
    const copy = [...data]
    copy[head] = removeAtPath(data[head], tail)
    return copy
  } else if (!Array.isArray(data)) {
    const key = String(head)
    if (!Object.prototype.hasOwnProperty.call(data, key)) return data
    const copy = { ...(data as Record<string, unknown>) }
    copy[key] = removeAtPath(copy[key], tail)
    return copy
  }
  return data
}

export function renameKey(
  data: unknown,
  path: DataPath,
  newKey: string,
): { ok: true; data: unknown } | { ok: false; reason: 'duplicate' | 'empty' | 'invalid' } {
  if (!newKey || newKey.trim() === '') {
    return { ok: false, reason: 'empty' }
  }
  if (!isUsableKey(newKey)) {
    return { ok: false, reason: 'invalid' }
  }
  if (!path || path.length === 0) {
    return { ok: false, reason: 'invalid' }
  }
  const oldKey = String(path[path.length - 1])
  const parentPath = path.slice(0, -1)
  const parent = parentPath.length === 0 ? data : getAtPath(data, parentPath)
  if (!parent || typeof parent !== 'object' || Array.isArray(parent)) {
    return { ok: false, reason: 'invalid' }
  }
  const parentObj = parent as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(parentObj, oldKey)) {
    return { ok: false, reason: 'invalid' }
  }
  if (newKey !== oldKey && Object.prototype.hasOwnProperty.call(parentObj, newKey)) {
    return { ok: false, reason: 'duplicate' }
  }

  const newParent: Record<string, unknown> = {}
  for (const k of Object.keys(parentObj)) {
    if (k === oldKey) {
      newParent[newKey] = parentObj[k]
    } else {
      newParent[k] = parentObj[k]
    }
  }

  const nextData = parentPath.length === 0 ? newParent : setAtPath(data, parentPath, newParent)
  return { ok: true, data: nextData }
}

function emptyShape(val: unknown): unknown {
  if (typeof val === 'string') return ''
  if (typeof val === 'number') return 0
  if (typeof val === 'boolean') return false
  if (val === null || val === undefined) return null
  if (Array.isArray(val)) return []
  if (typeof val === 'object') {
    const res: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      res[k] = emptyShape(v)
    }
    return res
  }
  return null
}

export function addArrayItem(data: unknown, path: DataPath, item?: unknown): unknown {
  const arr = (path.length === 0 ? data : getAtPath(data, path)) as unknown[]
  if (!Array.isArray(arr)) return data

  const newItem =
    item !== undefined ? item : arr.length > 0 ? emptyShape(arr[0]) : {}
  const nextArr = [...arr, newItem]
  return path.length === 0 ? nextArr : setAtPath(data, path, nextArr)
}

export function convertType(
  value: unknown,
  to: PathInfo['type'],
): { ok: true; value: unknown } | { ok: false } {
  if (to === 'number') {
    if (typeof value === 'number') return { ok: true, value }
    if (typeof value === 'string') {
      if (value.trim() === '') return { ok: false }
      const n = Number(value)
      if (Number.isNaN(n) || !Number.isFinite(n)) return { ok: false }
      return { ok: true, value: n }
    }
    if (typeof value === 'boolean') return { ok: true, value: value ? 1 : 0 }
    return { ok: false }
  }

  if (to === 'string') {
    if (typeof value === 'string') return { ok: true, value }
    if (typeof value === 'number') return { ok: true, value: String(value) }
    if (typeof value === 'boolean') return { ok: true, value: String(value) }
    if (value === null || value === undefined) return { ok: true, value: '' }
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        if (value.length === 0) return { ok: true, value: '' }
        return { ok: false }
      }
      if (Object.keys(value as Record<string, unknown>).length === 0) {
        return { ok: true, value: '' }
      }
      return { ok: false }
    }
    return { ok: false }
  }

  if (to === 'boolean') {
    if (typeof value === 'boolean') return { ok: true, value }
    if (value === 'true' || value === '1' || value === 1) return { ok: true, value: true }
    if (value === 'false' || value === '0' || value === 0 || value === '') {
      return { ok: true, value: false }
    }
    return { ok: true, value: Boolean(value) }
  }

  if (to === 'null') {
    return { ok: true, value: null }
  }

  if (to === 'object') {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return { ok: true, value }
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return { ok: true, value: {} }
      return { ok: false }
    }
    return { ok: true, value: {} }
  }

  if (to === 'array') {
    if (Array.isArray(value)) return { ok: true, value }
    if (typeof value === 'object' && value !== null) {
      if (Object.keys(value as Record<string, unknown>).length === 0) {
        return { ok: true, value: [] }
      }
      return { ok: true, value: [value] }
    }
    return { ok: true, value: [] }
  }

  return { ok: false }
}

export function inferJsonSchema(data: unknown): object {
  if (data === null) return { type: 'null' }
  if (typeof data === 'string') return { type: 'string' }
  if (typeof data === 'number') return { type: 'number' }
  if (typeof data === 'boolean') return { type: 'boolean' }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { type: 'array', items: {} }
    }
    const first = data[0]
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const properties: Record<string, object> = {}
      for (const item of data) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          for (const [k, v] of Object.entries(item)) {
            if (!properties[k]) {
              properties[k] = inferJsonSchema(v)
            }
          }
        }
      }
      return { type: 'array', items: { type: 'object', properties } }
    }
    return { type: 'array', items: inferJsonSchema(first) }
  }

  if (typeof data === 'object') {
    const properties: Record<string, object> = {}
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      properties[k] = inferJsonSchema(v)
    }
    return { type: 'object', properties }
  }

  return {}
}
