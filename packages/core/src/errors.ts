export type ErrorCode =
  | 'SCHEMA_INVALID'
  | 'MISSING_VARIABLE'
  | 'EXPRESSION_INVALID'
  | 'INVALID_VALUE'
  | 'FONT_NOT_FOUND'
  | 'FONT_INVALID'
  | 'IMAGE_LOAD_FAILED'
  | 'IMAGE_NOT_ALLOWED'
  | 'ANCHOR_NOT_FOUND'
  | 'BLOCK_TOO_TALL'
  | 'SEGMENTER_UNAVAILABLE'
  | 'LIMIT_EXCEEDED'
  | 'UNKNOWN_KEY'
  | 'STYLE_NOT_FOUND'

export type WarningCode =
  | 'MISSING_GLYPH'
  | 'FORCED_BREAK'
  | 'FONT_STYLE_FALLBACK'
  | 'MISSING_VARIABLE'
  | 'UNKNOWN_KEY'
  | 'STYLE_NOT_FOUND'

export interface Warning {
  code: string
  message: string
  path?: string
}

export class ApwPdfError extends Error {
  code: ErrorCode
  path?: string
  details?: unknown

  constructor(
    code: ErrorCode,
    message: string,
    opts?: { path?: string; details?: unknown },
  ) {
    super(message)
    this.name = 'ApwPdfError'
    this.code = code
    if (opts?.path !== undefined) {
      this.path = opts.path
    }
    if (opts?.details !== undefined) {
      this.details = opts.details
    }
  }
}
