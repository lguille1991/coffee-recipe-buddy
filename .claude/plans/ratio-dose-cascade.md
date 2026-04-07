# Ratio & Dose Cascade — Edit Mode Parameters

## Goal

Make `ratio` editable under the Advanced section, and establish a consistent cascade model between `ratio`, `coffee_g`, `water_g`, and steps.

---

## Cascade model

Three sources can drive changes; each cascades in a defined direction:

| User edits | Cascade |
|---|---|
| `ratio_multiplier` | keep `coffee_g` → recompute `water_g = coffee_g × ratio_multiplier` → scale steps proportionally |
| `coffee_g` | keep `ratio_multiplier` → recompute `water_g = coffee_g × ratio_multiplier` → scale steps proportionally |
| A step's `water_poured_g` (existing) | sum steps → update `water_g` → recalculate `ratio_multiplier = water_g / coffee_g` reactively |

**Step scaling rule:** `step.water_poured_g = round(step.water_poured_g / oldWater × newWater, 1)`.
The **last non-zero step** absorbs any rounding remainder to keep the sum exactly equal to `water_g`.
After scaling, call `recomputeAccumulated` to fix `water_accumulated_g` values.
Steps with `water_poured_g === 0` (wait/stir) stay at 0.

---

## `EditDraft` type change

Add `ratio_multiplier: number` — the numeric part of the ratio string (e.g. `15.5` for `"1:15.5"`).

```ts
// Before
type EditDraft = {
  coffee_g: number
  water_g: number
  temperature_display: number
  total_time: string
  grind_preferred_value: number
  steps: DraftStep[]
}

// After
type EditDraft = {
  coffee_g: number
  water_g: number
  ratio_multiplier: number        // new — numeric ratio, e.g. 15.5
  scaledFromDose: boolean         // new — true when a coffee_g cascade has run this session
  scaledFromRatio: boolean        // new — true when a ratio_multiplier cascade has run this session
  temperature_display: number
  total_time: string
  grind_preferred_value: number
  steps: DraftStep[]
}
```

---

## Implementation checklist

### 1. `EditDraft` — add new fields
- [ ] Add `ratio_multiplier`, `scaledFromDose`, `scaledFromRatio` to the `EditDraft` type
- [ ] Initialize in `enterEditMode` (or wherever `editDraft` is seeded):
  ```ts
  ratio_multiplier: r.parameters.water_g / r.parameters.coffee_g,
  scaledFromDose: false,
  scaledFromRatio: false,
  ```

### 2. Helper — `scaleStepsToWater`
- [ ] Write a pure helper `scaleStepsToWater(steps: DraftStep[], oldWater: number, newWater: number): DraftStep[]`:
  - If `oldWater === 0` or `oldWater === newWater`: return steps unchanged
  - For each step: `water_poured_g = round(step.water_poured_g / oldWater × newWater, 1)`
  - Find the last step with `water_poured_g > 0`; adjust it by the rounding remainder so steps sum to exactly `newWater`
  - Call `recomputeAccumulated` on the result before returning

### 3. `coffee_g` onChange handler — update draft only; cascade on blur
- [ ] `onChange`: update `editDraft.coffee_g` only (no cascade yet — avoids mid-keystroke rescaling)
- [ ] `onBlur`: cascade:
  ```ts
  const newCoffee = editDraft.coffee_g
  const newWater = Math.round(newCoffee * editDraft.ratio_multiplier * 10) / 10
  const newSteps = scaleStepsToWater(editDraft.steps, editDraft.water_g, newWater)
  setEditDraft(d => d ? { ...d, coffee_g: newCoffee, water_g: newWater, steps: newSteps, scaledFromDose: true } : d)
  ```

