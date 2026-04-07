# Recipe Edit Mode — Guided Parameter Editing

"Adjust Recipe" replaces both "Brew Again" and "Edit Parameters" on the detail page. Users edit parameters, then choose to save only or save and launch a brew session.

---

## Scope

Editable fields:
| Field | Stored as | Recalculates |
|---|---|---|
| Coffee dose | `parameters.coffee_g` | `parameters.ratio` display + step volumes (proportional to water/dose) |
| Water | `parameters.water_g` | Step volumes + `parameters.ratio` |
| Water temperature | `parameters.temperature_c` | Nothing |
| Brew time | `parameters.total_time` | Nothing |
| Grind (preferred grinder units) | `grind.k_ultra.starting_point` (via back-conversion) | All secondary grinders via `grinder-converter.ts` |

Ratio (`parameters.ratio`) is **always derived**: `ratio = "1:" + (water_g / coffee_g).toFixed(1)`. It is shown read-only.

When dose or water changes:
- Step `water_poured_g` and `water_accumulated_g` are rescaled: `new_value = round(old_value × (new_water_g / old_water_g), 1)`
- `parameters.ratio` string is recomputed from the new `water_g / coffee_g`

Grind is edited in the **preferred grinder's units**. On save, the value is back-converted to K-Ultra clicks via `grinder-converter.ts`, which becomes the new `grind.k_ultra.starting_point`. All other grinder values are then recomputed from that K-Ultra value.

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
- [ ] Add `has_manual_edits` and `has_feedback_adjustments` boolean derived fields to `RecipeListItemSchema` (computed by the API, not stored in DB — derived from `feedback_history`)

---

## 2. API

### `PATCH /api/recipes/[id]` (`src/app/api/recipes/[id]/route.ts`)

- [ ] Update `feedback_history` parsing to use the new union schema
- [ ] No other changes — existing route already accepts `current_recipe_json` + `feedback_history`

### `GET /api/recipes` (`src/app/api/recipes/route.ts`)

- [ ] Add `has_manual_edits` to each item: `feedback_history.some(r => r.type === 'manual_edit')`
- [ ] Add `has_feedback_adjustments` to each item: `feedback_history.some(r => !('type' in r) || r.type === 'feedback')`
- [ ] Update `RecipeListItemSchema` to include both: `has_manual_edits: z.boolean().default(false)`, `has_feedback_adjustments: z.boolean().default(false)`

### `GET /api/recipes/[id]`

- [ ] No changes needed — returns the full `SavedRecipe` including `feedback_history`, from which `has_manual_edits` can be derived client-side on the detail page

---

## 3. UI — Adjust Recipe Mode (`src/app/recipes/[id]/page.tsx`)

### Entry point

- [ ] Replace the existing "Brew Again" button with a single **"Adjust Recipe"** button (full width, primary style). No separate "Edit Parameters" button.
- [ ] On tap: set `isEditing = true`, initialize `editDraft` from `recipe.current_recipe_json`.

### State

- [ ] Add `isEditing: boolean` state (default `false`)
- [ ] Add `editDraft` state initialized from `recipe.current_recipe_json` when entering edit mode:
  ```ts
  type EditDraft = {
    coffee_g: number
    water_g: number
    temperature_display: number   // in user's temp_unit (C or F)
    total_time: string
    grind_preferred_value: number // clicks or rotations in preferred grinder's units
  }
  ```
- [ ] Add `editError: string | null` state for inline validation errors
- [ ] Add `isSavingEdit: boolean` state for save button spinner

### Entering / exiting edit mode

- [ ] On tap of "Adjust Recipe": set `isEditing = true`, initialize `editDraft`. Parse preferred grinder value from the stored grinder settings. Convert `temperature_c` to display unit using `useProfile().tempUnit`.
- [ ] **"Discard"** button: exits edit mode, resets `editDraft` and `editError` to null. Hide "Adjust Recipe" while `isEditing`.

### Editable Parameters section

When `isEditing`, replace the static parameter grid with an edit-friendly layout:

- [ ] **Coffee dose** — labeled number input (`min=1`, `max=50`, `step=0.1`).
- [ ] **Water** — labeled number input in grams (`min=50`, `max=1000`, `step=1`).
- [ ] **Ratio** — read-only display tile, updates live as `"1:" + (water_g / coffee_g).toFixed(1)` changes.
- [ ] **Temperature** — labeled number input in user's preferred unit. If `tempUnit === 'F'`: `min=140`, `max=212`, `step=1`; if `'C'`: `min=60`, `max=100`, `step=1`. Label shows unit (°C or °F).
- [ ] **Brew time** — labeled text input. Placeholder: `"e.g. 3:30"`. Accepts `m:ss` or `mm:ss`. Validated on save.

