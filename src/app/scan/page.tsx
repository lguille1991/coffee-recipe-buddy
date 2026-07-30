'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Upload } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { isE2eTestAuthEnabled } from '@/lib/e2e-test-auth'
import { compressImage } from '@/lib/image-compressor'
import { assertSupportedOcrImage, recognizeCoffeeBag } from '@/lib/browser-ocr'
import { recipeSessionStorage } from '@/lib/recipe-session-storage'

export default function ScanPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const activeScanRef = useRef<AbortController | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth?returnTo=/scan')
  }, [user, authLoading, router])

  useEffect(() => () => activeScanRef.current?.abort(), [])

  async function handleFile(file: File) {
    activeScanRef.current?.abort()
    const controller = new AbortController()
    activeScanRef.current = controller
    setError(null)
    setProgressMessage('Preparing your coffee bag photo…')
    setLoading(true)

    try {
      assertSupportedOcrImage(file)
      const compressed = await compressImage(file)
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result)
          else reject(new Error('Failed to read image data'))
        }
        reader.onerror = () => reject(new Error('Failed to read image data'))
        reader.readAsDataURL(compressed)
      })
      const data = await recognizeCoffeeBag(file, {
        signal: controller.signal,
        onProgress: progress => setProgressMessage(`${progress.status} (${Math.round(progress.progress * 100)}%)`),
        onBlocks: isE2eTestAuthEnabled({
          NODE_ENV: process.env.NODE_ENV,
          NEXT_PUBLIC_E2E_TEST_AUTH: process.env.NEXT_PUBLIC_E2E_TEST_AUTH,
        })
          ? blocks => sessionStorage.setItem('ocrDebugBlocks', JSON.stringify(blocks))
          : undefined,
      })
      if (controller.signal.aborted) return
      recipeSessionStorage.setExtractionResult(data)
      recipeSessionStorage.setScannedBagImageDataUrl(imageDataUrl)
      router.push('/analysis')
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setProgressMessage('')
      setLoading(false)
    } finally {
      if (activeScanRef.current === controller) activeScanRef.current = null
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-12" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 pb-6">
        <button onClick={() => router.back()} className="min-h-10 min-w-10 p-2 -ml-2 text-[var(--foreground)] flex items-center justify-center" aria-label="Go back">
          <ArrowLeft className="ui-icon-action" />
        </button>
        <h2 className="ui-section-title">Scan Coffee</h2>
      </div>

      {/* Upload zone */}
      <div className="flex-1 px-4 sm:px-6 flex flex-col gap-6">
        <div
          className="flex-1 min-h-[280px] md:min-h-[320px] xl:max-w-2xl xl:mx-auto w-full border-2 border-dashed border-[var(--border)] rounded-[16px] flex flex-col items-center justify-center gap-3 bg-[var(--card)] cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          data-testid="coffee-photo-upload-trigger"
        >
          {loading ? (
            <>
              <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
              <p className="ui-body-muted" aria-live="polite">{progressMessage || 'Reading your coffee bag on this device…'}</p>
            </>
          ) : (
            <>
              <Camera size={48} className="text-[var(--muted-foreground)]" strokeWidth={1.5} />
              <p className="ui-body-muted">Take a photo of your coffee bag</p>
            </>
          )}
        </div>

        {error && (
          <div className="ui-alert-danger text-sm">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 xl:max-w-2xl xl:mx-auto w-full">
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading}
            data-testid="take-photo-trigger"
            className="ui-button-primary flex-1 disabled:opacity-50"
          >
            <Camera className="ui-icon-inline" />
            Take Photo
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            data-testid="upload-photo-trigger"
            className="ui-button-secondary flex-1 disabled:opacity-50"
          >
            <Upload className="ui-icon-inline" />
            Upload
          </button>
        </div>

        <p className="ui-meta text-center pb-24">
          We&apos;ll analyze your coffee beans and create a personalized recipe
        </p>
      </div>

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} data-testid="coffee-photo-camera-input" />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} data-testid="coffee-photo-file-input" />
    </div>
  )
}
