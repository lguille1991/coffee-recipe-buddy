# Fellow Opus Grind Table Plan

## Baseline metadata

- Pre-existing dirty files: none
- Task-owned files:
  - `docs/grinder-tables/fellow-opus-grind-table.md`
- Release hygiene note:
  - This is a docs-only change, so `package.json` version bump is not required.
  - `CHANGELOG.md` update is not required unless the user asks for it.

## Implementation checklist

- [x] Use the browser-session MCP tooling to open `https://honestcoffeeguide.com/coffee-grind-size-chart/`.
- [x] Interact with the chart controls by selecting `Fellow` in the `Brand` dropdown and `Opus` in the `Model` dropdown.
- [x] Extract the displayed `Fellow Opus` grind-setting ranges for each brew method from the resulting chart/page state.
- [x] Cross-check the extracted brew-method names and ordering against the existing grinder table documents in `docs/grinder-tables/`.
- [x] Create `docs/grinder-tables/fellow-opus-grind-table.md` matching the existing document format:
  - title
  - source model line
  - scale/notation line appropriate for the grinder
  - recommended settings markdown table
  - source reference URL
- [x] Review the new document for formatting consistency and accuracy against the extracted source values.
- [x] Report the completed work with a concise suggested commit message.
