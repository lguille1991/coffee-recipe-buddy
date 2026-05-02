# Hard Delete Investigation: Recipes and Coffee Profiles

## Scope
Assess pros/cons of implementing hard deletion for:
- `recipes`
- `coffee_profiles`

Based on current schema and API behavior in this repo.

## Current State Summary

### Recipes
- API delete is currently soft delete: `archived = true`.
- Reads consistently filter active rows: `.eq('archived', false)`.
- Related table links:
  - `recipe_snapshots.recipe_id -> recipes.id` with `ON DELETE CASCADE`.
  - `shared_recipes.recipe_id -> recipes.id` with `ON DELETE CASCADE`.
  - `recipes.parent_recipe_id -> recipes.id` with `ON DELETE SET NULL`.

### Coffee Profiles
- API delete is currently hard delete (`DELETE FROM coffee_profiles`).
- “Archive” path exists via `archived_at`, blocked if linked recipes exist.
- Related links:
  - `recipes.(coffee_profile_id, coffee_profile_user_id)` -> `coffee_profiles(id,user_id)` with `ON DELETE SET NULL`.
  - `coffee_profile_images` linked via FK `ON DELETE CASCADE`.

## Pros of Hard Delete

### For Recipes
- True data minimization and privacy posture (row is actually removed).
- Eliminates long-term table growth from archived rows.
- Simplifies queries by removing “active vs archived” branch logic if fully migrated.

### For Coffee Profiles
- Already partly aligned with existing behavior.
- Avoids active+archived duplicate-management complexity for old profiles.
- Keeps profile list simpler if product intent is “remove permanently”.

## Cons / Risks of Hard Delete

### For Recipes
- Immediate irreversible loss of:
  - snapshot history (`recipe_snapshots` cascades),
  - share links (`shared_recipes` cascades),
  - share comments (`recipe_comments` cascades through share token).
- UX regression risk if users expect recoverability/undo.
- Auditing/debugging loss for generation-adjustment history.

### For Coffee Profiles
- Existing API deletes storage objects first, then DB row.
- If DB delete fails after storage removal, metadata remains but binary is gone (inconsistency risk).
- Existing recipe references become null (`ON DELETE SET NULL`), which is safe structurally but may reduce explainability of historical recipes (“which bean profile was this from?”).

## Important Findings in Current Implementation

1. Recipe soft-delete is deeply assumed by list/detail/share/update routes.
2. Hard-deleting recipes would remove public share artifacts automatically (FK cascade).
3. Coffee profile delete already performs hard delete.
4. Coffee profile archive route currently counts linked recipes without filtering `archived=false`; this can block archive even when only archived recipes are linked.
5. Storage cleanup for coffee profile delete is not transactionally coupled with DB delete.

## Decision Tradeoff

### Option A: Keep Current Mixed Model (Recommended Near-Term)
- Keep recipes soft-deleted.
- Keep coffee profiles hard-deletable (plus archive path).
- Add operational safeguards around coffee profile delete.

Why:
- Lowest regression risk.
- Preserves recipe history/share continuity.
- Matches current product semantics already in code.

### Option B: Move Recipes to Hard Delete
Do this only if product explicitly wants permanent deletion semantics.

Required changes include:
- Replace archive updates with `.delete()` in recipe delete endpoints.
- Remove or redesign views/flows relying on `archived=false`.
- Explicitly communicate that delete revokes shares and removes comments/history.
- Add optional delayed hard-delete job (trash retention window) if undo is needed.

### Option C: Move Coffee Profiles to Soft Delete Only
- Use `archived_at` exclusively; disable hard-delete endpoint for users.
- Keep admin-only purge flow if needed.

Why consider:
- Better traceability for historical recipe provenance.
- Easier user recovery.

## Recommended Path

1. Do **not** hard-delete recipes by default.
2. Keep recipes soft-delete for user-facing deletes.
3. Keep coffee profile hard-delete, but harden implementation:
   - delete DB row first, then best-effort storage cleanup in background; or
   - use a compensating strategy that re-validates successful DB deletion before blob removal.
4. If permanent recipe deletion is needed for compliance, add a separate explicit “Permanently delete” flow (or scheduled purge of archived recipes after retention).

## If You Choose Full Hard Delete for Both
Minimum engineering checklist:
- Update recipe delete/bulk-delete endpoints and tests.
- Remove/adjust `archived` filtering logic in list/detail/share flows.
- Re-check share/comment UX for cascade disappearance.
- Add deletion telemetry + audit events.
- Add user-facing warnings and confirmation copy.
- Validate storage cleanup idempotency and failure recovery.

## Bottom Line
Hard delete is feasible, but for recipes it materially changes product behavior by destroying snapshots and share artifacts. For this codebase, keeping recipe soft delete and treating hard delete as an explicit secondary lifecycle step gives the best safety-to-complexity balance.
