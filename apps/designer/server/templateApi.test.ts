import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { memo } from '@apw-pdf/templates'
import { createTemplateStore } from './templateStore.js'
import { createTemplateApiHandler } from './templateApi.js'

describe('templateApi HTTP handler', () => {
  let tmpDir: string
  let server: http.Server
  let baseUrl: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apw-api-test-'))
    const store = createTemplateStore(tmpDir)
    const handler = createTemplateApiHandler(store)

    server = http.createServer((req, res) => {
      handler(req, res, () => {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('next called')
      })
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('GET /api/templates lists builtin memo', async () => {
    const res = await fetch(`${baseUrl}/api/templates`)
    expect(res.status).toBe(200)
    const list = await res.json()
    expect(Array.isArray(list)).toBe(true)
    const memoItem = list.find((item: any) => item.name === 'memo')
    expect(memoItem).toBeDefined()
    expect(memoItem.source).toBe('builtin')
  })

  it('PUT then GET round-trip', async () => {
    const record = {
      name: 'round-trip-tpl',
      description: 'Round trip test',
      document: memo.document,
      dataSchema: { type: 'object' },
      example: { ok: true },
    }

    const putRes = await fetch(`${baseUrl}/api/templates/round-trip-tpl`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    expect(putRes.status).toBe(200)

    const getRes = await fetch(`${baseUrl}/api/templates/round-trip-tpl`)
    expect(getRes.status).toBe(200)
    const got = await getRes.json()
    expect(got.name).toBe('round-trip-tpl')
    expect(got.description).toBe('Round trip test')
    expect(got.source).toBe('saved')
    expect(got.document).toEqual(memo.document)
  })

  it('PUT existing without overwrite → 409, with ?overwrite=true → 200', async () => {
    const record = {
      name: 'conflict-tpl',
      description: 'Initial',
      document: memo.document,
      dataSchema: {},
      example: {},
    }

    const firstPut = await fetch(`${baseUrl}/api/templates/conflict-tpl`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    expect(firstPut.status).toBe(200)

    // Repeat without overwrite
    const secondPut = await fetch(`${baseUrl}/api/templates/conflict-tpl`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...record, description: 'Updated' }),
    })
    expect(secondPut.status).toBe(409)

    // With ?overwrite=true
    const overwritePut = await fetch(`${baseUrl}/api/templates/conflict-tpl?overwrite=true`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...record, description: 'Updated' }),
    })
    expect(overwritePut.status).toBe(200)

    const getRes = await fetch(`${baseUrl}/api/templates/conflict-tpl`)
    const got = await getRes.json()
    expect(got.description).toBe('Updated')
  })

  it('PUT invalid document → 422 body has issues', async () => {
    const record = {
      name: 'invalid-doc',
      description: 'Bad schema',
      document: { foo: 'bar' },
      dataSchema: {},
      example: {},
    }

    const res = await fetch(`${baseUrl}/api/templates/invalid-doc`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.error).toBeDefined()
    expect(Array.isArray(data.issues)).toBe(true)
    expect(data.issues.length).toBeGreaterThan(0)
    expect(data.issues[0].path).toBeDefined()

    const files = await fs.readdir(tmpDir)
    expect(files).toHaveLength(0)
  })

  it('PUT body > 1 MB → 413 before parsing completes', async () => {
    const record = {
      name: 'huge-tpl',
      description: 'x'.repeat(1024 * 1024 + 100),
      document: memo.document,
      dataSchema: {},
      example: {},
    }

    const res = await fetch(`${baseUrl}/api/templates/huge-tpl`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    expect(res.status).toBe(413)

    const files = await fs.readdir(tmpDir)
    expect(files).toHaveLength(0)
  })

  it('PUT /api/templates/..%2Fevil → 4xx and nothing written', async () => {
    const record = {
      name: '../evil',
      description: 'Path traversal',
      document: memo.document,
      dataSchema: {},
      example: {},
    }

    const res = await fetch(`${baseUrl}/api/templates/..%2Fevil`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)

    const files = await fs.readdir(tmpDir)
    expect(files).toHaveLength(0)
  })

  it('DELETE builtin → 403', async () => {
    const res = await fetch(`${baseUrl}/api/templates/memo`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(403)
  })

  it('non-/api path calls next()', async () => {
    const res = await fetch(`${baseUrl}/other-path`)
    expect(res.status).toBe(404)
    const text = await res.text()
    expect(text).toBe('next called')
  })
})
