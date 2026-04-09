# Auto-Adjust OpenRouter Model Swap With Gemini Fallback

- [ ] Update `src/app/api/recipes/[id]/auto-adjust/route.ts` so the primary OpenRouter model for the LLM branch is `google/gemma-4-31b-it:free`.
- [ ] Keep the pure-scale path unchanged so requests with empty `intent` still bypass the LLM entirely.
- [ ] Preserve the existing request schema and response shape; do not expose model selection to the client.
- [ ] Refactor the OpenRouter completion call into a small helper that accepts a model name so the same prompt/retry logic can be reused for primary and fallback runs.
- [ ] Run the current `MAX_RETRIES` loop against `google/gemma-4-31b-it:free` first.
- [ ] If the primary model run fails to produce a schema-valid recipe after retries, rerun the same loop once with fallback model `google/gemini-2.0-flash-001`.
- [ ] Treat fallback as server-side recovery for both transport/API failures and parse/validation exhaustion, so the route still returns a recipe when Gemini succeeds.
- [ ] Add minimal server logging that records when the route falls back to Gemini and why, without leaking prompt or recipe payload contents.
- [ ] Bump `package.json` version from `1.4.24` to `1.4.25` because this is a patch-level behavior change.
- [ ] Update the repo docs note in `CLAUDE.md` so it no longer incorrectly states that all LLM routes use only `google/gemini-2.0-flash-001`.
- [ ] Verify with targeted tests or manual checks:
- [ ] `intent === ''` still returns deterministic scaled output with no LLM call.
- [ ] Valid intent request succeeds with Gemma and returns `recipe`.
- [ ] Malformed or invalid Gemma output triggers retry behavior before fallback.
- [ ] Primary-model failure followed by Gemini success returns `200` with a valid schema-shaped recipe.
- [ ] Both models failing still returns the existing `422` error shape with validation errors.

## Assumptions

- [ ] Fallback should happen automatically on any unsuccessful primary run, not only network exceptions.
- [ ] No env var is needed for this change; model selection remains code-owned and scoped to auto-adjust only.
- [ ] `google/gemini-2.0-flash-001` remains unchanged for the other LLM routes for now.
