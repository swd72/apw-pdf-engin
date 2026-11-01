import type { ValidationIssue } from './engine.js'

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

const DOCUMENT_KEYS = new Set([
  'version',
  'meta',
  'page',
  'font',
  'numerals',
  'pageNumber',
  'styles',
  'dictionary',
  'assets',
  'blocks',
])

const META_KEYS = new Set(['title', 'author', 'subject', 'keywords'])
const PAGE_KEYS = new Set(['size', 'orientation', 'margin'])
const PAGE_SIZE_OBJ_KEYS = new Set(['width', 'height'])
const PAGE_MARGIN_KEYS = new Set(['top', 'bottom', 'left', 'right'])
const FONT_KEYS = new Set(['family', 'size', 'lineSpacing', 'color'])
const LINE_SPACING_KEYS = new Set(['multiple', 'exactly', 'atLeast'])
const PAGE_NUMBER_KEYS = new Set(['from', 'position', 'format', 'size', 'offset'])

const PARAGRAPH_STYLE_KEYS = new Set([
  'align',
  'firstLineIndent',
  'indentLeft',
  'indentRight',
  'spaceBefore',
  'spaceAfter',
  'lineSpacing',
  'tabs',
  'font',
  'keepWithNext',
  'keepLinesTogether',
  'widowControl',
])

const STYLE_FONT_KEYS = new Set(['family', 'size', 'bold', 'italic', 'color'])
const TAB_STOP_KEYS = new Set(['at', 'align', 'leader'])

const PARAGRAPH_BLOCK_KEYS = new Set([
  'type',
  'id',
  'style',
  'text',
  'runs',
  ...PARAGRAPH_STYLE_KEYS,
])

const IMAGE_BLOCK_KEYS = new Set([
  'type',
  'src',
  'width',
  'height',
  'align',
  'anchor',
  'spaceAfter',
])
const IMAGE_ANCHOR_KEYS = new Set(['relativeTo', 'x', 'y'])

const TABLE_BLOCK_KEYS = new Set([
  'type',
  'columns',
  'header',
  'rows',
  'footer',
  'repeatHeader',
  'border',
  'cellPadding',
  'allowRowSplit',
])
const TABLE_COLUMN_KEYS = new Set(['width', 'align'])
const TABLE_EACH_ROWS_KEYS = new Set(['each', 'as', 'cells'])
const CELL_KEYS = new Set([
  'blocks',
  'text',
  'colSpan',
  'rowSpan',
  'align',
  'vAlign',
  'border',
  'shade',
  'style',
])
const BORDER_KEYS = new Set(['width', 'color', 'style', 'top', 'bottom', 'left', 'right'])

const COLUMNS_BLOCK_KEYS = new Set(['type', 'columns', 'gap', 'keepTogether'])
const COLUMNS_COL_KEYS = new Set(['width', 'align', 'blocks'])

const SIGNATURE_BLOCK_KEYS = new Set([
  'type',
  'startAt',
  'linesBefore',
  'prefix',
  'image',
  'imageHeight',
  'name',
  'positions',
  'minLinesBefore',
])

const SPACER_BLOCK_KEYS = new Set(['type', 'height'])
const SPACER_HEIGHT_OBJ_KEYS = new Set(['lines'])

const LINE_BLOCK_KEYS = new Set(['type', 'thickness', 'style', 'spaceBefore', 'spaceAfter'])
const PAGE_BREAK_BLOCK_KEYS = new Set(['type'])
const EACH_BLOCK_KEYS = new Set(['type', 'of', 'as', 'blocks'])
const IF_BLOCK_KEYS = new Set(['type', 'test', 'then', 'else'])

const TEXT_RUN_KEYS = new Set([
  'text',
  'bold',
  'italic',
  'underline',
  'size',
  'family',
  'color',
  'anchors',
  'numerals',
])
const ANCHOR_KEYS = new Set(['name', 'index', 'edge'])
const TAB_RUN_KEYS = new Set(['tab'])
const FILL_RUN_KEYS = new Set(['fill', 'width', 'leader', 'align'])
const CHECKBOX_RUN_KEYS = new Set(['checkbox'])
const LINE_BREAK_RUN_KEYS = new Set(['lineBreak'])
const PAGE_NUMBER_RUN_KEYS = new Set(['pageNumber'])
const PAGE_COUNT_RUN_KEYS = new Set(['pageCount'])

