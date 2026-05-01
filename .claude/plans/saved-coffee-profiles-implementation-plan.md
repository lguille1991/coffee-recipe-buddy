# Saved Coffee Profiles Implementation Plan (v2)

## Decisions Locked
- [x] Rollout scope: net-new only (no backfill from existing `recipes` or `bag-photos`)
- [x] `POST /api/recipes/from-profile` behavior: generate and persist immediately
- [x] Archive behavior: archived profiles remain visible on historical recipes but cannot be used for new generation
- [x] Upload architecture: authenticated server-side multipart upload + server-side optimization

## 1. Canonical Contract Alignment
- [x] Reuse existing canonical schemas in `src/types/recipe.ts` for all generation inputs/outputs.
- [x] Map saved profile fields into `BeanProfileSchema` keys (`bean_name`, `variety`, `roast_level`, etc.) instead of introducing alternate naming.
- [x] Restrict brewer options to `MethodIdSchema` values only (`v60`, `origami`, `orea_v4`, `hario_switch`, `kalita_wave`, `chemex`, `ceado_hoop`, `pulsar`, `aeropress`).
- [x] Restrict goals to `BrewGoalSchema` values only (`clarity`, `balanced`, `sweetness`, `body`, `forgiving`).
- [x] Reuse existing generation pipeline (`/api/generate-recipe`) and existing save pipeline semantics (`/api/recipes`) rather than creating parallel incompatible contracts.

## 2. Data Model (DB)

### 2.1 New table: `coffee_profiles`
- [x] Add columns:
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `bean_profile_json jsonb not null` (must match `BeanProfileSchema` shape)
  - `label text not null` (display name in Saved Coffees list)
  - `scan_source text not null default 'scan'` (`scan | manual | mixed`)
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - `last_used_at timestamptz`
  - `archived_at timestamptz`
- [x] Add unique constraint: `unique (id, user_id)` for composite FK ownership enforcement.
- [x] Add indexes:
  - `(user_id, created_at desc)`
  - `(user_id, last_used_at desc nulls last)`
  - partial index for active rows: `(user_id, archived_at)` where `archived_at is null`

### 2.2 New table: `coffee_profile_images`
- [x] Add columns:
  - `id uuid primary key default gen_random_uuid()`
  - `coffee_profile_id uuid not null`
  - `user_id uuid not null`
  - `storage_bucket text not null default 'coffee-bag-images'`
  - `storage_path text not null unique`
  - `mime_type text not null`
  - `width int not null`
  - `height int not null`
  - `size_bytes int not null`
  - `sha256 text`
  - `is_primary boolean not null default true`
  - `created_at timestamptz not null default now()`
- [x] Add FK `(coffee_profile_id, user_id)` -> `coffee_profiles(id, user_id)` to prevent cross-user drift.
- [x] Add partial unique index for one primary image per profile in v1:
  - `unique (coffee_profile_id) where is_primary = true`

### 2.3 Extend existing `recipes`
- [x] Add nullable linkage columns:
  - `coffee_profile_id uuid`
  - `coffee_profile_user_id uuid`
- [x] Add generation provenance column:
  - `generation_context jsonb null` with shape:
    - `{ source: 'profile', goal, water_mode, water_grams?, water_delta_grams?, method }`
- [x] Add composite FK `(coffee_profile_id, coffee_profile_user_id)` -> `coffee_profiles(id, user_id)`.
- [x] Keep immutable snapshot requirement: recipe creation still copies bean into `recipes.bean_info` and snapshot tables.

## 3. RLS + Integrity Rules
- [x] `coffee_profiles` RLS: user can CRUD only rows where `user_id = auth.uid()`.
- [x] `coffee_profile_images` RLS: user can CRUD only rows where `user_id = auth.uid()`.
- [x] `recipes` linkage writes must preserve same-owner composite FK.
- [ ] Add DB check or trigger to reject linking archived profiles for new generation if desired at DB boundary (optional), always enforce at API boundary.

## 4. Storage + Upload Lifecycle
- [ ] Create private Supabase bucket: `coffee-bag-images`.
- [x] Storage path convention:
  - `users/{user_id}/coffee-profiles/{coffee_profile_id}/{image_id}.webp`
- [x] Implement authenticated multipart route handler for profile image upload.
- [x] Server-side optimization pipeline:
  - accepted mime: `image/jpeg`, `image/png`, `image/webp` (HEIC optional only if runtime decoder support is confirmed)
  - max long edge `1600px`
  - encode `webp` quality ~80, reduce to floor (e.g. 65) to satisfy max size (e.g. 500KB)
  - strip metadata/EXIF
