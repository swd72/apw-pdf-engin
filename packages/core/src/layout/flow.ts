import type { ResolvedBlock, ResolvedDocument } from '../bind/bind.js'
import { ApwPdfError, type Warning } from '../errors.js'
import { singleLineHeight, type FontSpec } from '../fonts/metrics.js'
import type { FontRegistry } from '../fonts/registry.js'
import type { ImageProvider } from '../fonts/provider.js'
import { readImageInfo } from '../images/info.js'
import { toPt, type pageBox } from '../units.js'
import type { AnchorTable } from './align.js'
import { layoutParagraph, type LaidLine, type ParagraphLayout } from './paragraph.js'
import type { LayoutItem, LayoutPage } from './tree.js'

export interface FlowContext {
  fonts: FontRegistry
  images: ImageProvider
  doc: ResolvedDocument
  box: ReturnType<typeof pageBox>
  bodyTop: (pageIndex: number) => number
  anchors: AnchorTable
  warnings: Warning[]
  imageCache: Map<string, Uint8Array>
}

export interface UnsplittableFragment {
  height: number
  spaceBefore: number
  spaceAfter: number
  keepWithNext?: boolean
  minLinesBefore?: number
  path: string
  splittable: false
  items(yTop: number): LayoutItem[]
  paraLines?: LaidLine[]
  pullTail?(
    needed: number,
    canPullAll: boolean,
  ): { remain: Fragment | null; pulled: Fragment; count: number } | null
}

export interface SplittableFragment {
  height: number
  spaceBefore: number
  spaceAfter: number
  keepWithNext?: boolean
  minLinesBefore?: number
  minHeadHeight: number
  path: string
  splittable: true
  items(yTop: number): LayoutItem[]
  split(avail: number): [Fragment, Fragment] | null
  paraLines?: LaidLine[]
  pullTail?(
    needed: number,
    canPullAll: boolean,
  ): { remain: Fragment | null; pulled: Fragment; count: number } | null
}

export type Fragment = UnsplittableFragment | SplittableFragment

export type BlockLayoutHandler = (
  block: any,
  ctx: FlowContext,
  x: number,
  width: number,
  path: string,
) => Promise<Fragment>

const blockHandlers = new Map<string, BlockLayoutHandler>()

export function registerBlockHandler(type: string, handler: BlockLayoutHandler): void {
  blockHandlers.set(type, handler)
}

export function laidLinesToItems(
  lines: LaidLine[],
  yTop: number,
  sourcePath: string,
): LayoutItem[] {
  const out: LayoutItem[] = []
  let currY = yTop

  for (const line of lines) {
    const baselineY = currY + line.ascent
    for (const shape of line.shapes) {
      if (shape.kind === 'line') {
        out.push({
          ...shape,
          y1: baselineY + shape.y1,
          y2: baselineY + shape.y2,
        })
      } else {
        out.push({
          ...shape,
          y: baselineY + shape.y,
        })
      }
    }
    for (const run of line.runs) {
      out.push({
        kind: 'glyphs',
        font: run.font.id,
        size: run.size,
        color: run.color,
        x: run.x,
        y: baselineY,
        glyphs: run.glyphs,
        text: run.text,
        clusters: run.clusters,
        sourcePath: run.path || sourcePath,
        ...(run.tokenKind ? { tokenKind: run.tokenKind } : {}),
      })
    }
    currY += line.height
  }

  return out
}

