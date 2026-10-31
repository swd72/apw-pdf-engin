export interface FontProvider {
  load(family: string, style: { bold: boolean; italic: boolean }): Promise<Uint8Array>
}

export interface ImageProvider {
  load(src: string): Promise<Uint8Array>
}
