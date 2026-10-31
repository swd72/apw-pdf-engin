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
})