### Editable Grind Settings section

When `isEditing`:

- [ ] Show a labeled number input for the **preferred grinder's units** (clicks or rotations, integer, `step=1`). Label reflects the grinder name (e.g., "Timemore C2 clicks"). `min`/`max` derived from the stored `range_logic.final_operating_range` back-converted to preferred grinder units.
- [ ] Show range hint: `"Recommended: {low}–{high} {unit}"` in muted text below input.
- [ ] If value is outside the recommended range: show amber inline warning `"Outside recommended range"` — does not block saving.
- [ ] On every change, compute K-Ultra equivalent via back-conversion, then compute all-grinder preview values and update secondary grinder displays live.
- [ ] If preferred grinder is K-Ultra, behavior is the same (no back-conversion needed).

### Save actions

- [ ] **"Save"** and **"Save & Brew"** buttons shown side-by-side at the bottom while `isEditing`, alongside "Discard"
- [ ] Both buttons run the same save logic (steps 1–10 below), differing only in step 11.

On tap of either save button:
1. Validate brew time — must match `/^\d+:[0-5]\d$/`. On fail: set `editError` with message `"Brew time must be in m:ss format (e.g. 3:30)"`, abort.
2. Convert temperature back to Celsius if `tempUnit === 'F'`: `(display - 32) × 5/9`, round to nearest integer.
3. Back-convert preferred grinder value to K-Ultra clicks via `grinder-converter.ts`.
4. Rescale step volumes using `new_water_g / old_water_g` as the scale factor: `new_water_poured_g = round(step.water_poured_g × scale, 1)`, same for `water_accumulated_g`.
5. Compute ratio string: `"1:" + (new_water_g / new_coffee_g).toFixed(1)`.
6. Rebuild all 4 grinder settings from the new K-Ultra clicks value (range strings stay the same; only `starting_point` changes).
7. Build `ManualEditRound`: `version = existing_manual_edits.length + 1`, `edited_at = new Date().toISOString()`, `changes` = only fields whose values actually changed.
8. If `changes` is empty: exit edit mode silently, no API call. If "Save & Brew" was tapped, still launch the brew session.
9. `PATCH /api/recipes/${id}` with updated `current_recipe_json` + appended `feedback_history`. On error: set `editError = "Failed to save. Please try again."`, stay in edit mode.
10. On success:
    - Update local `recipe` state, `setIsEditing(false)`.
    - **"Save"**: stay on detail page.
    - **"Save & Brew"**: write sessionStorage keys and navigate to `/recipe` (same as the old `handleBrewAgain` logic).

### Badges — detail page

- [ ] Show a `"v{N} edited"` badge in the title row when `feedback_history` contains any `ManualEditRound`. `N` = total adjustment rounds (feedback + manual) + 1 for the original.
- [ ] Tapping the badge opens a bottom sheet: **"Edit History"** — lists each `ManualEditRound` with its date and changed fields. Match the share sheet's visual style.
- [ ] Show a separate `"auto-adjusted"` badge in the title row when `feedback_history` contains any `FeedbackRound` (i.e. brew-mode AI adjustments). No bottom sheet needed — it's informational only.
- [ ] Both badges can coexist if the recipe has both types.

### Badges — recipe list cards (`src/app/recipes/page.tsx`)

- [ ] Read `has_manual_edits` and `has_feedback_adjustments` from the list API response
- [ ] When `has_manual_edits` is `true`: show a small `"edited"` label on the card (below the method name, muted style)
- [ ] When `has_feedback_adjustments` is `true` (and no manual edits): show a small `"auto-adjusted"` label instead
- [ ] When both are `true`: show `"edited"` only (manual edit is the stronger signal)

---

## 4. Rebrew flow compatibility (`src/app/recipes/[id]/page.tsx` + `src/app/recipe/page.tsx`)

> **Risk:** "Save & Brew" copies the full `feedback_history` (which now contains mixed `FeedbackRound | ManualEditRound` entries) into `adjustment_history` in sessionStorage. The recipe page then maps every entry assuming it's a `FeedbackRound` (accessing `.symptom`, `.variable_changed`, etc.), producing `undefined` values that fail the PATCH schema and drop manual edits.

