# Time-Travel Edit History

## Goal

Allow users to preview and permanently restore any past version of a recipe from the Edit History sheet.

---

## How it works

Each `ManualEditRound` will carry a full `recipe_snapshot` of `current_recipe_json` at the moment the edit was saved. Restore = PATCH the recipe with that snapshot + append a new history entry marking it as a restore.

Old entries without a snapshot show a "Restore unavailable" state — no migration needed since `feedback_history` is JSONB.

---

## Implementation checklist

### 1. Type — add `recipe_snapshot` to `ManualEditRoundSchema`

- [ ] In `src/types/recipe.ts`, add optional `recipe_snapshot` to `ManualEditRoundSchema`:
  ```ts
  export const ManualEditRoundSchema = z.object({
    type: z.enum(['manual_edit', 'auto_adjust']),
    version: z.number().int().positive(),
    edited_at: z.string(),
    changes: z.array(z.object({
      field: z.string(),
      previous_value: z.string(),
      new_value: z.string(),
    })),
    recipe_snapshot: RecipeWithAdjustmentSchema.optional(), // new
  })
  ```
  > Place after `changes`; optional so existing rounds without it remain valid.

### 2. Write path — store snapshot on manual edit save

- [ ] In `page.tsx`, in `handleSaveEdits` (around line 444), add `recipe_snapshot` to the new `ManualEditRound` object:
  ```ts
  const newEditRound: ManualEditRound = {
    type: 'manual_edit',
    version: existingManualEdits.length + 1,
    edited_at: new Date().toISOString(),
    changes,
    recipe_snapshot: updatedRecipeJson,   // new — full state after this edit
  }
  ```

### 3. Write path — store snapshot on auto-adjust

- [ ] In `src/app/recipes/[id]/auto-adjust/page.tsx`, find where the new `ManualEditRound` (type `'auto_adjust'`) is assembled and add `recipe_snapshot: adjustedRecipeJson` (or equivalent local var holding the post-adjust recipe).

### 4. State — restore flow in `page.tsx`

- [ ] Add state:
  ```ts
  const [previewSnapshot, setPreviewSnapshot] = useState<RecipeWithAdjustment | null>(null)
  const [confirmRestoreRound, setConfirmRestoreRound] = useState<ManualEditRound | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  ```

### 5. Handler — `handleRestoreVersion`

- [ ] Add an async function `handleRestoreVersion(round: ManualEditRound)`:
  ```ts
  async function handleRestoreVersion(round: ManualEditRound) {
    if (!round.recipe_snapshot || !recipe) return
    setIsRestoring(true)
    try {
      const allHistory = (recipe.feedback_history ?? []) as AnyFeedbackRound[]
      const restoreRound: ManualEditRound = {
        type: 'manual_edit',
        version: allHistory.filter(isManualEditRound).length + 1,
        edited_at: new Date().toISOString(),
        changes: [{ field: 'restored_from', previous_value: 'current', new_value: `v${round.version}` }],
        recipe_snapshot: round.recipe_snapshot,
      }
      const updatedHistory = [...allHistory, restoreRound]
      const res = await fetch(`/api/recipes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_recipe_json: round.recipe_snapshot,
          feedback_history: updatedHistory,
        }),
      })
      if (!res.ok) throw new Error('Failed to restore.')
      const saved = await res.json()
      setRecipe({ ...recipe, ...saved, current_recipe_json: round.recipe_snapshot, feedback_history: updatedHistory })
      setConfirmRestoreRound(null)
      setShowEditHistorySheet(false)
    } catch (err) {
      // surface error — reuse existing editError state or add a local one
    } finally {
      setIsRestoring(false)
    }
  }
  ```

### 6. UI — Edit History sheet: "Restore" CTA per entry

- [ ] In the Edit History sheet (`page.tsx` around line 1218), for each `edit` in `manualEditRounds`:
  - If `edit.recipe_snapshot` exists: render a `Restore` button (secondary style, small) at the bottom-right of the card
  - If no snapshot: render a muted `"Restore unavailable"` label
  - Tapping `Restore` sets `confirmRestoreRound = edit`
- [ ] Visually distinguish the "current version" card (last entry) — label it `"Current"` or suppress the Restore button since it's already the active state

### 7. UI — Restore confirmation sheet

- [ ] Add a `<ConfirmSheet>` (reuse existing component):
  ```tsx
  <ConfirmSheet
    open={confirmRestoreRound !== null}
    title="Restore this version?"
    message={`This will replace the current recipe with the state from ${edit.type === 'auto_adjust' ? 'Auto Adjusted' : `Edit v${confirmRestoreRound?.version}`}. A new history entry will be added.`}
    confirmLabel="Restore"
    loading={isRestoring}
    onConfirm={() => confirmRestoreRound && handleRestoreVersion(confirmRestoreRound)}
    onCancel={() => setConfirmRestoreRound(null)}
  />
  ```

### 8. UI — Preview (optional, v2)

> Not in scope for initial implementation. Tap-to-preview before confirming can be added later by rendering the snapshot fields inline in the history card on expansion.

---

## Out of scope

- Previewing a snapshot in a read-only view before restoring
- Restoring feedback/adjustment rounds (only manual edits and auto-adjusts are snapshotted)
- Pruning history length (no cap for now)
- Migrating existing `ManualEditRound` entries to backfill `recipe_snapshot`
