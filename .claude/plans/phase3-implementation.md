# Phase 3 — Persistence + User Accounts

Source spec: `phase3_persistence_accounts_final.md`

---

## 1. Supabase Project Setup

- [ ] Create Supabase project and note URL + anon key
- [ ] Configure Google OAuth provider in Supabase Auth dashboard
- [ ] Set JWT expiry and refresh token settings
- [ ] Create `bag-photos` Storage bucket (private, user-scoped)
- [x] Add `.env.local` variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 2. Database Schema + Migrations

- [x] Create `profiles` table: `id (uuid PK)`, `display_name (text)`, `default_volume_ml (int, default 250)`, `temp_unit (text, default 'C')`, `created_at`, `updated_at`
- [x] Create `recipes` table: `id (uuid PK)`, `user_id (uuid FK → profiles.id)`, `schema_version (int, default 1)`, `bean_info (jsonb)`, `method (text)`, `original_recipe_json (jsonb)`, `current_recipe_json (jsonb)`, `feedback_history (jsonb)`, `image_url (text, nullable)`, `created_at (timestamptz)`, `archived (bool, default false)`
- [x] Add indexes: `(user_id, created_at DESC)`, `(user_id, method)`, GIN on `bean_info`
- [x] Enable Row-Level Security on both tables
- [x] RLS policy on `profiles`: all ops restricted to `auth.uid() = id`
- [x] RLS policy on `recipes`: all ops restricted to `auth.uid() = user_id`
- [x] Trigger to auto-create `profiles` row on new auth user

> Migration SQL lives in `docs/migration_001_initial.sql` — run in Supabase SQL Editor.

---

## 3. Supabase Client Setup

- [x] Install `@supabase/supabase-js` and `@supabase/ssr`
- [x] Create `src/lib/supabase/client.ts` — browser client
- [x] Create `src/lib/supabase/server.ts` — server client (for API routes / RSC)
- [x] Create `src/lib/supabase/middleware.ts` — session refresh middleware
- [x] Wire middleware into `middleware.ts` at root for auth token refresh on every request

---

## 4. Authentication UI (`/auth`)

- [x] Create `/auth` route and page (single screen: sign-in + sign-up toggle)
- [x] Email/password sign-in form
- [x] Email/password sign-up form
- [x] Google OAuth button → Supabase OAuth redirect
- [x] Handle OAuth callback at `/auth/callback` route
- [x] Error states: invalid credentials, email already in use, OAuth failure
- [x] Mobile-first layout matching existing `max-w-sm mx-auto` style

---

## 5. Auth State + Guest Bridge

