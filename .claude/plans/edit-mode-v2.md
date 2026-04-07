# Edit Mode v2 — Restricted Fields, Step Editing & Auto Adjust

This plan supersedes the editable-fields and "Save & Brew" sections of `recipe-edit-mode.md`.
The destructive-action warnings (Section 5) and badge logic from that plan are **unchanged and already implemented**.

---

## What's changing vs. the original plan

| Original | New |
|---|---|
| Coffee dose + water + temp + brew time + grind editable | Temp + grind + brew time editable; dose/water in collapsible Advanced section |
| No step editing | Steps editable (timer, description, action type, add, delete, reorder) |
| "Save & Brew" launches `/recipe` feedback flow | Separate "Brew" button kept; "Auto Adjust" is a new independent flow |

---

## 1. Editable parameters

### Primary fields (always visible in edit mode)

- **Temperature** — labeled number input
- **Brew time** — labeled text input, `m:ss` format
- **Grind** — labeled number input for preferred grinder (range hint + amber out-of-range warning)

### Advanced fields (collapsible section, collapsed by default)

Coffee dose and water are not removed — they're moved into a collapsible **"Advanced"** section below the primary fields. This keeps the common case simple without blocking the user who wants to change dose without going through Auto Adjust.

- **Coffee dose** — labeled number input (`min=1`, `max=50`, `step=0.1`)
- **Water** — labeled number input in grams (`min=50`, `max=1000`, `step=1`)
- **Ratio** — read-only derived display, updates live as dose/water change

When dose or water changes, step `water_poured_g` and `water_accumulated_g` are rescaled proportionally (existing behaviour from the original plan), **and** the accumulated values are recomputed from scratch after rescaling (see Section 2).

### `EditDraft` type (`src/app/recipes/[id]/page.tsx`)

```ts
type EditDraft = {
  temperature_display: number    // °C or °F per user pref
  total_time: string             // m:ss
  grind_preferred_value: number  // preferred grinder units
  steps: RecipeStep[]            // full step array (see Section 2)
  // advanced:
  coffee_g: number
  water_g: number
}
```

### Save logic

Unchanged from existing `handleSaveEdit` logic for temp, grind, and advanced dose/water fields.
Add step array update from `editDraft.steps` after the grinder rebuild step.
`changes` tracking: `temperature_c`, `total_time`, `grind`, `coffee_g`, `water_g`, and a compact step diff.

---

## 2. Brew step editing

Steps are part of `editDraft.steps`. Edits are serialised into `current_recipe_json.steps` on save.

### Step data shape (already in `Recipe`)

```ts
type RecipeStep = {
  step: number           // auto-renumbered on save
  action: string         // 'pour' | 'wait' | 'stir' | 'swirl' | 'other'
  description: string    // free-text label
  time: string           // "m:ss" or "+" (relative) — see existing schema
  water_poured_g: number
  water_accumulated_g: number
}
```

### UI — step list in edit mode

Replace the static step list with an editable list when `isEditing`:

