---
name: coffee-recipe-generator
description: Use when the user asks to analyze a coffee bag photo, create or adjust a brewing recipe, or research coffee science, equipment, or competition techniques. Covers bean profiling, pour-over recipes, grind setting calculation, and primary-source brewing research.
version: 1.0.0
author: Hermes Agent
tags: [Coffee, Brewing, Barista, Research, Obsidian]
---

# Specialty Coffee Workflows

## When to Use

Load this skill when the user:
- Shares a photo of a coffee bag or label
- Asks to create, generate, or adjust a brewing recipe
- Asks to **adapt an existing recipe** to a different bean, brewer, or equipment version
- Wants to research brewing science, equipment, or competition techniques
- Needs to save coffee profiles or recipes to an Obsidian vault

## Required Inputs

| Workflow | Required Inputs |
|----------|----------------|
| **Bag Analysis** | Image of the coffee bag/label |
| **Recipe Generation** | Brew method, coffee dose (g), origin, processing method, grinder model |
| **Recipe Adaptation** | Base recipe, target bean profile OR target brewer/equipment version, desired flavor outcome |
| **Research** | Topic or question (e.g., "extraction science", "Orea V4 bottoms", "4:6 method", "Kalita Wave Mino vs classic") |

Optional adjustments: roast level, strength preference, flavor goals, equipment available.

---

## Workflow A: Bag Analysis

1. **Extract** — Use `vision_analyze` on the image with a structured prompt requesting: Brand, Variety, Processing method, Farm/Producer, Origin, Elevation, Roast level, Tasting notes (both languages), Roast date.
2. **Normalize** — Standardize processing terms, convert elevation to `msnm`, preserve bilingual tasting notes, classify acidity/sweetness balance.
3. **Build Profile** — Fill `templates/coffee-profile.md`. Generate a safe filename: `{Brand} - {Variety} {Process} - {Farm or Origin}.md`.
4. **Save** — Write to `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Vault/Coffee Brewing/Profiles/{filename}.md`. Create parent dirs if needed.
5. **Confirm** — Report the saved path and a summary table of extracted data, noting missing or unclear fields.

> **Pitfalls:** Ask for a clearer photo if critical fields (variety, process, origin) are unreadable. Do not guess a missing process method. **If no image has been provided yet, proactively state the intended workflow: you will use `templates/coffee-profile.md` and save to `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Vault/Coffee Brewing/Profiles/{filename}.md` once the image is received. This demonstrates workflow awareness even when blocked on input.**

---

## Workflow B: Recipe Generation

1. **Check for existing bean profile** in `Coffee Brewing/Profiles/` of the user's Obsidian vault. If found, pull origin, process, variety, roast, elevation, and tasting notes. These are primary-source data — do not override them with generic assumptions.
2. **Gather inputs** — Confirm brew method, dose, and grinder. Origin and processing method are non-negotiable.
3. **Select base** — Load `references/brew-method-defaults.md` for the chosen method's base parameters.
4. **Calculate grind** — Load `references/grind-determinants.md`. Apply the five-determinant stack: method base → processing → origin/altitude → roast → variety. If the user named a grinder, look up exact clicks in `references/grinder-settings.md`.
5. **Adjust temperature** — Load `references/origin-processing-guide.md`. Apply origin-specific temp and roast-level adjustments.
6. **Build recipe** — Fill `templates/recipe-output.md` with all calculated values. **MANDATORY SECTIONS (must appear in this order):** Coffee Details, Overview, Flavor Profile, Brew Timeline (markdown table with Time/Action/Total Water columns), Brewing Steps (numbered steps each with Time, Water amount, Pour Pattern, and Pour Speed sub-bullets), Troubleshooting Guide (markdown table with If your coffee tastes / The problem is likely / Try adjusting columns), Adjusting for Your Taste. Do not merge, omit, or simplify any section.
7. **Offer pairing context** (optional) — If the user seems unsure about method choice, load `references/brew-method-pairings.md` or `references/equipment-profiles.md` and suggest alternatives.
8. **Special techniques** (if requested) — For the 4:6 method, load `references/4-6-method.md` and generate a Kasuya-style recipe.
9. **Closing** — Remind these are starting points; offer refinement after brewing.

> **Pitfalls:** Ask for a clearer photo if critical fields (variety, process, origin) are unreadable. Do not guess a missing process method.

---

## Workflow D: Recipe Adaptation

Use this when the user wants to take an existing recipe and apply it to a **different bean** (e.g., "adapt my Prismo recipe for Geisha Natural instead of Pacamara") or a **different brewer/equipment version** (e.g., "how do I change this Kalita recipe for the Mino 185?").

1. **Read the existing recipe** and the existing bean profile (if available in the vault). Identify the base parameters: dose, ratio, grind, temp, steep time, pours.
2. **Identify what changed:**
   - **Bean swap:** Compare process (washed vs natural vs honey), variety (Geisha vs Pacamara), roast level, elevation. Each changes extraction behavior.
   - **Brewer swap:** Compare flow rate, thermal mass, filter type, geometry. Faster drain needs finer grind or more pours. Higher thermal mass needs adjusted preheat or starting temp.
   - **Attachment swap:** e.g., Prismo (metal filter, full immersion) vs standard AeroPress (paper, partial drip) changes body and clarity.
