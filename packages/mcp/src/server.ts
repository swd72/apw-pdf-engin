import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ApwPdfError, parseDocument, type TemplateDef } from '@apw-pdf/core'
import { createRenderer } from '@apw-pdf/node'
import { rasterizePage } from '@apw-pdf/raster'
import { templates as builtinTemplates } from '@apw-pdf/templates'
import {
  PathNotAllowedError,
  resolveInside,
  validatePdfFileName,
  validateTemplateName,
} from './paths.js'
import {
  STANDARDS_SECTION,
  formatToolError,
  getSchemaGuide,
} from './tools.js'

export interface ServerOptions {
  outputDir: string
  templateDir?: string
  imageBaseDir?: string | null
  allowRemoteImages?: string[]
}

interface SavedTemplateRecord {
  name: string
  description: string
  document: unknown
  dataSchema: object
  example: unknown
}

async function readSavedTemplate(
  templateDir: string,
  name: string,
): Promise<SavedTemplateRecord> {
  validateTemplateName(name)
  const filePath = resolveInside(templateDir, `${name}.json`)
  const raw = await fs.readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw) as Record<string, unknown>
  if (parsed && typeof parsed === 'object' && 'document' in parsed) {
    return {
      name,
      description:
        typeof parsed.description === 'string'
          ? parsed.description
          : `Saved template ${name}`,
      document: parsed.document,
      dataSchema:
        parsed.dataSchema && typeof parsed.dataSchema === 'object'
          ? parsed.dataSchema
          : {},
      example: parsed.example ?? {},
    }
  }
  return {
    name,
    description: `Saved template ${name}`,
    document: parsed,
    dataSchema: {},
    example: {},
  }
}