export function createParagraphFragment(layout: ParagraphLayout): Fragment {
  const { lines, spaceBefore, spaceAfter, keepWithNext, keepLinesTogether, widowControl, path } =
    layout
  const totalHeight = lines.reduce((s, l) => s + l.height, 0)

  if (keepLinesTogether || lines.length <= 1) {
    return {
      height: totalHeight,
      spaceBefore,
      spaceAfter,
      keepWithNext,
      path,
      splittable: false,
      paraLines: lines,
      items: (yTop: number) => laidLinesToItems(lines, yTop, path),
    }
  }

  const minLines = widowControl ? Math.min(2, lines.length) : 1
  const minHeadHeight = lines.slice(0, minLines).reduce((s, l) => s + l.height, 0)

  return {
    height: totalHeight,
    spaceBefore,
    spaceAfter,
    keepWithNext,
    minHeadHeight,
    path,
    splittable: true,
    paraLines: lines,
    items: (yTop: number) => laidLinesToItems(lines, yTop, path),
    split(avail: number): [Fragment, Fragment] | null {
      const n = lines.length
      if (widowControl && n < 4) {
        return null
      }
      let maxFit = 0
      let acc = 0
      for (let i = 0; i < n; i++) {
        if (acc + lines[i]!.height <= avail + 1e-6) {
          acc += lines[i]!.height
          maxFit = i + 1
        } else {
          break
        }
      }
      if (maxFit >= n) {
        maxFit = n - 1
      }
      const k = widowControl ? Math.min(maxFit, n - 2) : maxFit
      const minRequired = widowControl ? 2 : 1
      if (k < minRequired) {
        return null
      }

      const headLines = lines.slice(0, k)
      const tailLines = lines.slice(k)

      const headFrag = createParagraphFragment({
        lines: headLines,
        spaceBefore,
        spaceAfter: 0,
        keepWithNext: false,
        keepLinesTogether: true,
        widowControl,
        path,
      })
      const tailFrag = createParagraphFragment({
        lines: tailLines,
        spaceBefore: 0,
        spaceAfter,
        keepWithNext,
        keepLinesTogether,
        widowControl,
        path,
      })
      return [headFrag, tailFrag]
    },
  }
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_PAGES = 500

export async function loadImageWithCache(
  src: string,
  ctx: FlowContext,
  path: string,
): Promise<{
  resolvedSrc: string
  bytes: Uint8Array
  width: number
  height: number
  format: 'png' | 'jpeg'
}> {
  let resolvedSrc = src
  if (src.startsWith('asset:')) {
    const assetName = src.slice('asset:'.length)
    if (ctx.doc.assets && Object.hasOwn(ctx.doc.assets, assetName)) {
      resolvedSrc = ctx.doc.assets[assetName]!
    }
  } else if (ctx.doc.assets && Object.hasOwn(ctx.doc.assets, src)) {
    resolvedSrc = ctx.doc.assets[src]!
  }

  let bytes = ctx.imageCache.get(resolvedSrc)
  if (!bytes) {
    bytes = await ctx.images.load(resolvedSrc)
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new ApwPdfError('LIMIT_EXCEEDED', `Image "${src}" exceeds 10 MB limit`, { path })
    }
    ctx.imageCache.set(resolvedSrc, bytes)
    if (resolvedSrc !== src) {
      ctx.imageCache.set(src, bytes)
    }
  }
  const info = readImageInfo(bytes)
  return { resolvedSrc, bytes, ...info }
}

