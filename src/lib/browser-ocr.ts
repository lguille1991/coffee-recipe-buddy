'use client'

import { parseCoffeeBagOcr, type OcrTextBlock } from '@/lib/deterministic-ocr-parser'
import type { ExtractionResponse } from '@/types/recipe'
import type { PSM } from 'tesseract.js'

const OCR_ASSET_ROOT = '/ocr/v7'
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const COUNTRY_ORIGIN_TEXT = /\b(?:el salvador|brazil|brasil|colombia|guatemala|honduras|costa rica|panama|ethiopia|kenya)\b/i

// Coffee bags are composed labels rather than one continuous document column.
// Tesseract sparse-text mode preserves their independently positioned fields.
export const OCR_PAGE_SEGMENTATION_MODE: PSM = '11' as PSM
export const OCR_DEFAULT_PAGE_SEGMENTATION_MODE: PSM = '3' as PSM
export const OCR_IDENTITY_PAGE_SEGMENTATION_MODE: PSM = '11' as PSM
export const OCR_SINGLE_LINE_PAGE_SEGMENTATION_MODE: PSM = '7' as PSM
const MAX_RECOGNITION_PASSES = 9

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
  const merged: OcrTextBlock[] = []
  for (const block of runs.flat()) {
    const key = normalizeBlockText(block.text)
    if (!key) continue
    const existingIndex = merged.findIndex(candidate => (
      normalizeBlockText(candidate.text) === key
      && blocksShareLocation(candidate, block)
    ))
    if (existingIndex < 0) {
      merged.push(block)
    } else if ((block.confidence ?? 0) > (merged[existingIndex].confidence ?? 0)) {
      merged[existingIndex] = block
    }
  }
  return addAdjacentFragmentAlternates(merged)
}

function normalizeBlockText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function blocksShareLocation(left: OcrTextBlock, right: OcrTextBlock) {
  if (!left.bbox || !right.bbox) return true
  const intersectionWidth = Math.max(0, Math.min(left.bbox.x1, right.bbox.x1) - Math.max(left.bbox.x0, right.bbox.x0))
  const intersectionHeight = Math.max(0, Math.min(left.bbox.y1, right.bbox.y1) - Math.max(left.bbox.y0, right.bbox.y0))
  const intersection = intersectionWidth * intersectionHeight
  const leftArea = (left.bbox.x1 - left.bbox.x0) * (left.bbox.y1 - left.bbox.y0)
  const rightArea = (right.bbox.x1 - right.bbox.x0) * (right.bbox.y1 - right.bbox.y0)
  const union = leftArea + rightArea - intersection
  if (union > 0 && intersection / union >= 0.3) return true

  const leftCenterX = (left.bbox.x0 + left.bbox.x1) / 2
  const leftCenterY = (left.bbox.y0 + left.bbox.y1) / 2
  const rightCenterX = (right.bbox.x0 + right.bbox.x1) / 2
  const rightCenterY = (right.bbox.y0 + right.bbox.y1) / 2
  return Math.abs(leftCenterX - rightCenterX) <= 0.015
    && Math.abs(leftCenterY - rightCenterY) <= 0.015
}

const SOURCE_VERTICAL_RANGES: Record<string, readonly [number, number]> = {
  full: [0, 1],
  top: [0, 0.43],
  middle: [0.25, 0.75],
  bottom: [0.57, 1],
  identity: [0.14, 0.54],
  variety: [0.22, 0.4],
}

function sourceFamily(source: string) {
  return source.replace(/-(?:color|grayscale)$/, '')
}

function compatibleFragmentSources(left: OcrTextBlock, right: OcrTextBlock) {
  if (!left.source || !right.source || !left.bbox || !right.bbox) return false
  const leftFamily = sourceFamily(left.source)
  const rightFamily = sourceFamily(right.source)
  if (leftFamily === rightFamily) return true
  const leftRange = SOURCE_VERTICAL_RANGES[leftFamily]
  const rightRange = SOURCE_VERTICAL_RANGES[rightFamily]
  if (!leftRange || !rightRange) return false
  const sharedTop = Math.max(leftRange[0], rightRange[0])
  const sharedBottom = Math.min(leftRange[1], rightRange[1])
  const leftCenterY = (left.bbox.y0 + left.bbox.y1) / 2
  const rightCenterY = (right.bbox.y0 + right.bbox.y1) / 2
  return sharedTop <= sharedBottom
    && leftCenterY >= sharedTop
    && leftCenterY <= sharedBottom
    && rightCenterY >= sharedTop
    && rightCenterY <= sharedBottom
}

