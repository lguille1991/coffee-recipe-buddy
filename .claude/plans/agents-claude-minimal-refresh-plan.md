# Plan: Lean, Decision-Complete Refresh of `AGENTS.md` and `CLAUDE.md`

## Summary
- Rewrite both docs to be short and high-signal while preserving every implementation-critical invariant currently encoded.
- `AGENTS.md` becomes the repo policy entrypoint; `CLAUDE.md` becomes quick-start context only.
- Remove bloat (endpoint inventories, large generated sections, deep architecture dumps) and replace with short links where context still matters.

## Authority and Precedence (Explicit)
- [ ] Set and state precedence in `AGENTS.md`:
  - `AGENTS.md` is the repo policy entrypoint for agent behavior.
  - `.agents/docs/REACT_BEST_PRACTICES.md` remains authoritative for React/Next/TypeScript/Tailwind implementation practices.
  - Repo-specific constraints in `AGENTS.md` override generic framework guidance when more specific to this codebase.
  - If a repo-specific rule in `AGENTS.md` conflicts with React/Next/TS/Tailwind guidance, `AGENTS.md` wins for this repository.
- [ ] `CLAUDE.md` must not define or duplicate normative coding rules beyond explicitly pointing to `AGENTS.md`.

## Implementation Changes
- [ ] Rewrite `AGENTS.md` into compact sections with rule bullets only:
  - Purpose and precedence model.
  - Mandatory pre-read (`.agents/docs/REACT_BEST_PRACTICES.md`).
  - Repo invariants and non-negotiables.
  - Versioning/changelog/commit-handoff requirements.
  - Plan output requirement for `.claude/plans/*.md` checklists.
- [ ] Apply this keep/drop matrix for current `AGENTS.md` rules:
  - **KEEP** Next.js local docs requirement (`node_modules/next/dist/docs/`).
  - **KEEP** Supabase SSR import boundaries (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`).
  - **KEEP** Google OAuth profile sync invariant (`profiles.display_name` sync behavior).
  - **KEEP** OpenRouter centralization and tracking-ID format invariant.
  - **KEEP** async route params requirement (`await params`).
  - **KEEP** SemVer bump policy including docs-only/test-only/dependency-only skip behavior.
  - **KEEP** final handoff requirement to include suggested commit message.
  - **KEEP** plan-output rule (store plan markdown checklist in `.claude/plans/` when planning requested).
  - **DROP/COMPRESS** long explanatory prose, repeated examples, and non-decision text.
  - **FIX** spelling/reference typo to `CHANGELOG.md`.
- [ ] Rewrite `CLAUDE.md` with deterministic output contract (no ambiguity):
  - Keep exactly:
    - one-line purpose + `@AGENTS.md` authority pointer,
    - all scripts from `package.json` (`dev`, `build`, `start`, `lint`, `test`, `test:watch`) with exact command strings,
    - env vars with explicit scope:
      - required: `OPENROUTER_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      - optional-but-documented: `NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES`, `NEXT_PUBLIC_APP_VERSION`, `OPENROUTER_APP_URL`, `NEXT_PUBLIC_APP_URL`
    - 3-5 bullets for project snapshot,
    - links to phase docs.
  - Remove explicitly:
    - API endpoint tables,
    - persistence schema deep details,
    - long architecture walkthroughs,
    - autoskills/generated inventories.

## Test and Validation Plan
- [ ] Parity checklist for `AGENTS.md`:
  - every retained invariant above appears in equivalent concise form,
  - no contradiction with `.agents/docs/REACT_BEST_PRACTICES.md`,
  - precedence model is explicit and unambiguous.
- [ ] Parity checklist for `CLAUDE.md`:
  - commands match `package.json` scripts exactly,
  - env vars align with `.env.example` plus behavior-affecting optional vars,
  - no normative coding policy appears except pointer to `AGENTS.md`,
  - phase docs are linked (not rewritten inline).
- [ ] Regression check:
  - removed sections are intentionally removed per contract,
  - both files remain concise and ASCII-only.

## Assumptions and Non-Goals
- [ ] Aggressive minimalism is preferred, but not at the cost of losing behavior-affecting constraints.
- [ ] Non-goal: rewrite phase docs or technical specs; `CLAUDE.md` should link to them.
- [ ] Any future addition must materially change implementation decisions or operator setup to be included.
