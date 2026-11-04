import { describe, it, expect } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { memo } from '@apw-pdf/templates'
import { runCli } from '../src/cli.js'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('apw-pdf CLI', () => {
  it('lists templates, validates valid/invalid data, and renders PDF via runCli', async () => {
    const logs: string[] = []
    const errs: string[] = []
    const io = {
      stdout: (msg: string) => logs.push(msg),
      stderr: (msg: string) => errs.push(msg),
    }

    const codeTpl = await runCli(['templates'], io)
    expect(codeTpl).toBe(0)
    expect(logs.join('\n')).toContain('memo')
    expect(logs.join('\n')).toContain('external-letter')

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apw-pdf-cli-'))
    const badJson = path.join(tmpDir, 'bad.json')
    const goodJson = path.join(tmpDir, 'good.json')
    const outPdf = path.join(tmpDir, 'out.pdf')
    await fs.writeFile(badJson, JSON.stringify({ agency: 'ก' }))
    await fs.writeFile(goodJson, JSON.stringify(memo.example))

    errs.length = 0
    const codeBad = await runCli(['validate', 'memo', badJson], io)
    expect(codeBad).toBe(1)
    expect(errs.join('\n')).toContain('MISSING_VARIABLE')

    const codeGood = await runCli(['validate', 'memo', goodJson], io)
    expect(codeGood).toBe(0)

    const codeRender = await runCli(['render', 'memo', goodJson, '-o', outPdf], io)
    expect(codeRender).toBe(0)
    const stat = await fs.stat(outPdf)
    expect(stat.size).toBeGreaterThan(1000)

    const tplJson = path.join(tmpDir, 'tpl.json')
    await fs.writeFile(tplJson, JSON.stringify(memo.document))
    const codeNonStrict = await runCli(
      ['render', tplJson, badJson, '-o', outPdf, '--non-strict'],
      io,
    )
    expect(codeNonStrict).toBe(0)

    expect(await runCli(['unknown'], io)).toBe(1)
    expect(await runCli(['validate'], io)).toBe(1)
    expect(await runCli(['render', 'memo', goodJson], io)).toBe(1)
  })

  it('renders a UTF-8 BOM-prefixed data file and template file', async () => {
    const logs: string[] = []
    const errs: string[] = []
    const io = {
      stdout: (msg: string) => logs.push(msg),
      stderr: (msg: string) => errs.push(msg),
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apw-pdf-cli-bom-'))
    const bomDataJson = path.join(tmpDir, 'bom-data.json')
    const bomTplJson = path.join(tmpDir, 'bom-tpl.json')
    const outPdf = path.join(tmpDir, 'bom-out.pdf')

    await fs.writeFile(bomDataJson, `\uFEFF${JSON.stringify(memo.example)}`, 'utf8')
    await fs.writeFile(bomTplJson, `\uFEFF${JSON.stringify(memo.document)}`, 'utf8')

    expect(await runCli(['validate', bomTplJson, bomDataJson], io)).toBe(0)
    expect(await runCli(['render', 'memo', bomDataJson, '-o', outPdf], io)).toBe(0)
    expect(errs).toEqual([])
    const stat = await fs.stat(outPdf)
    expect(stat.size).toBeGreaterThan(1000)
  })

  it('exits with code 1 and prints MISSING_VARIABLE when running node bin/apw-pdf.js validate memo bad.json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apw-pdf-bin-'))
    const badJson = path.join(tmpDir, 'bad.json')
    await fs.writeFile(badJson, JSON.stringify({}))
    const binPath = path.resolve(__dirname, '../bin/apw-pdf.js')

    let exitCode = 0
    let output = ''
    try {
      await execFileAsync(process.execPath, [binPath, 'validate', 'memo', badJson])
    } catch (err: unknown) {
      const e = err as { code?: number; stdout?: string; stderr?: string }
      exitCode = e.code ?? 1
      output = `${e.stdout ?? ''}\n${e.stderr ?? ''}`
    }
    expect(exitCode).toBe(1)
    expect(output).toContain('MISSING_VARIABLE')
  })
})