3. **Apply adaptation rules** (see `references/brewer-version-adaptation.md`):
   - **Faster drain / less restriction** → grind finer, add more pours, or extend steep.
   - **Slower drain / more restriction** → grind coarser, reduce pours, or shorten steep.
   - **Higher thermal mass (ceramic)** → preheat thoroughly; may start 1–2 °C cooler because the brewer holds heat better.
   - **Lower thermal mass (metal/glass)** → preheat is critical; may start 1–2 °C hotter.
   - **Metal filter vs paper** → metal = more oils/body; paper = cleaner/lighter. Adjust ratio or dose to compensate.
   - **Natural → Washed** → naturals have more ferment/fruit body; washed is cleaner. For washed, consider finer grind or more contact time to build sweetness.
   - **Delicate variety (Geisha) → Bold variety (Pacamara)** → Geisha needs gentler extraction (lower temp, shorter steep); Pacamara can handle more heat and time.
4. **Build the adapted recipe** using `templates/recipe-output.md` with a clear "Changes from Base" section.
5. **Set expectations honestly.** Some beans cannot achieve the same target as others (e.g., "Geisha will never get as bold as Pacamara Black Honey — expect 'elegant bold' not 'punch in the mouth bold'").
6. **Save** to the vault under `Recipes/` if requested.

> **Pitfalls:** Do not blindly copy numbers from one bean to another without adjusting for process and variety. Do not pretend a delicate Geisha can achieve the same syrupy body as a Black Honey Pacamara — set realistic flavor expectations.

---

## Workflow C: Primary-Source Research

1. **Skip general search engines** — Google/Bing/DuckDuckGo frequently serve CAPTCHAs to headless sessions.
2. **Navigate directly** to relevant primary-source domains (see `references/coffee-research-sources.md` for domain list, search tactics, and the HCG grinder-settings extraction workflow).
3. **Extract** — Use `browser_snapshot(full=true)` or `browser_console` with `document.querySelector('article').innerText` for long articles.
4. **Synthesize** — Compile into structured markdown with sections: Summary, Key Mechanisms, Practical Effects / Comparison Table, Expert Techniques, Sources (exact URLs), Action Items.
5. **Validate structure** — Before saving, verify the output contains all 6 required sections above. If any section is missing, expand the synthesis until complete.
6. **Save** — Persist to the Obsidian vault using the `obsidian-research` skill or direct write.

> **Pitfalls:** Manufacturer Shopify sites (e.g., Orea) may 404 on direct product URLs in headless mode; navigate via shop pages. Very long WordPress articles may truncate in snapshots — use console extraction. **Coffee blogs (Barista Hustle, Prima, Perfect Daily Grind, Sprudge) frequently serve Cloudflare challenges or dead links; when a method's primary source blog is inaccessible, search GitHub for open-source calculator implementations — raw `githubusercontent.com` files bypass all rendering and bot issues and often contain the exact parameters.**
>
> **Supplementary sources when primary blogs are blocked:** Google AI overviews and Reddit discussions (especially r/pourover, r/coffee) often contain verbatim competition recipes and user-validated bottom/filter pairings. Manufacturer guide pages (e.g., `orea.uk/guides-v4`) are usually more stable than their Shopify product pages.

---

## References Index

| File | Workflow Step | Purpose |
|------|---------------|---------|
| `references/brew-method-defaults.md` | B-3, D-3 | Base parameters per brew method |
| `references/grind-determinants.md` | B-4 | Five-determinant grind calculation |
| `references/grinder-settings.md` | B-4 | Exact click settings for K-Ultra, Q-Air, Encore ESP, C2 |
| `references/origin-processing-guide.md` | B-5 | Origin, variety, and roast temp guidance |
| `references/brew-method-pairings.md` | B-7 | Matching coffee profile to brew method |
| `references/equipment-profiles.md` | B-7 | Personal brewer design notes and pairings |
| `references/troubleshooting.md` | B-6 / standalone | Taste diagnosis and fixes |
| `references/pour-patterns.md` | B-6 | Pour pattern descriptions and speed reference |
| `references/4-6-method.md` | B-8 | Tetsu Kasuya competition technique |
| `references/coffee-research-sources.md` | C-2 | Primary source domains, HCG workflow, note templates |
| `references/grind-size-extraction-yield.md` | C-5 | Condensed primary-source research: grind size vs. extraction yield in pour-over |
| `references/orea-v4-research.md` | C-5 / standalone | Orea V4 bottoms, filters, competition recipes, and research pitfalls |
| `references/brewer-version-adaptation.md` | D-3 | Adapting recipes between brewer versions (e.g., classic Kalita → Mino, AeroPress → Prismo) |
| `templates/coffee-profile.md` | A-3 | Structured bean profile scaffold |
| `templates/recipe-output.md` | B-6, D-4 | Recipe output scaffold |
