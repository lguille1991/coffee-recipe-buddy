# Add `data-testid` to Data Input/Display Surfaces

## Summary
- Apply `data-testid` across all user-facing routes on elements that accept data or show primary data values.
- Use short kebab-case IDs with canonical naming; primary name field is always `coffee-name`.
- Include native controls and custom interactive controls (button-based selectors/chips/toggles).
- Use stable suffixes for repeated entities; never use index suffixes for mutable collections.

## Implementation Checklist
- [ ] Create a shared test-id registry (single source of truth constant) for canonical field IDs used across pages/components.
- [x] Add `data-testid` to all editable elements in all user-facing flows, including:
  - native controls (`input`, `select`, `textarea`, file inputs)
  - custom controls that mutate form/state (button groups, chips, segmented controls, toggles, add/remove/reorder actions)
- [x] Add `data-testid` to key rendered data values (smallest stable value node), including recipe parameters, bean/profile attributes, recipe title/name, method, timing, notes, and comment content.
- [x] Add IDs to visible file-upload triggers and hidden file inputs where both are involved in UX.
- [x] Add/normalize IDs in repeated collections (steps/comments/cards) using stable keys:
  - `<base>-<stable-id>` when persistent ID exists
  - `<base>-<enum-or-key>` for fixed options
  - `<base>-<dnd-id>` for reorderable steps where internal stable key exists
- [x] Do not apply container-level IDs unless assertion target is the full container behavior.
- [x] Do not add IDs to decorative/static copy with no data meaning.

## Canonical Naming Rules
- [x] Attribute is always `data-testid`.
- [x] Lowercase kebab-case only.
- [x] Same business meaning must map to same ID across routes.
- [x] Primary name field is always `coffee-name` (used for profile label/bean name headline/edit field).
- [x] Canonical base IDs:
  - `coffee-name`, `roaster`, `bean-variety`, `bean-origin`, `bean-process`, `roast-level`, `roast-date`, `altitude`
  - `brew-method`, `brew-goal`, `water-mode`, `water-amount`, `water-delta`, `coffee-amount`, `brew-ratio`, `grind-setting`, `brew-temp`, `brew-time`, `target-volume`
  - `recipe-name`, `recipe-notes`, `share-comment-input`, `share-comment-content`
- [x] Option IDs use value suffixes for deterministic targeting:
  - `brew-goal-<value>`, `bean-process-<value>`, `roast-level-<value>`, `brew-method-<value>`, `water-mode-<value>`

## Placement Rules (Decision Complete)
- [x] Editable control: ID on the actual interactive element receiving events.
- [x] Display value: ID on the smallest stable node containing the target value string/number.
- [x] Composite rows/cards with label+value:
  - value node gets canonical field ID
  - container only gets ID when interaction/assertion is container-scoped
- [x] Hidden file input patterns:
  - input gets field ID (`coffee-photo-input` style)
  - trigger button gets action ID (`coffee-photo-upload-trigger` style)

## Route/Flow Coverage
- [x] `scan`: upload triggers + selected image/file state surfaces.
- [x] `analysis`: all bean/profile inputs, goal/method selectors, generated recommendation parameter values.
- [x] `manual`: all manual recipe entry controls, process/roast chips, step editing controls, final parameter displays.
- [x] `coffees` list/detail: filters/search inputs, profile fields, generation controls, rendered profile/parameter values.
- [x] `recipes` list/detail/edit/brew/auto-adjust: edit fields, step CRUD/reorder controls, brew-state values, notes, and parameter displays.
- [x] `share/[token]`: displayed shared recipe values, comments input, comment items/actions.
- [x] `settings` and `auth`: user-editable/account fields that accept/show user data.

## Test Strategy
- [ ] Keep role/label/text queries as default in tests.
- [ ] Use `data-testid` where selectors are repeated, non-semantic, or unstable by text/role.
- [ ] Add/adjust focused tests to assert presence and stability of IDs in:
  - analysis/manual profile+parameter flows
  - recipe detail/edit/brew flows
  - share comments flow
- [ ] For reorderable steps and mutable comments, assert stable-id based test IDs remain attached to the same entity after reorder/add/delete operations.

## Assumptions and Defaults
- [x] This pass is additive (no behavior change).
- [x] Existing touched selectors using other patterns are normalized to `data-testid` when modified.
- [x] Implementation phase includes patch SemVer bump in `package.json` and user-facing `CHANGELOG.md` entry.