- [x] Create `src/hooks/useAuth.ts` — exposes `user`, `signOut`, loading state
- [ ] Wrap app in auth context provider (or use Supabase's built-in session listener)
- [x] Guest-to-auth bridge: hold pending in-memory recipe in client state when save is triggered unauthenticated
- [x] After successful sign-in/sign-up, auto-save the pending recipe automatically
- [x] Auth state persists across sessions via Supabase refresh token in httpOnly cookie

---

## 6. Recipe CRUD API Routes

- [x] `POST /api/recipes` — validate body via Zod, insert into `recipes`, return saved record
- [x] `GET /api/recipes` — list recipes for auth'd user; support `?method=`, `?q=`, `?page=`, `?limit=`; paginate, return cards array
- [x] `GET /api/recipes/:id` — fetch single recipe; verify ownership (RLS handles it)
- [x] `PATCH /api/recipes/:id` — update `current_recipe_json` and append round to `feedback_history`
- [x] `DELETE /api/recipes/:id` — soft-delete: set `archived = true`
- [x] All routes: return 401 if no valid session; rely on RLS for ownership

---

## 7. Profile API Routes

- [x] `GET /api/profile` — fetch profile row for auth'd user
- [x] `PATCH /api/profile` — update `display_name`, `default_volume_ml`, `temp_unit`

---

## 8. Image Upload Pipeline

- [x] Install image compression lib or reuse `src/lib/image-compressor.ts`
- [ ] Compress bag photo to ≤ 500 KB client-side before upload
- [x] Upload to `bag-photos/{user_id}/{uuid}` in Supabase Storage on recipe save (not before)
- [x] Generate signed URL on read for display in recipe cards and detail
- [x] Pass `image_url` as part of the recipe payload to `POST /api/recipes`

---

## 9. Schema Versioning Framework

- [x] Add `schema_version: 1` to every saved recipe payload
- [x] Create `src/lib/recipe-migrations.ts` — registry of transform functions keyed by version
- [x] On recipe read: check `schema_version`; apply any chained migration transforms up to current version
- [x] Migrations are pure functions (no LLM calls)

---

## 10. Save Button on Recipe Screen

- [x] Add **"Save Recipe"** button to `/recipe` screen
- [x] If guest → trigger auth flow (redirect to `/auth` with return intent)
- [x] If auth'd → call `POST /api/recipes` with full recipe payload (bean info, method, both recipe JSONs, feedback history, image)
- [x] Show "Recipe saved" toast on success
- [x] Disable button and show loading state during save

---

## 11. Home Screen — "My Recipes" Section

- [x] After auth, show **"My Recipes"** section below the scan CTA
- [x] Call `GET /api/recipes` on mount (first page, limit 20)
- [x] Recipe cards: bag thumbnail, bean name, method icon, date
- [x] Empty state: "No saved recipes yet — scan your first bag!" with scan CTA
- [x] Guest: section hidden (or replaced with sign-in prompt)

---

## 12. Recipe List — Filters + Search

- [x] Method chip filters (one per supported brew method + "All")
- [x] Search input — debounced, passes `?q=` to `GET /api/recipes`
- [x] Method filter passes `?method=` param
- [x] Pagination: "Load more" button or infinite scroll (next page on scroll)
- [x] Filter + search states combine: both params sent together

---

## 13. Saved Recipe Detail Screen (`/recipes/:id`)

- [x] Fetch recipe via `GET /api/recipes/:id`
- [x] Render full recipe card (same component as `/recipe`)
- [x] **"Brew Again"** button
- [x] **"Delete"** button → confirmation dialog → `DELETE /api/recipes/:id` → navigate to home
- [x] Back navigation to recipe list

---

## 14. Re-brew Freshness Recalculation

- [x] Create `src/lib/freshness-recalculator.ts`
- [x] On "Brew Again": read `bean_info.roast_date` from saved recipe
- [x] Calculate days-since-roast vs today; determine freshness window
- [x] Compare to `range_logic.freshness_offset` stored in recipe
- [x] If window has shifted meaningfully: recalculate freshness offset per Block 4 logic
- [x] Apply delta to grind + temp in `current_recipe_json`
- [x] Recalculate grinder conversions after grind change
- [x] If adjusted: show notice card — "This coffee is now X days post-roast. Recipe adjusted for freshness." with diff highlight
- [x] "Keep Original" option to dismiss the adjustment
- [x] Pass adjusted recipe into Phase 2 feedback flow; new feedback rounds append to `feedback_history`

---

## 15. Settings Screen (`/settings`)

- [x] Create `/settings` route and page
- [x] Fetch profile via `GET /api/profile`
- [x] Temperature unit toggle: °C / °F
- [x] Default volume input (ml)
- [x] Save → `PATCH /api/profile`
- [x] Sign-out button → `supabase.auth.signOut()` → redirect to home
- [x] Link to settings from home screen (gear icon or menu)

---

## 16. Types + Zod Schemas

- [x] Add `SavedRecipe` type matching the DB schema (with `schema_version`, `feedback_history`, `image_url`, `archived`)
- [x] Add `FeedbackRound` type: `{ round, symptom, variable_changed, previous_value, new_value }`
- [x] Add `UserProfile` type: `{ display_name, default_volume_ml, temp_unit }`
- [x] Add Zod schemas for API request/response bodies for all new endpoints

---

## Acceptance Criteria Checklist

- [ ] User can sign up with email/password and Google OAuth on mobile
- [ ] Auth state persists across sessions (refresh token)
- [ ] Saved recipe stores: bean info, method, original + current recipe JSON, feedback history, bag photo, schema version
- [ ] `range_logic` is preserved inside saved recipe JSON (always inspectable)
- [ ] Recipe list loads in < 1 s for up to 100 recipes
- [ ] Filtering by method and searching by bean/origin/roaster works
- [ ] User can delete a recipe (soft delete)
- [ ] **"Brew Again"** rechecks freshness and adjusts if the window has shifted
- [ ] Freshness adjustment on re-brew highlights what changed and why
- [ ] New feedback rounds from re-brew append to existing `feedback_history`
- [ ] Updated recipe can be saved (overwrites `current_recipe_json`)
- [ ] RLS prevents cross-user data access (verified with integration test)
- [ ] Guest users retain full Phase 1–2 without signing in
- [ ] Save-as-guest triggers auth → auto-saves after completion
- [ ] `schema_version` is present on every saved recipe
