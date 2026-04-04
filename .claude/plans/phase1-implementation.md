# Phase 1 Implementation Plan — Coffee Recipe Buddy

## Context

Greenfield project. The goal is to deliver the full Phase 1 loop: upload a coffee bag photo → extract bean metadata via vision model → user reviews/corrects → method decision engine recommends top 3 brew methods → user picks one → coffee range system generates a structured recipe (with grind settings for 3 grinders) → recipe renders as a styled card.

Stack: **Next.js 14 App Router + TypeScript + Tailwind CSS + Anthropic SDK**. All API routes live in `app/api/`. Reference documents (range system, grinder tables) will be authored from scratch using the spec in `phase1_image_first_range_system.md`.

---

## Checklist

### 0. Project Bootstrap
- [x] `npx create-next-app@latest . --typescript --tailwind --app --src-dir`
- [x] Install deps: `@anthropic-ai/sdk zod`
- [x] Create `.env.local` with `ANTHROPIC_API_KEY=`
- [x] Create `.env.example` documenting required vars
- [x] Set up `src/types/recipe.ts` — Zod schema + TypeScript types for BeanProfile, MethodRecommendation, Recipe

### 1. Reference Documents (Knowledge Base)
- [x] `docs/coffee-range-system-skill.md` — Blocks 1–10 in full:
  - Block 1: Method base ranges (K-Ultra clicks + temp) for all 9 methods
  - Block 1B: Ratio ranges per method
  - Block 2: Process offsets (washed / natural / honey / anaerobic)
  - Block 3: Roast offsets (light / medium / dark)
  - Block 4: Freshness offsets (days since roast → offset magnitude)
  - Block 5: Density fine-tune (variety + altitude ±1–2 clicks)
  - Block 5B: Accumulation cap rule (≤ 10 clicks width, compress toward center)
  - Block 6: Mandatory decision order (steps 1–9)
  - Block 8: Pour technique per method
  - Block 10: Conflict interaction rules
- [x] `docs/method-decision-logic.md` — Decision matrix (bean profile → top 3 methods) + scoring algorithm for all 9 methods
- [x] `docs/output-format.md` — Full recipe JSON schema + post-LLM validation rules (mirrors phase1 spec exactly)
- [x] `docs/grinder-tables/1zpresso-k-ultra-grind-table.md` — Click → micron mapping (full range)
- [x] `docs/grinder-tables/1zpresso-q-air-grind-table.md` — Click → micron mapping (full range)
- [x] `docs/grinder-tables/baratza-encore-esp-grind-table.md` — Click → micron mapping; note pour-over constraint (clicks 14–24)

### 2. Core Utilities (`src/lib/`)
- [x] `src/lib/method-decision-engine.ts`
  - Pure function: `recommendMethods(bean: BeanProfile): MethodRecommendation[]`
  - Deterministic scoring — NO LLM call
  - Returns exactly 3 ranked methods with rationale strings
- [x] `src/lib/grinder-converter.ts`
  - `kUltraClicksToMicrons(clicks: number): number`
  - `micronsToQAir(microns: number): GrinderSetting`
  - `micronsToBaratza(microns: number): GrinderSetting`
  - Validates Baratza stays within 14–24 for pour-over methods
- [x] `src/lib/recipe-validator.ts`
  - `validateRecipe(recipe: unknown, bean: BeanProfile, method: string): ValidationResult`
  - Checks: ratio math (±5g), water sum exact match, click range, temp range, accumulation cap, Baratza zone, all 3 grinders present, all 5 quick-adjustment keys, range_logic completeness
- [x] `src/lib/prompt-builder.ts`
  - `buildExtractionPrompt(): string` — vision system prompt for bean extraction
  - `buildRecipePrompt(bean: BeanProfile, method: string): { system: string; user: string }` — assembles range system + grinder tables + output format spec
- [x] `src/lib/image-compressor.ts` (client-side)
  - `compressImage(file: File, maxSizeKb?: number): Promise<Blob>` — canvas-based compression, targets < 1 MB for API upload

### 3. API Routes (`src/app/api/`)
- [x] `src/app/api/extract-bean/route.ts`
  - Accepts: `multipart/form-data` with `image` field
  - Calls: Claude vision API with extraction system prompt
  - Validates: returned JSON against BeanProfile Zod schema
  - Returns: `{ bean: BeanProfile, confidence: Record<keyof BeanProfile, number> }`
  - Error: 422 on extraction failure with field-level errors
- [x] `src/app/api/generate-recipe/route.ts`
  - Accepts: `{ method: string, bean: BeanProfile }`
  - Calls: Claude with full range system prompt (assembled by `prompt-builder.ts`)
  - Validates: recipe JSON via `recipe-validator.ts`
  - Retry: up to 2 retries with validation error message injected back into prompt
  - Returns: validated `Recipe` object
  - Error: 422 after 3 failures

