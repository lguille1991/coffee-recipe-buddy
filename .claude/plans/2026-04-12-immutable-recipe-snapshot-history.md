# Immutable Recipe Snapshot History

## Summary
- [ ] Add immutable recipe snapshots so every persisted recipe-content edit creates a new DB snapshot instead of overwriting history in place.
- [ ] Keep `recipes` as the parent record for ownership, listing, notes, image, and the currently active recipe state.
- [ ] Make Edit History a read-only snapshot browser with back/forward navigation across ordered snapshots.
- [ ] When viewing a snapshot, allow only two actions: `Save as New Recipe` or `Use This Version`.
- [ ] Keep notes as parent-level mutable metadata; notes changes do not create snapshots.

## Database
- [ ] Add a `recipe_snapshots` table with immutable fields:
- [ ] `id`
- [ ] `recipe_id`
- [ ] `user_id`
- [ ] `snapshot_index`
- [ ] `snapshot_kind`
- [ ] `snapshot_recipe_json`
- [ ] `change_summary`
- [ ] `created_at`
- [ ] optional `source_snapshot_id`
- [ ] Add `recipes.live_snapshot_id` as the single pointer to the snapshot that drives recipe detail, brew mode, and sharing.
- [ ] Keep `recipes.current_recipe_json` temporarily as a rollout compatibility mirror of `live_snapshot_id`, not the source of truth.
- [ ] Backfill one initial snapshot for every existing recipe from its current live recipe JSON.
- [ ] Set `recipes.live_snapshot_id` to the backfilled snapshot for every existing recipe.
- [ ] Add DB-level protections so snapshot rows cannot be updated, deleted, or reordered by normal app flows.
- [ ] Enforce append-only `snapshot_index` sequencing per recipe.

## Server And API
- [ ] Replace the mutable recipe save path so every persisted recipe-content mutation creates a new snapshot row and updates `recipes.live_snapshot_id`.
- [ ] Treat manual edit saves as snapshot-creating events.
- [ ] Treat auto-adjust replacements as snapshot-creating events.
- [ ] Exclude notes-only updates from snapshot creation.
- [ ] Add recipe detail reads that return:
- [ ] parent recipe metadata
- [ ] ordered snapshot metadata
- [ ] the resolved live snapshot content
- [ ] Add an action that switches `recipes.live_snapshot_id` to an existing snapshot owned by the same recipe without mutating that snapshot row.
- [ ] Add an action that clones any snapshot into a brand new recipe row and creates that new recipe’s initial snapshot.
- [ ] Update share generation so shared payloads always use the recipe’s current `live_snapshot_id`.
- [ ] Narrow request validation so clients cannot submit arbitrary snapshot payload replacements, snapshot ordering changes, or full history rewrites.
- [ ] Treat `feedback_history` as legacy/supporting metadata only where still needed; Edit History must read from snapshots instead.

## Client And UI
- [ ] Replace the current `EditHistorySheet` summary list with a snapshot viewer.
- [ ] Open the snapshot viewer on the live snapshot by default.
- [ ] Support previous/next navigation through immutable snapshots in chronological append order.
- [ ] Make snapshot navigation read-only browsing, not destructive undo/redo.
- [ ] Show clear state for `Live version` versus older snapshots.
- [ ] For non-live snapshots, surface only `Save as New Recipe` and `Use This Version`.
- [ ] Keep notes editing outside snapshot history.
- [ ] Update manual edit save flow to create snapshots instead of overwriting the in-row edit trail.
- [ ] Update auto-adjust replace flow to create snapshots instead of overwriting the in-row edit trail.
- [ ] Ensure brew mode always reads from the live snapshot.
- [ ] Ensure share flows always read from the live snapshot.

## Types And Interfaces
- [ ] Add `RecipeSnapshot` schemas and TypeScript types.
- [ ] Add snapshot summary types for history navigation.
- [ ] Extend detail payloads and select helpers to include:
- [ ] `live_snapshot_id`
- [ ] snapshot metadata
- [ ] resolved live snapshot content
- [ ] Keep `SavedRecipe` compatible during rollout while shifting history behavior to snapshots.

## Migration And Rollout
- [ ] Create a migration for the new `recipe_snapshots` table and `recipes.live_snapshot_id`.
- [ ] Backfill existing recipes with exactly one initial snapshot each.
- [ ] Keep old readers working by mirroring the live snapshot back into `recipes.current_recipe_json` during rollout.
- [ ] Update recipe detail, brew, and share reads to prefer snapshot-backed live content.
- [ ] Remove any remaining dependency on `feedback_history` for Edit History presentation.

## Tests
- [ ] Verify each existing recipe gets exactly one initial snapshot after backfill.
- [ ] Verify backfilled recipes still render correctly in detail, brew, list, and share flows.
- [ ] Verify manual edit save creates a new snapshot and advances `live_snapshot_id`.
- [ ] Verify auto-adjust replace creates a new snapshot and preserves all earlier snapshots unchanged.
- [ ] Verify notes-only updates do not create snapshots.
- [ ] Verify switching to an older snapshot changes the live recipe without mutating snapshot rows or ordering.
- [ ] Verify cloning a snapshot creates a new recipe with its own initial snapshot chain.
- [ ] Verify unauthorized users cannot read or switch another user’s snapshots.
- [ ] Verify Edit History opens on the live snapshot.
- [ ] Verify previous/next navigation traverses snapshots in stable append order.
- [ ] Verify older snapshots are read-only.
- [ ] Verify `Use This Version` updates brew mode and share to the selected live snapshot.
- [ ] Verify `Save as New Recipe` opens a new independent recipe with its own history.

## Assumptions
- [ ] “Recipe-content mutation” means any persisted change to brew parameters, grind, steps, method-derived recipe JSON, or other fields stored in the live recipe payload.
- [ ] Notes, share state, and other parent metadata are not snapshot-triggering changes.
- [ ] Users must never be able to edit, reorder, or delete snapshot history through the client or normal API paths.
- [ ] During rollout, `recipes.current_recipe_json` remains temporarily for compatibility, but all new history behavior is driven by `recipe_snapshots` plus `recipes.live_snapshot_id`.