function sharesBaseline(left: OcrTextBlock, right: OcrTextBlock) {
  if (!left.bbox || !right.bbox) return false
  const leftHeight = left.bbox.y1 - left.bbox.y0
  const rightHeight = right.bbox.y1 - right.bbox.y0
  const verticalOverlap = Math.min(left.bbox.y1, right.bbox.y1) - Math.max(left.bbox.y0, right.bbox.y0)
  return verticalOverlap >= Math.min(leftHeight, rightHeight) * 0.4
}

function adjacentOnBaseline(left: OcrTextBlock, right: OcrTextBlock) {
  if (!left.bbox || !right.bbox || !compatibleFragmentSources(left, right) || !sharesBaseline(left, right)) return false
  const leftHeight = left.bbox.y1 - left.bbox.y0
  const rightHeight = right.bbox.y1 - right.bbox.y0
  const horizontalGap = right.bbox.x0 - left.bbox.x1
  return horizontalGap >= -0.004
    && horizontalGap <= Math.max(0.04, Math.min(leftHeight, rightHeight) * 1.5)
}

function normalizedBlockConfidence(block: OcrTextBlock) {
  if (typeof block.confidence !== 'number' || !Number.isFinite(block.confidence)) return 0
  return Math.max(0, Math.min(1, block.confidence > 1 ? block.confidence / 100 : block.confidence))
}