export async function layoutBlockToFragment(
  block: ResolvedBlock,
  ctx: FlowContext,
  x: number,
  width: number,
  path: string,
): Promise<{ fragment?: Fragment; anchoredItem?: LayoutItem; pageBreak?: boolean }> {
  const baseFont: FontSpec = {
    family: ctx.doc.font.family,
    size: toPt(ctx.doc.font.size),
    bold: false,
    italic: false,
    color: ctx.doc.font.color ?? '#000000',
  }

  switch (block.type) {
    case 'pageBreak':
      return { pageBreak: true }

    case 'spacer': {
      let h: number
      if (typeof block.height === 'object' && 'lines' in block.height) {
        const f = await ctx.fonts.get(baseFont.family, false, false)
        h = singleLineHeight(f.metrics, baseFont.size) * block.height.lines
      } else {
        h = toPt(block.height, { path: `${path}.height` })
      }
      return {
        fragment: {
          height: h,
          spaceBefore: 0,
          spaceAfter: 0,
          path,
          splittable: false,
          items: () => [],
        },
      }
    }

    case 'line': {
      const thickness = block.thickness !== undefined ? toPt(block.thickness) : 0.5
      const spaceBefore = block.spaceBefore !== undefined ? toPt(block.spaceBefore) : 0
      const spaceAfter = block.spaceAfter !== undefined ? toPt(block.spaceAfter) : 0
      const dash =
        block.style === 'dashed' ? [4, 2] : block.style === 'dotted' ? [1, 2] : undefined
      const color = baseFont.color
      return {
        fragment: {
          height: thickness,
          spaceBefore,
          spaceAfter,
          path,
          splittable: false,
          items: (yTop: number) => [
            {
              kind: 'line',
              x1: x,
              y1: yTop + thickness / 2,
              x2: x + width,
              y2: yTop + thickness / 2,
              width: thickness,
              dash,
              color,
            },
          ],
        },
      }
    }

    case 'image': {
      const info = await loadImageWithCache(block.src, ctx, path)
      let w: number
      let h: number
      if (block.width !== undefined && block.height !== undefined) {
        w = toPt(block.width)
        h = toPt(block.height)
      } else if (block.width !== undefined) {
        w = toPt(block.width)
        h = w * (info.height / info.width)
      } else if (block.height !== undefined) {
        h = toPt(block.height)
        w = h * (info.width / info.height)
      } else {
        w = info.width
        h = info.height
      }

      if (block.anchor) {
        const isMargin = block.anchor.relativeTo === 'margin'
        const originX = isMargin ? ctx.box.contentLeft : 0
        const originY = isMargin ? ctx.box.margin.top : 0
        const refWidth = isMargin ? ctx.box.contentWidth : ctx.box.width
        const imgX =
          block.anchor.x === 'center'
            ? originX + (refWidth - w) / 2
            : originX + toPt(block.anchor.x, { allowNegative: true })
        const imgY = originY + toPt(block.anchor.y, { allowNegative: true })
        return {
          anchoredItem: {
            kind: 'image',
            ref: info.resolvedSrc,
            x: imgX,
            y: imgY,
            w,
            h,
          },
        }
      }

      const align = block.align ?? 'left'
      const imgX =
        align === 'center'
          ? x + (width - w) / 2
          : align === 'right'
            ? x + width - w
            : x
      const spaceAfter = block.spaceAfter !== undefined ? toPt(block.spaceAfter) : 0

      return {
        fragment: {
          height: h,
          spaceBefore: 0,
          spaceAfter,
          path,
          splittable: false,
          items: (yTop: number) => [
            {
              kind: 'image',
              ref: info.resolvedSrc,
              x: imgX,
              y: yTop,
              w,
              h,
            },
          ],
        },
      }
    }

    case 'paragraph': {
      const { layout, warnings } = await layoutParagraph(block, {
        fonts: ctx.fonts,
        base: baseFont,
        styles: ctx.doc.styles,
        dictionary: ctx.doc.dictionary ?? [],
        contentLeft: x,
        contentWidth: width,
        anchors: ctx.anchors,
        path,
        lineSpacing: ctx.doc.font.lineSpacing,
      })
      ctx.warnings.push(...warnings)
      return { fragment: createParagraphFragment(layout) }
    }

    case 'table':
    case 'columns':
    case 'signature': {
      const handler = blockHandlers.get(block.type)
      if (!handler) {
        throw new ApwPdfError('SCHEMA_INVALID', `No layout handler registered for "${block.type}"`, {
          path,
        })
      }
      const fragment = await handler(block, ctx, x, width, path)
      return { fragment }
    }
  }
}

interface PlacedPageEntry {
  frag: Fragment
  yTop: number
  effectiveSpaceBefore: number
}

function minRequiredWithNext(queue: Fragment[], idx: number, fullPageAvail: number): number {
  const frag = queue[idx]!
  const selfMin = frag.splittable ? frag.minHeadHeight : frag.height
  if (!frag.keepWithNext || idx + 1 >= queue.length) {
    return selfMin
  }
  const nextFrag = queue[idx + 1]!
  const nextMin = nextFrag.splittable ? nextFrag.minHeadHeight : nextFrag.height
  const pairMin = frag.height + frag.spaceAfter + nextFrag.spaceBefore + nextMin

  let chainHeight = frag.height
  let curIdx = idx
  while (queue[curIdx]!.keepWithNext && curIdx + 1 < queue.length) {
    const cur = queue[curIdx]!
    const nxt = queue[curIdx + 1]!
    const isNextChainContinue = Boolean(nxt.keepWithNext && curIdx + 2 < queue.length)
    const nxtReq = isNextChainContinue ? nxt.height : nxt.splittable ? nxt.minHeadHeight : nxt.height
    chainHeight += cur.spaceAfter + nxt.spaceBefore + nxtReq
    curIdx++
  }

  return chainHeight <= fullPageAvail + 1e-6 ? chainHeight : pairMin
}

