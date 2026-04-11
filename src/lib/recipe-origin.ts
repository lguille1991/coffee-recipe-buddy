type ManualRecipeOriginCandidate = {
  objective?: string | null
  range_logic?: {
    base_range?: string | null
  } | null
}

export function isManualRecipeCreated(recipe: ManualRecipeOriginCandidate) {
  return recipe.objective === 'Manual recipe created without AI guidance.'
    || recipe.range_logic?.base_range === 'Manual recipe'
}
