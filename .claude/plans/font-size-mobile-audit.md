# Mobile Font Size Audit & Upgrade Plan

## Context

Current distribution: 132× `text-xs` (12px), 97× `text-sm` (14px), 5× `text-base` (16px).
Mobile best practices: 16px body minimum, 14px secondary floor, 12px only for decorative UI chrome.
iOS auto-zooms any input/select below 16px — a usability bug, not just aesthetics.

## Size reference (Tailwind defaults)

| Class | px | Use |
|---|---|---|
| `text-xs` | 12px | Decorative chrome only (badges, dividers) |
| `text-sm` | 14px | Secondary / metadata text |
| `text-base` | 16px | Body, inputs, buttons |
| `text-lg` | 18px | Subheadings |
| `text-xl` | 20px | Section headings |

---

## Category A — Critical: Fix iOS auto-zoom (inputs must be ≥ 16px)

All `<input>`, `<textarea>`, `<select>` fields currently at `text-sm` must become `text-base`.

- [ ] `src/app/analysis/page.tsx`
  - L58 — bean name input: `text-sm` → `text-base`
  - L146 — bean name editable input: `text-sm` → `text-base`
  - L208 — roast date input: `text-sm` → `text-base`
  - L227 — volume input: `text-sm` → `text-base`

- [ ] `src/app/auth/page.tsx`
  - L126 — email input: `text-sm` → `text-base`
  - L141 — password input: `text-sm` → `text-base`

- [ ] `src/app/manual/page.tsx`
  - L93 — bean name input: `text-sm` → `text-base`
  - L242 — variety/notes input: `text-sm` → `text-base`
  - L257 — roaster input: `text-sm` → `text-base`
  - L291 — volume input: `text-sm` → `text-base`
  - L314 — roast date input: `text-sm` → `text-base`

- [ ] `src/app/recipes/page.tsx`
  - L149 — search input: `text-sm` → `text-base`

- [ ] `src/app/recipes/[id]/page.tsx`
  - L699, L709, L775 — edit-mode parameter inputs: `text-sm` → `text-base`
  - L812 — inline editable field: `text-sm` → `text-base`
  - L978 — notes textarea: `text-xs` → `text-base`

- [ ] `src/app/recipes/[id]/auto-adjust/page.tsx`
  - L247 — intent textarea: `text-sm` → `text-base`

- [ ] `src/app/settings/page.tsx`
  - L113 — display name input: `text-sm` → `text-base`
  - L198 — default volume input: `text-sm` → `text-base`

- [ ] `src/app/share/[token]/ShareRecipeClient.tsx`
  - L297 — comment textarea: `text-xs` → `text-base`

- [ ] `src/app/recipes/[id]/SortableStepList.tsx`
  - L72, L83 — time/water inline inputs: `text-xs` → `text-sm` (constrained width)
  - L99 — step action textarea: `text-xs` → `text-base`

---

## Category B — Content text that must be readable

Brew steps, recipe body, notes, and comments are primary reading content — 12px is too small.

- [ ] `src/app/recipe/page.tsx` — brew step rows (L555, L589, L594–597, L613)
  - Step time: `text-xs` → `text-sm`
  - Step water info: `text-xs` → `text-sm`
  - Step action text: `text-xs` → `text-sm`
  - Step extra info (notes/tips): `text-xs` → `text-sm`
  - Step counter circle badge (L589): keep `text-xs` (constrained by 28px circle)

- [ ] `src/app/recipes/[id]/page.tsx` — brew step rows (L931, L936–939)
  - Same pattern as above: step time/water/action: `text-xs` → `text-sm`
  - Step counter circle badge (L931): keep `text-xs`

- [ ] `src/app/recipes/[id]/auto-adjust/page.tsx` — brew step rows (L315, L320–323)
  - Step time/water/action: `text-xs` → `text-sm`
  - Step counter circle (L315): keep `text-xs`

- [ ] `src/app/share/[token]/ShareRecipeClient.tsx` — brew step rows (L213, L218–221)
  - Step time/water/action: `text-xs` → `text-sm`
  - Step counter circle (L213): keep `text-xs`

- [ ] Recipe objective / rationale body text
  - `src/app/recipe/page.tsx` L419: `text-xs` → `text-sm`
  - `src/app/methods/page.tsx` L139: `text-xs` → `text-sm`

- [ ] Error / success / warning banners (inline content, not decorative)
  - `src/app/recipe/page.tsx` L424, L429, L446: `text-xs` → `text-sm`
  - `src/app/recipes/[id]/page.tsx` L677: `text-xs` → `text-sm`
  - `src/app/recipes/[id]/auto-adjust/page.tsx` L280, L331: `text-xs` → `text-sm`
  - `src/app/settings/page.tsx` L204, L209: `text-xs` → `text-sm`

