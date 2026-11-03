import fs from 'node:fs/promises'
import {
  PathNotAllowedError,
  resolveInside,
  validateTemplateName,
} from '@apw-pdf/mcp'
import { ApwPdfError, formatZodPath, parseDocument } from '@apw-pdf/core'
import { templates } from '@apw-pdf/templates'

export interface TemplateRecord {
  name: string
  description: string
  document: unknown
  dataSchema: object
  example: unknown
}

export interface TemplateSummary {
  name: string
  description: string
  source: 'builtin' | 'saved'
}

export class StoreError extends Error {
  status: 403 | 404 | 409 | 413 | 422
  issues?: Array<{ path: string; message: string }>

  constructor(
    status: 403 | 404 | 409 | 413 | 422,
    message: string,
    issues?: Array<{ path: string; message: string }>,
  ) {
    super(message)
    this.name = 'StoreError'
    this.status = status
    this.issues = issues
  }
}

export function createTemplateStore(dir: string) {
  return {
    async list(): Promise<TemplateSummary[]> {
      const result: TemplateSummary[] = Object.entries(templates).map(
        ([k, v]: [string, any]) => ({
          name: k,
          description: v.description ?? k,
          source: 'builtin' as const,
        }),
      )

      try {
        const entries = await fs.readdir(dir)
        for (const entry of entries) {
          if (!entry.endsWith('.json')) continue
          const baseName = entry.slice(0, -5)
          try {
            validateTemplateName(baseName)
            const filePath = resolveInside(dir, entry)
            const raw = await fs.readFile(filePath, 'utf8')
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object') {
              result.push({
                name: typeof parsed.name === 'string' ? parsed.name : baseName,
                description:
                  typeof parsed.description === 'string'
                    ? parsed.description
                    : `Saved template ${baseName}`,
                source: 'saved',
              })
            }
          } catch {
            // Ignore corrupt or invalid json files
          }
        }
      } catch {
        // Directory does not exist yet
      }

      return result
    },

    async get(name: string): Promise<TemplateRecord & { source: 'builtin' | 'saved' }> {
      validateTemplateName(name)

      if (Object.hasOwn(templates, name)) {
        const b = (templates as Record<string, any>)[name]
        return {
          name,
          description: b.description ?? name,
          document: b.document,
          dataSchema: b.dataSchema ?? {},
          example: b.example ?? {},
          source: 'builtin',
        }
      }

      const filePath = resolveInside(dir, `${name}.json`)
      let raw: string
      try {
        raw = await fs.readFile(filePath, 'utf8')
      } catch (err: any) {
        if (err && err.code === 'ENOENT') {
          throw new StoreError(404, `Template "${name}" not found`)
        }
        throw err
      }

      try {
        const parsed = JSON.parse(raw)
        return {
          name,
          description:
            typeof parsed.description === 'string'
              ? parsed.description
              : `Saved template ${name}`,
          document: parsed.document ?? parsed,
          dataSchema:
            parsed.dataSchema && typeof parsed.dataSchema === 'object'
              ? parsed.dataSchema
              : {},
          example: parsed.example ?? {},
          source: 'saved',
        }
      } catch {
        throw new StoreError(404, `Template "${name}" is malformed`)
      }
    },

    async put(record: TemplateRecord, opts?: { overwrite?: boolean }): Promise<void> {
      validateTemplateName(record.name)

      if (Object.hasOwn(templates, record.name)) {
        throw new StoreError(
          403,
          `Cannot overwrite builtin template "${record.name}"`,
        )
      }

      if (Buffer.byteLength(JSON.stringify(record), 'utf8') > 1024 * 1024) {
        throw new StoreError(413, 'Saved template payload exceeds 1 MB limit')
      }

      let parsedDoc: unknown
      try {
        parsedDoc = parseDocument(record.document)
      } catch (err: any) {
        const issues: Array<{ path: string; message: string }> = []
        if (err && err.name === 'ApwPdfError' && Array.isArray(err.details)) {
          for (const item of err.details) {
            const p = Array.isArray(item.path)
              ? formatZodPath(item.path)
              : (item.path ?? err.path ?? '')
            issues.push({ path: p, message: item.message })
          }
        }
        if (issues.length === 0) {
          issues.push({
            path: err?.path ?? '',
            message: err?.message ?? 'Invalid document schema',
          })
        }
        throw new StoreError(422, err?.message ?? 'Invalid document schema', issues)
      }

      const payload = JSON.stringify(
        {
          name: record.name,
          description: record.description ?? `Saved template ${record.name}`,
          document: parsedDoc,
          dataSchema: record.dataSchema ?? {},
          example: record.example ?? {},
        },
        null,
        2,
      )

      if (Buffer.byteLength(payload, 'utf8') > 1024 * 1024) {
        throw new StoreError(413, 'Saved template payload exceeds 1 MB limit')
      }

      const targetPath = resolveInside(dir, `${record.name}.json`)
      await fs.mkdir(dir, { recursive: true })

      try {
        await fs.writeFile(targetPath, payload, {
          encoding: 'utf8',
          flag: opts?.overwrite ? 'w' : 'wx',
        })
      } catch (err: any) {
        if (err && err.code === 'EEXIST') {
          throw new StoreError(
            409,
            `Template "${record.name}" already exists (pass overwrite: true to replace)`,
          )
        }
        throw err
      }
    },

    async remove(name: string): Promise<void> {
      validateTemplateName(name)

      if (Object.hasOwn(templates, name)) {
        throw new StoreError(
          403,
          `Cannot delete builtin template "${name}"`,
        )
      }

      const filePath = resolveInside(dir, `${name}.json`)
      try {
        await fs.unlink(filePath)
      } catch (err: any) {
        if (err && err.code === 'ENOENT') {
          throw new StoreError(404, `Template "${name}" not found`)
        }
        throw err
      }
    },
  }
}
