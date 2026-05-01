---
name: coffee-recipe-generator
description: Generate specialty coffee brewing recipes with detailed pour steps, timing, and adjustment guidance. Produces recipes for V60, Chemex, Kalita, French Press, AeroPress, and more.
version: 2.0.0
author: Hermes Agent
tags: [Coffee, Brewing, Barista, Recipe, Specialty Coffee]
---

# Coffee Recipe Generator Skill

Generate customized specialty coffee brewing recipes with detailed, adjustable pour steps. This skill produces production-ready recipes based on coffee parameters and user preferences.

## When to Use

Load this skill when the user asks to create, generate, or make a coffee recipe.

## Required Inputs (ask user if not provided)

1. **Brew method** — V60, Chemex, Kalita, French Press, AeroPress, Origami, Moka Pot, etc.
2. **Coffee dose in grams** — or ask for their preferred dose
3. **Coffee origin** — e.g., Ethiopia, Colombia, Brazil, Guatemala, Kenya, Yemen, etc.
4. **Processing method** — Washed / Natural / Honey — critical for brew parameters
5. **Which grinder do you use?** — 1ZPresso K-Ultra, Q-Air, Baratza Encore ESP, or other — this determines exact grind numbers

## Optional Adjustments (ask if relevant)

- Roast level (light, medium, medium-dark)
- Strength preference (mild, balanced, strong)
- Flavor goals (bright/acidic, sweet, chocolatey, floral)
- Equipment available (dripper type, kettle type, grinder type)
- Coffee variety/region if known (e.g., Yirgacheffe, Huila, Gesha)

## Workflow

### Step 1: Gather Inputs
Ask the required questions in order. Do not generate a recipe until origin and processing method are known — these are non-negotiable for accurate parameters.

### Step 2: Select Brew Method Base
Load `references/brew-method-defaults.md` and pick the base parameters (ratio, default grind description, temp range, brew time, steps) for the chosen method.

### Step 3: Calculate Grind Setting
Load `references/grind-determinants.md`. Follow the 5-determinant framework in order:
1. Start with brew method base
2. Apply processing adjustment (biggest swing factor)
3. Apply origin/altitude adjustment
4. Apply roast level adjustment
5. Apply variety adjustment

Use the stacking logic to arrive at a final starting grind. If the user specified a grinder, look up the exact click/setting in `references/grinder-settings.md`.

### Step 4: Adjust Temperature
Load `references/origin-processing-guide.md`. Apply origin-specific temp guidance and roast-level adjustments. Processing method also shifts temp:
- Washed → higher temp (93-96°C)
- Natural → lower temp (91-94°C)
- Honey → mid temp (92-95°C)

### Step 5: Build the Recipe
Load `templates/recipe-output.md`. Fill in all placeholders:
- Coffee details, overview, grind setting, flavor profile
- Brew timeline table with exact times and water amounts
- Step-by-step brewing instructions with pour patterns and speeds
- Troubleshooting table
- Taste-adjustment suggestions

### Step 6: Offer Method Pairing Context (optional)
If the user seems unsure about their brew method choice, load `references/brew-method-pairings.md` or `references/equipment-profiles.md` (if they own gear from that list) and suggest whether their chosen method suits the coffee profile. Offer alternatives if a mismatch exists.

### Step 7: Special Techniques (if requested)
If the user asks for the 4:6 method specifically, load `references/4-6-method.md` and generate a Tetsu Kasuya-style recipe instead of the standard template.

### Step 8: Closing Notes
- Remind the user these are starting points — taste and adjust
- Offer to refine based on feedback after brewing
- Note that processing method dominates grind and temp decisions

## Output Rules

- **Always use the recipe template** from `templates/recipe-output.md`
- **Always use the grind-determinant tables** before giving any grind setting — never estimate from scratch
- **Always include grinder-specific numbers** when the user has named their grinder
- **Simplify for beginners:** 3-4 key steps; **add nuance for experts**
- **Include troubleshooting** in every recipe

## References

Load these linked files on demand during recipe generation:

| File | When to Load |
|------|-------------|
| `references/brew-method-defaults.md` | Step 2 — base parameters per method |
| `references/grind-determinants.md` | Step 3 — how to calculate grind from 5 factors |
| `references/grinder-settings.md` | Step 3 — exact click settings for K-Ultra, Q-Air, Encore ESP |
| `references/origin-processing-guide.md` | Step 4 — origin, variety, and roast temp guidance |
| `references/brew-method-pairings.md` | Step 6 — matching coffee profile to brew method |
| `references/equipment-profiles.md` | Step 6 — your personal brewer design notes and pairings |
| `references/troubleshooting.md` | Standalone taste diagnosis |
| `references/4-6-method.md` | Step 7 — Tetsu Kasuya competition technique |
| `references/pour-patterns.md` | Step 5 — pour pattern descriptions and speed reference |
| `templates/recipe-output.md` | Step 5 — recipe output scaffold |

## Notes

- **ALWAYS ask for origin and processing method first** — these are required for accurate recipes
- The processing method directly affects temperature, grind, and brew time
- Origin influences flavor expectations and optimal brewing parameters
- Always ask user for their **experience level** to adjust recipe complexity
- If user mentions specific equipment, adapt the recipe accordingly
- Offer to adjust recipes based on user's feedback after brewing
- For beginners, simplify to 3-4 key steps; for experts, add nuance
- Always remind user that these are starting points — taste and adjust!
