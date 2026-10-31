import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.resolve(__dirname, '../assets/garuda-placeholder.png')

const W = 300
const H = 330
const png = new PNG({ width: W, height: H })

// 5x7 bitmap font for "PLACEHOLDER"
const FONT = {
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
}

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return
  const idx = (W * y + x) << 2
  png.data[idx] = r
  png.data[idx + 1] = g
  png.data[idx + 2] = b
  png.data[idx + 3] = a
}

// Draw stylized grey eagle/wing silhouette
const cx = W / 2
const cy = H / 2
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = (x - cx) / (W / 2)
    const dy = (y - cy) / (H / 2)
    const ax = Math.abs(dx)

    // Central body/crown oval
    const inBody = (dx * dx) / 0.12 + ((dy + 0.05) * (dy + 0.05)) / 0.55 <= 1
    // Spread wings
    const wingTop = -0.55 + ax * 0.35
    const wingBottom = 0.35 - Math.pow(ax - 0.45, 2) * 0.9
    const inWings = ax <= 0.92 && dy >= wingTop && dy <= wingBottom
    // Tail feathers
    const inTail = ax <= 0.32 && dy >= 0.3 && dy <= 0.88 - ax * 0.6

    if (inBody || inWings || inTail) {
      setPixel(x, y, 110, 115, 125, 255)
    } else {
      setPixel(x, y, 255, 255, 255, 0)
    }
  }
}

// Draw white banner and "PLACEHOLDER" text across chest
const label = 'PLACEHOLDER'
const scale = 3
const charW = 5 * scale
const charH = 7 * scale
const gap = scale
const totalW = label.length * charW + (label.length - 1) * gap
const startX = Math.floor((W - totalW) / 2)
const startY = Math.floor(H * 0.48 - charH / 2)

for (let y = startY - 6; y <= startY + charH + 6; y++) {
  for (let x = startX - 8; x <= startX + totalW + 8; x++) {
    setPixel(x, y, 70, 75, 85, 255)
  }
}

for (let i = 0; i < label.length; i++) {
  const ch = label[i]
  const glyph = FONT[ch]
  const ox = startX + i * (charW + gap)
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      if (glyph[r][c] === '1') {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            setPixel(ox + c * scale + sx, startY + r * scale + sy, 245, 245, 245, 255)
          }
        }
      }
    }
  }
}

await fs.mkdir(path.dirname(outPath), { recursive: true })
const buffer = PNG.sync.write(png)
await fs.writeFile(outPath, buffer)
console.log(`Wrote ${outPath} (${buffer.length} bytes)`)
