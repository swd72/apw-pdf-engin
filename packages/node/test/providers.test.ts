import { describe, it, expect } from 'vitest'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fontsDir } from '@apw-pdf/fonts/node'
import { fsFontProvider, fsImageProvider } from '../src/index.js'

const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
)

describe('fsFontProvider and fsImageProvider', () => {
  it('loads font from first matching directory and throws FONT_NOT_FOUND otherwise', async () => {
    const provider = fsFontProvider([path.join(os.tmpdir(), 'nonexistent-fonts'), fontsDir])
    const bytes = await provider.load('THSarabunIT9', { bold: false, italic: false })
    expect(bytes.byteLength).toBeGreaterThan(1000)

    const emptyProvider = fsFontProvider([path.join(os.tmpdir(), 'nonexistent-fonts')])
    await expect(
      emptyProvider.load('THSarabunIT9', { bold: false, italic: false }),
    ).rejects.toMatchObject({ code: 'FONT_NOT_FOUND' })
  })

  it('blocks path traversal outside baseDir with IMAGE_NOT_ALLOWED', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apw-pdf-img-'))
    const imgProvider = fsImageProvider({ baseDir: tmpDir })
    await expect(imgProvider.load('../../etc/passwd')).rejects.toMatchObject({
      code: 'IMAGE_NOT_ALLOWED',
    })
  })

  it('blocks remote image by default and loads when hostname is in allowRemoteImages', async () => {
    const blockedProvider = fsImageProvider({})
    await expect(
      blockedProvider.load('http://169.254.169.254/x.png'),
    ).rejects.toMatchObject({
      code: 'IMAGE_NOT_ALLOWED',
    })

    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end(Buffer.from(PNG_1X1))
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0

    try {
      const allowedProvider = fsImageProvider({
        allowRemoteImages: ['127.0.0.1'],
      })
      const loaded = await allowedProvider.load(`http://127.0.0.1:${port}/x.png`)
      expect(Buffer.from(loaded).equals(Buffer.from(PNG_1X1))).toBe(true)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('loads asset:garuda, custom assets, relative files inside baseDir, and data: URLs', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apw-pdf-local-'))
    const localImgPath = path.join(tmpDir, 'local.png')
    await fs.writeFile(localImgPath, PNG_1X1)

    const provider = fsImageProvider({
      baseDir: tmpDir,
      assets: {
        customBytes: PNG_1X1,
        customPath: localImgPath,
      },
    })
    const garuda = await provider.load('asset:garuda')
    expect(garuda[0]).toBe(0x89)
    expect(garuda[1]).toBe(0x50)

    const custom1 = await provider.load('asset:customBytes')
    expect(Buffer.from(custom1).equals(Buffer.from(PNG_1X1))).toBe(true)

    const custom2 = await provider.load('asset:customPath')
    expect(Buffer.from(custom2).equals(Buffer.from(PNG_1X1))).toBe(true)

    const relLoaded = await provider.load('local.png')
    expect(Buffer.from(relLoaded).equals(Buffer.from(PNG_1X1))).toBe(true)

    await expect(provider.load('missing.png')).rejects.toMatchObject({
      code: 'IMAGE_LOAD_FAILED',
    })
    await expect(provider.load('asset:unknown')).rejects.toMatchObject({
      code: 'IMAGE_LOAD_FAILED',
    })

    const b64 = Buffer.from(PNG_1X1).toString('base64')
    const dataImg = await provider.load(`data:image/png;base64,${b64}`)
    expect(Buffer.from(dataImg).equals(Buffer.from(PNG_1X1))).toBe(true)
  })

  it('blocks SSRF via 3xx redirect to unallowed host and enforces https for non-loopback hosts (S1)', async () => {
    let targetHit = false
    const evilServer = http.createServer((_req, res) => {
      targetHit = true
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end(Buffer.from(PNG_1X1))
    })
    await new Promise<void>((resolve) => evilServer.listen(0, '127.0.0.1', () => resolve()))
    const evilAddr = evilServer.address()
    const evilPort = typeof evilAddr === 'object' && evilAddr ? evilAddr.port : 0

    const redirectServer = http.createServer((req, res) => {
      if (req.url === '/redirect-evil') {
        res.writeHead(302, { Location: `http://localhost:${evilPort}/steal.png` })
        res.end()
        return
      }
      if (req.url === '/redirect-ok') {
        res.writeHead(302, { Location: '/final.png' })
        res.end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end(Buffer.from(PNG_1X1))
    })
    await new Promise<void>((resolve) => redirectServer.listen(0, '127.0.0.1', () => resolve()))
    const redirAddr = redirectServer.address()
    const redirPort = typeof redirAddr === 'object' && redirAddr ? redirAddr.port : 0

    try {
      // Only 127.0.0.1 is allowlisted, NOT localhost
      const provider = fsImageProvider({
        allowRemoteImages: ['127.0.0.1', 'example.com'],
      })

      await expect(
        provider.load(`http://127.0.0.1:${redirPort}/redirect-evil`),
      ).rejects.toMatchObject({
        code: 'IMAGE_NOT_ALLOWED',
      })
      expect(targetHit).toBe(false)

      // Redirect to allowed host succeeds
      const okBytes = await provider.load(`http://127.0.0.1:${redirPort}/redirect-ok`)
      expect(Buffer.from(okBytes).equals(Buffer.from(PNG_1X1))).toBe(true)

      // Non-loopback http:// is rejected even if hostname is in allowRemoteImages
      await expect(
        provider.load('http://example.com/logo.png'),
      ).rejects.toMatchObject({
        code: 'IMAGE_NOT_ALLOWED',
      })
    } finally {
      await new Promise<void>((resolve) => redirectServer.close(() => resolve()))
      await new Promise<void>((resolve) => evilServer.close(() => resolve()))
    }
  })

  it('prechecks Content-Length and aborts streaming response body at 10 MB without buffering everything (S2)', async () => {
    let chunksSent = 0
    const oneMb = Buffer.alloc(1024 * 1024, 0x41)
    const server = http.createServer((req, res) => {
      if (req.url === '/cl-oversize') {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': String(25 * 1024 * 1024),
        })
        // Never even finish sending 25 MB; precheck should reject immediately on headers
        res.write(Buffer.alloc(1024))
        return
      }
      if (req.url === '/stream-oversize') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        const writeNext = () => {
          if (res.destroyed || res.writableEnded) return
          if (chunksSent >= 25) {
            res.end()
            return
          }
          chunksSent++
          const ok = res.write(oneMb)
          if (ok) {
            setImmediate(writeNext)
          } else {
            res.once('drain', writeNext)
          }
        }
        writeNext()
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0

    try {
      const provider = fsImageProvider({ allowRemoteImages: ['127.0.0.1'] })

      // Content-Length > 10 MB rejects immediately with LIMIT_EXCEEDED (not timeout!)
      const start = Date.now()
      await expect(
        provider.load(`http://127.0.0.1:${port}/cl-oversize`),
      ).rejects.toMatchObject({
        code: 'LIMIT_EXCEEDED',
      })
      expect(Date.now() - start).toBeLessThan(2000)

      // Streaming response > 10 MB aborts early with LIMIT_EXCEEDED before all 25 chunks are sent
      await expect(
        provider.load(`http://127.0.0.1:${port}/stream-oversize`),
      ).rejects.toMatchObject({
        code: 'LIMIT_EXCEEDED',
      })
      expect(chunksSent).toBeLessThan(20)
    } finally {
      server.closeAllConnections?.()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
