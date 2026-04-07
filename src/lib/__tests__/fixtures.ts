import type { RecipeWithAdjustment, BeanProfile } from '@/types/recipe'

/** A minimal valid recipe fixture used across test files. */
export const BASE_RECIPE: RecipeWithAdjustment = {
  method: 'v60',
  display_name: 'Hario V60',
  objective: 'Clarity-focused pour-over',
  parameters: {
    coffee_g: 15,
    water_g: 250,
    ratio: '1:16.7',
    temperature_c: 93,
    filter: 'Hario V60 02 bleached',
    total_time: '3:00',
  },
  grind: {
    k_ultra: { range: '81–84 clicks', starting_point: '82 clicks', note: 'Start here' },
    q_air: { range: '2.5.0–2.6.0', starting_point: '2.5.2' },
    baratza_encore_esp: { range: 'clicks 17–19', starting_point: '18 clicks', note: 'Pour-over zone' },
    timemore_c2: { range: 'clicks 16–18', starting_point: '17 clicks', note: 'Pour-over zone' },
  },
  range_logic: {
    base_range: '80–86 clicks',
    process_offset: '+0 clicks',
    roast_offset: '+0 clicks',
    freshness_offset: '0 clicks',
    density_offset: '+0 clicks',
    final_operating_range: '81–84 clicks',
    compressed: false,
    starting_point: '82 clicks',
  },
  steps: [
    { step: 1, time: '0:00', action: 'Bloom', water_poured_g: 30, water_accumulated_g: 30 },
    { step: 2, time: '0:45', action: 'First pour', water_poured_g: 110, water_accumulated_g: 140 },
    { step: 3, time: '1:30', action: 'Second pour', water_poured_g: 110, water_accumulated_g: 250 },
  ],
  quick_adjustments: {
    too_acidic: 'Grind finer by 1 click',
    too_bitter: 'Grind coarser by 1 click',
    flat_or_lifeless: 'Increase temperature by 1°C',
    slow_drain: 'Grind coarser by 1 click',
    fast_drain: 'Grind finer by 1 click',
  },
}

export const WASHED_LIGHT_BEAN: BeanProfile = {
  process: 'washed',
  roast_level: 'light',
  tasting_notes: ['floral', 'citrus'],
  altitude_masl: 1900,
}

export const NATURAL_MEDIUM_BEAN: BeanProfile = {
  process: 'natural',
  roast_level: 'medium',
  tasting_notes: ['berry', 'chocolate'],
}

export const ANAEROBIC_BEAN: BeanProfile = {
  process: 'anaerobic',
  roast_level: 'medium-light',
  tasting_notes: ['wine', 'ferment'],
}
