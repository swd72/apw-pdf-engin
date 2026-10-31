import {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D,
  type Canvas,
} from '@napi-rs/canvas'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

const g = globalThis as Record<string, unknown>
if (!g.DOMMatrix) g.DOMMatrix = DOMMatrix
if (!g.ImageData) g.ImageData = ImageData
if (!g.Path2D) g.Path2D = Path2D

export interface RasterizeOptions {
  dpi?: number
}

const canvasFactory = {
  create(width: number, height: number) {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    const canvas = createCanvas(w, h)
    const context = canvas.getContext('2d')
    return { canvas, context }
  },
  reset(
    target: { canvas: Canvas; context: unknown },
    width: number,
    height: number,
  ) {
    target.canvas.width = Math.max(1, Math.round(width))
    target.canvas.height = Math.max(1, Math.round(height))
  },
  destroy(target: { canvas: Canvas | null; context: unknown }) {
    if (target.canvas) {
      target.canvas.width = 0
      target.canvas.height = 0
    }
    target.canvas = null
    target.context = null
  },
}

export async function rasterizePage(
  pdf: Uint8Array,
  pageNumber: number,
  opts?: RasterizeOptions,
): Promise<Uint8Array> {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new RangeError(
      `pageNumber must be an integer >= 1 (received ${String(pageNumber)})`,
    )
  }

  const requestedDpi = opts?.dpi ?? 150
  const dpi = Math.min(200, Math.max(36, requestedDpi))
  const scale = dpi / 72

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdf),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    canvasFactory,
  } as Parameters<typeof pdfjsLib.getDocument>[0])

  const doc = await loadingTask.promise
  try {
    if (pageNumber > doc.numPages) {
      throw new RangeError(
        `pageNumber ${pageNumber} exceeds document page count ${doc.numPages}`,
      )
    }

    const page = await doc.getPage(pageNumber)
    const viewport = page.getViewport({ scale })
    const width = Math.round(viewport.width)
    const height = Math.round(viewport.height)

    const { canvas, context } = canvasFactory.create(width, height)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
      canvasFactory,
    } as Parameters<typeof page.render>[0]).promise

    const pngBuf = canvas.toBuffer('image/png')
    return new Uint8Array(pngBuf.buffer, pngBuf.byteOffset, pngBuf.byteLength)
  } finally {
    await doc.destroy()
  }
}
