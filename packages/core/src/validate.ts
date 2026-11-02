import type { ValidationIssue } from './engine.js'
import { SCHEMA_SHAPES, lineSpacingObjectSchemas } from './schema.js'

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function shapeKeys(schema: { shape: Record<string, unknown> }): Set<string> {
  return new Set(Object.keys(schema.shape))
}

let _keySets: Record<string, Set<string>> | null = null

export function getKeySets(): Record<string, Set<string>> {
  if (!_keySets) {
    const sets: Record<string, Set<string>> = {}
    for (const [key, schema] of Object.entries(SCHEMA_SHAPES)) {
      sets[key] = shapeKeys(schema)
    }
    sets.lineSpacing = new Set(lineSpacingObjectSchemas.flatMap((s) => Object.keys(s.shape)))
    _keySets = sets
  }
  return _keySets
}

export const INTEGRITY_KEY_SETS: Record<string, Set<string>> = new Proxy(
  {} as Record<string, Set<string>>,
  {
    get(_target, prop: string) {
      return getKeySets()[prop]
    },
    ownKeys() {
      return Object.keys(getKeySets())
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      return {
        enumerable: true,
        configurable: true,
        value: getKeySets()[prop],
      }
    },
  },
)

export function validateDocumentIntegrity(doc: unknown): ValidationIssue[] {
  if (!isObject(doc)) return []
  const issues: ValidationIssue[] = []
  const keys = getKeySets()

  function checkUnknownKeys(
    obj: Record<string, unknown>,
    allowed: Set<string>,
    basePath: string,
  ): void {
    for (const key of Object.keys(obj)) {
      if (!allowed.has(key)) {
        issues.push({
          path: basePath ? `${basePath}.${key}` : key,
          code: 'UNKNOWN_KEY',
          message: `Unknown key "${key}"`,
        })
      }
    }
  }

  // 1. Top-level DocumentDef
  checkUnknownKeys(doc, keys.document, '')

  const documentStyles = isObject(doc.styles) ? doc.styles : undefined

  // Meta
  if (isObject(doc.meta)) {
    checkUnknownKeys(doc.meta, keys.meta, 'meta')
  }

  // Page
  if (isObject(doc.page)) {
    checkUnknownKeys(doc.page, keys.page, 'page')
    if (isObject(doc.page.size)) {
      checkUnknownKeys(doc.page.size, keys.pageSizeObj, 'page.size')
    }
    if (isObject(doc.page.margin)) {
      checkUnknownKeys(doc.page.margin, keys.pageMargin, 'page.margin')
    }
  }

  // Font
  if (isObject(doc.font)) {
    checkUnknownKeys(doc.font, keys.font, 'font')
    if (isObject(doc.font.lineSpacing)) {
      checkUnknownKeys(doc.font.lineSpacing, keys.lineSpacing, 'font.lineSpacing')
    }
  }

  // PageNumber
  if (isObject(doc.pageNumber)) {
    checkUnknownKeys(doc.pageNumber, keys.pageNumber, 'pageNumber')
  }

  function validateParagraphStyleFields(
    styleObj: Record<string, unknown>,
    basePath: string,
  ): void {
    if (isObject(styleObj.font)) {
      checkUnknownKeys(styleObj.font, keys.styleFont, `${basePath}.font`)
    }
    if (isObject(styleObj.lineSpacing)) {
      checkUnknownKeys(styleObj.lineSpacing, keys.lineSpacing, `${basePath}.lineSpacing`)
    }
    if (Array.isArray(styleObj.tabs)) {
      styleObj.tabs.forEach((tab, tIdx) => {
        if (isObject(tab)) {
          checkUnknownKeys(tab, keys.tabStop, `${basePath}.tabs[${tIdx}]`)
        }
      })
    }
  }

  // Styles
  if (isObject(doc.styles)) {
    for (const [sName, sVal] of Object.entries(doc.styles)) {
      if (isObject(sVal)) {
        checkUnknownKeys(sVal, keys.paragraphStyle, `styles.${sName}`)
        validateParagraphStyleFields(sVal, `styles.${sName}`)
      }
    }
  }

  function validateInlineRun(run: unknown, path: string): void {
    if (!isObject(run)) return
    if ('tab' in run) {
      checkUnknownKeys(run, keys.tabRun, path)
    } else if ('fill' in run) {
      checkUnknownKeys(run, keys.fillRun, path)
    } else if ('checkbox' in run) {
      checkUnknownKeys(run, keys.checkboxRun, path)
    } else if ('lineBreak' in run) {
      checkUnknownKeys(run, keys.lineBreakRun, path)
    } else if ('pageNumber' in run) {
      checkUnknownKeys(run, keys.pageNumberRun, path)
    } else if ('pageCount' in run) {
      checkUnknownKeys(run, keys.pageCountRun, path)
    } else if ('text' in run) {
      checkUnknownKeys(run, keys.textRun, path)
      if (Array.isArray(run.anchors)) {
        run.anchors.forEach((anc, aIdx) => {
          if (isObject(anc)) {
            checkUnknownKeys(anc, keys.anchor, `${path}.anchors[${aIdx}]`)
          }
        })
      }
    }
  }

  function validateCell(cell: unknown, path: string): void {
    if (!isObject(cell)) return
    checkUnknownKeys(cell, keys.cell, path)

    if (typeof cell.style === 'string') {
      if (!documentStyles || !Object.hasOwn(documentStyles, cell.style)) {
        issues.push({
          path: `${path}.style`,
          code: 'STYLE_NOT_FOUND',
          message: `Style "${cell.style}" not defined in document styles`,
        })
      }
    }

    if (isObject(cell.border)) {
      checkUnknownKeys(cell.border, keys.border, `${path}.border`)
    }

    if (Array.isArray(cell.blocks)) {
      cell.blocks.forEach((b, bIdx) => {
        validateBlock(b, `${path}.blocks[${bIdx}]`)
      })
    }
  }

  function validateBlock(block: unknown, path: string): void {
    if (!isObject(block)) return
    const bType = typeof block.type === 'string' ? block.type : null

    switch (bType) {
      case 'paragraph': {
        checkUnknownKeys(block, keys.paragraphBlock, path)
        if (typeof block.style === 'string') {
          if (!documentStyles || !Object.hasOwn(documentStyles, block.style)) {
            issues.push({
              path: `${path}.style`,
              code: 'STYLE_NOT_FOUND',
              message: `Style "${block.style}" not defined in document styles`,
            })
          }
        }
        validateParagraphStyleFields(block, path)
        if (Array.isArray(block.runs)) {
          block.runs.forEach((r, rIdx) => {
            validateInlineRun(r, `${path}.runs[${rIdx}]`)
          })
        }
        break
      }
      case 'image': {
        checkUnknownKeys(block, keys.imageBlock, path)
        if (isObject(block.anchor)) {
          checkUnknownKeys(block.anchor, keys.imageAnchor, `${path}.anchor`)
        }
        break
      }
      case 'table': {
        checkUnknownKeys(block, keys.tableBlock, path)
        if (Array.isArray(block.columns)) {
          block.columns.forEach((col, cIdx) => {
            if (isObject(col)) {
              checkUnknownKeys(col, keys.tableColumn, `${path}.columns[${cIdx}]`)
            }
          })
        }
        if (Array.isArray(block.header)) {
          block.header.forEach((row, rIdx) => {
            if (Array.isArray(row)) {
              row.forEach((c, cIdx) => validateCell(c, `${path}.header[${rIdx}][${cIdx}]`))
            }
          })
        }
        if (Array.isArray(block.footer)) {
          block.footer.forEach((row, rIdx) => {
            if (Array.isArray(row)) {
              row.forEach((c, cIdx) => validateCell(c, `${path}.footer[${rIdx}][${cIdx}]`))
            }
          })
        }
        if (Array.isArray(block.rows)) {
          block.rows.forEach((row, rIdx) => {
            if (Array.isArray(row)) {
              row.forEach((c, cIdx) => validateCell(c, `${path}.rows[${rIdx}][${cIdx}]`))
            }
          })
        } else if (isObject(block.rows)) {
          checkUnknownKeys(block.rows, keys.tableEachRows, `${path}.rows`)
          if (Array.isArray(block.rows.cells)) {
            block.rows.cells.forEach((c, cIdx) => validateCell(c, `${path}.rows.cells[${cIdx}]`))
          }
        }
        if (isObject(block.border)) {
          checkUnknownKeys(block.border, keys.border, `${path}.border`)
        }
        break
      }
      case 'columns': {
        checkUnknownKeys(block, keys.columnsBlock, path)
        if (Array.isArray(block.columns)) {
          block.columns.forEach((col, cIdx) => {
            if (isObject(col)) {
              checkUnknownKeys(col, keys.columnsCol, `${path}.columns[${cIdx}]`)
              if (Array.isArray(col.blocks)) {
                col.blocks.forEach((cb, bIdx) => {
                  validateBlock(cb, `${path}.columns[${cIdx}].blocks[${bIdx}]`)
                })
              }
            }
          })
        }
        break
      }
      case 'signature': {
        checkUnknownKeys(block, keys.signatureBlock, path)
        break
      }
      case 'spacer': {
        checkUnknownKeys(block, keys.spacerBlock, path)
        if (isObject(block.height)) {
          checkUnknownKeys(block.height, keys.spacerHeightObj, `${path}.height`)
        }
        break
      }
      case 'line': {
        checkUnknownKeys(block, keys.lineBlock, path)
        break
      }
      case 'pageBreak': {
        checkUnknownKeys(block, keys.pageBreakBlock, path)
        break
      }
      case 'each': {
        checkUnknownKeys(block, keys.eachBlock, path)
        if (Array.isArray(block.blocks)) {
          block.blocks.forEach((eb, bIdx) => {
            validateBlock(eb, `${path}.blocks[${bIdx}]`)
          })
        }
        break
      }
      case 'if': {
        checkUnknownKeys(block, keys.ifBlock, path)
        if (Array.isArray(block.then)) {
          block.then.forEach((tb, bIdx) => {
            validateBlock(tb, `${path}.then[${bIdx}]`)
          })
        }
        if (Array.isArray(block.else)) {
          block.else.forEach((eb, bIdx) => {
            validateBlock(eb, `${path}.else[${bIdx}]`)
          })
        }
        break
      }
    }
  }

  if (Array.isArray(doc.blocks)) {
    doc.blocks.forEach((b, bIdx) => {
      validateBlock(b, `blocks[${bIdx}]`)
    })
  }

  return issues
}
