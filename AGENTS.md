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
- Bump `package.json` version for shipped app behavior or API changes using SemVer:
  - MAJOR: breaking changes
  - MINOR: new features
  - PATCH: fixes/refinements
- Skip version bumps for documentation, CI, test-only, and dependency-only changes with no app behavior/API impact.
- Include user-facing updates in `CHANGELOG.md` when applicable.

## Handoff Requirements
- Include at least one concise suggested commit message in final handoff when code changes are made.

## Plan Output Requirement
- For non-documentation changes, store the approval plan as checklist-style markdown in `.claude/plans/`.
- Treat new files in `.claude/plans/` as local working artifacts. Do not commit them unless the user asks, or the plan records a durable product or architectural decision; promote durable decisions to `docs/` instead when appropriate.
- Documentation-only requests need a plan file only when the user asks for one or the task is in plan mode.

## Code Change Workflow
### Scope and risk classification

- This workflow applies to app/runtime code, tests, configs, scripts, dependencies, and database changes. It does not apply to documentation-only changes unless the user explicitly requests it.
- Classify the request before editing. If it matches more than one lane, use the highest-risk lane.
  - **Low risk:** an isolated test correction, styling refinement, or localized bug fix with no API, auth, persistence, migration, OpenRouter, environment, dependency, or public-flow impact.
  - **Standard:** all other routine application changes.
  - **High risk:** auth/OAuth, authorization or RLS, public sharing, API contracts, Supabase schema or data migrations, OpenRouter behavior/tracking, environment/configuration, dependency upgrades, security, or destructive data changes.

### Plan and approval

1. Inspect the relevant code and record acceptance criteria, pre-existing dirty files, and task-owned files in the plan before coding.
2. Prefer the simplest viable approach and state the selected risk lane and targeted checks in the plan.
3. Wait for explicit implementation approval.
   - For low-risk work, this single approval also authorizes implementation, targeted validation, review, and the full validation gates when review finds no issues.
   - For standard and high-risk work, report review findings and wait before fixes; ask for commit-readiness confirmation before the full validation gates.
4. Mark completed checklist items in the written plan. Refresh its task-owned and ambient-dirty-file metadata whenever the scope changes.

### Implementation, targeted validation, and review

1. Implement only the approved scope. Apply release hygiene before review when required.
2. Run the narrowest relevant automated checks immediately after implementation, before review. Use this selection matrix in addition to directly relevant unit tests:
   - OCR or Scan-to-Analysis changes: `npm run test:ocr-profiles`; run `npm run test:e2e:ocr-ui` when the browser flow, OCR worker loading, or test-auth flow changes and its required local environment is available.
   - Route handlers, auth, Supabase, or sharing changes: run the affected route tests; for migration changes also run `src/lib/__tests__/recipe-migrations.test.ts`.
   - Client UI or interaction changes: run affected component/page tests and verify the changed browser flow when a local app session is available.
   - Dependency, build, lint, or test configuration changes: run the affected command plus the full validation gates.
3. Run `review-recent-changes` immediately after targeted validation (prefer its skill/agent; use a manual findings-first review only when unavailable).
   - clean baseline: review the full working-tree diff;
   - dirty baseline + task-owned file clean at baseline: review the task-owned file diff only;
   - dirty baseline + task-owned file already dirty: review the full current diff for that file and explicitly label it mixed provenance.
4. Report review findings. Never fix review findings or a failed validation without explicit approval. If no findings remain, follow the risk-lane approval rule above.

### High-risk safeguards

- **Migrations/data:** never edit an applied migration; add the next numbered migration (currently `014`), make it safe to deploy with the previous app version where practical, document any backfill or rollback, and review RLS, indexes, and data-loss risk.
- **Auth/OAuth and authorization:** verify both authentication and authorization server-side, preserve profile-name synchronization, and test unauthenticated, authorized, and unauthorized paths.
- **APIs/public sharing:** preserve backward-compatible request and response behavior unless a breaking change is explicitly approved; validate input, status codes, and ownership checks.
- **OpenRouter and environment changes:** preserve the shared client and tracking-ID invariant, update `.env.example` and README when user setup changes, and never expose secrets.

### Full validation and rework

1. Before a commit recommendation, run `npm test`, `npm run lint`, and `npm run build`; prefer the `test-runner` role when available.
2. If a command cannot run because its required environment is unavailable, report the exact blocked command and reason rather than treating it as passed.
3. If review finds issues or validation fails, present the result and wait for approval to fix. After an approved fix batch, repeat release hygiene, targeted validation, and review before returning to the applicable checkpoint.
4. If validation passes and no blocking issues remain, provide at least one concise suggested commit message.
