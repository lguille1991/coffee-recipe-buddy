'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Upload } from 'lucide-react'
import { compressImage } from '@/lib/image-compressor'

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
      sessionStorage.setItem('extractionResult', JSON.stringify(data))
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
      <div className="flex items-center gap-3 px-4 pb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-[#333333]">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-[#333333]">Scan Coffee</h2>
      </div>

      {/* Upload zone */}
      <div className="flex-1 px-6 flex flex-col gap-6">
        <div
          className="flex-1 min-h-[280px] border-2 border-dashed border-[#E1E2E5] rounded-[16px] flex flex-col items-center justify-center gap-3 bg-white cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {loading ? (
            <>
              <div className="w-8 h-8 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#5B5F66]">Analyzing your coffee bag…</p>
            </>
          ) : (
            <>
              <Camera size={48} color="#9DA4B3" strokeWidth={1.5} />
              <p className="text-sm text-[#5B5F66]">Take a photo of your coffee bag</p>
            </>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-[14px]">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#333333] text-white text-sm font-medium rounded-[14px] py-3.5 disabled:opacity-50"
          >
            <Camera size={18} />
            Take Photo
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 border border-[#333333] text-[#333333] text-sm font-medium rounded-[14px] py-3.5 disabled:opacity-50"
          >
            <Upload size={18} />
            Upload
          </button>
        </div>

        <p className="text-center text-xs text-[#5B5F66] pb-24">
          We&apos;ll analyze your coffee beans and create a personalized recipe
        </p>
      </div>

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </div>
  )
}
