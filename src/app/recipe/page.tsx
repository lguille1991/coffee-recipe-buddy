'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Recipe } from '@/types/recipe'

function ParamCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="bg-[#F5F4F2] rounded-xl p-3 flex flex-col items-start gap-1.5">
      <div className="text-[#6B6B6B]">{icon}</div>
      <p className="text-sm font-semibold text-[#333333]">{value}</p>
      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{label}</p>
    </div>
  )
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-sm font-semibold text-[#333333]">{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4 6L8 10L12 6" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export default function RecipePage() {
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('recipe')
    if (!raw) { router.replace('/'); return }
    setRecipe(JSON.parse(raw))
  }, [router])

  if (!recipe) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#333333] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const beanRaw = typeof window !== 'undefined' ? sessionStorage.getItem('confirmedBean') : null
  const bean = JSON.parse(beanRaw || '{}')

  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto">
      <div className="h-12" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 15L7 10L12 5" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold">Your Recipe</h2>
        </div>
        <button className="p-2 text-[#333333]">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 2H15C15.55 2 16 2.45 16 3V18L10 15L4 18V3C4 2.45 4.45 2 5 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-4 pb-8 overflow-y-auto">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#333333]">{recipe.display_name}</h1>
          <p className="text-sm text-[#6B6B6B] mt-0.5">
            {bean.bean_name || 'Your Coffee'}{bean.roast_level ? ` · ${bean.roast_level.charAt(0).toUpperCase() + bean.roast_level.slice(1)} Roast` : ''}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed">{recipe.objective}</p>
        </div>

        {/* Parameters */}
        <div>
          <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-2">Parameters</h3>
          <div className="grid grid-cols-3 gap-2">
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2C5.79 2 4 3.79 4 6C4 8.21 5.79 10 8 10H12V14H4V12H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={`${recipe.parameters.water_g}ml`}
              label="Water"
            />
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="11" r="3" stroke="currentColor" strokeWidth="1.2"/><path d="M8 2V5M6 8H4M12 8H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={`${recipe.parameters.coffee_g}g`}
              label="Coffee"
            />
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V6M8 6C6.34 6 5 7.34 5 9C5 10.66 6.34 12 8 12C9.66 12 11 10.66 11 9C11 7.34 9.66 6 8 6Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={`${recipe.parameters.temperature_c}°C`}
              label="Temp"
            />
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M8 5V8L10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={recipe.parameters.total_time}
              label="Brew Time"
            />
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 12L8 4L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5.5 9H10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={recipe.grind.k_ultra.starting_point}
              label="Grind"
            />
            <ParamCard
              icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M8 3V13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
              value={recipe.parameters.ratio}
              label="Ratio"
            />
          </div>
        </div>

        {/* Grinder Settings */}
        <div className="bg-white rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-3">Grind Settings</h3>

          {/* K-Ultra primary */}
          <div className="bg-[#333333] rounded-xl p-3 mb-3 text-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-white/70">1Zpresso K-Ultra</span>
              <span className="text-[10px] text-white/50 bg-white/10 px-2 py-0.5 rounded-full">Primary</span>
            </div>
            <p className="text-lg font-bold">{recipe.grind.k_ultra.starting_point}</p>
            <p className="text-xs text-white/60 mt-0.5">Range: {recipe.grind.k_ultra.range}</p>
            {recipe.grind.k_ultra.description && (
              <p className="text-xs text-white/50 mt-1 italic">{recipe.grind.k_ultra.description}</p>
            )}
          </div>

          {/* Q-Air */}
          <div className="flex items-center justify-between py-2.5 border-b border-[#F0EDE9]">
            <div>
              <p className="text-xs font-medium text-[#6B6B6B]">1Zpresso Q-Air</p>
              <p className="text-xs text-[#9CA3AF]">Range: {recipe.grind.q_air.range}</p>
            </div>
            <p className="text-sm font-semibold text-[#333333]">{recipe.grind.q_air.starting_point}</p>
          </div>

          {/* Baratza */}
          <div className="flex items-start justify-between py-2.5 gap-3">
            <div>
              <p className="text-xs font-medium text-[#6B6B6B]">Baratza Encore ESP</p>
              <p className="text-xs text-[#9CA3AF]">Range: {recipe.grind.baratza_encore_esp.range}</p>
              {recipe.grind.baratza_encore_esp.note && (
                <p className="text-[10px] text-[#9CA3AF] mt-0.5 italic">{recipe.grind.baratza_encore_esp.note}</p>
              )}
            </div>
            <p className="text-sm font-semibold text-[#333333] shrink-0">{recipe.grind.baratza_encore_esp.starting_point}</p>
          </div>
        </div>

        {/* Brew Steps */}
        <div>
          <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-2">Brew Steps</h3>
          <div className="flex flex-col gap-2">
            {recipe.steps.map(step => (
              <div key={step.step} className="bg-white rounded-2xl p-4 flex gap-3">
                <div className="w-7 h-7 rounded-full bg-[#333333] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {step.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-[#333333]">{step.time}</p>
                    <p className="text-[10px] text-[#9CA3AF]">+{step.water_poured_g}g → {step.water_accumulated_g}g</p>
                  </div>
                  <p className="text-xs text-[#6B6B6B] leading-relaxed">{step.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Adjustments */}
        <Collapsible title="Quick Adjustments">
          <div className="flex flex-col gap-2.5">
            {Object.entries(recipe.quick_adjustments).map(([key, value]) => (
              <div key={key}>
                <p className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-0.5">
                  {key.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-[#333333] leading-relaxed">{value}</p>
              </div>
            ))}
          </div>
        </Collapsible>

        {/* Range Logic */}
        <Collapsible title="How was this calculated?">
          <div className="flex flex-col gap-2">
            {[
              ['Base Range', recipe.range_logic.base_range],
              ['Process Offset', recipe.range_logic.process_offset],
              ['Roast Offset', recipe.range_logic.roast_offset],
              ['Freshness Offset', recipe.range_logic.freshness_offset],
              ['Density Offset', recipe.range_logic.density_offset],
              ['Final Range', recipe.range_logic.final_operating_range],
              ['Starting Point', recipe.range_logic.starting_point],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <p className="text-[10px] text-[#9CA3AF] shrink-0">{label}</p>
                <p className="text-[10px] text-[#333333] text-right">{value}</p>
              </div>
            ))}
            {recipe.range_logic.compressed && (
              <p className="text-[10px] text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg mt-1">
                Range was compressed to stay within the 10-click accumulation cap.
              </p>
            )}
          </div>
        </Collapsible>
      </div>
    </div>
  )
}