### Fix in the "Save & Brew" handler (`src/app/recipes/[id]/page.tsx`)

- [ ] When writing sessionStorage before navigating to `/recipe`, split by type:
  ```ts
  const feedbackRounds = (recipe.feedback_history ?? []).filter(r => !('type' in r) || r.type === 'feedback')
  const manualEdits = (recipe.feedback_history ?? []).filter(r => 'type' in r && r.type === 'manual_edit')
  sessionStorage.setItem('adjustment_history', JSON.stringify(feedbackRounds))
  sessionStorage.setItem('manual_edit_history', JSON.stringify(manualEdits))
  ```

### Fix in `handleSave` (rebrew case, `src/app/recipe/page.tsx`)

- [ ] In the `if (effectiveId)` PATCH branch, after building `feedbackHistoryPayload` from `adjustmentHistory`, merge manual edits back in:
  ```ts
  const manualEditsRaw = sessionStorage.getItem('manual_edit_history')
  const manualEdits = manualEditsRaw ? JSON.parse(manualEditsRaw) : []
  body: JSON.stringify({
    current_recipe_json: recipe,
    feedback_history: [...manualEdits, ...feedbackHistoryPayload],
  })
  ```
- [ ] On `handleReset`: add `sessionStorage.removeItem('manual_edit_history')` alongside the existing `removeItem('feedback_round')` and `removeItem('adjustment_history')` calls.

> **Note (from recent fix `a36a9c2`):** When entering rebrew mode, `lastSavedRound` is now initialized to `0` (not `-1`), so the save button is hidden until the user makes an adjustment. This is intentional and does not affect edit mode.

---

## 5. Destructive-action warnings (confirmation modals)

### Shared component

- [ ] Create `src/components/ConfirmSheet.tsx` — a reusable bottom-sheet confirmation modal with these props:
  ```ts
  interface ConfirmSheetProps {
    open: boolean
    title: string
    message: string
    confirmLabel: string
    destructive?: boolean   // red confirm button when true
    loading?: boolean       // spinner on confirm button
    onConfirm: () => void
    onCancel: () => void
  }
  ```
  Style matches the existing delete-confirm and share sheets (`rounded-t-3xl`, `bg-[var(--card)]`, same button classes). Used by all four cases below.

---

### Case A — Leave AI-generated recipe without saving (`src/app/recipe/page.tsx`)

**Trigger:** user taps the back button (`router.back()`) while `feedbackRound > lastSavedRound`.

> `lastSavedRound` starts at `-1` for a fresh AI-generated recipe and `0` for a rebrew. The existing save-button visibility already uses `feedbackRound > lastSavedRound` as its "has unsaved changes" signal — reuse the same condition here.

- [ ] Add `showLeaveConfirm: boolean` state (default `false`).
- [ ] Replace the back-button `onClick` with:
  ```ts
  onClick={() => {
    if (feedbackRound > lastSavedRound) {
      setShowLeaveConfirm(true)
    } else {
      router.back()
    }
  }}
  ```
- [ ] Render `<ConfirmSheet>` with:
  - title: `"Leave without saving?"`
  - message: `"Your recipe won't be added to your library."`
  - confirmLabel: `"Leave"`
  - destructive: `true`
  - `onConfirm`: `router.back()`
  - `onCancel`: `setShowLeaveConfirm(false)`
- [ ] No interaction with `handleSave`, `rebrewId`, `savedRecipeId` — the condition is purely about the save-button signal.

---

### Case B — Reset recipe to original (`src/app/recipe/page.tsx`)

**Trigger:** user taps any "Reset to original" / "Reset recipe to original" button.

- [ ] Add `showResetConfirm: boolean` state (default `false`).
- [ ] There are **three** reset buttons (lines ~354, ~547, ~568). Change all three `onClick` handlers from `handleReset` to `() => setShowResetConfirm(true)`.
- [ ] Render `<ConfirmSheet>` with:
  - title: `"Reset to original recipe?"`
  - message: `"This will discard all adjustments made in this session."`
  - confirmLabel: `"Reset"`
  - destructive: `true`
  - `onConfirm`: `() => { handleReset(); setShowResetConfirm(false) }`
  - `onCancel`: `() => setShowResetConfirm(false)`
- [ ] `handleReset` itself is unchanged — the modal is just a gate in front of it.

---

### Case C — Revoke share link (`src/app/recipes/[id]/page.tsx`)

