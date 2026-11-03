import { describe, it, expect } from 'vitest'
import { buildSnippets } from './snippet.js'

describe('buildSnippets', () => {
  it('buildSnippets includes PdfDownloadButton and the template name', () => {
    const snippets = buildSnippets('custom-memo')
    expect(snippets.react).toContain('PdfDownloadButton')
    expect(snippets.react).toContain('custom-memo')
    expect(snippets.cli).toBe('apw-pdf render custom-memo data.json -o out.pdf')
  })
})
