# Typography And UI Sizing System Plan

## Goals

- [ ] Establish one enforceable typography scale for mobile and large-screen app views
- [ ] Establish one enforceable control-size system for buttons, inputs, chips, icon buttons, and alerts
- [ ] Replace ad hoc font sizes and spacing choices with semantic, reusable patterns
- [ ] Reduce visual inconsistency without changing the overall product structure or interaction model

## Audit Summary

- [ ] Confirm and document the current typography and control-size hotspots
- [ ] Replace custom micro-text usage such as `text-[9px]`, `text-[10px]`, and `text-[11px]`
- [ ] Normalize repeated one-off control heights created via mixed `py-*` values
- [ ] Align mobile and desktop navigation sizing so the same UI roles map to the same visual hierarchy
- [ ] Verify warning, helper, and status messaging remains readable at both small and large viewports

## Token System

- [ ] Add semantic typography tokens or utilities in `src/app/globals.css`
- [ ] Define a constrained text scale for app UI roles
- [ ] Define a constrained control-size scale for interactive elements
- [ ] Define icon-size guidance for inline, action, and navigation icons
- [ ] Map semantic roles to text sizes
  - [ ] Page title
  - [ ] Section label
  - [ ] Card title / row primary text
  - [ ] Secondary body text
  - [ ] Metadata / caption text
  - [ ] Button text
  - [ ] Input text
  - [ ] Helper / validation text
  - [ ] Badge text

## Recommended Baseline

- [ ] Use `text-xs` for captions, timestamps, chip labels, and overlines
- [ ] Use `text-sm` for helper text, secondary text, alert details, and descriptive UI copy
- [ ] Use `text-base` for body text, button text, input text, and primary row text
- [ ] Use `text-lg` for compact headers and modal titles
- [ ] Use `text-2xl` on mobile and `sm:text-3xl` on larger screens for standard page titles
- [ ] Reserve `text-4xl` or larger only for marketing-style hero treatments

## Control Sizing

- [ ] Standardize primary and secondary buttons to a shared minimum height
- [ ] Standardize text inputs and textareas to the same base text size as buttons
- [ ] Standardize icon buttons to a minimum touch target of `40x40`
- [ ] Standardize chips and pills to a compact but readable height
- [ ] Standardize modal sheet actions so confirm/cancel actions share the same rhythm

## Implementation Sequence

- [ ] Step 1: Add global typography and control-size primitives in `src/app/globals.css`
- [ ] Step 2: Refactor shared navigation components
  - [ ] Update `src/components/BottomNav.tsx`
  - [ ] Update `src/components/SideNav.tsx`
- [ ] Step 3: Refactor high-traffic page headers and top-level actions
  - [ ] Update `src/app/page.tsx`
  - [ ] Update `src/app/recipes/page.tsx`
  - [ ] Update `src/app/settings/page.tsx`
  - [ ] Update `src/app/manual/page.tsx`
- [ ] Step 4: Refactor recipe detail and sheet UI patterns
  - [ ] Update `src/app/recipes/[id]/page.tsx`
  - [ ] Update `src/components/ConfirmSheet.tsx`
  - [ ] Normalize warning, success, and destructive states
- [ ] Step 5: Sweep remaining routes for lingering one-off sizes
- [ ] Step 6: Bump `package.json` patch version when implementation begins

## Concrete Rules To Enforce

- [ ] Do not use `text-[9px]`, `text-[10px]`, or `text-[11px]` for interactive labels
- [ ] Do not introduce new arbitrary text sizes unless there is a documented exception
- [ ] Do not size buttons by arbitrary vertical padding when a shared control pattern exists
- [ ] Do not let mobile and desktop nav use different semantic label sizes for the same role
- [ ] Prefer weight, color, and spacing changes before introducing another font size

## Verification

- [ ] Review mobile viewport behavior on the primary app screens
- [ ] Review large-screen behavior on the same screens
- [ ] Confirm page titles, section titles, helper text, metadata, and buttons follow the new role mapping
- [ ] Confirm alerts and warnings are readable and visually distinct
- [ ] Confirm touch targets remain usable on mobile
- [ ] Run lint if implementation touches multiple files

## Notes

- [ ] Preserve the current visual language and layout structure while tightening the sizing system
- [ ] Favor semantic utilities and reusable patterns over repeated inline Tailwind classes
- [ ] Keep the system small enough that future screens naturally reuse it instead of bypassing it
