# CLAUDE.md

Quick operator context for this repository. Coding rules live in [AGENTS.md](/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/AGENTS.md).

## Commands
```bash
npm run dev        # next dev
npm run build      # next build
npm run start      # next start
npm run lint       # eslint
npm run test       # vitest run
npm run test:watch # vitest
```

## Environment Variables
Required:
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional but used by runtime/features:
- `NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES`
- `NEXT_PUBLIC_APP_VERSION`
- `OPENROUTER_APP_URL`
- `NEXT_PUBLIC_APP_URL`

See `.env.example` for baseline setup.

## Project Snapshot
- App: Coffee Recipe Buddy (`crp`), mobile-first Next.js App Router app.
- Core flows: scan/manual input -> analysis/method selection -> recipe session; plus saved recipes/coffees and shared recipe pages.
- Persistence/auth/sharing use Supabase (`@supabase/ssr` + Postgres/Auth/Storage).
- LLM requests run through OpenRouter via shared helper in `src/lib/openrouter.ts`.

## Product Docs
- `phase1_image_first_range_system.md`
- `phase2_feedback_block9_manual_fallback.md`
- `phase3_persistence_accounts_final.md`
