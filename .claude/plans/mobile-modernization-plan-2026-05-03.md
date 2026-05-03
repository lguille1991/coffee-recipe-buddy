# Mobile UX Modernization Plan (Coffee Recipe Buddy)

Date: 2026-05-03
Status: Implemented (pending review + commit-readiness checkpoint)

## Baseline Metadata
- Pre-existing dirty files: none (clean working tree)
- Task-owned files (planned):
  - `src/app/layout.tsx`
  - `src/app/globals.css`
  - `src/components/BottomNav.tsx`
  - `src/app/page.tsx`
  - `src/app/recipes/loading.tsx`
  - `src/app/recipes/RecipesClient.tsx`
  - `src/app/coffees/SavedCoffeesClient.tsx`
  - `src/app/recipe/RecipeSessionClient.tsx`
  - `src/app/recipe/_components/ManualRecipeForm.tsx`
  - `src/app/recipe/_components/FeedbackAdjustmentPanel.tsx`
  - `src/app/recipes/RecipesClient.test.tsx` (if assertions need updating for UI behavior changes)
  - `package.json` (version bump per repo policy)
  - `CHANGELOG.md` (user-facing updates)

- Deferred from this plan to avoid accidental global regressions:
  - `src/components/ResponsiveContainer.tsx` (global wrapper; handle in separate, explicit full-app layout plan)

## Goals
- Make mobile interactions feel more natural, spacious, and modern.
- Eliminate layout hacks that create inconsistency across screens.
- Improve thumb ergonomics, readability, and action clarity.

## Explicit Scope
- In scope routes/components:
  - Home (`/`)
  - Recipes list (`/recipes`) + loading state
  - Saved Coffees list (`/coffees`)
  - Recipe Session (`/recipe`) for both manual and generated flows
- Out of scope (for this plan):
  - Global shell migration for every route in the app
  - Global container-width strategy changes via `ResponsiveContainer`
  - Cross-route transition system

## Phase 1: Foundation (highest impact)
- [x] Introduce a shared mobile shell spacing contract in `globals.css`.
  - Add CSS custom properties for top bar height and one shared reserved bottom-space contract.
  - Define a single source of truth variable for reserved mobile bottom space that includes nav chrome + safe area inset.
  - Add reusable utility classes for `ui-page-shell`, `ui-top-spacer`, and `ui-bottom-spacer`.
- [x] Remove inline font override in `layout.tsx` and use one typography system.
  - Prerequisite: explicitly define the active sans font source before removing inline override (either proper `next/font` wiring in `layout.tsx` or concrete stack in `globals.css`).
  - Keep body typography consistent with theme token usage in `globals.css`.
- [x] Standardize bottom nav sizing and tap ergonomics in `BottomNav.tsx` and `globals.css`.
  - Raise interactive targets to minimum 44px (prefer 48px on primary nav actions).
  - Slightly improve inactive-state contrast for legibility.

Acceptance criteria:
- In-scope routes no longer rely on ad hoc `h-12`/`h-24` for core shell spacing.
- In-scope routes and their floating bars consume the same shared reserved bottom-space variable.
- Bottom nav never overlaps critical content/actions on iPhone safe-area devices in in-scope routes.
- Typography rendering is consistent across all screens.

## Phase 2: High-traffic screens
- [x] Migrate Home, Recipes list, Saved Coffees list, and Recipe Session to shared shell utilities.
  - Replace local spacer divs and inconsistent bottom padding with shell utilities.
- [x] Improve filter/search ergonomics in `RecipesClient.tsx`.
  - Increase chip/toggle hit areas and spacing.
  - Preserve horizontal scroll chips but reduce visual crowding.
- [x] Align floating bulk-action bars with shell contract (`RecipesClient.tsx`, `SavedCoffeesClient.tsx`).
  - Replace hard-coded `bottom-16` with the shared reserved bottom-space contract.
- [x] Include Recipe loading state shell parity in `src/app/recipes/loading.tsx`.
  - Avoid spacing jumps between loading and loaded views.

Acceptance criteria:
- Critical controls remain comfortably reachable with one hand.
- Selection/bulk-action states feel stable (no collision with bottom nav).
- Lists read cleaner at a glance on 375px-width screens.

## Phase 3: Form and detail refinement
- [x] Improve manual form rhythm in `ManualRecipeForm.tsx`.
  - Use one-column layout by default on narrow mobile; move to 2-column at `sm`.
  - Increase spacing between field groups and clarify required-state visibility.
- [x] Normalize top app bar behavior in `RecipeSessionClient.tsx`.
  - Ensure icon button sizes and title scale are consistent.
- [x] Keep generated-flow panel spacing aligned with session shell updates in `FeedbackAdjustmentPanel.tsx`.
  - Ensure manual and generated modes share equivalent vertical rhythm and bottom safety.

Acceptance criteria:
- Manual recipe input flow is easier to scan and edit on mobile.
- Header actions remain discoverable and consistent across session screens.

## Phase 4: Motion and polish
- [x] Add subtle, meaningful component-level mobile-first motion states.
  - Scope only to component entry/interaction polish on in-scope screens.
  - Explicitly defer cross-route transition architecture.
  - Keep reduced-motion support intact.

Acceptance criteria:
- Motion improves perceived quality without hurting clarity on in-scope screens.
- No route-transition-level changes are introduced in this plan.

## Release Hygiene (required by repo policy)
- [ ] Bump `package.json` version (PATCH expected unless scope expands).
- [ ] Add user-facing notes to `CHANGELOG.md`.

## Validation and Review Workflow (per AGENTS.md)
- [ ] After implementation, run review of recent changes (findings-first).
- [ ] If review is clean, ask for commit-readiness confirmation.
- [ ] After confirmation, run validation gates:
  - `npm test`
  - `npm run lint`
  - `npm run build`
- [ ] Provide at least one suggested commit message.

## Manual QA Matrix (required for this UI-heavy change)
- [ ] Devices/viewports:
  - iPhone-class narrow width (~375px) with safe-area/home-indicator
  - Tablet width
  - Desktop width (regression check)
- [ ] Accessibility/system settings:
  - Reduced motion enabled
  - Keyboard focus visibility on key controls
- [ ] Route checks:
  - Home: header spacing, hero/actions visibility, bottom-nav clearance
  - Recipes list: filter chips, search, pagination, selection mode CTA bar, loading state parity
  - Saved Coffees list: status toggle, card density, selection mode CTA bar
  - Recipe Session manual flow: field rhythm, save/back controls, bottom clearance
  - Recipe Session generated flow: feedback panel spacing and action reachability
- [ ] Failure checks:
  - No horizontal overflow
  - No floating bar/nav overlap
  - No clipped content behind safe area
  - No abrupt spacing jump between loading and loaded states

## Suggested rollout order
1. Phase 1 foundations
2. Phase 2 high-traffic screens
3. Phase 3 form/detail refinement
4. Phase 4 polish

## Risks and mitigations
- Risk: spacing changes cause regressions on desktop.
  - Mitigation: keep shell utilities mobile-first and preserve existing `lg:` behavior.
- Risk: bulk-action bars overlap custom device safe areas.
  - Mitigation: use one shared reserved bottom-space variable consumed by both page padding and floating bars; test with notch/home-indicator layouts.
- Risk: visual churn across many files.
  - Mitigation: phase rollout; keep logic untouched and focus on layout/interaction layer.
- Risk: typography regression from removing inline font override.
  - Mitigation: explicitly establish font source first, then remove override.
