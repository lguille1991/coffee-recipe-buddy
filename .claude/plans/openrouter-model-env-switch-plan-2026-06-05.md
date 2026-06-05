# OpenRouter Model Env Switch Plan

## Baseline Metadata
- [x] Pre-existing dirty files: none observed at planning time
- [x] Task-owned files:
  - `.claude/plans/openrouter-model-env-switch-plan-2026-06-05.md`
  - `src/lib/openrouter-model.ts`
  - `src/lib/recipe-generation.ts`
  - `src/app/api/extract-bean/route.ts`
  - `src/app/api/recipes/[id]/auto-adjust/route.ts`
  - `src/app/api/generate-recipe/route.test.ts`
  - `src/app/api/generate-recipe/route.integration.test.ts`
  - `src/app/api/recipes/[id]/auto-adjust/route.test.ts`
  - `src/app/api/recipes/from-profile/route.test.ts`
  - `src/lib/__tests__/openrouter.test.ts` or `src/lib/__tests__/openrouter-model.test.ts`
  - `.env.example`
  - `README.md`
  - `package.json`
  - `CHANGELOG.md`

## Summary
- [x] Add centralized env-driven OpenRouter model selection so local and Vercel deployments can switch models without code edits.
- [x] Support one shared default model env var plus optional feature-specific override env vars.
- [x] Preserve current behavior by falling back to `google/gemini-2.5-flash` when no model env vars are set.

## Implementation Checklist
- [x] Add a typed selector such as `getOpenRouterModel(feature)` in a new adjacent module `src/lib/openrouter-model.ts`.
- [x] Keep `src/lib/openrouter.ts` focused on client creation, headers, and user/cookie helpers so existing `@/lib/openrouter` route mocks do not need new selector exports.
- [x] Implement precedence:
  - feature-specific env var
  - `OPENROUTER_MODEL`
  - hardcoded fallback `google/gemini-2.5-flash`
- [x] Treat empty-string env values as unset.
- [x] Read env values lazily inside `getOpenRouterModel()` on each call rather than capturing them once at module load.
- [x] Add support for these env vars:
  - `OPENROUTER_MODEL`
  - `OPENROUTER_MODEL_RECIPE_GENERATION`
  - `OPENROUTER_MODEL_BEAN_EXTRACTION`
  - `OPENROUTER_MODEL_AUTO_ADJUST`
- [x] Replace the hardcoded model string in `src/lib/recipe-generation.ts` with the shared selector so both `/api/generate-recipe` and `/api/recipes/from-profile` inherit the same behavior.
- [x] Replace hardcoded model strings in the bean extraction route with the shared selector.
- [x] Replace hardcoded model strings in the auto-adjust route with the shared selector.
- [x] Verify `/api/recipes/from-profile` continues to use `generateRecipeWithRetries()` so model selection stays centralized in the shared recipe-generation path.
- [x] Keep provider scope unchanged: OpenRouter remains the only client/provider and env values are OpenRouter model IDs only.

## Public Interfaces / Config
- [x] Keep this as env-only configuration with no app UI, database setting, or HTTP API contract change.
- [x] Use a typed internal interface based on feature keys:
  - `getOpenRouterModel('recipe_generation')`
  - `getOpenRouterModel('bean_extraction')`
  - `getOpenRouterModel('auto_adjust')`
- [x] Document inheritance behavior:
  - missing feature override inherits `OPENROUTER_MODEL`
  - missing shared default inherits the current hardcoded default

## Docs And Release Hygiene
- [x] Update `.env.example` with the new optional model env vars.
- [x] Update `README.md` with local usage and Vercel env configuration notes.
- [x] Document that changing Vercel env vars requires redeploying for the new model to take effect.
- [x] Bump `package.json` version with a SemVer minor increment for this feature.
- [x] Add a concise `CHANGELOG.md` entry describing env-based model switching.

## Test Plan
- [x] Add unit coverage for selector precedence in `src/lib/__tests__/openrouter-model.test.ts` or a small update to the existing OpenRouter test file.
- [x] Verify feature override beats shared default.
- [x] Verify shared default is used when feature override is absent.
- [x] Verify hardcoded fallback is used when all model env vars are absent.
- [x] Verify empty env values do not override.
- [x] Reset env and module state between selector tests so env mutations do not leak across cases:
  - restore `process.env` / `vi.unstubAllEnvs()`
  - use `vi.resetModules()` if any test imports the selector after env changes
- [x] Update recipe generation tests to assert the selected model passed to `client.chat.completions.create`.
- [x] Update or add `/api/recipes/from-profile` test coverage to confirm the shared recipe-generation path receives the selected recipe-generation model.
- [x] Update auto-adjust tests to assert the selected model passed to `client.chat.completions.create`.
- [x] Add bean extraction coverage for model selection, either via route test or focused route-level assertion.
- [x] Confirm no-env configuration preserves current production behavior.

## Assumptions
- [x] First version supports only OpenRouter model IDs, not provider switching.
- [x] Model switching is operational configuration only; no in-app settings page is added.
- [x] Local configuration uses `.env.local`.
- [x] Vercel configuration uses project env vars per environment as needed.
