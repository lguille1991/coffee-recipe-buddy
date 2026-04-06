# Revised Method Decision Engine — Implementation Plan

Implements the scoring model from `revised-method-decision-logic.md`.
`desired_profile` is collected as pill chips at the top of `/methods` and re-scores client-side on selection.

---

## 1. Types (`src/types/recipe.ts`)

- [ ] Add `DesiredProfile` union type: `'clarity' | 'sweetness' | 'body' | 'low_acidity' | 'balance' | 'forgiving'`
- [ ] Export `DESIRED_PROFILE_LABELS: Record<DesiredProfile, string>` display map (e.g. `low_acidity → 'Low Acidity'`)
- [ ] Add `desired_profile?: DesiredProfile` to `MethodRecommendation` schema/type so saved recs carry the preference used to produce them

---

## 2. Method decision engine (`src/lib/method-decision-engine.ts`)

Update the `recommendMethods` signature:
```ts
recommendMethods(bean: BeanProfile, desiredProfile?: DesiredProfile): MethodRecommendation[]
```

### Scoring changes

- [ ] Add `scoreDesiredProfile(scores, desiredProfile)` — table from plan §1, +4 strong / +2 good
- [ ] Update `scoreProcess()`:
  - Adjust `orea_v4` and `pulsar` placements to match plan §2
  - Add `experimental` row (same as anaerobic, plus `-1` for `v60` and `origami`)
  - Change anaerobic avoid penalty from `-2` → `-1`
- [ ] Update `scoreRoast()`:
  - Align with plan §3 weights (+3 / +1 / -1 instead of current +2 / +1 / -1)
  - Add `hario_switch` to medium-light strong match
  - Add `aeropress` and `pulsar` to medium good match
- [ ] Update `scoreFlavorNotes()`:
  - Align flavor families with plan §4 (stone fruit/berry/tropical → `pulsar, hario_switch, orea_v4`; wine-like → `pulsar, hario_switch`)
  - Add per-method accumulator and cap flavor contribution at **+4 per method**
- [ ] Update `scoreVariety()`:
  - Reduce exotic weight from `+2` → `+1`; add Pacamara/SL28/SL34 row
  - Reduce classic weight from `+2` → `+1`
  - All as `+0.5` good matches (can use `0.5` or round to `+1` for simplicity)
- [ ] Add `scoreFreshness(scores, roastDate?)`:
  - Compute days off roast from `bean.roast_date`
  - Apply adjustments from plan §6
- [ ] Add `scoreBatchSize(scores, batchSize?)` — optional, derive from `targetVolumeMl` in sessionStorage if not passed directly
- [ ] Remove `scoreAltitude()` entirely
- [ ] Update tie-break sort: on equal score prefer higher `desiredProfile` match → then higher forgiveness
- [ ] Update `buildRationale()` to be outcome-aware: templates should mention what the method will do in the cup + why it fits `desiredProfile` when provided

---

## 3. `/methods` page (`src/app/methods/page.tsx`)

- [ ] Read `confirmedBean` from sessionStorage on mount (already available via `beanRaw` in `selectMethod`, move it to state)
- [ ] Add `desiredProfile` state (`DesiredProfile | null`, default `null`)
- [ ] On mount and whenever `desiredProfile` changes, re-run `recommendMethods(bean, desiredProfile)` client-side and update `recommendations` state
  - Replace the current `useEffect` that reads `methodRecommendations` from sessionStorage — compute fresh on this page instead
  - Keep sessionStorage read as fallback if `confirmedBean` is missing (redirect to `/scan`)
- [ ] Render profile chips above the recommendation cards:
  - 6 chips: Clarity · Sweetness · Body · Low Acidity · Balance · Most Forgiving
  - Selected chip: filled/dark style; unselected: ghost/outline style
  - Tapping a selected chip deselects it (resets to `null` → uses balanced defaults)
- [ ] Update subtitle copy: "Based on your bean profile, here are the best brewing methods:" → append "Tap a preference to refine." or similar
- [ ] Pass `desiredProfile` into `selectMethod` → store on `storedRec` so it's saved with the recipe

---

## 4. Analysis page (`src/app/analysis/page.tsx`)

- [ ] Remove the `sessionStorage.setItem('methodRecommendations', ...)` call — `/methods` now computes recommendations itself
  - Verify nothing else reads `methodRecommendations` from sessionStorage before removing

---

## 5. Rationale quality pass

- [ ] Write outcome-aware rationale templates in `buildRationale()` that cover each `(method, desiredProfile)` combination for the most common pairings
- [ ] Fallback to a generic per-method rationale when `desiredProfile` is `null`

---

## 6. Smoke test checklist

- [ ] Image flow: scan → analysis → methods — page loads, chips render, selecting a chip re-ranks cards live
- [ ] Manual flow: manual → methods — same behaviour
- [ ] Selecting a method with a preference chip active → recipe page works normally
- [ ] No preference selected → recommendations still show (balanced defaults from `orea_v4 / hario_switch / kalita_wave`)
- [ ] `experimental` process coffee does not crash the engine
- [ ] Freshness calculation: coffee roasted today penalises V60/Origami slightly
