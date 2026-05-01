# Recipe Output Template

Use this as the scaffold for every generated recipe. Fill in all placeholders with values calculated from the brew-method defaults, grind-determinant framework, and origin/processing guidance.

## Placeholder Legend

- `{{BREW_METHOD}}` — User's chosen brew method
- `{{COFFEE_ORIGIN}}` — Country/Region
- `{{PROCESSING}}` — Washed / Natural / Honey
- `{{VARIETY}}` — If known
- `{{ROAST_LEVEL}}` — Light / Medium / Medium-Dark
- `{{COFFEE_DOSE}}` — Grams of coffee
- `{{WATER_AMOUNT}}` — Total ml of water
- `{{WATER_TEMP}}` — Degrees Celsius
- `{{RATIO}}` — e.g., 1:15
- `{{YIELD}}` — Expected ml yield
- `{{BREW_TIME}}` — Target range, e.g., 2:45-3:15
- `{{GRIND_SETTING}}` — Grinder-specific or descriptive
- `{{TIMELINE_ROWS}}` — Pipe-delimited markdown table rows
- `{{STEPS}}` — Numbered step blocks
- `{{FLAVOR_NOTES}}` — 2-3 sentence flavor description
- `{{TROUBLESHOOTING_ROWS}}` — Pipe-delimited table rows

## Example Filled Recipe

```
# V60 Recipe for Ethiopia Yirgacheffe Natural Process

## Coffee Details
- **Origin:** Ethiopia Yirgacheffe
- **Processing:** Natural (Dry Process)
- **Variety:** Heirloom
- **Roast Level:** Light

## Overview
- **Coffee:** 15g
- **Water:** 255ml at 92°C
- **Ratio:** 1:17
- **Expected Yield:** ~240ml
- **Expected Brew Time:** 2:45 - 3:15
- **Grind:** Medium-fine (0.6.0 – 0.8.0 on K-Ultra = 60-80 ticks | 1.2.0 – 2.0.1 on Q Air | Setting 16-17 on Baratza Encore ESP)

## Flavor Profile
A fruit-forward cup with intense blueberry and stone fruit notes. The natural process enhances the coffee's wild, wine-like character. Expect a syrupy body with a clean, bright finish. Perfect for showcasing Ethiopian terroir.

## Brew Timeline
| Time | Action | Total Water |
|------|--------|-------------|
| 0:00 | Bloom | 30ml |
| 0:45 | First Main Pour | 110ml |
| 1:15 | Second Main Pour | 185ml |
| 1:45 | Final Pour | 255ml |
| 2:45 | Drawdown complete | — |

## Brewing Steps

### Step 1: Bloom
- **Time:** 0:00 - 0:45
- **Water:** 30g at 92°C (double the coffee dose)
- **Pour Pattern:** Start at center, slowly spiral outward to edges
- **Pour Speed:** Slow (3-4 ml/s)

### Step 2: First Main Pour
- **Time:** 0:45 - 1:15
- **Water:** Add 80g (total 110g)
- **Pour Pattern:** Start center, pour in slow circles expanding to outer edge, maintain water level at 1/3 bed height
- **Pour Speed:** Medium (5-6 ml/s)

### Step 3: Second Main Pour
- **Time:** 1:15 - 1:45
- **Water:** Add 75g (total 185g)
- **Pour Pattern:** Slow circles from center outward, maintain level
- **Pour Speed:** Medium (5-6 ml/s)

### Step 4: Final Pour
- **Time:** 1:45 - 2:15
- **Water:** Add 70g (total 255g)
- **Pour Pattern:** Gentle spiral pour, finish 2-3cm above bed to avoid air incorporation
- **Pour Speed:** Slow (3-4 ml/s)

### Final Drawdown
- **Time:** Target 2:45 - 3:15 total
- **Expected:** All water should pass through by 3:15-3:30

## Troubleshooting Guide

| If your coffee tastes... | The problem is likely... | Try adjusting... |
|--------------------------|--------------------------|------------------|
| Too sour/under-extracted | Under-extraction | Grind 1-2 clicks finer, raise temp 1-2°C, pour slower |
| Too bitter/over-extracted | Over-extraction | Grind 1-2 clicks coarser, lower temp 1-2°C, pour faster |
| Weak/watery | Low extraction yield | Grind finer, use 1-2g more coffee, or slow down first pour |
| Too strong | Over-concentrated | Grind 1-2 clicks coarser, use 1-2g less coffee |
| Muddy/cloudy | Too many fines or over-agitation | Pour 3-5cm higher, let bed settle more between pours |
| Lacking fruit notes | Temp too low or coffee too old | Raise temp to 94°C, use fresher beans |
| Harsh/bitter + sour | Uneven extraction (channeling) | Ensure even pour pattern, grind finer |
| "Wine-like" too intense | Natural process character or over-fermentation | Use lower temp (90-91°C), or reduce contact time |

## Adjusting for Your Taste

- **Brighter/acidic:** Lower temp to 90-91°C, grind coarser, or stop brew 15s earlier
- **Sweeter/milder:** Raise temp to 94-95°C, grind medium, or add 10s to brew time
- **More fruit intensity:** Use slightly lower temp (91-92°C) with longer bloom
- **Heavier body:** Use coarser grind, or try French Press method instead
- **Cleaner cup:** Rinse filter twice, pour slower, or use Chemex filter
```

## Rules for Filling the Template

1. **Grind setting:** Always consult `references/grind-determinants.md` first. Never estimate from scratch.
2. **Temp:** Use `references/origin-processing-guide.md` for origin and roast-level temp adjustments.
3. **Brew time:** Use `references/brew-method-defaults.md` as the base, then adjust for processing.
4. **Steps:** Simplify to 3-4 key steps for beginners; add nuance for experts.
5. **Troubleshooting:** Include the full table in every recipe.
6. **Grinder callout:** If the user specified a grinder (K-Ultra, Q-Air, Encore ESP), include the exact setting from `references/grinder-settings.md`. Otherwise use descriptive names only.
