# Recipe Edit Mode — Guided Parameter Editing

Edit mode for saved recipes that lets users adjust parameters within valid ranges, with real-time grinder conversion and a clear audit trail.

---

## Scope

Editable fields:
| Field | Stored as | Recalculates |
|---|---|---|
| Grind (K-Ultra clicks) | `grind.k_ultra.starting_point` | All secondary grinders via `grinder-converter.ts` |
| Water temperature | `parameters.temperature_c` | Nothing |
| Coffee dose | `parameters.coffee_g` | `parameters.ratio` display + step volumes (proportional) |
| Brew time | `parameters.total_time` | Nothing |

When dose changes, step `water_poured_g` and `water_accumulated_g` values are rescaled proportionally: `new_value = old_value × (new_dose / old_dose)`, rounded to 1 decimal. `water_g` (`parameters.water_g`) is also rescaled the same way. `parameters.ratio` string is recomputed as `water_g / coffee_g` rounded to 1 decimal formatted as `"1:X.X"`.

---

## 1. Types (`src/types/recipe.ts`)

- [ ] Add `ManualEditRoundSchema`:
  ```ts
  export const ManualEditRoundSchema = z.object({
    type: z.literal('manual_edit'),
    version: z.number().int().positive(), // monotonically increasing edit count for this recipe
    edited_at: z.string(), // ISO timestamp
    changes: z.array(z.object({
      field: z.string(),
      previous_value: z.string(),
      new_value: z.string(),
    })),
  })
  export type ManualEditRound = z.infer<typeof ManualEditRoundSchema>
  ```
- [ ] Add `type: z.literal('feedback').default('feedback')` to `FeedbackRoundSchema` (backward-compatible default so existing saved rows keep working)
- [ ] Update `feedback_history` in `SavedRecipeSchema` to `z.array(z.union([FeedbackRoundSchema, ManualEditRoundSchema])).default([])`
- [ ] Update `UpdateRecipeRequestSchema.feedback_history` to the same union array type
- [ ] Add a `has_manual_edits` boolean derived field to `RecipeListItemSchema` (computed by the API, not stored in DB — derived from `feedback_history`)

---

## 2. API

### `PATCH /api/recipes/[id]` (`src/app/api/recipes/[id]/route.ts`)

- [ ] Update `feedback_history` parsing to use the new union schema
- [ ] No other changes — existing route already accepts `current_recipe_json` + `feedback_history`

### `GET /api/recipes` (`src/app/api/recipes/route.ts`)

- [ ] Add `has_manual_edits` to each item in the response: `feedback_history.some(r => r.type === 'manual_edit')`
- [ ] Update `RecipeListItemSchema` to include `has_manual_edits: z.boolean().default(false)`

### `GET /api/recipes/[id]`

- [ ] No changes needed — returns the full `SavedRecipe` including `feedback_history`, from which `has_manual_edits` can be derived client-side on the detail page

---

## 3. UI — Edit Mode (`src/app/recipes/[id]/page.tsx`)

### State

- [ ] Add `isEditing: boolean` state (default `false`)
- [ ] Add `editDraft` state initialized from `recipe.current_recipe_json` when entering edit mode:
  ```ts
  type EditDraft = {
    coffee_g: number
    temperature_display: number  // in user's temp_unit (C or F)
    total_time: string
    grind_k_ultra_clicks: number  // parsed from starting_point string
  }
  ```
- [ ] Add `editError: string | null` state for inline validation errors
- [ ] Add `isSavingEdit: boolean` state for the save button spinner

### Entering / exiting edit mode

- [ ] Add **"Edit Parameters"** button below the "Brew Again" button — same full width, secondary style (outlined, not filled). Only shown when `!isEditing`.
- [ ] On tap: set `isEditing = true`, initialize `editDraft` from `recipe.current_recipe_json`. Parse K-Ultra clicks from `grind.k_ultra.starting_point` (strip " clicks" suffix, parse int). Convert `temperature_c` to display unit using `useProfile().tempUnit`.
- [ ] Hide "Brew Again" and "Edit Parameters" buttons while `isEditing`
- [ ] **"Discard"** button: exits edit mode, resets `editDraft` and `editError` to null

### Editable Parameters section

When `isEditing`, replace the static 3×2 grid with an edit-friendly layout:

- [ ] **Coffee dose** — labeled number input (`min=1`, `max=50`, `step=0.1`). Below it, show live ratio: `water_g_preview / coffee_g_draft` → `"1:X.X"` (water_g_preview = original water_g scaled by new_dose/original_dose).
- [ ] **Temperature** — labeled number input in user's preferred unit. If `tempUnit === 'F'`: `min=140`, `max=212`, `step=1`; if `'C'`: `min=60`, `max=100`, `step=1`. Label shows unit (°C or °F).
- [ ] **Brew time** — labeled text input. Placeholder: `"e.g. 3:30"`. Accepts `m:ss` or `mm:ss`. Validated on save.
- [ ] **Water** and **Ratio** — remain read-only display tiles (water shown as the proportionally scaled preview value while dose is being edited)

### Editable Grind Settings section

When `isEditing`:

