import React from 'react'
import { createRoot } from 'react-dom/client'
import { GlobalWorkerOptions } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './ui/tokens.css'
import './ui/ui.css'
import { App } from './App.js'

GlobalWorkerOptions.workerSrc = workerSrc

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
