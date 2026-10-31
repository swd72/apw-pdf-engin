function toHex4(n: number): string {
  return (n & 0xffff).toString(16).toUpperCase().padStart(4, '0')
}

function stringToUtf16Hex(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    out += toHex4(s.charCodeAt(i))
  }
  return out
}

export function buildToUnicodeCMap(map: Map<number, string>): string {
  const entries = Array.from(map.entries())
    .filter(([gid, str]) => gid >= 0 && str.length > 0)
    .sort((a, b) => a[0] - b[0])

  const chunks: string[] = []
  for (let i = 0; i < entries.length; i += 100) {
    const slice = entries.slice(i, i + 100)
    const lines = slice.map(([gid, str]) => `<${toHex4(gid)}> <${stringToUtf16Hex(str)}>`)
    chunks.push(`${slice.length} beginbfchar\n${lines.join('\n')}\nendbfchar`)
  }

  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    ...chunks,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n')
}
