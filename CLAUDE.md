# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run lint     # ESLint
```

Requires `OPENROUTER_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (see `.env.example`).

## Architecture

**QAfe** is a mobile-first Next.js 16 (App Router) coffee recipe app.

### User flows

```
/ (home) → /scan → /analysis → /methods → /recipe        ← image-first flow
/ (home) → /manual → /methods → /recipe                  ← manual entry flow
/recipes → /recipes/[id]                                  ← saved recipe detail
/share/[token]                                            ← public shared recipe view
/auth                                                     ← sign in / sign up
/settings                                                 ← preferences
```

### Session state (unauthenticated flow)

State is passed between pages via `sessionStorage`. No global state manager.

| Key stored | Set by | Read by |
|---|---|---|
| `extractionResult` | `/scan` after API call | `/analysis` |
| `confirmedBean` | `/analysis` on confirm | `/methods` |
| `methodRecommendations` | `/analysis` (client-side) | `/methods` |
| `recipe` | `/methods` after API call | `/recipe` |

### Persistence (Supabase)

Auth, recipe storage, and sharing all use Supabase (Postgres + Auth + Storage).

- **Auth**: email/password + Google OAuth via Supabase Auth; session via `@supabase/ssr` with httpOnly cookies
- **`recipes` table**: stores full recipe JSON (`original_recipe_json`, `current_recipe_json`), bean info, feedback history, image URL, schema version, notes, archived flag
- **`profiles` table**: display name, default volume, temperature unit preference
- **`shared_recipes` table**: public share token → snapshot JSON + owner metadata
- **`recipe_comments` table**: public comments on shared recipes (author linked to profiles)

Supabase client setup:
- `src/lib/supabase/client.ts` — browser client
- `src/lib/supabase/server.ts` — server client (for API routes and Server Components)
- `src/lib/supabase/middleware.ts` — session refresh middleware

### API routes

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/extract-bean` | No | Vision extraction of bean info from image |
| `POST /api/generate-recipe` | No | LLM recipe generation (retries up to 2×) |
| `POST /api/adjust-recipe` | No | Deterministic Block 9 feedback adjustment |
| `GET /api/recipes` | Required | List saved recipes (paginated, filterable) |
| `POST /api/recipes` | Required | Save a recipe |
| `GET /api/recipes/[id]` | Required | Single recipe detail |
| `PATCH /api/recipes/[id]` | Required | Update recipe + append feedback round |
| `POST /api/recipes/[id]/auto-adjust` | Required | Scale and/or LLM-adjust a saved recipe; pure-scale path is deterministic and recalculates all grinder settings via a per-scale click offset |
| `DELETE /api/recipes/[id]` | Required | Soft-delete (archive) |
| `GET /api/recipes/[id]/share` | Required | Get existing share token/URL |
| `POST /api/recipes/[id]/share` | Required | Create share link (idempotent) |
| `DELETE /api/recipes/[id]/share` | Required | Revoke share link |
| `GET /api/share/[token]` | No | Public snapshot for shared recipe |
| `GET /api/share/[token]/comments` | No | Paginated comments (50/page) |
| `POST /api/share/[token]/comments` | Required | Post a comment |
| `DELETE /api/share/[token]/comments/[id]` | Required | Delete own comment |
| `POST /api/share/[token]/clone` | Required | Clone a shared recipe into own library |
| `GET /api/profile` | Required | Get user preferences |
| `PATCH /api/profile` | Required | Update preferences |

All LLM routes use `google/gemini-2.0-flash-001` via OpenRouter (OpenAI-compatible SDK, `baseURL: https://openrouter.ai/api/v1`).

### Key lib modules

- `src/lib/method-decision-engine.ts` — pure scoring engine: takes `BeanProfile`, returns top-3 `MethodRecommendation[]` ranked by process/roast/variety/flavor/altitude rules. Runs **client-side** in `/analysis`.
- `src/lib/grinder-converter.ts` — converts K-Ultra clicks ↔ microns ↔ Q-Air settings ↔ Baratza Encore ESP clicks ↔ Timemore C2 clicks. K-Ultra is the primary reference; all others convert through microns via piecewise-linear tables.
- `src/lib/adjustment-engine.ts` — Block 9 feedback rules + Block 10 conflict checks. One variable per round, clamped within `final_operating_range`. Used by `/api/adjust-recipe`.
- `src/lib/freshness-recalculator.ts` — client-side freshness recalculation on re-brew. Compares saved `freshness_offset` to today's window; applies grind/temp delta if the window has shifted.
- `src/lib/recipe-migrations.ts` — schema version migration transforms (run on read when `schema_version` is behind).
- `src/lib/prompt-builder.ts` — builds system/user prompts for both LLM API routes.
- `src/lib/recipe-validator.ts` — validates `Recipe` JSON and builds retry prompts.
- `src/lib/image-compressor.ts` — client-side image compression before upload.

### Hooks

- `src/hooks/useAuth.ts` — Supabase auth state (user, session, sign-in, sign-out)
- `src/hooks/useProfile.ts` — user profile preferences with local optimistic update
- `src/hooks/useTheme.ts` — theme preference (system/light/dark)

### Key components

- `src/components/NavGuardContext.tsx` — `NavGuardProvider` + `useNavGuard` hook. Pages call `setGuard(fn)` to register a navigation blocker (e.g. unsaved edits); `BottomNav` calls `requestNavigate(href)` so the guard can intercept. Provider is mounted in the root layout wrapping everything.

### Types

All domain types live in `src/types/recipe.ts` and are defined as Zod schemas with inferred TypeScript types. Supported brew methods: `v60`, `origami`, `orea_v4`, `hario_switch`, `kalita_wave`, `chemex`, `ceado_hoop`, `pulsar`, `aeropress`.

`total_time` accepts either a single time (`3:30`) or a range (`3:30 – 4:00`), both in `m:ss` format.

### Styling

Tailwind CSS v4 with no custom config file — configuration is inline via CSS variables. Fixed palette: `#333333` (primary), `#5B5F66` / `#6B6B6B` (secondary text), `#F5F4F2` (background), `#E1E2E5` (borders). All screens are `max-w-sm mx-auto` mobile-first.

## Phase docs

Product specs for each phase live in the repo root:

- `phase1_image_first_range_system.md` — completed
- `phase2_feedback_block9_manual_fallback.md` — completed
- `phase3_persistence_accounts_final.md` — completed (auth, recipes CRUD, sharing, comments, clone, re-brew freshness)