**Trigger:** user taps "Revoke Link" inside the share sheet.

- [ ] Add `showRevokeConfirm: boolean` state (default `false`).
- [ ] Change the "Revoke Link" button `onClick` from `handleRevoke` to `() => setShowRevokeConfirm(true)`.
- [ ] Render `<ConfirmSheet>` with:
  - title: `"Revoke share link?"`
  - message: `"Anyone with the current link will lose access. This cannot be undone."`
  - confirmLabel: `"Revoke Link"`
  - destructive: `true`
  - loading: `revoking`
  - `onConfirm`: `handleRevoke` (existing function, already sets `revoking` and closes share sheet on success)
  - `onCancel`: `() => setShowRevokeConfirm(false)`
- [ ] On success inside `handleRevoke`, add `setShowRevokeConfirm(false)` alongside the existing `setShowShareSheet(false)`.
- [ ] `ConfirmSheet` renders above the share sheet — z-index ordering is fine since both are `z-50`; the sheet backdrop click-through is already blocked by `e.stopPropagation()` on the share sheet.

---

### Case D — Delete comment (`src/app/share/[token]/ShareRecipeClient.tsx`)

**Trigger:** user taps the trash icon on their own comment.

- [ ] Add `showDeleteCommentConfirm: boolean` state (default `false`).
- [ ] Add `pendingDeleteCommentId: string | null` state (default `null`).
- [ ] Change the trash-icon `onClick` from immediately calling `handleDeleteComment(comment.id)` to:
  ```ts
  onClick={() => {
    setPendingDeleteCommentId(comment.id)
    setShowDeleteCommentConfirm(true)
  }}
  ```
- [ ] Render `<ConfirmSheet>` with:
  - title: `"Delete comment?"`
  - message: `"This cannot be undone."`
  - confirmLabel: `"Delete"`
  - destructive: `true`
  - loading: `deletingId === pendingDeleteCommentId`
  - `onConfirm`: `async () => { await handleDeleteComment(pendingDeleteCommentId!); setShowDeleteCommentConfirm(false); setPendingDeleteCommentId(null) }`
  - `onCancel`: `() => { setShowDeleteCommentConfirm(false); setPendingDeleteCommentId(null) }`
- [ ] `handleDeleteComment` is unchanged.

---

### Case E — Edit mode: navigate away with unsaved changes (`src/app/recipes/[id]/page.tsx`)

**Trigger:** user taps the back button while `isEditing === true`.

This guard must be added **as part of the edit mode implementation** (Section 3), not before it.

- [ ] The back button already exists in the header. When `isEditing`, intercept it:
  ```ts
  onClick={() => {
    if (isEditing) {
      setShowDiscardConfirm(true)
    } else {
      router.back()
    }
  }}
  ```
- [ ] Add `showDiscardConfirm: boolean` state (default `false`).
- [ ] Render `<ConfirmSheet>` with:
  - title: `"Discard changes?"`
  - message: `"Your edits to this recipe won't be saved."`
  - confirmLabel: `"Discard"`
  - destructive: `true`
  - `onConfirm`: `() => { setIsEditing(false); setEditDraft(null); setShowDiscardConfirm(false); router.back() }`
  - `onCancel`: `() => setShowDiscardConfirm(false)`
- [ ] The explicit **"Discard"** button in the edit-mode save bar (Section 3, Save actions) also shows this confirmation before exiting edit mode — same `setShowDiscardConfirm(true)` call.

---

### Non-issues (confirmed, no modal needed)

- **Recipe deletion** — already has a confirmation sheet.
- **Feedback "Cancel" button** (dismisses symptom selector) — cancels a UI selection, not a data write. No confirmation needed.
- **Recipe cloning** — creates a new record, nothing overwritten.

---

## 6. Out of scope

- Editing pour step action text
- Editing ratio directly (it's derived from water_g / coffee_g)
- Editing bean info or brew method
- Edit mode on the live `/recipe` page (that's the feedback flow)
- Edit mode on the public `/share/[token]` view

---

## Implementation order

1. Types — add `ManualEditRoundSchema`, update union, add `has_manual_edits` + `has_feedback_adjustments` to list schema
2. API — update `PATCH` parser, add both flags to `GET /api/recipes` list response
3. Rebrew compatibility — fix "Save & Brew" split + `handleSave` merge + `handleReset` clear
4. Edit mode UI — state, enter/exit, parameters section, grind section, save logic
5. Badges — detail page badge + edit history sheet, list card badge
