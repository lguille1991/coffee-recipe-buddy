# Phase 4 — Grinder Preference, Dark Mode, Sharing, Recipe Editing & Notes

This plan covers five features that extend the Phase 3 foundation. They are grouped here because they share the same prerequisite (auth + saved recipes from Phase 3) and several touch the same surfaces (Settings screen, recipe card, profile API).

---

## 1. Grinder Preference

**Goal:** User picks their preferred grinder in Settings. The recipe's Grind Settings section shows that grinder as the primary card; the others appear as secondary rows.

**Current state:** ✅ Complete. Four grinders supported: K-Ultra, Q-Air, Baratza Encore ESP, Timemore C2. Conversion logic in `src/lib/grinder-converter.ts`. Q-Air corrected to rotation-based scale. Schema migrations v2 (Timemore C2) and v3 (Q-Air fix) applied to existing saved recipes via `src/lib/recipe-migrations.ts`.

### Database

- [x] Add `preferred_grinder` column to `profiles`: `text NOT NULL DEFAULT 'k_ultra'` — values: `k_ultra | q_air | baratza_encore_esp | timemore_c2`
- [x] Add migration to `docs/migration_002_grinder_preference.sql`
- [x] Add Timemore C2 to CHECK constraint — `docs/migration_003_add_timemore_c2.sql`

### API

- [x] Update `UserProfile` type in `src/types/recipe.ts` to include `preferred_grinder`
- [x] Update `GET /api/profile` response to include `preferred_grinder`
- [x] Update `PATCH /api/profile` to accept and validate `preferred_grinder`

### Settings UI (`src/app/settings/page.tsx`)

- [x] Add **Preferred Grinder** section below Temperature Unit
- [x] Four-option toggle: "1Zpresso K-Ultra" / "1Zpresso Q-Air" / "Baratza Encore ESP" / "Timemore C2"
- [x] Persist as part of the existing Save action (no separate save needed)

### Recipe Card Grind Section

- [x] Create `src/hooks/useProfile.ts` to expose `preferred_grinder` client-side
- [x] Update the Grind Settings section in the recipe card component to use `preferredGrinder`
- [x] When `primaryGrinder` is `q_air`: show Q-Air as the large primary card, others as secondary rows
- [x] When `primaryGrinder` is `baratza_encore_esp`: show Baratza as primary, others as secondary rows
- [x] When `primaryGrinder` is `timemore_c2`: show Timemore C2 as primary, others as secondary rows
- [x] Default (guests + `k_ultra`): existing layout unchanged
- [x] Apply to both the live `/recipe` page and the saved `/recipes/:id` detail page

---

## 2. Dark Mode

**Goal:** User can switch between light and dark mode in Settings. Preference persists across sessions.

**Current state:** All color references in the codebase use hardcoded hex values (e.g., `text-[#333333]`, `bg-[#F5F4F2]`). Tailwind v4 with inline CSS variable configuration in `globals.css`.

### Decision: CSS Variable Swap Strategy

Rather than adding `dark:` variants to every element, flip the CSS variables themselves under a `.dark` class on `<html>`. This is one change point and works with existing Tailwind v4 inline config.

The hex values in components must be replaced with CSS variable references (e.g., `text-[var(--foreground)]`) — this is a deliberate refactor pass, not a side-effect.

### Dark Mode Palette

| Role | Light | Dark |
|---|---|---|
| `--foreground` | `#333333` | `#F5F4F2` |
| `--background` | `#F5F4F2` | `#1A1A1A` |
| `--card` | `#FFFFFF` | `#242424` |
| `--border` | `#E1E2E5` | `#3A3A3A` |
| `--muted-foreground` | `#6B6B6B` | `#9CA3AF` |
| `--muted` | `#5B5F66` | `#8B8E94` |

### Implementation

- [x] Add `.dark { --foreground: ...; --background: ...; ... }` block to `globals.css`
- [x] Create `src/hooks/useTheme.ts`
  - Reads preference from `localStorage` (`theme: 'light' | 'dark' | 'system'`)
  - Adds/removes `dark` class on `document.documentElement`
  - Handles `prefers-color-scheme` for `system` mode
  - Exposes `theme`, `setTheme`
