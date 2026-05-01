import type { BeanProfile, Recipe } from '@/types/recipe'
import { getMethodRatioBounds } from '@/lib/recipe-policy'

function parseTimeToSeconds(value: string): number | null {
  const match = value.match(/^(\d+):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}

function formatSecondsToTime(seconds: number): string {
  const clamped = Math.max(60, Math.min(9 * 60, Math.round(seconds)))
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatRatio(ratio: number): string {
  return ratio % 1 === 0 ? `1:${ratio}` : `1:${ratio.toFixed(1)}`
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceActionGramValue(action: string, previousValue: number, nextValue: number): string {
  if (previousValue === nextValue) return action
  const escaped = escapeForRegex(String(previousValue))
  return action.replace(new RegExp(`(?<!\\d)${escaped}g(?!\\d)`, 'g'), `${nextValue}g`)
}

function syncActionWaterMentions(
  action: string,
  previousPoured: number,
  previousAccumulated: number,
  nextPoured: number,
  nextAccumulated: number,
): string {
  let nextAction = replaceActionGramValue(action, previousPoured, nextPoured)
  nextAction = replaceActionGramValue(nextAction, previousAccumulated, nextAccumulated)
  return nextAction
}

function computeRatioOffset(bean: BeanProfile): number {
  let offset = 0

  if (bean.roast_level === 'light' || bean.roast_level === 'medium-light') offset += 0.4
  if (bean.process === 'washed') offset += 0.3
  if (bean.altitude_masl && bean.altitude_masl >= 1400) offset += 0.3

  if (bean.process === 'natural') offset -= 0.4
  if (bean.process === 'anaerobic' || bean.process === 'carbonic' || bean.process === 'thermal_shock' || bean.process === 'experimental') offset -= 0.6
  if (bean.roast_level === 'medium-dark') offset -= 0.3
  if (bean.roast_level === 'dark') offset -= 0.5

  return offset
}

function computeTimeDeltaSeconds(bean: BeanProfile): number {
  let delta = 0
  if (bean.process === 'natural') delta += 15
  if (bean.process === 'anaerobic' || bean.process === 'carbonic' || bean.process === 'thermal_shock' || bean.process === 'experimental') delta -= 20
  if (bean.roast_level === 'light') delta += 10
  if (bean.roast_level === 'dark') delta -= 15
  return delta
}

function recomputeStepsForWater(steps: Recipe['steps'], newWaterG: number): Recipe['steps'] {
  const currentWater = steps.reduce((sum, step) => sum + step.water_poured_g, 0)
  if (currentWater <= 0) return steps

  const scale = newWaterG / currentWater
  const poured = steps.map(step => Math.max(0, Math.round(step.water_poured_g * scale)))
  const sumBeforeFix = poured.reduce((sum, value) => sum + value, 0)
  const diff = newWaterG - sumBeforeFix
  poured[poured.length - 1] += diff

  let accumulated = 0
  return steps.map((step, idx) => {
    const previousPoured = step.water_poured_g
    const previousAccumulated = step.water_accumulated_g
    accumulated += poured[idx]
    return {
      ...step,
      action: syncActionWaterMentions(
        step.action,
        previousPoured,
        previousAccumulated,
        poured[idx],
        accumulated,
      ),
      water_poured_g: poured[idx],
      water_accumulated_g: accumulated,
    }
  })
}

export function applySkillBrewParameterSettings(recipe: Recipe, bean: BeanProfile): Recipe {
  const bounds = getMethodRatioBounds(recipe.method)
  const midpoint = (bounds.low + bounds.high) / 2
  const ratioNum = Math.max(bounds.low, Math.min(bounds.high, midpoint + computeRatioOffset(bean)))
  const nextRatio = formatRatio(ratioNum)

  const nextWater = Math.round(recipe.parameters.coffee_g * ratioNum)
  const nextSteps = recomputeStepsForWater(recipe.steps, nextWater)

  const currentTime = parseTimeToSeconds(recipe.parameters.total_time) ?? 180
  const nextTime = formatSecondsToTime(currentTime + computeTimeDeltaSeconds(bean))

  return {
    ...recipe,
    parameters: {
      ...recipe.parameters,
      ratio: nextRatio,
      water_g: nextWater,
      total_time: nextTime,
    },
    steps: nextSteps,
  }
}
