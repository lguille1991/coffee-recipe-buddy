'use client'

import { parseCoffeeBagOcr, type OcrTextBlock } from '@/lib/deterministic-ocr-parser'
import type { ExtractionResponse } from '@/types/recipe'
import type { PSM } from 'tesseract.js'

const OCR_ASSET_ROOT = '/ocr/v7'
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// Coffee bags are composed labels rather than one continuous document column.
// Tesseract sparse-text mode preserves their independently positioned fields.
export const OCR_PAGE_SEGMENTATION_MODE: PSM = '11' as PSM
export const OCR_DEFAULT_PAGE_SEGMENTATION_MODE: PSM = '3' as PSM
export const OCR_IDENTITY_PAGE_SEGMENTATION_MODE: PSM = '6' as PSM
export const OCR_SINGLE_LINE_PAGE_SEGMENTATION_MODE: PSM = '7' as PSM

export type OcrProgress = {
  progress: number
  status: string
}

export function assertSupportedOcrImage(file: File) {
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    throw new Error('HEIC photos are not supported by this browser. Please choose a JPEG, PNG, or WebP image.')
  }
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image of your coffee bag.')
  }
}

export function blocksFromOcrData(data: { text: string; confidence: number; blocks: Array<{ text: string; confidence: number }> | null }): OcrTextBlock[] {
  if (data.blocks?.length) {
    return data.blocks.flatMap(block => block.text.split(/\r?\n/).filter(Boolean).map(text => ({ text, confidence: block.confidence })))
  }
  return data.text.split(/\r?\n/).filter(Boolean).map(text => ({ text, confidence: data.confidence }))
}

export function mergeOcrBlocks(...runs: readonly OcrTextBlock[][]): OcrTextBlock[] {
  const merged = new Map<string, OcrTextBlock>()
  for (const block of runs.flat()) {
    const key = block.text.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!key) continue
    const existing = merged.get(key)
    if (!existing || (block.confidence ?? 0) > (existing.confidence ?? 0)) {
      merged.set(key, block)
    }
  }
  return [...merged.values()]
}

export function identityCropForPortraitBag(width: number, height: number) {
  if (height / width < 1.1) return null
  return {
    left: Math.round(width * 0.15),
    top: Math.round(height * 0.14),
    width: Math.round(width * 0.73),
    height: Math.round(height * 0.25),
  }
}

// A second, tighter pass favors the large variety name commonly printed in
// the upper-middle of portrait labels. It is only used when the broader OCR
// passes did not already identify a variety.
export function varietyCropForPortraitBag(width: number, height: number) {
  if (height / width < 1.1) return null
  return {
    left: Math.round(width * 0.1),
    top: Math.round(height * 0.22),
    width: Math.round(width * 0.8),
    height: Math.round(height * 0.18),
  }
}

async function preprocessForOcr(file: File): Promise<{ image: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('OCR image processing is unavailable in this browser.')

    context.drawImage(bitmap, 0, 0, width, height)
    const image = context.getImageData(0, 0, width, height)
    for (let index = 0; index < image.data.length; index += 4) {
      const luminance = image.data[index] * 0.2126 + image.data[index + 1] * 0.7152 + image.data[index + 2] * 0.0722
      const contrast = Math.max(0, Math.min(255, (luminance - 128) * 1.35 + 128))
      image.data[index] = contrast
      image.data[index + 1] = contrast
      image.data[index + 2] = contrast
    }
    context.putImageData(image, 0, 0)

    const preparedImage = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare this photo for OCR.')), 'image/png')
    })
    return { image: preparedImage, width, height }
  } finally {
    bitmap.close()
  }
}

export async function recognizeCoffeeBag(
  file: File,
  options: { onProgress?: (progress: OcrProgress) => void; signal?: AbortSignal } = {},
): Promise<ExtractionResponse> {
  assertSupportedOcrImage(file)
  const prepared = await preprocessForOcr(file)
  if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')

  const { createWorker } = await import('tesseract.js')
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null
  let terminated = false
  const terminate = async () => {
    if (!worker || terminated) return
    terminated = true
    await worker.terminate()
  }
  const stop = () => { void terminate() }
  options.signal?.addEventListener('abort', stop, { once: true })

  try {
    worker = await createWorker(['eng', 'spa'], 1, {
      workerPath: `${OCR_ASSET_ROOT}/worker.min.js`,
      corePath: `${OCR_ASSET_ROOT}/core`,
      langPath: `${OCR_ASSET_ROOT}/lang`,
      workerBlobURL: false,
      gzip: true,
      logger: message => options.onProgress?.({ progress: message.progress, status: message.status }),
    })
    await worker.setParameters({ tessedit_pageseg_mode: OCR_DEFAULT_PAGE_SEGMENTATION_MODE })
    const automaticResult = await worker.recognize(prepared.image, {}, { blocks: true })
    await worker.setParameters({ tessedit_pageseg_mode: OCR_PAGE_SEGMENTATION_MODE })
    if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
    const sparseResult = await worker.recognize(prepared.image, {}, { blocks: true })
    if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
    let blocks = mergeOcrBlocks(
      blocksFromOcrData(automaticResult.data),
      blocksFromOcrData(sparseResult.data),
    )
    let extraction = parseCoffeeBagOcr(blocks)
    const identityCrop = !extraction.bean.variety && identityCropForPortraitBag(prepared.width, prepared.height)
    if (identityCrop) {
      await worker.setParameters({ tessedit_pageseg_mode: OCR_IDENTITY_PAGE_SEGMENTATION_MODE })
      const identityResult = await worker.recognize(prepared.image, { rectangle: identityCrop }, { blocks: true })
      if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
      blocks = mergeOcrBlocks(blocks, blocksFromOcrData(identityResult.data))
      extraction = parseCoffeeBagOcr(blocks)
    }
    const varietyCrop = !extraction.bean.variety && varietyCropForPortraitBag(prepared.width, prepared.height)
    if (varietyCrop) {
      await worker.setParameters({ tessedit_pageseg_mode: OCR_PAGE_SEGMENTATION_MODE })
      const varietyResult = await worker.recognize(prepared.image, { rectangle: varietyCrop }, { blocks: true })
      if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
      blocks = mergeOcrBlocks(blocks, blocksFromOcrData(varietyResult.data))
      extraction = parseCoffeeBagOcr(blocks)
      if (!extraction.bean.variety) {
        await worker.setParameters({ tessedit_pageseg_mode: OCR_SINGLE_LINE_PAGE_SEGMENTATION_MODE })
        const singleLineResult = await worker.recognize(prepared.image, { rectangle: varietyCrop }, { blocks: true })
        if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
        blocks = mergeOcrBlocks(blocks, blocksFromOcrData(singleLineResult.data))
        extraction = parseCoffeeBagOcr(blocks)
      }
    }
    return extraction
  } finally {
    options.signal?.removeEventListener('abort', stop)
    await terminate()
  }
}
