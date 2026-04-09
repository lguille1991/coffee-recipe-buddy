'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Upload } from 'lucide-react'
import { compressImage } from '@/lib/image-compressor'
import { recipeSessionStorage } from '@/lib/recipe-session-storage'

export default function ScanPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setLoading(true)

    try {
      const compressed = await compressImage(file)
      const form = new FormData()
      form.append('image', compressed, 'coffee-bag.jpg')

      const res = await fetch('/api/extract-bean', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Extraction failed')
      }

      const data = await res.json()
      recipeSessionStorage.setExtractionResult(data)
      router.push('/analysis')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
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
        >
          {loading ? (
            <>
              <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
              <p className="ui-body-muted">Analyzing your coffee bag…</p>
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
            className="ui-button-primary flex-1 disabled:opacity-50"
          >
            <Camera className="ui-icon-inline" />
            Take Photo
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
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

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </div>
  )
}
