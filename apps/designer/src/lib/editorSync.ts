import type { DocumentDef } from '@apw-pdf/core'
import type { TemplateRecord } from '../../server/templateStore.js'
import { validateDocumentText, type Issue } from './validate.js'
import { inferJsonSchema } from '../editor/dataModel.js'

export function docToText(doc: DocumentDef | unknown): string {
  return JSON.stringify(doc, null, 2)
}

export function textToDoc(
  text: string,
): { ok: true; doc: DocumentDef } | { ok: false; issues: Issue[] } {
  const res = validateDocumentText(text)
  if (!res.ok) {
    return { ok: false, issues: res.issues }
  }
  return { ok: true, doc: res.value as DocumentDef }
}

export interface BuildSaveRecordParams {
  name: string
  description?: string
  doc: unknown
  data: unknown
}

export function buildSaveRecord({
  name,
  description = '',
  doc,
  data,
}: BuildSaveRecordParams): TemplateRecord {
  return {
    name,
    description: description || `Template ${name}`,
    document: doc,
    dataSchema: inferJsonSchema(data),
    example: data,
  }
}