- [x] Create `src/components/ThemeProvider.tsx` — mounts in root layout, initializes theme before first paint (inline script in `<head>` to avoid flash)
- [x] Wire `ThemeProvider` into `src/app/layout.tsx`
- [x] Refactor pass — replace all hardcoded hex class values across all pages and components with `var(--*)` equivalents:
  - `text-[#333333]` → `text-[var(--foreground)]`
  - `bg-[#F5F4F2]` → `bg-[var(--background)]`
  - `bg-white` → `bg-[var(--card)]`
  - `border-[#E1E2E5]` → `border-[var(--border)]`
  - `text-[#6B6B6B]`, `text-[#5B5F66]` → `text-[var(--muted-foreground)]`
- [x] Add **Appearance** toggle in Settings: Light / Dark / System (3-option toggle, same style as temp unit toggle)
- [x] Preference stored in `localStorage` only — no DB column needed (avoids round-trip; matches OS expectation)

> **Scope note:** The refactor pass touches every page and component. Plan the PR accordingly — it should be one atomic change so dark mode either fully works or the PR is reverted cleanly.

---

## 3. Recipe Sharing

**Goal:** Users can share a recipe with other Brygg users via a shareable link.

### Snapshot vs. Live-Sync Decision

**Use snapshots.** Recipes are personal — they encode a specific bean's freshness at brew time, the user's feedback adjustments, and their grinder calibration. A live-synced shared recipe would silently reflect the sharer's later adjustments (e.g., a feedback round coarsening the grind), which could confuse the recipient who is brewing a different freshness window.

The sharing model is: **share a read-only snapshot → recipient views it → recipient optionally clones it into their own library to brew and adjust independently.**

### Database

- [ ] Add `shared_recipes` table to `docs/migration_004_sharing.sql`:
  ```sql
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
  owner_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  recipe_id    uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE
  snapshot_json jsonb NOT NULL          -- copy of current_recipe_json + bean_info at share time
  share_token  text UNIQUE NOT NULL     -- short random slug, e.g. nanoid(10)
  title        text                     -- optional display name set by sharer
  created_at   timestamptz DEFAULT now()
  ```
- [ ] RLS: owner can insert/delete their own rows; anyone (including unauthenticated) can `SELECT` by `share_token`

### API Routes

- [ ] `POST /api/recipes/:id/share` — auth'd; creates `shared_recipes` record, snapshots `current_recipe_json` + `bean_info`; returns `{ shareToken, url }`
- [ ] `GET /api/share/:token` — public (no auth); returns snapshot + `title` + `owner display_name`; 404 if not found
- [ ] `DELETE /api/recipes/:id/share` — auth'd; removes the share link (revokes access)
- [ ] `POST /api/share/:token/clone` — auth'd; copies snapshot into recipient's `recipes` table as a new saved recipe; `original_recipe_json` = `current_recipe_json` = snapshot; `feedback_history` = `[]`

### UI

- [ ] **Share button** on saved recipe detail (`/recipes/:id`) — opens a bottom sheet with the shareable URL and a copy-to-clipboard button
- [ ] Show "Shared" badge on recipe card and detail when a share link exists; tapping the badge re-opens the share sheet
- [ ] "Revoke link" option in the share sheet
- [ ] **Public share view** (`/share/[token]/page.tsx`) — unauthenticated-accessible
  - Renders full recipe card (read-only, no feedback or edit controls)
  - Shows sharer display name and share date
  - "Clone to my library" CTA → auth redirect if guest → auto-clone after sign-in
  - Meta tags (`og:title`, `og:description`) for link previews

---

## 4. Editing Saved Recipe Parameters

**Goal:** Users can manually edit a saved recipe's brewing parameters after saving.

### Should this exist?

Yes — Phase 2 provides guided, symptom-driven adjustments, which is the primary path. Direct editing serves experienced users who know exactly what they want to change (e.g., "I always add 2 clicks coarser for this roaster") without going through the symptom flow. The key guardrail is transparency: the app must make it obvious that a manual override has occurred and that the range system no longer guarantees the parameters.

### What's editable

| Field | Recalculates |
|---|---|
| Grind (K-Ultra clicks) | Q-Air setting, Baratza clicks (via `grinder-converter.ts`) |
| Water temperature | nothing |
| Coffee dose (g) | ratio |
| Brew time | nothing |

Pour step volumes are **not** directly editable — they follow from dose/ratio and method. If the user changes dose, they should re-brew to get updated steps, or the app recalculates them proportionally.

### Data

- No new DB columns needed. Manual edits append to `feedback_history` using a new round type:
  ```json
  { "round": 4, "type": "manual_edit", "changes": [
    { "field": "grind", "previous": "82 clicks", "new": "84 clicks" }
  ]}
  ```
- `current_recipe_json` is updated via the existing `PATCH /api/recipes/:id` route

