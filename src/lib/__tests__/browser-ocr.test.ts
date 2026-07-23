import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertSupportedOcrImage,
  blocksFromOcrData,
  identityCropForPortraitBag,
  varietyCropForPortraitBag,
  mergeOcrBlocks,
  OCR_DEFAULT_PAGE_SEGMENTATION_MODE,
  OCR_IDENTITY_PAGE_SEGMENTATION_MODE,
  OCR_PAGE_SEGMENTATION_MODE,
  OCR_SINGLE_LINE_PAGE_SEGMENTATION_MODE,
} from '../browser-ocr'

describe('browser OCR helpers', () => {
  it('uses sparse-text segmentation for independently positioned bag labels', () => {
    expect(OCR_DEFAULT_PAGE_SEGMENTATION_MODE).toBe('3')
    expect(OCR_PAGE_SEGMENTATION_MODE).toBe('11')
    expect(OCR_IDENTITY_PAGE_SEGMENTATION_MODE).toBe('6')
    expect(OCR_SINGLE_LINE_PAGE_SEGMENTATION_MODE).toBe('7')
  })

  it('targets the central identity strip only for portrait bags', () => {
    expect(identityCropForPortraitBag(960, 1280)).toEqual({ left: 144, top: 179, width: 701, height: 320 })
    expect(identityCropForPortraitBag(1280, 960)).toBeNull()
  })

  it('targets the upper-middle variety name only for portrait bags', () => {
    expect(varietyCropForPortraitBag(960, 1280)).toEqual({ left: 96, top: 282, width: 768, height: 230 })
    expect(varietyCropForPortraitBag(1280, 960)).toBeNull()
  })

  it('merges complementary OCR passes without duplicating a stronger shared line', () => {
    expect(mergeOcrBlocks(
      [{ text: 'Process: Washed', confidence: 42 }, { text: 'Variety: Geisha', confidence: 80 }],
      [{ text: ' process:   washed ', confidence: 92 }, { text: 'Roast: Medium Light', confidence: 85 }],
    )).toEqual([
      { text: ' process:   washed ', confidence: 92 },
      { text: 'Variety: Geisha', confidence: 80 },
      { text: 'Roast: Medium Light', confidence: 85 },
    ])
  })

  it('keeps Tesseract block confidence for deterministic parsing', () => {
    expect(blocksFromOcrData({
      text: 'ignored',
      confidence: 10,
      blocks: [{ text: 'Proceso: Lavado', confidence: 82 }],
    })).toEqual([{ text: 'Proceso: Lavado', confidence: 82 }])
  })

  it('preserves line layout and maps crop coordinates into the full image', () => {
    expect(blocksFromOcrData({
      text: 'ignored',
      confidence: 10,
      blocks: [{
        text: 'ignored block text',
        confidence: 70,
        paragraphs: [{
          lines: [{
            text: 'Origin: El Salvador',
            confidence: 92,
            bbox: { x0: 10, y0: 20, x1: 190, y1: 40 },
          }],
        }],
      }],
    }, {
      source: 'bottom',
      imageWidth: 400,
      imageHeight: 800,
      rectangle: { left: 0, top: 400, width: 200, height: 400 },
    })).toEqual([{
      text: 'Origin: El Salvador',
      confidence: 92,
      source: 'bottom',
      order: 0,
      bbox: { x0: 0.025, y0: 0.525, x1: 0.475, y1: 0.55 },
    }])
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
