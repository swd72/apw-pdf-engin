import React from 'react'
import { usePdf } from './usePdf.js'

export interface PdfDownloadButtonProps {
  doc: unknown
  data: unknown
  fileName: string
  children: React.ReactNode
  className?: string
  debounceMs?: number
}

export function PdfDownloadButton({
  doc,
  data,
  fileName,
  children,
  className,
  debounceMs,
}: PdfDownloadButtonProps) {
  const { status, url } = usePdf(doc, data, { debounceMs })
  const isReady = status === 'ready' && Boolean(url)

  const handleClick = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <button
      type="button"
      className={className}
      disabled={!isReady}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}
