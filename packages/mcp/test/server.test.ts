import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { memo } from '@apw-pdf/templates'
import {
  createServer,
  formatToolError,
  getSchemaGuide,
  resolveInside,
  runStdioServer,
  validatePdfFileName,
} from '../src/index.js'

describe('@apw-pdf/mcp server and tools', () => {
  let tmpRoot: string
  let outputDir: string
  let templateDir: string
  let client: Client
  let closeAll: () => Promise<void>

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'apw-pdf-mcp-'))
    outputDir = path.join(tmpRoot, 'out')
    templateDir = path.join(tmpRoot, 'templates')
    await fs.mkdir(outputDir, { recursive: true })
    await fs.mkdir(templateDir, { recursive: true })

    const server = await createServer({ outputDir, templateDir })
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair()

    client = new Client({ name: 'test-client', version: '1.0.0' })
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ])

    closeAll = async () => {
      await client.close()
      await server.close()
    }
  })

  afterEach(async () => {
    await closeAll?.()
    await fs.rm(tmpRoot, { recursive: true, force: true })
  })

  it('listTools returns all 7 tools', async () => {
    const res = await client.listTools()
    const names = res.tools.map((t) => t.name)
    expect(names).toEqual([
      'describe_schema',
      'list_templates',
      'get_template',
      'validate_document',
      'render_pdf',
      'render_page_png',
      'save_template',
    ])
  })

  it('render_pdf renders memo example into outputDir with pageCount 1', async () => {
    const res = await client.callTool({
      name: 'render_pdf',
      arguments: {
        templateName: 'memo',
        data: memo.example as Record<string, unknown>,
      },
    })
    expect(res.isError).toBeFalsy()
    const content = res.content as Array<{ type: string; text: string }>
    const parsed = JSON.parse(content[0]!.text) as {
      path: string
      pageCount: number
      warnings: unknown[]
    }
    expect(parsed.pageCount).toBe(1)
    expect(parsed.path.startsWith(outputDir)).toBe(true)
    const stat = await fs.stat(parsed.path)
    expect(stat.size).toBeGreaterThan(100)
  })

  it('render_pdf with fileName "../x.pdf" returns isError and PATH_NOT_ALLOWED and writes nothing outside', async () => {
    const res = await client.callTool({
      name: 'render_pdf',
      arguments: {
        templateName: 'memo',
        data: memo.example as Record<string, unknown>,
        fileName: '../x.pdf',
      },
    })
    expect(res.isError).toBe(true)
    const content = res.content as Array<{ type: string; text: string }>
    expect(content[0]!.text).toContain('PATH_NOT_ALLOWED')
    const outsideExists = await fs
      .stat(path.join(tmpRoot, 'x.pdf'))
      .then(() => true)
      .catch(() => false)
    expect(outsideExists).toBe(false)
  })

  it('render_page_png returns image/png content', async () => {
    const res = await client.callTool({
      name: 'render_page_png',
      arguments: {
        templateName: 'memo',
        data: memo.example as Record<string, unknown>,
        page: 1,
        dpi: 150,
      },
    })
    expect(res.isError).toBeFalsy()
    const content = res.content as Array<{
      type: string
      mimeType: string
      data: string
    }>
    expect(content[0]!.type).toBe('image')
    expect(content[0]!.mimeType).toBe('image/png')
    expect(content[0]!.data.length).toBeGreaterThan(100)
  })

  it('validate_document with missing data returns ok:false and issues with paths', async () => {
    const res = await client.callTool({
      name: 'validate_document',
      arguments: {
        templateName: 'memo',
        data: {},
      },
    })
    expect(res.isError).toBeFalsy()
    const content = res.content as Array<{ type: string; text: string }>
    const parsed = JSON.parse(content[0]!.text) as {
      ok: boolean
      issues: Array<{ path?: string; code: string; message: string }>
    }
    expect(parsed.ok).toBe(false)
    expect(parsed.issues.length).toBeGreaterThan(0)
    expect(parsed.issues[0]!.path).toBeDefined()
  })

  it('save_template saves valid template, appears in list_templates and get_template, and rejects "../evil"', async () => {
    const saveRes = await client.callTool({
      name: 'save_template',
      arguments: {
        name: 'my-memo',
        template: memo.document as unknown as Record<string, unknown>,
        dataSchema: memo.dataSchema as Record<string, unknown>,
        example: memo.example as Record<string, unknown>,
      },
    })
    expect(saveRes.isError).toBeFalsy()

    const listRes = await client.callTool({
      name: 'list_templates',
      arguments: {},
    })
    const listContent = listRes.content as Array<{ type: string; text: string }>
    const templatesList = JSON.parse(listContent[0]!.text) as Array<{
      name: string
      source: string
    }>
    expect(templatesList).toContainEqual(
      expect.objectContaining({ name: 'my-memo', source: 'saved' }),
    )

    const getRes = await client.callTool({
      name: 'get_template',
      arguments: { name: 'my-memo' },
    })
    expect(getRes.isError).toBeFalsy()

    const evilRes = await client.callTool({
      name: 'save_template',
      arguments: {
        name: '../evil',
        template: memo.document as unknown as Record<string, unknown>,
      },
    })
    expect(evilRes.isError).toBe(true)
  })

  it('describe_schema and resources work', async () => {
    const descAll = await client.callTool({
      name: 'describe_schema',
      arguments: {},
    })
    const descContent = descAll.content as Array<{ type: string; text: string }>
    expect(descContent[0]!.text).toContain('paragraph')
    expect(descContent[0]!.text).toContain('thaiDate')

    const descTopic = await client.callTool({
      name: 'describe_schema',
      arguments: { topic: 'standards' },
    })
    const topicContent = descTopic.content as Array<{
      type: string
      text: string
    }>
    expect(topicContent[0]!.text).toContain('2.5')

    const stdResource = await client.readResource({
      uri: 'apw-pdf://standards',
    })
    const stdText = (stdResource.contents[0] as { text: string }).text
    expect(stdText).toContain('ขอแสดงความนับถือ')
    expect(stdText).toContain('2.5')

    const tplResource = await client.readResource({
      uri: 'apw-pdf://templates/memo',
    })
    const tplText = (tplResource.contents[0] as { text: string }).text
    expect(tplText).toContain('บันทึกข้อความ')
  })

  it('resolveInside, validatePdfFileName, getSchemaGuide, formatToolError, and runStdioServer enforce rules', async () => {
    expect(() => resolveInside('/tmp/out', '../secret.pdf')).toThrow(
      'PATH_NOT_ALLOWED',
    )
    expect(() => resolveInside('/tmp/out', '/etc/passwd')).toThrow(
      'PATH_NOT_ALLOWED',
    )
    expect(() => validatePdfFileName('../x.pdf')).toThrow('PATH_NOT_ALLOWED')
    expect(() => validatePdfFileName('บันทึก-01.pdf')).not.toThrow()

    expect(getSchemaGuide('blocks')).toContain('paragraph')
    expect(getSchemaGuide('inline')).toContain('TextRun')
    expect(getSchemaGuide('filters')).toContain('thaiDate')
    expect(getSchemaGuide('standards')).toContain('2.5')

    const genericErr = formatToolError(new Error('boom'))
    expect(genericErr.isError).toBe(true)
    expect(genericErr.content[0]!.text).toContain('INTERNAL_ERROR')

    const getBuiltin = await client.callTool({
      name: 'get_template',
      arguments: { name: 'memo' },
    })
    expect(getBuiltin.isError).toBeFalsy()

    const getUnknown = await client.callTool({
      name: 'get_template',
      arguments: { name: 'unknown-tpl' },
    })
    expect(getUnknown.isError).toBe(true)

    await expect(runStdioServer({})).rejects.toThrow(
      'APW_PDF_OUTPUT_DIR environment variable is required',
    )
  })

  it('disables relative local file images in MCP by default and sanitizes internal error messages (M8, M9)', async () => {
    const docWithLocalImg = {
      ...memo.document,
      blocks: [
        {
          type: 'image',
          src: 'package.json',
          width: '2cm',
        },
      ],
    }
    const res = await client.callTool({
      name: 'render_pdf',
      arguments: {
        template: docWithLocalImg,
        data: {},
      },
    })
    expect(res.isError).toBe(true)
    const content = res.content as Array<{ type: string; text: string }>
    expect(content[0]!.text).toContain('IMAGE_NOT_ALLOWED')

    const fsErr = new Error(
      "ENOENT: no such file or directory, open 'C:\\Users\\secret\\private.json'",
    )
    const formatted = formatToolError(fsErr)
    expect(formatted.isError).toBe(true)
    expect(formatted.content[0]!.text).not.toContain('C:\\Users\\secret')
    expect(formatted.content[0]!.text).not.toContain('private.json')
  })

  it('save_template rejects payloads over 1 MB and prevents silent overwrite unless overwrite:true (M11)', async () => {
    const firstSave = await client.callTool({
      name: 'save_template',
      arguments: {
        name: 'custom-one',
        template: memo.document as unknown as Record<string, unknown>,
      },
    })
    expect(firstSave.isError).toBeFalsy()

    // Second save without overwrite:true fails instead of silently overwriting
    const dupSave = await client.callTool({
      name: 'save_template',
      arguments: {
        name: 'custom-one',
        template: memo.document as unknown as Record<string, unknown>,
      },
    })
    expect(dupSave.isError).toBe(true)

    // With overwrite:true it succeeds
    const overwriteSave = await client.callTool({
      name: 'save_template',
      arguments: {
        name: 'custom-one',
        template: memo.document as unknown as Record<string, unknown>,
        overwrite: true,
      },
    })
    expect(overwriteSave.isError).toBeFalsy()

    // Oversized example (> 1 MB) is rejected with LIMIT_EXCEEDED
    const hugeSave = await client.callTool({
      name: 'save_template',
      arguments: {
        name: 'huge-tpl',
        template: memo.document as unknown as Record<string, unknown>,
        example: { big: 'x'.repeat(1_200_000) },
      },
    })
    expect(hugeSave.isError).toBe(true)
    const hugeContent = hugeSave.content as Array<{ type: string; text: string }>
    expect(hugeContent[0]!.text).toContain('LIMIT_EXCEEDED')
  })
})