export async function paginate(
  blocks: ResolvedBlock[],
  ctx: FlowContext,
): Promise<LayoutPage[]> {
  const pages: LayoutPage[] = []
  let pageEntries: PlacedPageEntry[] = []
  let pageAnchoredItems: LayoutItem[] = []
  let pageIndex = 0
  let cursorY = ctx.bodyTop(0)
  let atAutoBreakTop = false
  const pulledOnce = new WeakSet<Fragment>()

  function pageBottom(): number {
    return ctx.box.height - ctx.box.margin.bottom
  }

  function flushCurrentPage(): void {
    const items: LayoutItem[] = [...pageAnchoredItems]
    for (const entry of pageEntries) {
      items.push(...entry.frag.items(entry.yTop))
    }
    pages.push({
      width: ctx.box.width,
      height: ctx.box.height,
      items,
    })
    if (pages.length > MAX_PAGES) {
      throw new ApwPdfError('LIMIT_EXCEEDED', `Document exceeds ${MAX_PAGES} page limit`)
    }
  }

  function startNewPage(isAutoBreak: boolean): void {
    flushCurrentPage()
    pageIndex++
    pageEntries = []
    pageAnchoredItems = []
    cursorY = ctx.bodyTop(pageIndex)
    atAutoBreakTop = isAutoBreak
  }

  function pullPrecedingLines(minLines: number, sigFrag: Fragment): Fragment[] {
    const pulledFrags: Fragment[] = []
    let needed = minLines
    const nextPageAvail = pageBottom() - ctx.bodyTop(pageIndex + 1)
    const remainingPullHeight = Math.max(0, nextPageAvail - sigFrag.spaceBefore - sigFrag.height)
    let pulledHeight = 0

    while (needed > 0 && pageEntries.length > 0) {
      const lastEntry = pageEntries[pageEntries.length - 1]!
      const canPullAll = pageEntries.length > 1
      const pLines = lastEntry.frag.paraLines
      if (pLines && pLines.length > 0) {
        const shouldPullWhole = pLines.length <= needed || pLines.length - needed < 2
        if (shouldPullWhole && canPullAll) {
          const fragH = pLines.reduce((s, l) => s + l.height, 0) + lastEntry.frag.spaceAfter
          if (pulledHeight + fragH <= remainingPullHeight + 1e-6) {
            pageEntries.pop()
            pulledFrags.unshift(
              createParagraphFragment({
                lines: pLines,
                spaceBefore: lastEntry.frag.spaceBefore,
                spaceAfter: lastEntry.frag.spaceAfter,
                keepWithNext: true,
                keepLinesTogether: true,
                widowControl: false,
                path: lastEntry.frag.path,
              }),
            )
            pulledHeight += fragH
            needed -= pLines.length
            continue
          }
        }

        const minRemain = canPullAll ? 2 : 1
        if (pLines.length <= minRemain) {
          break
        }
        let maxLinesByHeight = 0
        let accH = lastEntry.frag.spaceAfter
        for (let i = pLines.length - 1; i >= minRemain; i--) {
          const lh = pLines[i]!.height
          if (pulledHeight + accH + lh <= remainingPullHeight + 1e-6) {
            accH += lh
            maxLinesByHeight++
          } else {
            break
          }
        }
        const pullCount = Math.min(needed, pLines.length - minRemain, maxLinesByHeight)
        if (pullCount <= 0) {
          break
        }
        const splitIdx = pLines.length - pullCount
        const remainLines = pLines.slice(0, splitIdx)
        const moveLines = pLines.slice(splitIdx)
        lastEntry.frag = createParagraphFragment({
          lines: remainLines,
          spaceBefore: lastEntry.frag.spaceBefore,
          spaceAfter: 0,
          keepWithNext: false,
          keepLinesTogether: true,
          widowControl: false,
          path: lastEntry.frag.path,
        })
        pulledFrags.unshift(
          createParagraphFragment({
            lines: moveLines,
            spaceBefore: 0,
            spaceAfter: lastEntry.frag.spaceAfter,
            keepWithNext: true,
            keepLinesTogether: true,
            widowControl: false,
            path: lastEntry.frag.path,
          }),
        )
        pulledHeight += accH
        needed -= pullCount
        break
      }

      if (lastEntry.frag.pullTail) {
        const res = lastEntry.frag.pullTail(needed, canPullAll)
        if (
          !res ||
          pulledHeight + res.pulled.height + res.pulled.spaceAfter > remainingPullHeight + 1e-6
        ) {
          break
        }
        if (res.remain) {
          lastEntry.frag = res.remain
        } else {
          pageEntries.pop()
        }
        pulledFrags.unshift(res.pulled)
        pulledHeight += res.pulled.height + res.pulled.spaceAfter
        needed -= res.count
        if (res.remain) {
          break
        }
        continue
      }

      if (canPullAll) {
        const fragH = lastEntry.frag.height + lastEntry.frag.spaceAfter
        if (pulledHeight + fragH <= remainingPullHeight + 1e-6) {
          pageEntries.pop()
          pulledFrags.unshift({
            ...lastEntry.frag,
            keepWithNext: true,
          })
          pulledHeight += fragH
          needed -= 1
          continue
        }
      }
      break
    }

    return pulledFrags
  }

  // First layout blocks sequentially so anchors defined in earlier blocks are visible to later blocks
  type FlowStep =
    | { kind: 'pageBreak' }
    | { kind: 'anchored'; item: LayoutItem }
    | { kind: 'fragment'; frag: Fragment }

  const steps: FlowStep[] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!
    const path = `blocks[${i}]`
    const res = await layoutBlockToFragment(
      b,
      ctx,
      ctx.box.contentLeft,
      ctx.box.contentWidth,
      path,
    )
    if (res.pageBreak) {
      steps.push({ kind: 'pageBreak' })
    } else if (res.anchoredItem) {
      steps.push({ kind: 'anchored', item: res.anchoredItem })
    } else if (res.fragment) {
      steps.push({ kind: 'fragment', frag: res.fragment })
    }
  }

  // Now paginate steps
  let sIdx = 0
  while (sIdx < steps.length) {
    const step = steps[sIdx]!
    if (step.kind === 'pageBreak') {
      startNewPage(false)
      sIdx++
      continue
    }
    if (step.kind === 'anchored') {
      pageAnchoredItems.push(step.item)
      sIdx++
      continue
    }

    // Collect contiguous fragment run for keepWithNext lookahead
    const fragQueue: Fragment[] = [step.frag]
    let lookIdx = sIdx + 1
    while (lookIdx < steps.length && steps[lookIdx]!.kind === 'fragment') {
      fragQueue.push((steps[lookIdx] as { kind: 'fragment'; frag: Fragment }).frag)
      lookIdx++
    }

    let qIdx = 0
    while (qIdx < fragQueue.length) {
      const frag = fragQueue[qIdx]!
      const isPageEmpty = pageEntries.length === 0
      const effectiveBefore = isPageEmpty && atAutoBreakTop ? 0 : frag.spaceBefore
      const fullPageAvail = pageBottom() - ctx.bodyTop(pageIndex)
      const avail = pageBottom() - (cursorY + effectiveBefore)

      if (!frag.splittable && frag.height > fullPageAvail + 1e-6) {
        throw new ApwPdfError(
          'BLOCK_TOO_TALL',
          `Block at ${frag.path} (height ${frag.height.toFixed(2)}pt) exceeds page height (${fullPageAvail.toFixed(2)}pt)`,
          { path: frag.path },
        )
      }

      const requiredForKeep = minRequiredWithNext(fragQueue, qIdx, fullPageAvail)
      if (!isPageEmpty && frag.keepWithNext && requiredForKeep > avail + 1e-6) {
        startNewPage(true)
        continue
      }

      if (frag.height <= avail + 1e-6) {
        const yTop = cursorY + effectiveBefore
        pageEntries.push({ frag, yTop, effectiveSpaceBefore: effectiveBefore })
        cursorY = yTop + frag.height + frag.spaceAfter
        atAutoBreakTop = false
        qIdx++
        continue
      }

      if (frag.splittable) {
        const splitRes = frag.split(avail)
        if (splitRes) {
          const [head, tail] = splitRes
          const yTop = cursorY + effectiveBefore
          pageEntries.push({ frag: head, yTop, effectiveSpaceBefore: effectiveBefore })
          startNewPage(true)
          fragQueue[qIdx] = tail
          continue
        }
        if (!isPageEmpty) {
          startNewPage(true)
          continue
        }
      }

      // Unsplittable and does not fit on current page
      if (!isPageEmpty) {
        if (frag.minLinesBefore && frag.minLinesBefore > 0 && !pulledOnce.has(frag)) {
          pulledOnce.add(frag)
          const pulled = pullPrecedingLines(frag.minLinesBefore, frag)
          startNewPage(true)
          if (pulled.length > 0) {
            fragQueue.splice(qIdx, 0, ...pulled)
          }
          continue
        }
        startNewPage(true)
        continue
      }

      throw new ApwPdfError(
        'BLOCK_TOO_TALL',
        `Block at ${frag.path} exceeds available page height`,
        { path: frag.path },
      )
    }

    sIdx = lookIdx
  }

  flushCurrentPage()
  return pages
}
