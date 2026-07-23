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

type OcrRectangle = { left: number; top: number; width: number; height: number }

type OcrLayoutOptions = {
  source?: string
  imageWidth?: number
  imageHeight?: number
  renderedWidth?: number
  renderedHeight?: number
  rectangle?: OcrRectangle
}

type TesseractLine = {
  text: string
  confidence: number
  bbox?: { x0: number; y0: number; x1: number; y1: number }
}

type TesseractBlock = {
  text: string
  confidence: number
  paragraphs?: Array<{ lines?: TesseractLine[] }>
}

export function blocksFromOcrData(
  data: { text: string; confidence: number; blocks: TesseractBlock[] | null },
  options: OcrLayoutOptions = {},
): OcrTextBlock[] {
  if (data.blocks?.length) {
    const lines = data.blocks.flatMap(block => block.paragraphs?.flatMap(paragraph => paragraph.lines ?? []) ?? [])
    if (lines.length) {
      return lines.filter(line => line.text.trim()).map((line, order) => {
        const result: OcrTextBlock = {
          text: line.text.trim(),
          confidence: line.confidence,
          source: options.source,
          order,
        }
        if (
          line.bbox
          && options.imageWidth
          && options.imageHeight
        ) {
          const rectangle = options.rectangle ?? {
            left: 0,
            top: 0,
            width: options.imageWidth,
            height: options.imageHeight,
          }
          const renderedWidth = options.renderedWidth ?? rectangle.width
          const renderedHeight = options.renderedHeight ?? rectangle.height
          result.bbox = {
            x0: (rectangle.left + line.bbox.x0 / renderedWidth * rectangle.width) / options.imageWidth,
            y0: (rectangle.top + line.bbox.y0 / renderedHeight * rectangle.height) / options.imageHeight,
            x1: (rectangle.left + line.bbox.x1 / renderedWidth * rectangle.width) / options.imageWidth,
            y1: (rectangle.top + line.bbox.y1 / renderedHeight * rectangle.height) / options.imageHeight,
          }
        }
        if (!result.source) delete result.source
        return result
      })
    }
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

type PreparedOcrImage = {
  color: Blob
  grayscale: Blob
  width: number
  height: number
  bands: Array<{
    image: Blob
    source: string
    rectangle: OcrRectangle
    renderedWidth: number
    renderedHeight: number
  }>
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare this photo for OCR.')), 'image/png')
  })
}

