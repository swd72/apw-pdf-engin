import path from 'node:path'

export class PathNotAllowedError extends Error {
  code = 'PATH_NOT_ALLOWED' as const
  path?: string

  constructor(message = 'PATH_NOT_ALLOWED', targetPath?: string) {
    super(message)
    this.name = 'PathNotAllowedError'
    this.path = targetPath
  }
}

const PDF_FILENAME_RE = /^[\w\-ก-๙. ]{1,100}\.pdf$/
const TEMPLATE_NAME_RE = /^[a-z0-9-]{1,64}$/

export function validatePdfFileName(fileName: string): string {
  if (!PDF_FILENAME_RE.test(fileName) || fileName.includes('..')) {
    throw new PathNotAllowedError('PATH_NOT_ALLOWED', fileName)
  }
  return fileName
}

export function validateTemplateName(name: string): string {
  if (!TEMPLATE_NAME_RE.test(name)) {
    throw new PathNotAllowedError('PATH_NOT_ALLOWED', name)
  }
  return name
}

export function resolveInside(root: string, name: string): string {
  if (
    !name ||
    path.isAbsolute(name) ||
    name.startsWith('/') ||
    name.startsWith('\\') ||
    /^[a-zA-Z]:/.test(name) ||
    name.includes('..')
  ) {
    throw new PathNotAllowedError('PATH_NOT_ALLOWED', name)
  }

  const rootAbs = path.resolve(root)
  const resolved = path.resolve(rootAbs, name)
  const rel = path.relative(rootAbs, resolved)

  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new PathNotAllowedError('PATH_NOT_ALLOWED', name)
  }

  return resolved
}