- [x] Insert DB metadata only after successful storage upload.
- [x] On DB insert failure after upload, delete uploaded object immediately.
- [x] On image replacement, delete old storage object after successful swap.
- [x] On profile hard delete, delete all associated storage objects then DB rows.

## 5. API Contracts (Aligned)

### 5.1 `POST /api/coffee-profiles`
- [x] Auth required.
- [x] Accept scan-derived bean payload mapped to `BeanProfileSchema` + `label`.
- [x] Create profile row.
- [x] Optional multipart image in same flow or follow-up upload endpoint.
- [x] Return `{ profile }`.

### 5.2 `GET /api/coffee-profiles`
- [x] List active profiles (`archived_at is null` by default), paginated.
- [x] Include primary image signed URL.

### 5.3 `GET /api/coffee-profiles/:id`
- [x] Return profile, image metadata/url, and recent linked recipes.

### 5.4 `PATCH /api/coffee-profiles/:id`
- [x] Update label and editable bean fields (validated through mapped `BeanProfileSchema`).

### 5.5 `POST /api/coffee-profiles/:id/archive`
- [x] Set `archived_at`.
- [x] Archived profile remains readable for history views.

### 5.6 `POST /api/recipes/from-profile`
- [x] Auth required.
- [x] Validate profile ownership and `archived_at is null`.
- [x] Validate request overrides:
  - `method` must satisfy `MethodIdSchema`
  - `goal` must satisfy `BrewGoalSchema`
  - water input supports:
    - `water_mode: 'absolute'` + `water_grams`
    - `water_mode: 'delta'` + `water_delta_grams`
- [x] Build generation request by combining profile `bean_profile_json` and override inputs.
- [x] Call existing generation logic.
- [x] Persist immediately as recipe via existing save semantics, including snapshots.
- [x] Set recipe linkage (`coffee_profile_id`, `coffee_profile_user_id`) and `generation_context`.
- [x] Update profile `last_used_at`.

## 6. UI Scope (v1)
- [x] Saved Coffees list page with thumbnail, label, roaster, roast level, last used.
- [x] Profile detail view with image + bean data + Generate form.
- [x] Generate form fields:
  - method selector (from canonical method list)
  - goal selector (from canonical goal list)
  - water mode + numeric input
- [x] Scan completion flow includes save confirmation/edit step.
- [x] Archive action available from profile detail.
- [x] Prevent generation from archived profiles with explicit user message.

## 7. Migration + Rollout
- [x] Net-new only: do not backfill old recipes/images.
- [x] Add migrations for tables, indexes, FKs, RLS, and `recipes` new columns.
- [x] Add feature gating only if project already has an existing mechanism; otherwise ship behind environment flag check in routes/UI.
- [ ] Roll out to staging first, then production.

## 8. Test Matrix (Implementation-Blocking)
 - [x] Auth:
  - unauthorized profile CRUD denied
  - cross-user profile/image/recipe linkage denied
 - [x] Generation:
  - from-profile generation succeeds and persists snapshot chain
  - archived profile generation blocked
 - [x] Provenance:
  - `recipes.bean_info` snapshot preserved
  - `generation_context` accurately stores `water_mode` and values
- [x] Storage lifecycle:
  - upload success inserts metadata
  - DB failure triggers object cleanup
  - profile delete removes storage objects
- [x] Validation:
  - non-canonical method/goal rejected
  - invalid water mode combinations rejected
- [ ] Regression:
  - existing manual generation/save flow remains unchanged

## 9. Sequencing Plan
- [x] Phase 1: DB migration + RLS + composite FK integrity
- [x] Phase 2: Storage bucket + upload/optimization route + cleanup paths
- [x] Phase 3: profile CRUD APIs + list/detail UI
- [x] Phase 4: `/api/recipes/from-profile` integration with existing generation/save flow
- [ ] Phase 5: tests, staging verification, rollout

## 10. Risks + Mitigations
- [x] Risk: schema drift from existing generation types.
  - Mitigation: enforce mapping layer + zod validation against canonical schemas.
- [x] Risk: orphaned storage objects.
  - Mitigation: explicit cleanup on failure/replacement/delete.
- [x] Risk: ownership mismatch across linked tables.
  - Mitigation: composite FK `(id, user_id)` pattern plus RLS.

## 11. Acceptance Criteria
- [ ] Users can save scanned coffee as reusable profile with optimized image.
- [ ] Users can revisit saved profile and generate recipe immediately with new method/goal/water overrides.
- [ ] Generated recipes preserve immutable bean snapshot + provenance context.
- [ ] Archived profiles remain visible historically and cannot generate new recipes.
- [ ] No regressions in existing recipe generation and save flows.
