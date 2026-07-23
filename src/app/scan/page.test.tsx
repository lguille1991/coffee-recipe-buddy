/** @vitest-environment jsdom */

import React from 'react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

const { pushMock, recognizeMock, compressMock, assertSupportedMock, setExtractionResultMock, setImageMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  recognizeMock: vi.fn(),
  compressMock: vi.fn(async () => new Blob(['photo'], { type: 'image/jpeg' })),
  assertSupportedMock: vi.fn(),
  setExtractionResultMock: vi.fn(),
  setImageMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }) }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, loading: false }) }))
vi.mock('@/lib/image-compressor', () => ({ compressImage: compressMock }))
vi.mock('@/lib/browser-ocr', () => ({ assertSupportedOcrImage: assertSupportedMock, recognizeCoffeeBag: recognizeMock }))
vi.mock('@/lib/recipe-session-storage', () => ({
  recipeSessionStorage: { setExtractionResult: setExtractionResultMock, setScannedBagImageDataUrl: setImageMock },
}))

import ScanPage from './page'

describe('ScanPage', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    assertSupportedMock.mockImplementation((file: File) => {
      if (file.type !== 'image/jpeg') throw new Error('Choose a JPEG, PNG, or WebP image of your coffee bag.')
    })
    recognizeMock.mockResolvedValue({ bean: { process: 'washed', roast_level: 'light' }, confidence: {}, status: 'complete', warnings: [] })
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    document.body.innerHTML = ''
  })

  it('runs local OCR and does not call the removed extraction endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    act(() => root.render(<ScanPage />))
    const input = container.querySelector('[data-testid="coffee-photo-file-input"]') as HTMLInputElement
    const file = new File(['photo'], 'bag.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file] })

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(recognizeMock).toHaveBeenCalledWith(file, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setExtractionResultMock).toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith('/analysis')
  })

  it('rejects unsupported files before compression or OCR', async () => {
    act(() => root.render(<ScanPage />))
    const input = container.querySelector('[data-testid="coffee-photo-file-input"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [new File(['photo'], 'bag.gif', { type: 'image/gif' })] })

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })

    expect(compressMock).not.toHaveBeenCalled()
    expect(recognizeMock).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Choose a JPEG, PNG, or WebP image')
  })
})