### UI — `/recipes/:id`

- [ ] Add **"Edit Parameters"** button to the saved recipe detail (below the recipe card, alongside "Brew Again")
- [ ] Tapping enters edit mode: the Parameters section and Grind Settings section become inline-editable (numeric inputs replacing static display values)
- [ ] Grind change auto-updates the secondary grinder displays in real time (client-side via `grinder-converter.ts`)
- [ ] Dose change auto-updates the ratio display
- [ ] **"Save Changes"** button at the bottom — calls `PATCH /api/recipes/:id` with updated `current_recipe_json` and appended `feedback_history` entry
- [ ] **"Discard"** button exits edit mode without saving
- [ ] Show **"Manually edited"** badge on the recipe card when `feedback_history` contains any `type: 'manual_edit'` entry
- [ ] "Reset to Original" already exists from Phase 2 — ensure it also clears manual edits

---

## 5. Notes & Comments

### Personal notes (Phase A — implement first)

Every saved recipe can have a freeform text note for personal context ("great with oat milk", "beans were 18 days old", "ground 2 extra clicks coarser").

- [ ] Add `notes text` (nullable) column to `recipes` table → `docs/migration_004_notes.sql`
- [ ] Update `SavedRecipe` type and API:
  - `GET /api/recipes/:id` — include `notes` in response
  - `PATCH /api/recipes/:id` — accept `notes` field
- [ ] Notes textarea in saved recipe detail (`/recipes/:id`):
  - Appears below the recipe card, above action buttons
  - Placeholder: "Add notes about this brew…"
  - Auto-saves on blur (debounced `PATCH` call, no explicit save button)
  - Character limit: 1000
- [ ] Notes field included in the share snapshot (read-only in `/share/:token` view as "Sharer's notes")

### Comments on shared recipes (Phase B — plan now, implement after Phase A)

Enables conversation about a shared recipe — useful when a friend shares a recipe and you want to ask about the dose or a specific adjustment.

- [ ] Add `recipe_comments` table → `docs/migration_005_comments.sql`:
  ```sql
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  share_token   text NOT NULL REFERENCES shared_recipes(share_token) ON DELETE CASCADE
  author_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  body          text NOT NULL CHECK (length(body) <= 500)
  created_at    timestamptz DEFAULT now()
  ```
- [ ] RLS: anyone can read comments for a given `share_token`; only the `author_id` can delete their own
- [ ] `GET /api/share/:token/comments` — public; paginated, ordered by `created_at ASC`
- [ ] `POST /api/share/:token/comments` — auth'd; validates body length; inserts comment
- [ ] `DELETE /api/share/:token/comments/:id` — auth'd; only own comments
- [ ] Comments section in `/share/[token]` view — below recipe card; shows comment list + input (auth required to post, prompt to sign in otherwise)
- [ ] Comment count shown in share badge on recipe detail
- [ ] **No notifications in this scope** — polling or static load only; real-time (Supabase Realtime) is a future enhancement

---

## Implementation Order

Features are largely independent but share DB migrations. Suggested order:

1. **Grinder preference** — smallest scope, highest recipe-quality impact, no new tables
2. **Dark mode** — isolated to CSS + hooks, no backend changes; the component refactor pass is the bulk of work
3. **Personal notes (Phase A)** — one new column, very low risk
4. **Recipe editing** — builds on existing PATCH route; no new tables
5. **Recipe sharing** — new tables, new public routes, most cross-cutting UI work
6. **Comments (Phase B)** — depends on sharing being live

---

## Open Questions

| # | Question | Recommendation |
|---|---|---|
| 1 | Should `preferred_grinder` be in the DB profile or only localStorage? | DB — it should follow the user across devices. |
| 2 | Dark mode: store preference in DB profile or only localStorage? | localStorage only — avoids a blocking API call on load; no cross-device sync needed for a visual preference. |
| 3 | Should shared recipe URLs be guessable or require a direct link? | Direct link only — use a cryptographically random `share_token` (nanoid), never expose an enumerable ID. |
| 4 | Should cloning a shared recipe also copy the sharer's personal notes? | Yes — include in snapshot as "Sharer's notes" (read-only label), separate from the recipient's own notes field. |
| 5 | Should the share link expire? | Not by default. Sharer can revoke manually. Auto-expiry is a future option if spam becomes a concern. |
| 6 | Can users edit a live (not yet saved) recipe's parameters directly? | Out of scope — the Phase 2 feedback flow covers in-session adjustment. Direct editing is for saved recipes only. |
