# Plan: Simplify Grind Settings Section with Collapsible Secondary Grinders

## Summary
Refactor the "Grind Settings" section in **Edit Recipe** and **Brew** screens to show only the primary grinder by default, with all other grinders hidden in a collapsible menu. The menu should be collapsed by default and expand when clicking "See more grinders".

## Current State

### Edit Recipe Screen (`src/app/recipes/[id]/page.tsx`)
- **Lines 847-917**: Grind Settings section shows all grinders:
  - Primary grinder (editable/view mode)
  - 3 secondary grinders (always visible)
- **Lines 715-727**: Already uses collapsible pattern for "Advanced (dose & ratio)"
- **Line 122**: Has `advancedOpen` state for collapsible

### Brew Screen (`src/app/recipe/page.tsx`)
- **Lines 502-548**: Grind Settings section shows all grinders:
  - Primary grinder (with adjustment indicators)
  - 3 secondary grinders (always visible)
- **Lines 57-76**: Has reusable `Collapsible` component
- **Lines 607, 621**: Uses `Collapsible` for "Quick Adjustments" and "How was this calculated?"

## Target State

### Changes for Edit Recipe Screen
1. Add new state variable `secondaryGrindersOpen` (default: `false`)
2. Wrap secondary grinders map in a collapsible section
3. Add toggle button with chevron (matches "Advanced" pattern)
4. Button text: "See more grinders"
5. Secondary grinders visible only when `secondaryGrindersOpen` is true

### Changes for Brew Screen
1. Add new state variable `secondaryGrindersOpen` (default: `false`)
2. Wrap secondary grinders map in a collapsible section
3. Add toggle button with chevron (matches existing `Collapsible` pattern)
4. Button text: "See more grinders"
5. Secondary grinders visible only when `secondaryGrindersOpen` is true

## Implementation Checklist

### Phase 1: Edit Recipe Screen (`src/app/recipes/[id]/page.tsx`)
- [ ] Add `secondaryGrindersOpen` state after line 122 (after `advancedOpen`)
- [ ] Modify Grind Settings section (lines 847-917):
  - [ ] Keep primary grinder display unchanged (lines 856-896)
  - [ ] Add collapsible toggle button after primary grinder
  - [ ] Wrap secondary grinders map in conditional `{secondaryGrindersOpen && (...)}`
  - [ ] Use same button/chevron pattern as "Advanced" (lines 716-727)

### Phase 2: Brew Screen (`src/app/recipe/page.tsx`)
- [ ] Add `secondaryGrindersOpen` state after existing state declarations
- [ ] Modify Grind Settings section (lines 502-548):
  - [ ] Keep primary grinder display unchanged (lines 511-527)
  - [ ] Add collapsible toggle button after primary grinder
  - [ ] Wrap secondary grinders map in conditional `{secondaryGrindersOpen && (...)}`
  - [ ] Use same pattern as existing `Collapsible` component

### Phase 3: Verification
- [ ] Verify primary grinder is always visible
- [ ] Verify secondary grinders are hidden by default
- [ ] Verify clicking toggle shows/hides secondary grinders
- [ ] Verify chevron rotates on toggle
- [ ] Verify styling matches "Advanced" pattern

## Code Patterns to Follow

### Button Pattern (from "Advanced" in Edit Recipe)
```tsx
<button
  onClick={() => setSecondaryGrindersOpen(o => !o)}
  className="flex items-center justify-between w-full py-2 text-left"
>
  <span className="text-xs font-medium text-[var(--muted-foreground)]">See more grinders</span>
  <svg
    width="14" height="14" viewBox="0 0 14 14" fill="none"
    className={`transition-transform text-[var(--muted-foreground)] ${secondaryGrindersOpen ? 'rotate-180' : ''}`}
  >
    <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
</button>
```

### Conditional Content Pattern
```tsx
{secondaryGrindersOpen && (
  <div className="mt-2">
    {secondaryGrinders.map((grinder, i) => (
      // existing secondary grinder items
    ))}
  </div>
)}
```

### State Declaration Pattern
```tsx
const [secondaryGrindersOpen, setSecondaryGrindersOpen] = useState(false)
```

## Affected Files
1. `/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/app/recipes/[id]/page.tsx` - Edit Recipe screen
2. `/Users/guillermoabrego/Documents/GitHub/coffee-recipe-buddy/src/app/recipe/page.tsx` - Brew screen

## Visual Mockup (Conceptual)

### Before:
```
┌─────────────────────────────┐
│  Grind Settings             │
│  ┌─────────────────────┐    │
│  │ Primary Grinder     │    │
│  │ (K-Ultra)           │    │
│  │ 65 clicks           │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ Q-Air               │    │
│  │ Range: X-Y          │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ Baratza Encore ESP  │    │
│  │ Range: A-B          │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ Timemore C2         │    │
│  │ Range: C-D          │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

### After:
```
┌─────────────────────────────┐
│  Grind Settings             │
│  ┌─────────────────────┐    │
│  │ Primary Grinder     │    │
│  │ (K-Ultra)           │    │
│  │ 65 clicks           │    │
│  └─────────────────────┘    │
│  See more grinders     ▼    │  ← collapsed by default
│                             │
│  [after click]              │
│  See more grinders     ▲    │
│  ┌─────────────────────┐    │
│  │ Q-Air               │    │
│  │ Range: X-Y          │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ Baratza Encore ESP  │    │
│  │ Range: A-B          │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ Timemore C2         │    │
│  │ Range: C-D          │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

## Grind Settings Auto-Calculation Logic Verification

### How It Works (Edit Recipe Screen)

**Data Flow:**
1. **User edits primary grinder value** → `editDraft.grind_preferred_value` changes
2. **`liveGrindSettings` useMemo** (lines 479-495) recalculates ALL grinder values:
   - Converts user grinder value → K-Ultra clicks using `grinderValueToKUltraClicks()`
   - Computes Q-Air: `kUltraRangeToQAir()`
   - Computes Baratza: `kUltraRangeToBaratza()`
   - Computes Timemore C2: `kUltraRangeToTimemoreC2()`
3. **`activeGrind` variable** (line 535) selects either:
   - `liveGrindSettings` (when editing) - contains computed values for ALL grinders
   - `r.grind` (when viewing) - saved recipe data
4. **Grind Settings section** (lines 847-917) displays values from `activeGrind`

**Key Finding:** The secondary grinder values are **computed from the primary grinder** using conversion utilities in `src/lib/grinder-converter.ts`. The UI simply **displays** these pre-computed values.

### Impact of Collapsible Change

**✅ SAFE** - The collapsible UI change only affects **VISIBILITY**, not calculation:
- `liveGrindSettings` computes ALL grinder values regardless of UI state
- `activeGrind` references these computed values
- Secondary grinders are display-only (no user input)
- Collapsible only controls CSS visibility (`{secondaryGrindersOpen && (...)}`)

**✅ NO LOGIC CHANGES NEEDED** for:
- `liveGrindSettings` useMemo (lines 479-495)
- `activeGrind` computation (line 535)
- Grinder conversion functions in `src/lib/grinder-converter.ts`
- Any grind scaling or adjustment logic

### Brew Screen
- Uses `recipe.grind` directly (no live preview needed)
- Same secondary grinders display pattern
- Same safety applies: collapsible only affects visibility

## Notes
- The "Recipes" list screen doesn't show grind settings, so no changes needed there
- Use consistent styling with existing collapsible sections
- Ensure accessibility (keyboard navigation, focus states) is maintained
- Keep existing logic for grind value conversion and display
- **NO changes needed** to any auto-calculation logic - the collapsible only affects UI visibility