function joinedFragmentText(left: OcrTextBlock, right: OcrTextBlock) {
  if (normalizedBlockConfidence(left) < 0.5 || normalizedBlockConfidence(right) < 0.5) return null
  const leftText = left.text.trim()
  const rightText = right.text.trim()
  if (!/^[\p{L}\p{N}'-]+$/u.test(leftText) || !/^[\p{L}\p{N}'-]+$/u.test(rightText)) return null

  const altitudeParts = /^\d{3,4}$/.test(leftText) && /^\p{L}{1,5}$/u.test(rightText)
  const splitWord = /^\p{L}{1,4}$/u.test(leftText)
    && /^\p{Ll}{1,5}$/u.test(rightText)
  const properNameParts = /^\p{Lu}[\p{L}'-]{1,3}$/u.test(leftText)
    && /^\p{Lu}[\p{L}'-]{2,14}$/u.test(rightText)
    && leftText !== leftText.toLocaleUpperCase()
    && rightText !== rightText.toLocaleUpperCase()
  if (!altitudeParts && !splitWord && !properNameParts) return null
  return `${leftText}${splitWord ? '' : ' '}${rightText}`
}

function addAdjacentFragmentAlternates(blocks: readonly OcrTextBlock[]) {
  const result = [...blocks]
  const positioned = blocks
    .filter((block): block is OcrTextBlock & { bbox: NonNullable<OcrTextBlock['bbox']> } => (
      Boolean(block.bbox) && !block.source?.startsWith('joined:')
    ))
    .toSorted((left, right) => (
      (left.bbox.y0 + left.bbox.y1) - (right.bbox.y0 + right.bbox.y1)
      || left.bbox.x0 - right.bbox.x0
    ))
  const rows: Array<typeof positioned> = []
  for (const block of positioned) {
    const row = rows.findLast(candidate => candidate.some(anchor => sharesBaseline(anchor, block)))
    if (row) row.push(block)
    else rows.push([block])
  }
  for (const row of rows) {
    const ordered = row.toSorted((left, right) => left.bbox.x0 - right.bbox.x0)
    for (let index = 0; index + 1 < ordered.length; index += 1) {
      const left = ordered[index]
      const right = ordered.slice(index + 1).find(candidate => candidate.bbox.x0 >= left.bbox.x1 - 0.004)
      if (!right || !adjacentOnBaseline(left, right)) continue
      const text = joinedFragmentText(left, right)
      if (!text) continue
      if (result.some(candidate => normalizeBlockText(candidate.text) === normalizeBlockText(text))) continue
      result.push({
        text,
        confidence: Math.min(left.confidence ?? 0, right.confidence ?? 0),
        source: `joined:${left.source ?? 'unknown'}+${right.source ?? 'unknown'}`,
        order: Math.min(left.order ?? 0, right.order ?? 0),
        bbox: {
          x0: Math.min(left.bbox.x0, right.bbox.x0),
          y0: Math.min(left.bbox.y0, right.bbox.y0),
          x1: Math.max(left.bbox.x1, right.bbox.x1),
          y1: Math.max(left.bbox.y1, right.bbox.y1),
        },
      })
    }
  }
  return result
}

export function identityCropForPortraitBag(width: number, height: number) {
  if (height / width < 1.1) return null
  return {
    left: Math.round(width * 0.15),
    top: Math.round(height * 0.14),
    width: Math.round(width * 0.73),
    height: Math.round(height * 0.4),
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

// A focused upscale gives small country-of-origin seals a chance to be read
// when the main label already supplied a regional origin.
export function countrySealCropForPortraitBag(width: number, height: number) {
  if (height / width < 1.1) return null
  return {
    left: Math.round(width * 0.8),
    top: Math.round(height * 0.32),
    width: Math.round(width * 0.2),
    height: Math.round(height * 0.18),
  }
}

type PreparedOcrImage = {
  color: Blob
  grayscale: Blob
  width: number
  height: number
  bands: PreparedOcrCrop[]
  identity: PreparedOcrCrop[]
  variety?: PreparedOcrCrop
  countrySeals: PreparedOcrCrop[]
}

type PreparedOcrCrop = {
  image: Blob
  source: string
  rectangle: OcrRectangle
  renderedWidth: number
  renderedHeight: number
  rotated?: boolean
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare this photo for OCR.')), 'image/png')
  })
}

export function drawScaledCrop(
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

function rotateCropQuarterTurns(source: HTMLCanvasElement, quarterTurns: 1 | 3) {
  const canvas = document.createElement('canvas')
  canvas.width = source.height
  canvas.height = source.width
  const context = canvas.getContext('2d')
  if (!context) throw new Error('OCR image processing is unavailable in this browser.')
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(quarterTurns * Math.PI / 2)
  context.drawImage(source, -source.width / 2, -source.height / 2)
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
    const prepareCrop = async (
      sourceCanvas: HTMLCanvasElement,
      rectangle: OcrRectangle,
      source: string,
      quarterTurns?: 1 | 3,
    ): Promise<PreparedOcrCrop> => {
      const cropCanvas = drawScaledCrop(sourceCanvas, rectangle)
      const renderedCanvas = quarterTurns ? rotateCropQuarterTurns(cropCanvas, quarterTurns) : cropCanvas
      return {
        image: await canvasBlob(renderedCanvas),
        source,
        rectangle,
        renderedWidth: renderedCanvas.width,
        renderedHeight: renderedCanvas.height,
        rotated: Boolean(quarterTurns),
      }
    }
    const bandsPromise = Promise.all(bandDefinitions.map(definition => {
      const rectangle = {
        left: 0,
        top: Math.round(height * definition.top),
        width,
        height: Math.min(height, Math.round(height * definition.height)),
      }
      return prepareCrop(colorCanvas, rectangle, definition.source)
    }))
    const identityRectangle = identityCropForPortraitBag(width, height)
    const varietyRectangle = varietyCropForPortraitBag(width, height)
    const countrySealRectangle = countrySealCropForPortraitBag(width, height)
    const [
      color,
      grayscale,
      bands,
      identityColor,
      identityGrayscale,
      variety,
      countrySealCounterclockwise,
    ] = await Promise.all([
      canvasBlob(colorCanvas),
      canvasBlob(grayscaleCanvas),
      bandsPromise,
      identityRectangle
        ? prepareCrop(colorCanvas, identityRectangle, 'identity-color')
        : Promise.resolve(undefined),
      identityRectangle
        ? prepareCrop(grayscaleCanvas, identityRectangle, 'identity-grayscale')
        : Promise.resolve(undefined),
      varietyRectangle
        ? prepareCrop(grayscaleCanvas, varietyRectangle, 'variety-grayscale')
        : Promise.resolve(undefined),
      countrySealRectangle
        ? prepareCrop(grayscaleCanvas, countrySealRectangle, 'country-seal-counterclockwise', 3)
        : Promise.resolve(undefined),
    ])

    return {
      color,
      grayscale,
      width,
      height,
      bands,
      identity: [identityColor, identityGrayscale].filter(
        (crop): crop is PreparedOcrCrop => Boolean(crop),
      ),
      variety,
      countrySeals: [countrySealCounterclockwise].filter(
        (crop): crop is PreparedOcrCrop => Boolean(crop),
      ),
    }
  } finally {
    bitmap.close()
  }
}

export async function recognizeCoffeeBag(
  file: File,
  options: {
    onProgress?: (progress: OcrProgress) => void
    signal?: AbortSignal
    onBlocks?: (blocks: OcrTextBlock[]) => void
  } = {},
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
      : 0.1 + ((activePass + progress) / MAX_RECOGNITION_PASSES) * 0.9
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
    const throwIfAborted = () => {
      if (options.signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError')
    }
    const recognizePass = async (image: Blob) => {
      throwIfAborted()
      activePass += 1
      const result = await worker!.recognize(image, {}, { blocks: true })
      throwIfAborted()
      return result
    }
    await worker.setParameters({ tessedit_pageseg_mode: OCR_DEFAULT_PAGE_SEGMENTATION_MODE })
    const automaticResult = await recognizePass(prepared.color)
    await worker.setParameters({ tessedit_pageseg_mode: OCR_PAGE_SEGMENTATION_MODE })
    const sparseResult = await recognizePass(prepared.grayscale)
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

    if (
      prepared.identity.length
      && (!extraction.bean.variety || extraction.bean.process === 'unknown')
    ) {
      await worker.setParameters({ tessedit_pageseg_mode: OCR_IDENTITY_PAGE_SEGMENTATION_MODE })
      for (const identity of prepared.identity) {
        const identityResult = await recognizePass(identity.image)
        blocks = mergeOcrBlocks(blocks, blocksFromOcrData(identityResult.data, {
          source: identity.source,
          imageWidth: prepared.width,
          imageHeight: prepared.height,
          renderedWidth: identity.renderedWidth,
          renderedHeight: identity.renderedHeight,
          rectangle: identity.rectangle,
        }))
        extraction = parseCoffeeBagOcr(blocks)
      }
    }

    if (!extraction.bean.variety && prepared.variety) {
      await worker.setParameters({ tessedit_pageseg_mode: OCR_SINGLE_LINE_PAGE_SEGMENTATION_MODE })
      const varietyResult = await recognizePass(prepared.variety.image)
      blocks = mergeOcrBlocks(blocks, blocksFromOcrData(varietyResult.data, {
        source: prepared.variety.source,
        imageWidth: prepared.width,
        imageHeight: prepared.height,
        renderedWidth: prepared.variety.renderedWidth,
        renderedHeight: prepared.variety.renderedHeight,
        rectangle: prepared.variety.rectangle,
      }))
      extraction = parseCoffeeBagOcr(blocks)
    }
    if (
      prepared.countrySeals.length
      && (
        !extraction.bean.origin
        || !COUNTRY_ORIGIN_TEXT.test(extraction.bean.origin)
      )
    ) {
      await worker.setParameters({ tessedit_pageseg_mode: OCR_PAGE_SEGMENTATION_MODE })
      for (const countrySeal of prepared.countrySeals) {
        const countrySealResult = await recognizePass(countrySeal.image)
        blocks = mergeOcrBlocks(blocks, blocksFromOcrData(
          countrySealResult.data,
          countrySeal.rotated
            ? { source: countrySeal.source }
            : {
                source: countrySeal.source,
                imageWidth: prepared.width,
                imageHeight: prepared.height,
                renderedWidth: countrySeal.renderedWidth,
                renderedHeight: countrySeal.renderedHeight,
                rectangle: countrySeal.rectangle,
              },
        ))
        extraction = parseCoffeeBagOcr(blocks)
        if (extraction.bean.origin && COUNTRY_ORIGIN_TEXT.test(extraction.bean.origin)) break
      }
    }
    activePass = MAX_RECOGNITION_PASSES - 1
    reportProgress(1, 'complete')
    options.onBlocks?.(blocks)
    return extraction
  } finally {
    options.signal?.removeEventListener('abort', stop)
    await terminate()
  }
}