function drawScaledCrop(
  source: HTMLCanvasElement,
  rectangle: OcrRectangle,
  targetLongEdge = 2000,
) {
  const scale = Math.max(1, targetLongEdge / Math.max(rectangle.width, rectangle.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(rectangle.width * scale)
  canvas.height = Math.round(rectangle.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('OCR image processing is unavailable in this browser.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    source,
    rectangle.left,
    rectangle.top,
    rectangle.width,
    rectangle.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas
}

async function preprocessForOcr(file: File): Promise<PreparedOcrImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(2, 2200 / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const colorCanvas = document.createElement('canvas')
    colorCanvas.width = width
    colorCanvas.height = height
    const colorContext = colorCanvas.getContext('2d')
    if (!colorContext) throw new Error('OCR image processing is unavailable in this browser.')
    colorContext.imageSmoothingEnabled = true
    colorContext.imageSmoothingQuality = 'high'
    colorContext.drawImage(bitmap, 0, 0, width, height)

    const grayscaleCanvas = document.createElement('canvas')
    grayscaleCanvas.width = width
    grayscaleCanvas.height = height
    const grayscaleContext = grayscaleCanvas.getContext('2d', { willReadFrequently: true })
    if (!grayscaleContext) throw new Error('OCR image processing is unavailable in this browser.')
    grayscaleContext.drawImage(colorCanvas, 0, 0)
    const image = grayscaleContext.getImageData(0, 0, width, height)
    for (let index = 0; index < image.data.length; index += 4) {
      const luminance = image.data[index] * 0.2126 + image.data[index + 1] * 0.7152 + image.data[index + 2] * 0.0722
      const contrast = Math.max(0, Math.min(255, (luminance - 128) * 1.35 + 128))
      image.data[index] = contrast
      image.data[index + 1] = contrast
      image.data[index + 2] = contrast
    }
    grayscaleContext.putImageData(image, 0, 0)

    const bandDefinitions = [
      { source: 'top', top: 0, height: 0.43 },
      { source: 'middle', top: 0.25, height: 0.5 },
      { source: 'bottom', top: 0.57, height: 0.43 },
    ]
    const bands = await Promise.all(bandDefinitions.map(async definition => {
      const rectangle = {
        left: 0,
        top: Math.round(height * definition.top),
        width,
        height: Math.min(height, Math.round(height * definition.height)),
      }
      const bandCanvas = drawScaledCrop(colorCanvas, rectangle)
      return {
        image: await canvasBlob(bandCanvas),
        source: definition.source,
        rectangle,
        renderedWidth: bandCanvas.width,
        renderedHeight: bandCanvas.height,
      }
    }))

    return {
      color: await canvasBlob(colorCanvas),
      grayscale: await canvasBlob(grayscaleCanvas),
      width,
      height,
      bands,
    }
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
  let activePass = -1
  let reportedProgress = 0
  const reportProgress = (progress: number, status: string) => {
    const candidate = activePass < 0
      ? progress * 0.1
      : 0.1 + ((activePass + progress) / 6) * 0.9
    reportedProgress = Math.max(reportedProgress, Math.min(1, candidate))
    options.onProgress?.({ progress: reportedProgress, status })
  }
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
      logger: message => reportProgress(message.progress, message.status),
    })
    const recognizePass = async (image: Blob) => {
      activePass += 1
      return worker!.recognize(image, {}, { blocks: true })
    }
    await worker.setParameters({ tessedit_pageseg_mode: OCR_DEFAULT_PAGE_SEGMENTATION_MODE })
    const automaticResult = await recognizePass(prepared.color)
    await worker.setParameters({ tessedit_pageseg_mode: OCR_PAGE_SEGMENTATION_MODE })
    if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
    const sparseResult = await recognizePass(prepared.grayscale)
    if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
    let blocks = mergeOcrBlocks(
      blocksFromOcrData(automaticResult.data, {
        source: 'full-color',
        imageWidth: prepared.width,
        imageHeight: prepared.height,
      }),
      blocksFromOcrData(sparseResult.data, {
        source: 'full-grayscale',
        imageWidth: prepared.width,
        imageHeight: prepared.height,
      }),
    )
    let extraction = parseCoffeeBagOcr(blocks)
    const missingDetails = () => !extraction.bean.variety
      || !extraction.bean.finca
      || !extraction.bean.producer
      || !extraction.bean.origin
      || !extraction.bean.tasting_notes?.length
      || extraction.bean.process === 'unknown'

    if (missingDetails()) {
      await worker.setParameters({ tessedit_pageseg_mode: OCR_PAGE_SEGMENTATION_MODE })
      for (const band of prepared.bands) {
        const result = await recognizePass(band.image)
        if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
        blocks = mergeOcrBlocks(blocks, blocksFromOcrData(result.data, {
          source: band.source,
          imageWidth: prepared.width,
          imageHeight: prepared.height,
          renderedWidth: band.renderedWidth,
          renderedHeight: band.renderedHeight,
          rectangle: band.rectangle,
        }))
        extraction = parseCoffeeBagOcr(blocks)
      }
    }

    const identityCrop = !extraction.bean.variety && identityCropForPortraitBag(prepared.width, prepared.height)
    if (identityCrop) {
      const identityCanvas = {
        image: prepared.bands[0].image,
        source: prepared.bands[0].source,
        rectangle: prepared.bands[0].rectangle,
        renderedWidth: prepared.bands[0].renderedWidth,
        renderedHeight: prepared.bands[0].renderedHeight,
      }
      await worker.setParameters({ tessedit_pageseg_mode: OCR_IDENTITY_PAGE_SEGMENTATION_MODE })
      const identityResult = await recognizePass(identityCanvas.image)
      if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
      blocks = mergeOcrBlocks(blocks, blocksFromOcrData(identityResult.data, {
        source: `${identityCanvas.source}-identity`,
        imageWidth: prepared.width,
        imageHeight: prepared.height,
        renderedWidth: identityCanvas.renderedWidth,
        renderedHeight: identityCanvas.renderedHeight,
        rectangle: identityCanvas.rectangle,
      }))
      extraction = parseCoffeeBagOcr(blocks)
    }
    activePass = 5
    reportProgress(1, 'complete')
    return extraction
  } finally {
    options.signal?.removeEventListener('abort', stop)
    await terminate()
  }
}
