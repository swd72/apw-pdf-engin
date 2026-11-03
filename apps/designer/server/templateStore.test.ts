import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PathNotAllowedError } from '@apw-pdf/mcp'
import { memo } from '@apw-pdf/templates'
import {
  createTemplateStore,
  StoreError,
  type TemplateRecord,
} from './templateStore.js'

describe('createTemplateStore', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apw-store-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('put then get round-trips a record', async () => {
    const store = createTemplateStore(tmpDir)
    const record: TemplateRecord = {
      name: 'my-custom',
      description: 'A custom memo template',
      document: memo.document,
      dataSchema: { type: 'object' },
      example: { subject: 'Test' },
    }

    await store.put(record, { overwrite: false })
    const got = await store.get('my-custom')

    expect(got.name).toBe('my-custom')
    expect(got.description).toBe('A custom memo template')
    expect(got.source).toBe('saved')
    expect(got.document).toEqual(memo.document)
    expect(got.dataSchema).toEqual({ type: 'object' })
    expect(got.example).toEqual({ subject: 'Test' })
  })

  it("list includes builtin 'memo' with source builtin and saved entries", async () => {
    const store = createTemplateStore(tmpDir)
    const record: TemplateRecord = {
      name: 'saved-memo',
      description: 'Saved custom memo',
      document: memo.document,
      dataSchema: {},
      example: {},
    }
    await store.put(record, { overwrite: false })

    const list = await store.list()
    const builtinItem = list.find((item) => item.name === 'memo')
    expect(builtinItem).toBeDefined()
    expect(builtinItem?.source).toBe('builtin')

    const savedItem = list.find((item) => item.name === 'saved-memo')
    expect(savedItem).toBeDefined()
    expect(savedItem?.source).toBe('saved')
    expect(savedItem?.description).toBe('Saved custom memo')
  })

  it('put rejects name "../evil" with PathNotAllowedError and writes nothing', async () => {
    const store = createTemplateStore(tmpDir)
    const record: TemplateRecord = {
      name: '../evil',
      description: 'Evil path traversal',
      document: memo.document,
      dataSchema: {},
      example: {},
    }

    await expect(store.put(record, { overwrite: false })).rejects.toThrow(
      PathNotAllowedError,
    )
    const files = await fs.readdir(tmpDir)
    expect(files).toHaveLength(0)
  })

  it('put rejects names "a/b", empty, and ".json" suffix with PathNotAllowedError', async () => {
    const store = createTemplateStore(tmpDir)
    const invalidNames = ['a/b', '', 'template.json']

    for (const name of invalidNames) {
      const record: TemplateRecord = {
        name,
        description: 'Invalid name',
        document: memo.document,
        dataSchema: {},
        example: {},
      }
      await expect(store.put(record, { overwrite: false })).rejects.toThrow(
        PathNotAllowedError,
      )
    }
  })

  it('put of existing name without overwrite throws StoreError 409', async () => {
    const store = createTemplateStore(tmpDir)
    const record: TemplateRecord = {
      name: 'existing-tpl',
      description: 'First version',
      document: memo.document,
      dataSchema: {},
      example: {},
    }

    await store.put(record, { overwrite: false })

    const updated: TemplateRecord = {
      ...record,
      description: 'Second version',
    }

    await expect(store.put(updated, { overwrite: false })).rejects.toMatchObject({
      status: 409,
    })

    const current = await store.get('existing-tpl')
    expect(current.description).toBe('First version')
  })

  it("put of builtin name 'memo' throws StoreError 403", async () => {
    const store = createTemplateStore(tmpDir)
    const record: TemplateRecord = {
      name: 'memo',
      description: 'Trying to overwrite builtin',
      document: memo.document,
      dataSchema: {},
      example: {},
    }

    await expect(store.put(record, { overwrite: true })).rejects.toMatchObject({
      status: 403,
    })
  })

  it('put with schema-invalid document throws StoreError 422 with issues[0].path defined and writes nothing', async () => {
    const store = createTemplateStore(tmpDir)
    const record: TemplateRecord = {
      name: 'invalid-doc-tpl',
      description: 'Invalid doc',
      document: { invalidSchema: true },
      dataSchema: {},
      example: {},
    }

    try {
      await store.put(record, { overwrite: false })
      expect.unreachable('Should have thrown StoreError')
    } catch (err) {
      expect(err).toBeInstanceOf(StoreError)
      const storeErr = err as StoreError
      expect(storeErr.status).toBe(422)
      expect(storeErr.issues).toBeDefined()
      expect(storeErr.issues!.length).toBeGreaterThan(0)
      expect(storeErr.issues![0]!.path).toBeDefined()
    }

    const files = await fs.readdir(tmpDir)
    expect(files).toHaveLength(0)
  })

  it('put over 1 MB throws StoreError 413', async () => {
    const store = createTemplateStore(tmpDir)
    const record: TemplateRecord = {
      name: 'huge-tpl',
      description: 'x'.repeat(1024 * 1024 + 100),
      document: memo.document,
      dataSchema: {},
      example: {},
    }

    await expect(store.put(record, { overwrite: false })).rejects.toMatchObject({
      status: 413,
    })
  })

  it('remove deletes saved, throws 403 for builtin, 404 for missing', async () => {
    const store = createTemplateStore(tmpDir)
    const record: TemplateRecord = {
      name: 'temp-tpl',
      description: 'To be deleted',
      document: memo.document,
      dataSchema: {},
      example: {},
    }
    await store.put(record, { overwrite: false })

    await store.remove('temp-tpl')
    await expect(store.get('temp-tpl')).rejects.toMatchObject({ status: 404 })

    await expect(store.remove('memo')).rejects.toMatchObject({ status: 403 })
    await expect(store.remove('missing-tpl')).rejects.toMatchObject({ status: 404 })
  })

  it('list skips a corrupt .json file and still lists the rest', async () => {
    const store = createTemplateStore(tmpDir)
    const validRecord: TemplateRecord = {
      name: 'good-tpl',
      description: 'Good template',
      document: memo.document,
      dataSchema: {},
      example: {},
    }
    await store.put(validRecord, { overwrite: false })

    await fs.writeFile(path.join(tmpDir, 'corrupt.json'), '{"corrupt: json syntax error', 'utf8')

    const list = await store.list()
    const goodItem = list.find((item) => item.name === 'good-tpl')
    expect(goodItem).toBeDefined()
    expect(goodItem?.source).toBe('saved')

    const corruptItem = list.find((item) => item.name === 'corrupt')
    expect(corruptItem).toBeUndefined()
  })

  it('get unknown name throws 404', async () => {
    const store = createTemplateStore(tmpDir)
    await expect(store.get('unknown-template')).rejects.toMatchObject({
      status: 404,
    })
  })
})
