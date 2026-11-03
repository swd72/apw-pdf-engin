import { describe, it, expect } from 'vitest'
import {
  listPaths,
  setAtPath,
  removeAtPath,
  renameKey,
  addArrayItem,
  convertType,
  inferJsonSchema,
  isUsableKey,
} from './dataModel.js'

describe('dataModel', () => {
  it('listPaths lists nested scalars, objects and arrays with rowFields', () => {
    const data = {
      title: 'Report',
      count: 5,
      user: {
        name: 'Alice',
        active: true,
      },
      items: [
        { id: 1, label: 'First' },
        { id: 2, label: 'Second' },
      ],
    }

    const paths = listPaths(data)
    expect(paths).toContainEqual({ path: 'title', type: 'string' })
    expect(paths).toContainEqual({ path: 'count', type: 'number' })
    expect(paths).toContainEqual({ path: 'user', type: 'object' })
    expect(paths).toContainEqual({ path: 'user.name', type: 'string' })
    expect(paths).toContainEqual({ path: 'user.active', type: 'boolean' })
    expect(paths).toContainEqual({ path: 'items', type: 'array', rowFields: ['id', 'label'] })
  })

  it('listPaths on empty array and null does not throw', () => {
    expect(() => listPaths([])).not.toThrow()
    expect(() => listPaths(null)).not.toThrow()
    expect(() => listPaths(undefined)).not.toThrow()
    expect(listPaths([])).toEqual([])
    expect(listPaths(null)).toEqual([])
    expect(listPaths({ emptyList: [] })).toContainEqual({ path: 'emptyList', type: 'array' })
  })

  it('setAtPath creates intermediate objects and does not mutate input', () => {
    const original = { a: 1 }
    const next = setAtPath(original, ['nested', 'deep', 'val'], 'hello')

    expect(original).toEqual({ a: 1 })
    expect(next).toEqual({
      a: 1,
      nested: {
        deep: {
          val: 'hello',
        },
      },
    })
  })

  it('removeAtPath on array index and on key', () => {
    const data = {
      arr: ['first', 'second', 'third'],
      keyToRemove: 'bye',
      keep: 'hi',
    }

    const res1 = removeAtPath(data, ['arr', 1]) as any
    expect(res1.arr).toEqual(['first', 'third'])
    expect(data.arr).toEqual(['first', 'second', 'third']) // immutability

    const res2 = removeAtPath(data, ['keyToRemove']) as any
    expect(res2).toEqual({
      arr: ['first', 'second', 'third'],
      keep: 'hi',
    })
  })

  it('renameKey rejects duplicate and empty and keeps key order', () => {
    const data = { a: 1, b: 2, c: 3 }

    const dup = renameKey(data, ['b'], 'c')
    expect(dup).toEqual({ ok: false, reason: 'duplicate' })

    const empty = renameKey(data, ['b'], '')
    expect(empty).toEqual({ ok: false, reason: 'empty' })

    const ok = renameKey(data, ['b'], 'bNew')
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(Object.keys(ok.data as object)).toEqual(['a', 'bNew', 'c'])
      expect((ok.data as any).bNew).toBe(2)
    }
  })

  it('addArrayItem copies first-element shape with emptied values', () => {
    const data = {
      items: [
        {
          id: 1,
          title: 'Item 1',
          active: true,
          sub: { note: 'foo' },
        },
      ],
    }

    const next = addArrayItem(data, ['items']) as any
    expect(next.items).toHaveLength(2)
    expect(next.items[0]).toEqual(data.items[0])
    expect(next.items[1]).toEqual({
      id: 0,
      title: '',
      active: false,
      sub: { note: '' },
    })
  })

  it('convertType "12" to number ok, "abc" to number rejected, "" to number rejected, number to string ok, non-empty object to string rejected', () => {
    expect(convertType('12', 'number')).toEqual({ ok: true, value: 12 })
    expect(convertType('abc', 'number')).toEqual({ ok: false })
    expect(convertType('', 'number')).toEqual({ ok: false })
    expect(convertType(42, 'string')).toEqual({ ok: true, value: '42' })
    expect(convertType({ a: 1 }, 'string')).toEqual({ ok: false })
  })

  it('inferJsonSchema scalars, nested object, array of objects, empty array gives items {}', () => {
    expect(inferJsonSchema('hello')).toEqual({ type: 'string' })
    expect(inferJsonSchema(123)).toEqual({ type: 'number' })
    expect(inferJsonSchema(true)).toEqual({ type: 'boolean' })

    const nested = { user: { name: 'Alice' } }
    expect(inferJsonSchema(nested)).toEqual({
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      },
    })

    const arrOfObjects = [{ id: 1 }]
    expect(inferJsonSchema(arrOfObjects)).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
        },
      },
    })

    expect(inferJsonSchema([])).toEqual({
      type: 'array',
      items: {},
    })
  })

  it('isUsableKey rejects "a b", "__proto__" and accepts "item_1"', () => {
    expect(isUsableKey('a b')).toBe(false)
    expect(isUsableKey('__proto__')).toBe(false)
    expect(isUsableKey('item_1')).toBe(true)
  })
})
