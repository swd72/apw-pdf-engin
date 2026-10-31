export type Subsetter = (font: Uint8Array, glyphIds: Iterable<number>) => Uint8Array

interface HbSubsetExports {
  memory: WebAssembly.Memory
  malloc(size: number): number
  free(ptr: number): void
  hb_blob_create(
    data: number,
    length: number,
    mode: number,
    userData: number,
    destroy: number,
  ): number
  hb_blob_destroy(blob: number): void
  hb_blob_get_length(blob: number): number
  hb_blob_get_data(blob: number, lengthPtr: number): number
  hb_face_create(blob: number, index: number): number
  hb_face_destroy(face: number): void
  hb_face_reference_blob(face: number): number
  hb_subset_input_create_or_fail(): number
  hb_subset_input_destroy(input: number): void
  hb_subset_input_glyph_set(input: number): number
  hb_subset_input_unicode_set(input: number): number
  hb_subset_input_set_flags(input: number, flags: number): void
  hb_set_add(set: number, codepoint: number): void
  hb_subset_or_fail(source: number, input: number): number
}

const THAI_MARK_CODEPOINTS = [
  0x0e31, 0x0e34, 0x0e35, 0x0e36, 0x0e37, 0x0e38, 0x0e39, 0x0e3a, 0x0e47,
  0x0e48, 0x0e49, 0x0e4a, 0x0e4b, 0x0e4c, 0x0e4d,
]

export async function createSubsetter(
  wasm: Uint8Array | ArrayBuffer,
): Promise<Subsetter> {
  const bytes =
    wasm instanceof Uint8Array
      ? new Uint8Array(wasm.buffer, wasm.byteOffset, wasm.byteLength)
      : new Uint8Array(wasm)
  const res = (await WebAssembly.instantiate(bytes, {})) as
    | WebAssembly.WebAssemblyInstantiatedSource
    | WebAssembly.Instance
  const instance = 'instance' in res ? res.instance : res
  const ex = instance.exports as unknown as HbSubsetExports

  return (fontBytes: Uint8Array, glyphIds: Iterable<number>): Uint8Array => {
    const n = fontBytes.byteLength
    const p = ex.malloc(n)
    const lenPtr = ex.malloc(4)
    new Uint8Array(ex.memory.buffer).set(fontBytes, p)

    const blob = ex.hb_blob_create(p, n, 2 /* HB_MEMORY_MODE_WRITABLE */, 0, 0)
    const face = ex.hb_face_create(blob, 0)
    const input = ex.hb_subset_input_create_or_fail()
    const glyphSet = ex.hb_subset_input_glyph_set(input)
    const unicodeSet = ex.hb_subset_input_unicode_set(input)

    ex.hb_set_add(glyphSet, 0)
    for (const gid of glyphIds) {
      ex.hb_set_add(glyphSet, gid)
    }
    for (const cp of THAI_MARK_CODEPOINTS) {
      ex.hb_set_add(unicodeSet, cp)
    }

    // 0x2 = HB_SUBSET_FLAGS_RETAIN_GIDS, 0x1 = HB_SUBSET_FLAGS_NO_HINTING
    ex.hb_subset_input_set_flags(input, 0x2 | 0x1)

    const subFace = ex.hb_subset_or_fail(face, input)
    if (!subFace) {
      ex.hb_subset_input_destroy(input)
      ex.hb_face_destroy(face)
      ex.hb_blob_destroy(blob)
      ex.free(p)
      ex.free(lenPtr)
      return fontBytes
    }

    const outBlob = ex.hb_face_reference_blob(subFace)
    const outLen = ex.hb_blob_get_length(outBlob)
    const outPtr = ex.hb_blob_get_data(outBlob, lenPtr)
    const result = new Uint8Array(outLen)
    result.set(new Uint8Array(ex.memory.buffer, outPtr, outLen))

    ex.hb_blob_destroy(outBlob)
    ex.hb_face_destroy(subFace)
    ex.hb_subset_input_destroy(input)
    ex.hb_face_destroy(face)
    ex.hb_blob_destroy(blob)
    ex.free(p)
    ex.free(lenPtr)

    return result
  }
}