- [ ] Grind setting description / note italic lines
  - `src/app/recipe/page.tsx` L521, L524: `text-xs` → `text-sm`
  - `src/app/recipes/[id]/page.tsx` L886, L889: `text-xs` → `text-sm`
  - `src/app/share/[token]/ShareRecipeClient.tsx` L181, L184: `text-xs` → `text-sm`

- [ ] Sharer's notes and comment body text
  - `src/app/share/[token]/ShareRecipeClient.tsx` L232, L263: `text-xs` → `text-sm`

- [ ] Adjustment history entries
  - `src/app/recipes/[id]/page.tsx` L953: `text-xs` → `text-sm`

---

## Category C — Secondary metadata (bump one step)

Roaster, date, method context — secondary but still informational.

- [ ] `src/app/analysis/page.tsx` L148–149: roaster + profile sub-line: `text-xs` → `text-sm`
- [ ] `src/app/recipe/page.tsx` L416: method sub-line below title: `text-sm` ✓ (already ok)
- [ ] `src/app/recipes/[id]/page.tsx` L635, L648: roaster + freshness note: `text-xs` → `text-sm`
- [ ] `src/app/recipes/[id]/auto-adjust/page.tsx` L202, L206: bean name + method: `text-xs` → `text-sm`
- [ ] `src/app/share/[token]/ShareRecipeClient.tsx` L136, L138: roaster + date: `text-xs` → `text-sm`
- [ ] `src/app/page.tsx` L34: recipe card method subtitle: `text-xs` → `text-sm`
- [ ] `src/app/recipes/page.tsx` L46: recipe card method subtitle: `text-xs` → `text-sm`
- [ ] `src/app/settings/page.tsx` L98: email address display: `text-xs` → `text-sm`
- [ ] `src/components/SideNav.tsx` L46: app subtitle: `text-xs` → `text-sm`

---

## Category D — Buttons & CTAs (bump to text-base)

CTA buttons should match form input size for visual rhythm.

- [ ] `src/app/page.tsx` L88, L95, L103: primary + secondary CTAs: `text-sm` → `text-base`
- [ ] `src/app/scan/page.tsx` L86, L94: scan/camera buttons: `text-sm` → `text-base`
- [ ] `src/app/analysis/page.tsx` L240: confirm button: `text-sm` → `text-base`
- [ ] `src/app/manual/page.tsx` L333: generate button: `text-sm` → `text-base`
- [ ] `src/app/recipe/page.tsx` L660, L679: method switch + save buttons: `text-sm` → `text-base`
- [ ] `src/app/recipe/page.tsx` L730, L737: feedback cancel/submit: `text-sm` → `text-base`
- [ ] `src/app/recipes/[id]/auto-adjust/page.tsx` L261, L341, L350, L357: all CTAs: `text-sm` → `text-base`
- [ ] `src/app/recipes/[id]/page.tsx` L993, L1002: save/discard edit: `text-sm` → `text-base`
- [ ] `src/app/settings/page.tsx` L218, L229: save + sign out: `text-sm` → `text-base`
- [ ] `src/app/auth/page.tsx` L148, L165: sign in + Google button: `text-sm` → `text-base`
- [ ] `src/components/ConfirmSheet.tsx` L35, L50: confirm/cancel: `text-sm` → `text-base`
- [ ] `src/app/share/[token]/ShareRecipeClient.tsx` L304: post comment button: `text-xs` → `text-sm`
- [ ] `src/app/share/[token]/ShareRecipeClient.tsx` L316: load more: `text-xs` → `text-sm`
- [ ] `src/app/share/[token]/ShareRecipeClient.tsx` L333: clone button: `text-sm` → `text-base`

---

## What stays as-is (intentional)

- Section header labels (`text-xs font-semibold uppercase tracking-wider`) — decorative UI chrome, acceptable at 12px
- Flavor note pills `text-xs` in `/analysis` — compact chip style
- Grind range line `text-xs opacity-60` — supplementary, visually de-emphasized intentionally
- Brew step circle badge `text-xs font-bold` — constrained by 28px `w-7 h-7` circle
- `text-xs` scan page footer hint (L101) — intentionally de-emphasized
- `text-xs` "See all" link on home page — intentionally subordinate
- `text-xs` "or" divider on auth page — decorative
- Filter pill labels `text-xs` on `/recipes` — compact chip style, ok
- Method rank badge `text-xs` on `/methods` — compact chip style
