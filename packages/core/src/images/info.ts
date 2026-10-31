import { ApwPdfError } from '../errors.js'

export function readImageInfo(bytes: Uint8Array): {
  format: 'png' | 'jpeg'
  width: number
  height: number
} {
  if (bytes.byteLength >= 24) {
    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      const width = view.getUint32(16, false)
      const height = view.getUint32(20, false)
      if (width > 0 && height > 0) {
        return { format: 'png', width, height }
      }
      throw new ApwPdfError('IMAGE_LOAD_FAILED', 'Invalid PNG dimensions')
    }
  }

  if (bytes.byteLength >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let pos = 2
    while (pos + 4 <= bytes.byteLength) {
      if (bytes[pos] !== 0xff) {
        pos++
        continue
      }
      while (pos < bytes.byteLength && bytes[pos] === 0xff) {
        pos++
      }
      if (pos >= bytes.byteLength) break
      const marker = bytes[pos]!
      pos++

      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        continue
      }
      if (marker === 0xd9 || marker === 0xda) {
        break
      }
      if (pos + 2 > bytes.byteLength) break
      const segLen = view.getUint16(pos, false)
      if (segLen < 2 || pos + segLen > bytes.byteLength) break

      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      if (isSof) {
        if (pos + 7 > bytes.byteLength) break
        const height = view.getUint16(pos + 3, false)
        const width = view.getUint16(pos + 5, false)
        if (width > 0 && height > 0) {
          return { format: 'jpeg', width, height }
        }
      }
      pos += segLen
    }
    throw new ApwPdfError('IMAGE_LOAD_FAILED', 'Could not read JPEG SOF dimensions')
  }

  throw new ApwPdfError('IMAGE_LOAD_FAILED', 'Unsupported or invalid image format (expected PNG or JPEG)')
}