export function validateDocumentIntegrity(doc: unknown): ValidationIssue[] {
  if (!isObject(doc)) return []
  const issues: ValidationIssue[] = []

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
  checkUnknownKeys(doc, DOCUMENT_KEYS, '')

  const documentStyles = isObject(doc.styles) ? doc.styles : undefined

  // Meta
  if (isObject(doc.meta)) {
    checkUnknownKeys(doc.meta, META_KEYS, 'meta')
  }

  // Page
  if (isObject(doc.page)) {
    checkUnknownKeys(doc.page, PAGE_KEYS, 'page')
    if (isObject(doc.page.size)) {
      checkUnknownKeys(doc.page.size, PAGE_SIZE_OBJ_KEYS, 'page.size')
    }
    if (isObject(doc.page.margin)) {
      checkUnknownKeys(doc.page.margin, PAGE_MARGIN_KEYS, 'page.margin')
    }
  }

  // Font
  if (isObject(doc.font)) {
    checkUnknownKeys(doc.font, FONT_KEYS, 'font')
    if (isObject(doc.font.lineSpacing)) {
      checkUnknownKeys(doc.font.lineSpacing, LINE_SPACING_KEYS, 'font.lineSpacing')
    }
  }

  // PageNumber
  if (isObject(doc.pageNumber)) {
    checkUnknownKeys(doc.pageNumber, PAGE_NUMBER_KEYS, 'pageNumber')
  }

  function validateParagraphStyleFields(
    styleObj: Record<string, unknown>,
    basePath: string,
  ): void {
    if (isObject(styleObj.font)) {
      checkUnknownKeys(styleObj.font, STYLE_FONT_KEYS, `${basePath}.font`)
    }
    if (isObject(styleObj.lineSpacing)) {
      checkUnknownKeys(styleObj.lineSpacing, LINE_SPACING_KEYS, `${basePath}.lineSpacing`)
    }
    if (Array.isArray(styleObj.tabs)) {
      styleObj.tabs.forEach((tab, tIdx) => {
        if (isObject(tab)) {
          checkUnknownKeys(tab, TAB_STOP_KEYS, `${basePath}.tabs[${tIdx}]`)
        }
      })
    }
  }

  // Styles
  if (isObject(doc.styles)) {
    for (const [sName, sVal] of Object.entries(doc.styles)) {
      if (isObject(sVal)) {
        checkUnknownKeys(sVal, PARAGRAPH_STYLE_KEYS, `styles.${sName}`)
        validateParagraphStyleFields(sVal, `styles.${sName}`)
      }
    }
  }

  function validateInlineRun(run: unknown, path: string): void {
    if (!isObject(run)) return
    if ('tab' in run) {
      checkUnknownKeys(run, TAB_RUN_KEYS, path)
    } else if ('fill' in run) {
      checkUnknownKeys(run, FILL_RUN_KEYS, path)
    } else if ('checkbox' in run) {
      checkUnknownKeys(run, CHECKBOX_RUN_KEYS, path)
    } else if ('lineBreak' in run) {
      checkUnknownKeys(run, LINE_BREAK_RUN_KEYS, path)
    } else if ('pageNumber' in run) {
      checkUnknownKeys(run, PAGE_NUMBER_RUN_KEYS, path)
    } else if ('pageCount' in run) {
      checkUnknownKeys(run, PAGE_COUNT_RUN_KEYS, path)
    } else if ('text' in run) {
      checkUnknownKeys(run, TEXT_RUN_KEYS, path)
      if (Array.isArray(run.anchors)) {
        run.anchors.forEach((anc, aIdx) => {
          if (isObject(anc)) {
            checkUnknownKeys(anc, ANCHOR_KEYS, `${path}.anchors[${aIdx}]`)
          }
        })
      }
    }
  }

  function validateCell(cell: unknown, path: string): void {
    if (!isObject(cell)) return
    checkUnknownKeys(cell, CELL_KEYS, path)

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
      checkUnknownKeys(cell.border, BORDER_KEYS, `${path}.border`)
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
        checkUnknownKeys(block, PARAGRAPH_BLOCK_KEYS, path)
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
        checkUnknownKeys(block, IMAGE_BLOCK_KEYS, path)
        if (isObject(block.anchor)) {
          checkUnknownKeys(block.anchor, IMAGE_ANCHOR_KEYS, `${path}.anchor`)
        }
        break
      }
      case 'table': {
        checkUnknownKeys(block, TABLE_BLOCK_KEYS, path)
        if (Array.isArray(block.columns)) {
          block.columns.forEach((col, cIdx) => {
            if (isObject(col)) {
              checkUnknownKeys(col, TABLE_COLUMN_KEYS, `${path}.columns[${cIdx}]`)
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
          checkUnknownKeys(block.rows, TABLE_EACH_ROWS_KEYS, `${path}.rows`)
          if (Array.isArray(block.rows.cells)) {
            block.rows.cells.forEach((c, cIdx) => validateCell(c, `${path}.rows.cells[${cIdx}]`))
          }
        }
        if (isObject(block.border)) {
          checkUnknownKeys(block.border, BORDER_KEYS, `${path}.border`)
        }
        break
      }
      case 'columns': {
        checkUnknownKeys(block, COLUMNS_BLOCK_KEYS, path)
        if (Array.isArray(block.columns)) {
          block.columns.forEach((col, cIdx) => {
            if (isObject(col)) {
              checkUnknownKeys(col, COLUMNS_COL_KEYS, `${path}.columns[${cIdx}]`)
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
        checkUnknownKeys(block, SIGNATURE_BLOCK_KEYS, path)
        break
      }
      case 'spacer': {
        checkUnknownKeys(block, SPACER_BLOCK_KEYS, path)
        if (isObject(block.height)) {
          checkUnknownKeys(block.height, SPACER_HEIGHT_OBJ_KEYS, `${path}.height`)
        }
        break
      }
      case 'line': {
        checkUnknownKeys(block, LINE_BLOCK_KEYS, path)
        break
      }
      case 'pageBreak': {
        checkUnknownKeys(block, PAGE_BREAK_BLOCK_KEYS, path)
        break
      }
      case 'each': {
        checkUnknownKeys(block, EACH_BLOCK_KEYS, path)
        if (Array.isArray(block.blocks)) {
          block.blocks.forEach((eb, bIdx) => {
            validateBlock(eb, `${path}.blocks[${bIdx}]`)
          })
        }
        break
      }
      case 'if': {
        checkUnknownKeys(block, IF_BLOCK_KEYS, path)
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
