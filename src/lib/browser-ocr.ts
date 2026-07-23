'use client'

import { parseCoffeeBagOcr, type OcrTextBlock } from '@/lib/deterministic-ocr-parser'
import type { ExtractionResponse } from '@/types/recipe'

const OCR_ASSET_ROOT = '/ocr/v7'
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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

async function preprocessForOcr(file: File): Promise<Blob> {
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

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare this photo for OCR.')), 'image/png')
    })
  } finally {
    bitmap.close()
  }
}

export async function recognizeCoffeeBag(
  file: File,
  options: { onProgress?: (progress: OcrProgress) => void; signal?: AbortSignal } = {},
): Promise<ExtractionResponse> {
  assertSupportedOcrImage(file)
  const image = await preprocessForOcr(file)
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
    if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
    const result = await worker.recognize(image, {}, { blocks: true })
    if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
    return parseCoffeeBagOcr(blocksFromOcrData(result.data))
  } finally {
    options.signal?.removeEventListener('abort', stop)
    await terminate()
  }
}
