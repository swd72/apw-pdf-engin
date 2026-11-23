import { describe, it, expect } from 'vitest'
import type { Server } from 'node:http'
import { isMainModule, pruneRateWindows, createApp } from '../server.js'

describe('isMainModule', () => {
  it.skipIf(process.platform !== 'win32')('identifies Windows absolute file paths correctly', () => {
    const metaUrl = 'file:///D:/AI/apw-pdf-engin/examples/express-server/dist/server.js'
    const argv1 = 'D:\\AI\\apw-pdf-engin\\examples\\express-server\\dist\\server.js'
    expect(isMainModule(metaUrl, argv1)).toBe(true)
  })

  it('identifies file paths correctly for current platform', () => {
    const isWin = process.platform === 'win32'
    const metaUrl = isWin
      ? 'file:///D:/home/user/project/dist/server.js'
      : 'file:///home/user/project/dist/server.js'
    const argv1 = isWin
      ? 'D:\\home\\user\\project\\dist\\server.js'
      : '/home/user/project/dist/server.js'
    expect(isMainModule(metaUrl, argv1)).toBe(true)
  })

  it.skipIf(process.platform !== 'win32')('handles Windows paths with spaces and special characters', () => {
    const metaUrl = 'file:///D:/My%20Projects/app/dist/server.js'
    const argv1 = 'D:\\My Projects\\app\\dist\\server.js'
    expect(isMainModule(metaUrl, argv1)).toBe(true)
  })

  it.skipIf(process.platform === 'win32')('handles POSIX paths with spaces and special characters', () => {
    const metaUrl = 'file:///home/user/My%20Projects/app/dist/server.js'
    const argv1 = '/home/user/My Projects/app/dist/server.js'
    expect(isMainModule(metaUrl, argv1)).toBe(true)
  })

  it('returns false when argv1 is undefined or non-matching', () => {
    const metaUrl = 'file:///D:/project/server.js'
    expect(isMainModule(metaUrl, undefined)).toBe(false)
    expect(isMainModule(metaUrl, 'D:\\project\\other.js')).toBe(false)
  })
})

describe('pruneRateWindows', () => {
  it('prunes expired entries and keeps valid entries', () => {
    const now = 100_000
    const windows = new Map([
      ['expired-1', { count: 5, resetAt: now - 100 }],
      ['expired-2', { count: 2, resetAt: now }],
      ['valid-1', { count: 1, resetAt: now + 500 }],
    ])

    pruneRateWindows(windows, now)

    expect(windows.has('expired-1')).toBe(false)
    expect(windows.has('expired-2')).toBe(false)
    expect(windows.has('valid-1')).toBe(true)
    expect(windows.get('valid-1')?.count).toBe(1)
  })

  it('caps map size to maxEntries when too many concurrent entries exist', () => {
    const now = 100_000
    const windows = new Map<string, { count: number; resetAt: number }>()
    for (let i = 0; i < 20; i++) {
      windows.set(`ip-${i}`, { count: 1, resetAt: now + 10_000 })
    }

    pruneRateWindows(windows, now, 10)
    expect(windows.size).toBe(10)
  })
})

describe('createApp', () => {
  it('serves GET /templates with template list', async () => {
    const app = await createApp({
      renderer: {
        render: async () => new Uint8Array(),
      },
    })

    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s))
    })

    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Unexpected address format')
      }
      const res = await fetch(`http://127.0.0.1:${address.port}/templates`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
      expect(data[0]).toHaveProperty('name')
      expect(data[0]).toHaveProperty('description')
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })
})