- [ ] Replace the primary grinder display with a labeled number input for K-Ultra clicks (integer, `step=1`). `min`/`max` parsed from `range_logic.final_operating_range` via `parseKUltraRange()`. Show range hint: `"Recommended: {low}–{high} clicks"` in muted text below input.
- [ ] If value is outside `[low, high]`: show amber inline warning `"Outside recommended range"` — does not block saving.
- [ ] On every change, compute all-grinder preview values via `kUltraRangeToQAir(clicks, clicks)`, `kUltraRangeToBaratza(clicks, clicks)`, `kUltraRangeToTimemoreC2(clicks, clicks)` and update secondary grinder displays live.
- [ ] If `preferredGrinder !== 'k_ultra'`: the K-Ultra input is shown as a secondary row labeled `"K-Ultra (source)"`. The preferred grinder's live-computed value is displayed prominently as a read-only preview above it.

### Save

- [ ] **"Save Changes"** primary button (full width, filled) shown at bottom while `isEditing`, alongside "Discard"
- [ ] On tap:
  1. Validate brew time — must match `/^\d+:[0-5]\d$/`. On fail: set `editError` with message `"Brew time must be in m:ss format (e.g. 3:30)"`, abort.
  2. Convert temperature back to Celsius if `tempUnit === 'F'`: `(display - 32) × 5/9`, round to nearest integer.
  3. Compute `new_water_g = round(original_water_g × new_coffee_g / original_coffee_g, 1)`.
  4. Rescale step volumes: `new_water_poured_g = round(step.water_poured_g × scale, 1)`, same for `water_accumulated_g`.
  5. Compute new ratio string: `"1:" + (new_water_g / new_coffee_g).toFixed(1)`.
  6. Rebuild all 4 grinder settings via converter functions (range strings stay the same; only `starting_point` changes).
  7. Build `ManualEditRound`: `version = existing_manual_edits.length + 1`, `edited_at = new Date().toISOString()`, `changes` = only fields whose values actually changed.
  8. If `changes` is empty: exit edit mode silently, no API call.
  9. `PATCH /api/recipes/${id}` with updated `current_recipe_json` + appended `feedback_history`.
  10. On success: update local `recipe` state, `setIsEditing(false)`.
  11. On error: set `editError = "Failed to save. Please try again."`, stay in edit mode.

### "Manually Edited" badge — detail page

- [ ] Show a small `"v{N} edited"` badge in the title row (e.g. `"v2 edited"`) when `feedback_history` contains any `ManualEditRound`. `N` = count of all adjustment rounds (feedback + manual) + 1 for the original. So: original = v1, first change (feedback or manual) = v2, etc.
- [ ] Tapping the badge opens a bottom sheet: **"Edit History"** — lists each `ManualEditRound` with its date and changed fields. Match the share sheet's visual style.

### "Edited" badge — recipe list cards (`src/app/recipes/page.tsx`)

- [ ] Read `has_manual_edits` from the list API response
- [ ] When `true`, show a small `"edited"` label on the recipe card (below the method name, same muted style as secondary text) so users know the AI-generated recipe has been manually customized

### Reset to Original

- [ ] When "Reset to Original" is triggered (in the re-brew / `/recipe` page), also strip all `manual_edit` entries from `feedback_history` before calling `PATCH`. Find and update the reset logic in `src/app/recipe/page.tsx`.

---

## 5. Rebrew flow compatibility (`src/app/recipes/[id]/page.tsx` + `src/app/recipe/page.tsx`)

> **Risk:** `handleBrewAgain` copies the full `feedback_history` (which now contains mixed `FeedbackRound | ManualEditRound` entries) into `adjustment_history` in sessionStorage. The recipe page then maps every entry assuming it's a `FeedbackRound` (accessing `.symptom`, `.variable_changed`, etc.), producing `undefined` values that fail the PATCH schema and drop manual edits.

### Fix in `handleBrewAgain` (`src/app/recipes/[id]/page.tsx`)

- [ ] Before writing to sessionStorage, split `feedback_history` by type:
  ```ts
  const feedbackRounds = (recipe.feedback_history ?? []).filter(r => !('type' in r) || r.type === 'feedback')
  const manualEdits = (recipe.feedback_history ?? []).filter(r => 'type' in r && r.type === 'manual_edit')
  sessionStorage.setItem('adjustment_history', JSON.stringify(feedbackRounds))
  sessionStorage.setItem('manual_edit_history', JSON.stringify(manualEdits))
  ```

### Fix in `handleSave` (rebrew case, `src/app/recipe/page.tsx`)

- [ ] When building the PATCH payload in the rebrew (`effectiveId`) branch, read `manual_edit_history` from sessionStorage and include it:
  ```ts
  const manualEditsRaw = sessionStorage.getItem('manual_edit_history')
  const manualEdits = manualEditsRaw ? JSON.parse(manualEditsRaw) : []
  // feedbackHistoryPayload stays as-is (built from adjustmentHistory)
  body: JSON.stringify({
    current_recipe_json: recipe,
    feedback_history: [...manualEdits, ...feedbackHistoryPayload],
  })
  ```
- [ ] On `handleReset`: also clear `manual_edit_history` from sessionStorage (so reset truly wipes all edits)

---

## 4. Out of scope

- Editing pour step action text
- Editing `water_g` directly (it's derived)
- Editing bean info or brew method
- Edit mode on the live `/recipe` page (that's the feedback flow)
- Edit mode on the public `/share/[token]` view

---

## Implementation order

1. Types — add `ManualEditRoundSchema`, update union, add `has_manual_edits` to list schema
2. API — update `PATCH` parser, add `has_manual_edits` to `GET /api/recipes` list response
3. Rebrew compatibility — fix `handleBrewAgain` split + `handleSave` merge + `handleReset` clear
4. Edit mode UI — state, enter/exit, parameters section, grind section, save logic
5. Badges — detail page badge + edit history sheet, list card badge
