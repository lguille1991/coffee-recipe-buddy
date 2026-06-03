# Skill-Owned Grind Policy

Generated recipe grind settings use the `coffee-recipe-generator` skill references as the canonical source of truth. The skill's grinder table must cover every supported grinder before app refactoring depends on it, skill worked examples become regression fixtures once their arithmetic is reconciled, and previous grind-selection env flags are tolerated as no-op configuration for one release rather than continuing to choose behavior.

## Consequences

- New generated recipes use one canonical skill-derived grind policy instead of env-selectable app modes.
- Historical saved recipes keep their saved grind values unless the user explicitly regenerates or adjusts them.
- The app preserves the existing recipe JSON shape while making compression inert for canonical skill grinds.
