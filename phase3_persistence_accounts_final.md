# Phase 3 — Persistence + User Accounts

## Goal

Add user identity and data persistence so users can save recipes (including the full range logic and feedback history), revisit their brewing history, and re-brew from any saved recipe.

---

## Scope

### In Scope

- Authentication (email/password + Google OAuth)
- User profile with default preferences
- Recipe saving: full recipe JSON + bean info + bag photo + range logic + feedback history
- Recipe history list with search and filter
- Re-brew: open a saved recipe and enter the Phase 2 feedback flow
- Delete / archive recipes
- Database schema and migrations (Supabase / Postgres)
- Protected API routes with Row-Level Security
- Recipe JSON schema versioning (for future-proofing)

### Out of Scope

- Community sharing or public feeds
- Multi-language support
- Personalization engine / taste profiling across recipes
- Subscription tiers
- Equipment management (adding/removing grinders or methods — future)

---

## What Gets Saved

A saved recipe stores the full context needed to understand and re-use it:

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "schema_version": 1,
  "bean_info": {
    "variety": "Gesha",
    "process": "natural",
    "origin": "Ethiopia, Guji",
    "altitude": "2000-2200 masl",
    "roast_level": "light",
    "tasting_notes": ["blueberry", "jasmine", "citrus"],
    "roaster": "Onyx Coffee Lab",
    "bean_name": "Tropical Weather",
    "roast_date": "2026-03-25"
  },
  "method": "Hario Switch",
  "original_recipe_json": { "...Phase 1 generation output..." },
  "current_recipe_json": { "...latest version after feedback adjustments..." },
  "feedback_history": [
    {
      "round": 1,
      "symptom": "too_acidic",
      "variable_changed": "grind",
      "previous_value": "82 clicks",
      "new_value": "80 clicks"
    }
  ],
  "image_url": "https://storage.supabase.co/.../bag-photo.jpg",
  "created_at": "2026-03-28T10:30:00Z",
  "archived": false
}
```

Key design decisions:
- **`original_recipe_json`** preserves the first generated recipe (before any feedback)
- **`current_recipe_json`** is the latest version the user brewed with
- **`range_logic`** is embedded inside both recipe JSONs — always available for transparency and re-calculation
- **`feedback_history`** tracks every adjustment round with exact values
- **`schema_version`** enables migration if the recipe JSON schema evolves

---

## User Flows

### Save a recipe

1. After generating (or adjusting) a recipe, user taps **"Save"**
2. If not signed in → auth flow triggers (sign up or sign in)
3. After auth, recipe is saved automatically (including bag photo if available)
4. Confirmation: "Recipe saved" toast

### Browse saved recipes

1. Home screen shows **"My Recipes"** section (after auth)
2. Cards display: bag thumbnail · bean name · method icon · date
3. Filter by method (chip filters) or search by bean/origin/roaster
4. Tap a card → full recipe detail view

### Re-brew from saved recipe

1. Open a saved recipe detail
2. Tap **"Brew Again"**
3. System checks freshness: recalculates days since `roast_date` vs today
4. If freshness window has changed significantly (e.g., was optimal, now 30+ days old):
   - Show a notice: "This coffee is now X days post-roast. The recipe has been adjusted for freshness."
   - Apply updated freshness offset (Block 4) to the saved recipe
   - Highlight what changed
5. User can now enter the Phase 2 feedback flow from this recipe
6. New feedback rounds are appended to `feedback_history`
7. User can save the updated version (overwrites `current_recipe_json`)

### Default preferences

1. User opens settings
2. Sets: temperature unit (°C / °F), default volume (ml)
3. These inform display formatting and pre-fill generation inputs

---

## Technical Breakdown

### Authentication

| Item | Details |
|---|---|
| Provider | Supabase Auth |
| Methods | Email/password + Google OAuth |
| Session | JWT via Supabase client; refresh token in httpOnly cookie |
| Guest mode | Full Phase 1–2 functionality without auth; save triggers sign-in |

### Database Schema (Postgres via Supabase)

**`profiles` table:**

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, from Supabase Auth |
| display_name | text | Optional |
| default_volume_ml | integer | Default 250 |
| temp_unit | text | `'C'` or `'F'`, default `'C'` |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto |

**`recipes` table:**

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles.id, indexed |
| schema_version | integer | Default 1; for future migrations |
| bean_info | jsonb | Extracted or manual bean metadata |
| method | text | Brewing method, indexed |
| original_recipe_json | jsonb | First generated recipe (with `range_logic`) |
| current_recipe_json | jsonb | Latest version after feedback |
| feedback_history | jsonb | Array of adjustment rounds |
| image_url | text | Nullable; bag photo in Supabase Storage |
| created_at | timestamptz | Indexed desc |
| archived | boolean | Default false |

**Indexes:**
- `(user_id, created_at DESC)` — fast list queries
- `(user_id, method)` — method filter
- GIN index on `bean_info` — full-text search on bean name, origin, roaster

**Row-Level Security:**
- All operations restricted to `auth.uid() = user_id`

### API Endpoints

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `POST /api/recipes` | POST | Required | Save a recipe |
| `GET /api/recipes` | GET | Required | List recipes (paginated, filterable) |
| `GET /api/recipes/:id` | GET | Required | Single recipe detail |
| `PATCH /api/recipes/:id` | PATCH | Required | Update `current_recipe_json` + append feedback |
| `DELETE /api/recipes/:id` | DELETE | Required | Soft-delete (archive) |
| `GET /api/profile` | GET | Required | User preferences |
| `PATCH /api/profile` | PATCH | Required | Update preferences |

**Query params for `GET /api/recipes`:**
- `?method=hario_switch` — filter by method
- `?q=ethiopia` — search bean name, origin, roaster
- `?page=1&limit=20` — pagination

### Re-brew Freshness Recalculation

When a user opens a saved recipe to re-brew:

1. Read `bean_info.roast_date` from saved recipe
2. Calculate current freshness window (days since roast vs today)
3. Compare to the freshness used in `range_logic.freshness_offset`
4. If the window has shifted (e.g., optimal → older):
   - Recalculate freshness offset per Block 4
   - Apply the delta to `current_recipe_json` grind and temp
   - Recalculate grinder conversions
   - Show the user what changed and why
5. If no meaningful change → use recipe as-is

This runs **client-side or server-side** using the same range system logic.

### Image Storage

- Supabase Storage bucket: `bag-photos` (private, user-scoped)
- Upload on save (not before — no orphaned images)
- Compress to ≤ 500 KB before upload
- Signed URL generated on read for display

### Schema Versioning

Every saved recipe includes `schema_version`. If the recipe JSON schema changes in future phases:

1. New recipes get the new version number
2. On read, check version → apply migration transform if needed
3. Migration transforms are lightweight functions, not LLM calls

---

## Frontend Changes

| Component | Details |
|---|---|
| Auth screens | Sign in / sign up — single screen, minimal, mobile-first |
| Home screen | "My Recipes" section below scan CTA (after auth) |
| Recipe list | Cards: bag thumbnail · bean name · method icon · date |
| Filters | Method chip filters + search input |
| Recipe detail (saved) | Same recipe card + "Brew Again" and "Delete" actions |
| Re-brew flow | Freshness check → optional adjustment notice → feedback mode |
| Save button | On recipe card after generation; triggers auth if guest |
| Settings | Temperature unit, default volume, sign-out |
| Empty state | "No saved recipes yet — scan your first bag!" with CTA |
| Guest-to-auth | After sign-up, in-memory recipe auto-saves |

---

## Deliverables

1. **Supabase project** — auth config, schema, RLS, storage bucket, indexes
2. **Auth UI** — sign in / sign up / OAuth (mobile-first)
3. **Recipe CRUD API** — save, list, detail, update, delete
4. **Profile API** — get + update preferences
5. **Recipe list screen** — cards with thumbnails, method filter, search
6. **Saved recipe detail** — re-brew + delete actions
7. **Re-brew freshness check** — recalculate Block 4 offset on open
8. **Settings screen** — temp unit, volume default, sign-out
9. **Image upload pipeline** — compress + upload to Supabase Storage on save
10. **Schema versioning** — version field + migration framework
11. **Guest-to-auth bridge** — seamless save after sign-up

---

## Acceptance Criteria

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

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| OAuth mobile browser quirks | Use Supabase Auth UI helpers; test on real iOS Safari + Android Chrome |
| Recipe JSON schema changes | `schema_version` field + migration transforms on read |
| Freshness recalculation gives confusing results | Clear UI notice explaining what changed; "Keep original" option |
| Bag photo storage costs | Compress to ≤ 500 KB; per-user cap (e.g., 200 recipes) |
| Guest-to-auth data loss | Hold in-memory recipe in client state; auto-save after auth |
| Feedback history grows large | Cap at 3 rounds per brew session; trim old sessions on save |

---

## Estimated Effort

| Task | Estimate |
|---|---|
| Supabase setup + schema + RLS + storage + indexes | 2–3 days |
| Auth UI (email + Google OAuth) | 2–3 days |
| Recipe CRUD API (save, list, detail, update, delete) | 2–3 days |
| Recipe list + filters + search | 2–3 days |
| Saved recipe detail + re-brew action | 1–2 days |
| Re-brew freshness recalculation | 1–2 days |
| Profile / settings screen | 1 day |
| Image upload on save | 1 day |
| Schema versioning framework | 0.5 days |
| Guest-to-auth bridge | 1 day |
| Integration + auth edge case testing | 2 days |
| **Total** | **~15–20 days** |