export async function createServer(opts: ServerOptions): Promise<McpServer> {
  const renderer = await createRenderer({
    imageBaseDir: opts.imageBaseDir ?? null,
    allowRemoteImages: opts.allowRemoteImages,
  })

  const server = new McpServer({
    name: '@apw-pdf/mcp',
    version: '0.1.0',
  })

  async function resolveTargetTemplate(
    template: unknown,
    templateName?: string,
  ): Promise<unknown> {
    if (template !== undefined) {
      return template
    }
    if (!templateName) {
      throw new ApwPdfError(
        'SCHEMA_INVALID',
        'Either template or templateName is required',
        { path: 'templateName' },
      )
    }
    const builtin = (builtinTemplates as Record<string, TemplateDef | undefined>)[
      templateName
    ]
    if (builtin) {
      return builtin.document
    }
    if (opts.templateDir) {
      const saved = await readSavedTemplate(opts.templateDir, templateName)
      return saved.document
    }
    throw new ApwPdfError(
      'SCHEMA_INVALID',
      `Unknown template: ${templateName}`,
      { path: 'templateName' },
    )
  }

  // 1. describe_schema
  server.registerTool(
    'describe_schema',
    {
      description:
        'Describe the APW PDF document JSON schema, inline runs, filters, and Thai government document standards.',
      inputSchema: {
        topic: z
          .enum(['blocks', 'inline', 'filters', 'standards'])
          .optional(),
      },
    },
    async ({ topic }) => ({
      content: [
        {
          type: 'text',
          text: getSchemaGuide(topic),
        },
      ],
    }),
  )

  // 2. list_templates
  server.registerTool(
    'list_templates',
    {
      description: 'List all builtin and saved templates.',
      inputSchema: {},
    },
    async () => {
      const result: Array<{
        name: string
        description: string
        source: 'builtin' | 'saved'
      }> = Object.values(builtinTemplates).map((tpl) => ({
        name: tpl.name,
        description: tpl.description,
        source: 'builtin',
      }))

      if (opts.templateDir) {
        try {
          const entries = await fs.readdir(opts.templateDir)
          for (const entry of entries) {
            if (!entry.endsWith('.json')) continue
            const baseName = entry.slice(0, -5)
            try {
              const saved = await readSavedTemplate(opts.templateDir, baseName)
              result.push({
                name: saved.name,
                description: saved.description,
                source: 'saved',
              })
            } catch {
              // ignore malformed files
            }
          }
        } catch {
          // templateDir may not exist yet
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      }
    },
  )

  // 3. get_template
  server.registerTool(
    'get_template',
    {
      description:
        'Get a builtin or saved template definition, its dataSchema, and example data.',
      inputSchema: {
        name: z.string(),
      },
    },
    async ({ name }) => {
      try {
        const builtin = (
          builtinTemplates as Record<string, TemplateDef | undefined>
        )[name]
        if (builtin) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  template: builtin.document,
                  dataSchema: builtin.dataSchema,
                  example: builtin.example,
                }),
              },
            ],
          }
        }
        if (opts.templateDir) {
          const saved = await readSavedTemplate(opts.templateDir, name)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  template: saved.document,
                  dataSchema: saved.dataSchema,
                  example: saved.example,
                }),
              },
            ],
          }
        }
        throw new ApwPdfError('SCHEMA_INVALID', `Unknown template: ${name}`, {
          path: 'name',
        })
      } catch (err) {
        return formatToolError(err)
      }
    },
  )

  // 4. validate_document
  server.registerTool(
    'validate_document',
    {
      description: 'Validate a document or template name against input data.',
      inputSchema: {
        template: z.unknown().optional(),
        templateName: z.string().optional(),
        data: z.unknown(),
      },
    },
    async ({ template, templateName, data }) => {
      try {
        const doc = await resolveTargetTemplate(template, templateName)
        const validation = renderer.validate(doc, data)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(validation),
            },
          ],
        }
      } catch (err) {
        return formatToolError(err)
      }
    },
  )

  // 5. render_pdf
  server.registerTool(
    'render_pdf',
    {
      description:
        'Render a document or template with data to a PDF file inside APW_PDF_OUTPUT_DIR.',
      inputSchema: {
        template: z.unknown().optional(),
        templateName: z.string().optional(),
        data: z.unknown(),
        fileName: z.string().optional(),
      },
    },
    async ({ template, templateName, data, fileName }) => {
      try {
        const safeName = validatePdfFileName(
          fileName ?? `${templateName ?? 'document'}-${Date.now()}.pdf`,
        )
        const targetPath = resolveInside(opts.outputDir, safeName)
        const doc = await resolveTargetTemplate(template, templateName)
        await fs.mkdir(opts.outputDir, { recursive: true })
        const { pageCount, warnings } = await renderer.renderToFile(
          doc,
          data,
          targetPath,
        )
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                path: targetPath,
                pageCount,
                warnings,
              }),
            },
          ],
        }
      } catch (err) {
        return formatToolError(err)
      }
    },
  )

  // 6. render_page_png
  server.registerTool(
    'render_page_png',
    {
      description:
        'Render a specific page of a document or template to PNG (up to 200 DPI) for visual inspection.',
      inputSchema: {
        template: z.unknown().optional(),
        templateName: z.string().optional(),
        data: z.unknown(),
        page: z.number().int().min(1).optional(),
        dpi: z.number().min(36).max(200).optional(),
      },
    },
    async ({ template, templateName, data, page, dpi }) => {
      try {
        const doc = await resolveTargetTemplate(template, templateName)
        const pdfBytes = await renderer.render(doc, data)
        const pngBytes = await rasterizePage(pdfBytes, page ?? 1, {
          dpi: dpi ?? 150,
        })
        return {
          content: [
            {
              type: 'image',
              mimeType: 'image/png',
              data: Buffer.from(pngBytes).toString('base64'),
            },
          ],
        }
      } catch (err) {
        return formatToolError(err)
      }
    },
  )

  // 7. save_template
  server.registerTool(
    'save_template',
    {
      description:
        'Validate and save a custom JSON template into APW_PDF_TEMPLATE_DIR.',
      inputSchema: {
        name: z.string(),
        template: z.unknown(),
        description: z.string().optional(),
        dataSchema: z.record(z.unknown()).optional(),
        example: z.unknown().optional(),
      },
    },
    async ({ name, template, description, dataSchema, example }) => {
      try {
        if (!opts.templateDir) {
          throw new PathNotAllowedError('APW_PDF_TEMPLATE_DIR is not configured')
        }
        validateTemplateName(name)
        const parsedDoc = parseDocument(template)
        const targetPath = resolveInside(opts.templateDir, `${name}.json`)
        await fs.mkdir(opts.templateDir, { recursive: true })
        await fs.writeFile(
          targetPath,
          JSON.stringify(
            {
              name,
              description: description ?? `Saved template ${name}`,
              document: parsedDoc,
              dataSchema: dataSchema ?? {},
              example: example ?? {},
            },
            null,
            2,
          ),
          'utf8',
        )
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ path: targetPath }),
            },
          ],
        }
      } catch (err) {
        return formatToolError(err)
      }
    },
  )

  // Resource 1: apw-pdf://standards
  server.registerResource(
    'standards',
    'apw-pdf://standards',
    {
      description: 'Thai government document layout standards (§3)',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: STANDARDS_SECTION,
        },
      ],
    }),
  )

  // Resource 2: apw-pdf://templates/{name}
  server.registerResource(
    'template',
    new ResourceTemplate('apw-pdf://templates/{name}', { list: undefined }),
    {
      description: 'Template JSON definition by name',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const name = String(variables.name ?? '')
      const builtin = (
        builtinTemplates as Record<string, TemplateDef | undefined>
      )[name]
      if (builtin) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(builtin, null, 2),
            },
          ],
        }
      }
      if (opts.templateDir) {
        const saved = await readSavedTemplate(opts.templateDir, name)
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(saved, null, 2),
            },
          ],
        }
      }
      throw new ApwPdfError('SCHEMA_INVALID', `Unknown template: ${name}`, {
        path: 'name',
      })
    },
  )

  return server
}

export async function runStdioServer(
  env: NodeJS.ProcessEnv = process.env,
): Promise<McpServer> {
  const outputDir = env.APW_PDF_OUTPUT_DIR?.trim()
  if (!outputDir) {
    throw new Error('APW_PDF_OUTPUT_DIR environment variable is required')
  }
  const templateDir = env.APW_PDF_TEMPLATE_DIR?.trim() || undefined
  const imageBaseDir = env.APW_PDF_IMAGE_BASE_DIR?.trim() || undefined
  const allowRemoteImages = env.APW_PDF_ALLOW_REMOTE_IMAGES
    ? env.APW_PDF_ALLOW_REMOTE_IMAGES.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined

  const server = await createServer({
    outputDir: path.resolve(outputDir),
    templateDir: templateDir ? path.resolve(templateDir) : undefined,
    imageBaseDir: imageBaseDir ? path.resolve(imageBaseDir) : null,
    allowRemoteImages,
  })
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}
