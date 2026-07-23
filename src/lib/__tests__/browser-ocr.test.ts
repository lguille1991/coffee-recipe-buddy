import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { assertSupportedOcrImage, blocksFromOcrData } from '../browser-ocr'

describe('browser OCR helpers', () => {
  it('keeps Tesseract block confidence for deterministic parsing', () => {
    expect(blocksFromOcrData({
      text: 'ignored',
      confidence: 10,
      blocks: [{ text: 'Proceso: Lavado', confidence: 82 }],
    })).toEqual([{ text: 'Proceso: Lavado', confidence: 82 }])
  })

  it('splits multi-line layout blocks without losing their confidence', () => {
    expect(blocksFromOcrData({
      text: 'ignored', confidence: 10,
      blocks: [{ text: 'Origin: Colombia\nProcess: Washed', confidence: 82 }],
    })).toEqual([
      { text: 'Origin: Colombia', confidence: 82 },
      { text: 'Process: Washed', confidence: 82 },
    ])
  })

  it('uses line fallback when Tesseract does not return layout blocks', () => {
    expect(blocksFromOcrData({ text: 'Origin\nColombia', confidence: 61, blocks: null }))
      .toEqual([{ text: 'Origin', confidence: 61 }, { text: 'Colombia', confidence: 61 }])
  })

  it('rejects unsupported and HEIC inputs before starting a worker', () => {
    expect(() => assertSupportedOcrImage(new File(['x'], 'bag.heic', { type: 'image/heic' }))).toThrow('HEIC')
    expect(() => assertSupportedOcrImage(new File(['x'], 'bag.gif', { type: 'image/gif' }))).toThrow('JPEG, PNG, or WebP')
  })

  it('ships every core variant Tesseract v7 can select', () => {
    const coreDirectory = join(process.cwd(), 'public/ocr/v7/core')
    const variants = [
      'tesseract-core.wasm.js', 'tesseract-core.wasm',
      'tesseract-core-simd.wasm.js', 'tesseract-core-simd.wasm',
      'tesseract-core-relaxedsimd.wasm.js', 'tesseract-core-relaxedsimd.wasm',
      'tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm',
      'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm',
      'tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm',
    ]

    expect(variants.every(asset => existsSync(join(coreDirectory, asset)))).toBe(true)
  })
})