- Each step row has:
  - **Drag handle** (⠿) on the left — touch-drag to reorder
  - **Action selector** — small segmented control or dropdown: `Pour` / `Wait` / `Stir` / `Swirl` / `Other`
  - **Timer field** — text input, `m:ss` format (flag invalid format inline but don't block save)
  - **Description field** — text input, max 80 chars
  - **Delete button** (trash icon) — removes step; show a confirmation if deleting would leave 0 steps

- **"+ Add Step"** button at the bottom of the step list — appends a blank step with a small type picker shown immediately:
  ```ts
  { step: steps.length + 1, action: 'pour', description: '', time: '0:00',
    water_poured_g: 0, water_accumulated_g: 0 }
  ```

- Step numbers (`step` field) are auto-renumbered 1..N on save, not on every interaction.

### `water_accumulated_g` integrity

**After every add, delete, or reorder**, recompute accumulated values in a single pass:

```ts
function recomputeAccumulated(steps: RecipeStep[]): RecipeStep[] {
  let acc = 0
  return steps.map(s => {
    acc += s.water_poured_g
    return { ...s, water_accumulated_g: Math.round(acc * 10) / 10 }
  })
}
```

Call this inside `editDraft` state updates whenever steps are mutated. This ensures the brew session's running totals remain correct even after reorders.

### Drag-and-drop implementation

Use **`@dnd-kit/core`** (add as a dependency). Native HTML5 drag events do not fire on iOS Safari, and a hand-rolled `touchmove` handler requires scroll-vs-drag disambiguation logic that is difficult to get right on a mobile-first app. `@dnd-kit/core` handles touch natively and is tree-shakeable.

Minimal setup:
- `DndContext` wraps the step list, `useSortable` on each row
- `arrayMove` from `@dnd-kit/sortable` to reorder `editDraft.steps`
- Call `recomputeAccumulated` after each reorder

### Save: step diff in ManualEditRound

Step changes are recorded compactly in `changes`:
```ts
{ field: 'steps', previous_value: '<N steps>', new_value: '<M steps>' }
```
(Not a field-by-field diff — step arrays can be large and the display is informational only.)

---

## 3. Button layout on detail page

Three actions, stacked, when not in edit mode:

```
[ Brew ]               ← primary (filled) — launches /recipe directly (existing handleBrewAgain logic)
[ Edit Recipe ]        ← secondary (outlined) — enters inline edit mode
[ Auto Adjust ]        ← ghost / muted — launches the new Auto Adjust flow
```

"Brew" remains the primary CTA. "Edit Recipe" and "Auto Adjust" are distinct secondary actions.
The existing **"Adjust Recipe"** button is renamed to **"Edit Recipe"** for clarity.

---

## 4. Auto Adjust Recipe

A separate full-screen flow for AI-assisted scaling and adaptation. It does **not** replace "Brew" or "Edit Recipe" — it is an additive feature.

### Flow overview

```
Detail page → tap "Auto Adjust" → /recipes/[id]/auto-adjust (full page)
  → user sets scale + intent → calls POST /api/recipes/[id]/auto-adjust
  → loading state → preview of generated recipe
  → "Save as New Recipe" | "Replace This Recipe" | "Discard"
  → on save: POST /api/recipes creates new linked recipe → redirect to new recipe detail
  → on replace: PATCH /api/recipes/[id] updates in place → redirect back to detail
```

### New page: `src/app/recipes/[id]/auto-adjust/page.tsx`

State:
- `scaleFactor: number` — 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 2.0 (segmented control, default 1.0)
- `intent: string` — free text, max 500 chars. Placeholder: "e.g. Make it for two people, slightly coarser for a lazy morning"
- `loading: boolean`
- `result: Recipe | null` — the generated recipe
- `saving: boolean`
- `error: string | null`

**Generate button is disabled** when `scaleFactor === 1.0` and `intent.trim() === ''`. Show a helper hint: "Change the scale or describe what you'd like to adjust."

UI structure:
1. **Header** — back button (chevron left → router.back()), title "Auto Adjust"
2. **Source recipe summary** — method + bean name, read-only pill
3. **Scale selector** — horizontal segmented control: `½×`, `¾×`, `1×`, `1¼×`, `1½×`, `2×`
4. **Intent field** — `<textarea>` with char counter (500 max)
5. **"Generate"** button (primary, full width) — disabled when nothing meaningful to send
6. **Result preview** (shown after generation):
   - Full recipe card (read-only, same component used elsewhere)
   - Three action buttons: **"Save as New"** (primary) / **"Replace"** (secondary, destructive warning) / **"Regenerate"** (ghost)
7. **Error display** inline below Generate button

### "Replace This Recipe" confirm sheet

When user taps "Replace": show a `ConfirmSheet`:
- title: `"Replace recipe?"`
- message: `"This will overwrite your current recipe. The original will still be accessible via Edit History."`
- confirmLabel: `"Replace"`
- destructive: `true`

On confirm: `PATCH /api/recipes/[id]` with `current_recipe_json = result`, append a `ManualEditRound` with `type: 'auto_adjust'` (new sub-type, see types note below), then navigate back to `/recipes/[id]`.

### New API route: `POST /api/recipes/[id]/auto-adjust`

Auth: required.

Request body:
```ts
{
  scale_factor: number   // 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 2.0
  intent: string         // free text, max 500 chars
}
```

Logic:
1. Fetch source recipe from DB (verify ownership).
2. Pre-scale numeric parameters deterministically (before sending to LLM):
   - `coffee_g = round(source.coffee_g × scale_factor, 1)`
   - `water_g = round(source.water_g × scale_factor, 1)` → ratio stays identical
   - Step `water_poured_g` and `water_accumulated_g` scaled proportionally, then `recomputeAccumulated` applied
   - Grind settings unchanged (grind doesn't scale with dose)
   - Temperature unchanged
   - `total_time` unchanged
3. If `intent` is empty and `scale_factor === 1.0`: return 400 (client should have blocked this, but guard server-side too).
4. If `intent` is empty but scale ≠ 1.0: skip LLM entirely — return the pre-scaled recipe directly. No LLM call needed for a pure scale.
5. Otherwise, build a prompt for `google/gemini-2.0-flash-001` via OpenRouter:
   - System: "You are a coffee recipe expert. Adjust the following recipe according to the user's intent. Return only valid JSON matching the Recipe schema. Keep parameters within their operating ranges."
   - User: serialised scaled recipe + intent string
   - Schema passed as a JSON Schema block (same pattern as `/api/generate-recipe`)
6. Validate response via `recipe-validator.ts`. Retry once on failure.
7. Return `{ recipe: Recipe }`.

Error responses: `400` (bad input or nothing to do), `401` (unauth), `404` (recipe not found), `500` (LLM failure after retry).

### Saving as a new linked recipe

On "Save as New", the auto-adjust page calls `POST /api/recipes` with:

```ts
{
  method: result.method,
  bean_info: source.bean_info,
  original_recipe_json: result,          // scaled result is the "original" for this new recipe
  current_recipe_json: result,
  schema_version: CURRENT_SCHEMA_VERSION,
  feedback_history: [],
  parent_recipe_id: sourceRecipeId,      // new field — links to source
  scale_factor: scaleFactor,             // new field — for display purposes
}
```

### Schema & DB changes

**`recipes` table** — two new nullable columns:

```sql
ALTER TABLE recipes ADD COLUMN parent_recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL;
ALTER TABLE recipes ADD COLUMN scale_factor numeric(4,2);
```

Migration file: `docs/migration_007_auto_adjust.sql`.

**`SavedRecipe` type** — add optional fields:
```ts
parent_recipe_id?: string | null
scale_factor?: number | null
```

**`ManualEditRound`** — extend `type` to include `'auto_adjust'`:
```ts
type: z.enum(['manual_edit', 'auto_adjust'])
```
Used when "Replace This Recipe" is chosen — records that the current version was AI-generated via Auto Adjust, not hand-edited.

**`POST /api/recipes`** route — accept and persist `parent_recipe_id` and `scale_factor`.

### Linked recipe display

On the saved recipe detail page:
- When `parent_recipe_id` is set, show a **"Scaled from"** pill/link below the method badge. Tapping navigates to `/recipes/[parent_recipe_id]`.
- Append scale factor when set and ≠ 1.0: `(×1.5)`.
- On recipe list cards: faint `"scaled"` label (same muted style as `"edited"`).

### `GET /api/recipes` list changes

- Add `is_scaled: boolean` (`parent_recipe_id IS NOT NULL`) to `RecipeListItemSchema`
- Show `"scaled"` label on list cards when `is_scaled` is true

---

## 5. Out of scope

- Editing `water_poured_g` / `water_accumulated_g` per step directly (they follow from scale or recomputeAccumulated)
- Edit mode on the live `/recipe` feedback page
- Edit mode on the public `/share/[token]` view
- Real-time recipe collaboration

---

## Implementation order

1. **Editable parameters** — move dose/water to Advanced collapsible, keep in `EditDraft`, update UI
2. **Brew step editing** — add steps to `EditDraft`, add `@dnd-kit/core` dep, build step editor with action selector + `recomputeAccumulated`
3. **Button layout** — rename "Adjust Recipe" → "Edit Recipe", add "Brew" as primary CTA, add "Auto Adjust" ghost button
4. **DB migration** — `parent_recipe_id` + `scale_factor` columns, type + schema updates
5. **Auto-adjust API route** — `POST /api/recipes/[id]/auto-adjust` with pure-scale short-circuit
6. **Auto-adjust page** — scale selector, intent field, disabled-state guard, result preview, Save/Replace/Regenerate actions
7. **Linked recipe display** — "Scaled from" pill on detail + "scaled" label on list cards

Steps 1–3 are independent of each other. Steps 4–7 are sequential.
