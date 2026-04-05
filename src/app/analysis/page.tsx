'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BeanProfile, ExtractionResponse } from '@/types/recipe'
import { recommendMethods } from '@/lib/method-decision-engine'

const PROCESS_LABELS: Record<string, string> = {
  washed: 'Washed',
  natural: 'Natural',
  honey: 'Honey',
  anaerobic: 'Anaerobic',
  unknown: 'Unknown',
}

const ROAST_LABELS: Record<string, string> = {
  light: 'Light',
  'medium-light': 'Med-Light',
  medium: 'Medium',
  'medium-dark': 'Med-Dark',
  dark: 'Dark',
}

function ConfidenceBadge({ score }: { score?: number }) {
  if (!score || score >= 0.6) return null
  return (
    <span className="ml-1 inline-block px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-700 rounded-full">
      low confidence
    </span>
  )
}

function EditableField({
  label,
  value,
  onChange,
  confidence,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  confidence?: number
  type?: string
}) {
  return (
    <div className="bg-white rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider">{label}</label>
        <ConfidenceBadge score={confidence} />
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm font-medium text-[#333333] bg-transparent outline-none"
      />
    </div>
  )
}

export default function AnalysisPage() {
  const router = useRouter()
  const [extraction, setExtraction] = useState<ExtractionResponse | null>(null)
  const [bean, setBean] = useState<BeanProfile | null>(null)
  const [roastDate, setRoastDate] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('extractionResult')
    if (!raw) { router.replace('/scan'); return }
    const data: ExtractionResponse = JSON.parse(raw)
    setExtraction(data)
    setBean(data.bean)
  }, [router])

  function updateField<K extends keyof BeanProfile>(key: K, value: BeanProfile[K]) {
    setBean(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function handleGenerate() {
    if (!bean) return
    const finalBean: BeanProfile = { ...bean, roast_date: roastDate || undefined }
    sessionStorage.setItem('confirmedBean', JSON.stringify(finalBean))

    // Run deterministic method recommendation client-side
    const recs = recommendMethods(finalBean)
    sessionStorage.setItem('methodRecommendations', JSON.stringify(recs))
    router.push('/methods')
  }

  if (!bean || !extraction) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto">
      <div className="h-12" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-4">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 15L7 10L12 5" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold">Coffee Analysis</h2>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-5 overflow-y-auto pb-32">
        {/* Bean identity card */}
        <div className="bg-white rounded-2xl p-4 flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl bg-[#D4C9B8] flex items-center justify-center shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="12" rx="8" ry="5" stroke="#6B5B45" strokeWidth="1.5" />
              <path d="M4 12C4 12 8 7 12 12S20 12 20 12" stroke="#6B5B45" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[#333333] text-sm">
              {bean.bean_name || 'Unknown Bean'}
            </p>
            <p className="text-xs text-[#5B5F66] mt-0.5">{bean.roaster || 'Unknown Roaster'}</p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {bean.origin ? `${bean.origin} · ` : ''}{ROAST_LABELS[bean.roast_level]} Roast
            </p>
          </div>
        </div>

        {/* Bean profile grid */}
        <div>
          <h3 className="text-xs font-semibold text-[#5B5F66] uppercase tracking-wider px-1 mb-2">Bean Profile</h3>
          <div className="grid grid-cols-2 gap-2">
            <EditableField
              label="Origin"
              value={bean.origin || ''}
              onChange={v => updateField('origin', v || undefined)}
              confidence={extraction.confidence.origin}
            />
            <EditableField
              label="Roast"
              value={ROAST_LABELS[bean.roast_level] || bean.roast_level}
              onChange={v => updateField('roast_level', v.toLowerCase().replace(' ', '-') as BeanProfile['roast_level'])}
              confidence={extraction.confidence.roast_level}
            />
            <EditableField
              label="Process"
              value={PROCESS_LABELS[bean.process] || bean.process}
              onChange={v => updateField('process', v.toLowerCase() as BeanProfile['process'])}
              confidence={extraction.confidence.process}
            />
            <EditableField
              label="Altitude"
              value={bean.altitude_masl ? `${bean.altitude_masl}m` : ''}
              onChange={v => updateField('altitude_masl', parseInt(v) || undefined)}
              confidence={extraction.confidence.altitude_masl}
            />
          </div>
        </div>

        {/* Flavor notes */}
        {(bean.tasting_notes?.length ?? 0) > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[#5B5F66] uppercase tracking-wider px-1 mb-2">Flavor Notes</h3>
            <div className="flex flex-wrap gap-2">
              {bean.tasting_notes!.map(note => (
                <span key={note} className="px-3 py-1.5 bg-white rounded-full text-xs font-medium text-[#333333] capitalize">
                  {note}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Roast date */}
        <div>
          <h3 className="text-xs font-semibold text-[#5B5F66] uppercase tracking-wider px-1 mb-2">Roast Date</h3>
          <div className="bg-white rounded-xl p-3">
            <input
              type="date"
              value={roastDate}
              onChange={e => setRoastDate(e.target.value)}
              className="w-full text-sm font-medium text-[#333333] bg-transparent outline-none"
              placeholder="Optional — leave blank for optimal window"
            />
            {!roastDate && (
              <p className="text-[10px] text-[#9CA3AF] mt-1">Assuming optimal window (8–21 days)</p>
            )}
          </div>
        </div>
      </div>

      {/* Generate button — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#F5F4F2] px-4 pt-4 pb-24 max-w-sm mx-auto">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 bg-[#333333] text-white text-sm font-semibold rounded-[14px] py-4 disabled:opacity-50"
        >
          {generating ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L10 6H15L11 9.5L12.5 15L8 12L3.5 15L5 9.5L1 6H6L8 1Z" fill="white" />
            </svg>
          )}
          Generate Recipe
        </button>
      </div>
    </div>
  )
}
