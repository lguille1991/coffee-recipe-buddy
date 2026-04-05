# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run lint     # ESLint
```

Requires `ANTHROPIC_API_KEY` in `.env.local` (see `.env.example`).

## Architecture

**QAfe** is a mobile-first Next.js 16 (App Router) coffee recipe app. The user flow is linear and session-scoped:

```
/ (home) → /scan → /analysis → /methods → /recipe
```

State is passed between pages exclusively via `sessionStorage` — there is no global state manager or database in Phase 1.

| Key stored | Set by | Read by |
|---|---|---|
| `extractionResult` | `/scan` after API call | `/analysis` |
| `confirmedBean` | `/analysis` on confirm | `/methods` |
| `methodRecommendations` | `/analysis` (client-side) | `/methods` |
| `recipe` | `/methods` after API call | `/recipe` |

### API routes

- `POST /api/extract-bean` — accepts multipart form with `image` field, calls Claude with vision to extract `BeanProfile`, validates via Zod, returns `ExtractionResponse`
- `POST /api/generate-recipe` — accepts `{ method, bean }`, calls Claude to generate a `Recipe` JSON, retries up to 2× on validation failure using the same message thread

Both routes use `claude-sonnet-4-6`.

### Key lib modules

- `src/lib/method-decision-engine.ts` — pure scoring engine: takes `BeanProfile`, returns top-3 `MethodRecommendation[]` ranked by process/roast/variety/flavor/altitude rules. Runs **client-side** in `/analysis`.
- `src/lib/grinder-converter.ts` — converts K-Ultra clicks ↔ microns ↔ Q-Air settings ↔ Baratza Encore ESP clicks. K-Ultra is the primary reference; all other grinders convert through microns via piecewise-linear tables.
- `src/lib/prompt-builder.ts` — builds system/user prompts for both API routes
- `src/lib/recipe-validator.ts` — validates `Recipe` JSON and builds retry prompts
- `src/lib/image-compressor.ts` — client-side image compression before upload

### Types

All domain types live in `src/types/recipe.ts` and are defined as Zod schemas with inferred TypeScript types. Supported brew methods: `v60`, `origami`, `orea_v4`, `hario_switch`, `kalita_wave`, `chemex`, `ceado_hoop`, `pulsar`, `aeropress`.

### Styling

Tailwind CSS v4 with no custom config file — configuration is inline via CSS variables. Fixed palette: `#333333` (primary), `#5B5F66` / `#6B6B6B` (secondary text), `#F5F4F2` (background), `#E1E2E5` (borders). All screens are `max-w-sm mx-auto` mobile-first.

## Phase docs

Product specs for each phase live in the repo root:

- `phase1_image_first_range_system.md` — completed
- `phase2_feedback_block9_manual_fallback.md`
- `phase3_persistence_accounts_final.md`
