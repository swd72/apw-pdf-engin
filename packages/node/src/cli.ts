import fs from 'node:fs/promises'
import { templates } from '@apw-pdf/templates'
import { createRenderer } from './renderer.js'

export interface CliIO {
  stdout: (msg: string) => void
  stderr: (msg: string) => void
}

const defaultIO: CliIO = {
  stdout: (msg: string) => console.log(msg),
  stderr: (msg: string) => console.error(msg),
}

async function loadTemplateOrFile(spec: string): Promise<unknown> {
  if (spec in templates) {
    return templates[spec]!.document
  }
  const raw = await fs.readFile(spec, 'utf8')
  const parsed = JSON.parse(raw) as Record<string, unknown>
  return 'document' in parsed && typeof parsed.document === 'object'
    ? parsed.document
    : parsed
}

export async function runCli(
  argv: string[],
  io: CliIO = defaultIO,
): Promise<number> {
  const cmd = argv[0]

  if (cmd === 'templates') {
    for (const [name, tpl] of Object.entries(templates)) {
      io.stdout(`${name}\t${tpl.description}`)
    }
    return 0
  }

  if (cmd === 'validate') {
    const tplSpec = argv[1]
    const dataPath = argv[2]
    if (!tplSpec || !dataPath) {
      io.stderr('Usage: apw-pdf validate <template.json|name> <data.json>')
      return 1
    }
    try {
      const doc = await loadTemplateOrFile(tplSpec)
      const data = JSON.parse(await fs.readFile(dataPath, 'utf8')) as unknown
      const renderer = await createRenderer()
      const res = renderer.validate(doc, data)
      if (!res.ok) {
        for (const issue of res.issues) {
          io.stderr(`${issue.path ?? ''} ${issue.code} ${issue.message}`.trim())
        }
        return 1
      }
      io.stdout('OK')
      return 0
    } catch (err) {
      io.stderr(err instanceof Error ? err.message : String(err))
      return 1
    }
  }

  if (cmd === 'render') {
    const tplSpec = argv[1]
    const dataPath = argv[2]
    if (!tplSpec || !dataPath) {
      io.stderr(
        'Usage: apw-pdf render <template.json|name> <data.json> -o <out.pdf> [--non-strict]',
      )
      return 1
    }
    let outFile: string | undefined
    let strict = true
    for (let i = 3; i < argv.length; i++) {
      if (argv[i] === '-o' && argv[i + 1]) {
        outFile = argv[i + 1]
        i++
      } else if (argv[i] === '--non-strict') {
        strict = false
      }
    }
    if (!outFile) {
      io.stderr('Missing required -o <out.pdf> argument')
      return 1
    }

    try {
      const doc = await loadTemplateOrFile(tplSpec)
      const data = JSON.parse(await fs.readFile(dataPath, 'utf8')) as unknown
      const renderer = await createRenderer()
      const res = await renderer.renderToFile(doc, data, outFile, { strict })
      for (const w of res.warnings) {
        io.stderr(`WARN ${w.path ?? ''} ${w.code} ${w.message}`.trim())
      }
      io.stdout(`Rendered ${res.pageCount} page(s) to ${outFile}`)
      return 0
    } catch (err) {
      io.stderr(err instanceof Error ? err.message : String(err))
      return 1
    }
  }

  io.stderr(
    'Commands: render <template|name> <data.json> -o <out.pdf> | validate <template|name> <data.json> | templates',
  )
  return 1
}