### 4. Pages & Navigation (`src/app/`)
- [x] `src/app/page.tsx` — Home screen (Brygg branding, hero photo, Scan CTA, bottom nav)
- [x] `src/app/scan/page.tsx` — Upload screen (camera/gallery picker, upload zone, loading state)
- [x] `src/app/analysis/page.tsx` — Bean confirmation (extracted fields, editable, confidence badges, roast date)
- [x] `src/app/methods/page.tsx` — Method recommendation + selection (3 ranked cards)
- [x] `src/app/recipe/page.tsx` — Recipe card display
- [x] State passed via `sessionStorage` (no persistence in Phase 1)

### 5. UI Components (`src/components/`)
- [x] `src/components/BottomNav.tsx`
  - Floating white pill nav (`cornerRadius: 36`) with dark active tab indicator (`cornerRadius: 26`)
  - Home / Recipes / Settings tabs
- [x] Bean confirmation UI (inline in `/analysis` page)
  - Editable fields for all extracted bean properties
  - Per-field confidence badge (yellow warning if confidence < 0.6)
  - Roast date picker (optional; shows "Assuming optimal window" if skipped)
- [x] Method recommendation cards (inline in `/methods` page)
  - Renders exactly 3 method cards from `recommendMethods()` output
  - Each card: method name, rank badge, rationale text
  - Tap to select → calls generate-recipe API → navigate to recipe page
- [x] Recipe card (inline in `/recipe` page)
  - `Parameters` section: 6-cell grid (water, coffee, temp, brew time, grind, ratio)
  - `Grind Settings` section: K-Ultra primary card, Q-Air and Baratza rows
  - `Brew Steps` section: numbered cards with time, action, water poured, accumulated
  - `Quick Adjustments` section: collapsible, 5 categories
  - `How was this calculated?` section: collapsible full offset chain

### 6. Integration & Wiring
- [x] Wire scan page → extract-bean API → analysis page (with extracted data + confidence)
- [x] Wire analysis page → method decision engine (client-side) → methods page
- [x] Wire method selection → generate-recipe API → recipe page
- [x] Loading states for both API calls (spinner + message)
- [x] Error display for API failures (inline error box)

### 7. Design Token Alignment (Pencil design)
- [x] CTA button radius: `rounded-[14px]` (extracted from Pencil: `cornerRadius: 14`)
- [x] Button background: `#333333` (`--foreground` token)
- [x] Background: `#F5F5F5` (`--background` token)
- [x] Card background: `#FFFFFF` (`--card` token)
- [x] Border: `#E1E2E5` (`--border` token)
- [x] Muted text: `#5B5F66` (`--muted-foreground` token)
- [x] Font: Roboto (`--font-primary` token)
- [x] Hero image radius: `rounded-[16px]`
- [x] Bottom nav: floating white pill with dark active indicator

### 7. Validation & Testing
- [ ] Unit test `method-decision-engine.ts` — all 4 bean profile scenarios return correct top method
- [ ] Unit test `recipe-validator.ts` — each validation rule independently
- [ ] Unit test `grinder-converter.ts` — K-Ultra → micron → Q-Air and Baratza spot-checks; Baratza zone constraint
- [ ] Integration test `POST /api/extract-bean` — mock Claude response, assert schema output
- [ ] Integration test `POST /api/generate-recipe` — mock Claude response with valid + invalid JSON, assert retry and validation behavior
- [ ] Manual end-to-end test: upload real coffee bag photo → full flow → recipe renders

---

## Critical File Paths

| File | Purpose |
|---|---|
| `src/types/recipe.ts` | Single source of truth for all types + Zod schemas |
| `src/lib/method-decision-engine.ts` | Deterministic method scoring |
| `src/lib/recipe-validator.ts` | Post-LLM validation + retry trigger |
| `src/lib/prompt-builder.ts` | Assembles full LLM system prompt |
| `src/lib/grinder-converter.ts` | K-Ultra → Q-Air + Baratza conversion |
| `src/app/api/extract-bean/route.ts` | Vision extraction endpoint |
| `src/app/api/generate-recipe/route.ts` | Recipe generation endpoint with retry |
| `docs/coffee-range-system-skill.md` | Injected verbatim into LLM system prompt |
| `docs/method-decision-logic.md` | Decision matrix used by the engine |

---

## Verification

1. `npm run dev` starts without errors
2. Navigate to `/` — upload screen renders, camera/gallery picker works on mobile
3. Upload a coffee bag photo — extract-bean returns bean data in < 5s
4. Confirm page shows all fields; low-confidence fields show yellow badge
5. Method page shows exactly 3 ranked options with rationale
6. Select a method → recipe page renders with all sections populated
7. Recipe JSON passes all validator checks (no 422 errors in console)
8. Range logic section is expandable and shows full offset chain
9. Baratza click within 14–24 for any pour-over method
10. Final grind range ≤ 10 clicks wide