### 4. `ratio_multiplier` onChange handler — update draft only; cascade on blur
- [ ] `onChange`: update `editDraft.ratio_multiplier` only (no cascade yet)
- [ ] `onBlur`: cascade:
  ```ts
  const newRatio = editDraft.ratio_multiplier
  const newWater = Math.round(editDraft.coffee_g * newRatio * 10) / 10
  const newSteps = scaleStepsToWater(editDraft.steps, editDraft.water_g, newWater)
  setEditDraft(d => d ? { ...d, ratio_multiplier: newRatio, water_g: newWater, steps: newSteps, scaledFromRatio: true } : d)
  ```

### 5. Step `water_poured_g` onChange — keep existing logic, also update `ratio_multiplier`
- [ ] In `handleStepUpdate` (and `handleStepDelete`), after recalculating `water_g` from steps, also update `ratio_multiplier`:
  ```ts
  ratio_multiplier: totalPoured / d.coffee_g
  ```
  (Only when `d.coffee_g > 0`. Does **not** set `scaledFromDose` or `scaledFromRatio` — step edits never trigger the warning.)

### 6. UI — Advanced section
- [ ] Replace the read-only ratio display with an editable `<input type="number">`:
  - `min={1}`, `max={50}`, `step={0.1}`
  - Label: `Ratio` with `"1:"` prefix rendered outside the input (e.g. `<span>1:</span><input ...>`)
  - Value: `editDraft.ratio_multiplier`
- [ ] Keep `water_g` as a **read-only display** (it's always derived). Style same as current.
- [ ] Update the Advanced section label from `"Advanced (dose & water)"` to `"Advanced (dose & ratio)"`.

### 7. Inline warning + grind hint on cascade changes
- [ ] Derive a `cascadeWarning` from `editDraft.scaledFromDose` and `editDraft.scaledFromRatio` (computed in render, no extra state):
  ```ts
  type CascadeWarning = null | { grindHint: string | null; strength: 'strong' | 'soft' }
  ```
  Logic — evaluated after each blur cascade:
  - Neither flag set → `null`
  - `scaledFromDose` only (coffee scaled, ratio held):
    - coffee increased → `{ grindHint: 'coarser', strength: 'strong' }`
    - coffee decreased → `{ grindHint: 'finer', strength: 'strong' }`
  - `scaledFromRatio` only (water scaled, coffee held):
    - ratio increased → `{ grindHint: 'finer', strength: 'soft' }`
    - ratio decreased → `{ grindHint: 'coarser', strength: 'soft' }`
  - Both flags set → `{ grindHint: null, strength: 'strong' }` (direction ambiguous; still warn about step scaling)

  Grind hint text by strength:
  - `'strong'` → `"Consider grinding {finer|coarser}."`
  - `'soft'` → `"You may want to grind slightly {finer|coarser}."`
  - `null` → omit grind sentence entirely

- [ ] Render the warning **inside the Advanced collapsible**, below the inputs, only when `cascadeWarning !== null`:
  - Amber banner (`text-amber-*`), consistent with existing out-of-range grind warning style
  - First sentence (always): `"Step amounts were scaled proportionally."`
  - Second sentence (when `grindHint !== null`): the hint string from above
  - No dismiss button — disappears on save or when edit mode is exited

### 8. Save logic — `handleSaveEdit`
- [ ] The ratio is already recomputed at save from `water_g / coffee_g`. No change needed.
- [ ] Confirm `ratio` change tracking already works (it's derived, so it reflects in `water_g` or `coffee_g` changes).

### 9. Validation — guard edge cases
- [ ] Ensure `coffee_g > 0` before computing ratio (division by zero guard — already enforced by `min={1}`).
- [ ] Ensure `ratio_multiplier > 0` before cascading.
- [ ] Ensure `newWater >= sum of non-zero steps` at save time — or let the existing `validateSteps` handle it.

---

## Out of scope
- Making `water_g` directly editable (it's always derived)
- Changing how grind or temperature interact with dose/ratio
- Auto-adjusting LLM step descriptions when dose changes (only numeric `water_poured_g` scales)
