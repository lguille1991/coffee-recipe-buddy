# AI Coding Rules (Repo Entry Point)

This file is the policy entrypoint for AI agents in this repo.

## Precedence
- Read `.agents/docs/REACT_BEST_PRACTICES.md` before any code change.
- That doc is authoritative for React/Next.js/TypeScript/Tailwind implementation practices.
- If a repo-specific rule in this file conflicts with generic framework guidance, this file wins for this repository.

## Repo Invariants
- Next.js guidance can differ from training data. Check relevant docs in `node_modules/next/dist/docs/` when behavior or APIs are uncertain.
- Supabase SSR only:
  - Browser: `src/lib/supabase/client.ts`
  - Server/API/RSC: `src/lib/supabase/server.ts`
  - Do not use `@supabase/auth-helpers-nextjs`.
- Auth profile sync invariant:
  - Keep `profiles.display_name` synced from Supabase auth metadata when blank, including Google OAuth flows (`src/lib/auth-profile.ts`).
- OpenRouter invariant:
  - Use shared setup in `src/lib/openrouter.ts`; do not create ad hoc clients in route handlers.
  - Preserve tracking ID format:
    - Authenticated: `crp:<display-slug>:<short-user-id>` or `crp:<short-user-id>`
    - Guest: `guest:<persistent-cookie-id>`
- Route handler params are async in this app shape. Always `await params` before destructuring.

## Change Hygiene
- Bump `package.json` version for code changes using SemVer:
  - MAJOR: breaking changes
  - MINOR: new features
  - PATCH: fixes/refinements
- Skip version bump for docs-only changes, test-only changes, and dependency updates with no behavior/API impact.
- Include user-facing updates in `CHANGELOG.md` when applicable.

## Handoff Requirements
- Include at least one concise suggested commit message in final handoff when code changes are made.

## Plan Output Requirement
- When asked to create a plan (or operating in plan mode), store it as checklist-style markdown in `.claude/plans/`.

## Code Change Workflow
- Scope:
  - Applies to requested code changes (app/runtime code, tests, configs, scripts, dependency-impacting edits).
  - Does not apply to docs-only changes unless the user explicitly asks to use this workflow.
- Step 1: Plan first, then wait.
  - Provide a detailed implementation plan and prefer the simplest viable approach.
  - Wait for explicit user approval before implementation, even outside plan mode.
  - Save the plan as checklist markdown in `.claude/plans/`.
  - Record baseline metadata in the plan before coding:
    - pre-existing dirty files,
    - task-owned files.
- Step 2: Implement after approval.
  - Implement only after approval.
  - Mark completed checklist items in the written plan.
  - Apply release hygiene before review when required (`package.json` SemVer and `CHANGELOG.md` updates).
- Step 3: Review immediately after implementation.
  - Run `review-recent-changes` (prefer skill/agent; fallback to manual findings-first review).
  - Deterministic fallback scope:
    - clean baseline: review full working-tree diff,
    - dirty baseline + task-owned file clean at baseline: review task-owned file diff only,
    - dirty baseline + task-owned file already dirty: review full current diff for that file and explicitly label mixed provenance.
  - Report findings and wait before further fixes.
- Step 4: Commit-readiness checkpoint.
  - If review has no issues, ask whether to proceed to commit-readiness validation.
  - If user manually tests and reports issues, return to Step 2 (approval before fixes), then Step 3.
- Step 5: Validate before commit recommendation.
  - Run validation only after user confirms commit readiness.
  - Prefer `test-runner` role when available in session tooling; fallback to commands.
  - Minimum command: `npm test`.
  - Additional repo gates: `npm run lint` and `npm run build`.
  - If validation passes and no blocking issues remain, provide at least one recommended commit message.
- Rework loop:
  - If review finds issues, present findings and wait for approval before fixes.
  - For each approved fix batch, update the plan checklist and refresh metadata if changed:
    - task-owned file list,
    - newly observed ambient dirty files.
  - After fixes: rerun Step 2 release hygiene check, then Step 3 review.
  - If Step 5 validation fails: report failures, request fix approval, apply fixes, then return to Step 3 before asking commit readiness again.
