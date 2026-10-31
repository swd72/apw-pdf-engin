import { describe, it, expect } from 'vitest'
import { segmentWords, assertSegmenter } from '../src/text/segment.js'
import { graphemeClusters } from '../src/text/clusters.js'

describe('segmentation and grapheme clusters', () => {
  it('preserves join invariant', () => {
    const fixtures = [
      'ขอ (ด่วน) มาก',
      'กรุงเทพฯ เด็กๆ ไปโรงเรียน',
      'สำนักงานสาธารณสุขจังหวัดอุทัยธานี',
      'ราคา 10\u00A0บาท (รวมภาษี 7%)',
      '"หนังสือราชการ" [ฉบับที่ 1]',
    ]
    for (const s of fixtures) {
      expect(segmentWords(s, ['สำนักงานสาธารณสุขจังหวัด']).join('')).toBe(s)
    }
  })

  it('glues open punctuation forward and close punctuation', () => {
    const tokens = segmentWords('ขอ (ด่วน) มาก')
    expect(tokens).toContain('(ด่วน)')
  })

  it('glues close punctuation and ฯ ๆ back', () => {
    const tokens = segmentWords('กรุงเทพฯ เด็กๆ')
    expect(tokens).toContain('กรุงเทพฯ')
    expect(tokens).toContain('เด็กๆ')
  })

  it('merges dictionary words before segmenting gaps', () => {
    const tokens = segmentWords('สำนักงานสาธารณสุขจังหวัดอุทัยธานี', [
      'สำนักงานสาธารณสุขจังหวัด',
    ])
    expect(tokens[0]).toBe('สำนักงานสาธารณสุขจังหวัด')
    expect(tokens.join('')).toBe('สำนักงานสาธารณสุขจังหวัดอุทัยธานี')
  })

  it('NBSP keeps number+unit as one token', () => {
    const tokens = segmentWords('จำนวน 10\u00A0บาท เท่านั้น')
    expect(tokens).toContain('10\u00A0บาท')
  })

  it('splits grapheme clusters for Thai text', () => {
    expect(graphemeClusters('น้ำกุ้ง')).toEqual(['น้ำ', 'กุ้', 'ง'])
  })

  it('throws SEGMENTER_UNAVAILABLE when Intl.Segmenter is missing', () => {
    const orig = Intl.Segmenter
    try {
      // @ts-expect-error testing missing Intl.Segmenter
      Intl.Segmenter = undefined
      expect(() => assertSegmenter()).toThrow(
        expect.objectContaining({ code: 'SEGMENTER_UNAVAILABLE' }),
      )
      expect(() => segmentWords('ก')).toThrow(
        expect.objectContaining({ code: 'SEGMENTER_UNAVAILABLE' }),
      )
      expect(() => graphemeClusters('ก')).toThrow(
        expect.objectContaining({ code: 'SEGMENTER_UNAVAILABLE' }),
      )
    } finally {
      Intl.Segmenter = orig
    }
  })
})
