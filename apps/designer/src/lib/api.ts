import type { Issue } from './validate.js'
import type { TemplateRecord, TemplateSummary } from '../../server/templateStore.js'

export class ApiError extends Error {
  status: number
  issues?: Issue[]

  constructor(status: number, message: string, issues?: Issue[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.issues = issues
  }
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const res = await fetch('/api/templates')
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new ApiError(
      res.status,
      errData.error ?? 'Failed to list templates',
      errData.issues,
    )
  }
  return res.json()
}

export async function getTemplate(
  name: string,
): Promise<TemplateRecord & { source: 'builtin' | 'saved' }> {
  const res = await fetch(`/api/templates/${encodeURIComponent(name)}`)
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new ApiError(
      res.status,
      errData.error ?? `Failed to get template ${name}`,
      errData.issues,
    )
  }
  return res.json()
}

export async function saveTemplate(
  record: TemplateRecord,
  overwrite = false,
): Promise<{ ok: boolean; name: string }> {
  const query = overwrite ? '?overwrite=true' : ''
  const res = await fetch(
    `/api/templates/${encodeURIComponent(record.name)}${query}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    },
  )
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new ApiError(
      res.status,
      errData.error ?? `Failed to save template ${record.name}`,
      errData.issues,
    )
  }
  return res.json()
}

export async function deleteTemplate(name: string): Promise<void> {
  const res = await fetch(`/api/templates/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new ApiError(
      res.status,
      errData.error ?? `Failed to delete template ${name}`,
      errData.issues,
    )
  }
}
