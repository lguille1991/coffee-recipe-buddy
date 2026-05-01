import type { BeanProfile, Recipe } from '@/types/recipe'

function formatRatio(value: number): string {
  return value % 1 === 0 ? `1:${value}` : `1:${value.toFixed(1)}`
}

function chooseFourSixTemperature(bean: BeanProfile): number {
  switch (bean.roast_level) {
    case 'dark':
      return 83
    case 'medium':
    case 'medium-dark':
      return 88
    case 'light':
    case 'medium-light':
    default:
      return 94
  }
}

export function applyFourSixRecipeMode(recipe: Recipe, bean: BeanProfile): Recipe {
  const coffeeG = 20
  const waterG = 300
  const pour = 60
  const steps: Recipe['steps'] = [
    { step: 1, time: '0:00', action: 'Pour 1 (acidity/sweetness control)', water_poured_g: pour, water_accumulated_g: 60 },
    { step: 2, time: '0:45', action: 'Pour 2 (complete first 40%)', water_poured_g: pour, water_accumulated_g: 120 },
    { step: 3, time: '1:30', action: 'Pour 3 (strength control)', water_poured_g: pour, water_accumulated_g: 180 },
    { step: 4, time: '2:15', action: 'Pour 4', water_poured_g: pour, water_accumulated_g: 240 },
    { step: 5, time: '3:00', action: 'Pour 5 (finish at 300g)', water_poured_g: pour, water_accumulated_g: 300 },
  ]

  const temperature = chooseFourSixTemperature(bean)

  return {
    ...recipe,
    recipe_mode: 'four_six',
    objective: 'Tetsu Kasuya 4:6 method with 40/60 split for balance and concentration control.',
    parameters: {
      ...recipe.parameters,
      coffee_g: coffeeG,
      water_g: waterG,
      ratio: formatRatio(waterG / coffeeG),
      temperature_c: temperature,
      total_time: '3:30',
    },
    steps,
  }
}
