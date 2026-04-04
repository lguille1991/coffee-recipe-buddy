# Phase 2 — Post-Brew Feedback (Block 9 Navigation) + Manual Fallback

## Goal

Let users refine recipes through post-brew feedback using the **Block 9 navigation rules** (stay within the operating range, adjust one variable at a time), and provide a manual bean entry path as fallback.

---

## Scope

### In Scope

- Post-brew feedback UI (symptom selection → deterministic adjustment per Block 9)
- Adjusted recipe rendering with highlighted changes
- Feedback history tracking (up to 3 rounds per recipe)
- All adjustments stay **within the final operating range** — never break the system
- Manual bean entry as alternative to image upload
- "Reset to original" option

### Out of Scope

- User accounts or persistence (Phase 3)
- Changing the brewing method mid-feedback (user must go back to method selection)
- LLM re-generation for feedback — all adjustments are deterministic

---

## Post-Brew Feedback — Block 9 Navigation Rules

The feedback system implements Block 9 from `coffee-range-system-skill.md`. All adjustments operate **within the final operating range** established during recipe generation.

### Critical rule: one variable at a time

Block 9 + the system rules explicitly state: **do not change multiple variables at once**. Each feedback round adjusts the most impactful variable first.

### Symptom → Adjustment mapping

| Symptom | Primary adjustment | Secondary (if primary didn't help) |
|---|---|---|
| **Too acidic / sour** | Grind finer (toward fine end of operating range) | Increase temperature (within offset-adjusted bounds) |
| **Too bitter / harsh** | Grind coarser (toward coarse end of operating range) | Decrease temperature |
| **Flat / lifeless** | Grind finer (if underextracted) | Increase temperature · increase agitation · lower ratio (more coffee) |
| **Slow drain** | Grind coarser (toward coarse end) | Reduce aggressive pours or agitation |
| **Fast drain** | Grind finer (toward fine end) | Improve bloom or water distribution |

### How adjustments work

1. Take the `range_logic.final_operating_range` from the current recipe (e.g., 79–86 clicks)
2. Take the current `grind.k_ultra.starting_point` (e.g., 82 clicks)
3. Apply the symptom's adjustment direction within the range:
   - "Finer" → move 1–2 clicks toward the low end
   - "Coarser" → move 1–2 clicks toward the high end
4. Recalculate Q-Air and Baratza equivalents via micron mapping
5. If grind is already at the edge of the range, escalate to the secondary adjustment (temp)
6. Temperature adjustments: ±1°C per round, clamped within the offset-adjusted bounds
7. Ratio adjustments (flat/lifeless): move toward the concentrated end of the method's ratio range (Block 1B)

### Adjustment bounds — never leave the system

| Parameter | Bound |
|---|---|
| K-Ultra clicks | Within `range_logic.final_operating_range` |
| Temperature | Within method base ± process offset ± roast offset ± freshness offset |
| Ratio | Within method's ratio range (Block 1B) |
| Bloom time | 30s–60s (Block 4 technique guides) |

### Interaction-aware adjustments (Block 10)

The feedback engine must check for known conflicting combinations before applying adjustments:

| Current recipe state | Feedback symptom | Special handling |
|---|---|---|
| Natural + light roast + already mid-range grind | Too acidic | Don't go much finer — risk saturating cup. Prefer temp increase first. |
| Very fresh coffee (1–7 days) + fine grind | Slow drain | Finer won't help — open coarser, extend bloom |
| Anaerobic + already low temp | Too bitter | Don't drop temp further — go coarser instead |

### Round limits

- Maximum **3 feedback rounds** per recipe
- After round 3: suggest "This bean might work better with a different method" + link back to method selection with the same bean data pre-filled
- Each round shows which variable was changed and by how much

---

## User Flow — Post-Brew Feedback

1. User brews coffee using the generated recipe
2. Returns to recipe card → taps **"How did it taste?"**
3. Selects **one** symptom (single-select to enforce one-variable-at-a-time):
   - ☀️ Too acidic / sour
   - 🔥 Too bitter / harsh
   - 💧 Flat / lifeless
   - 🐌 Draining too slowly
   - 💨 Draining too fast
4. Taps **"Adjust"**
5. Adjustment engine modifies the single most impactful parameter
6. Updated recipe card renders with the **changed value highlighted**
7. A small annotation shows what changed: e.g., "Grind: 82 → 80 clicks (finer)"
8. User can:
   - Brew again → submit feedback again (round 2, then 3)
   - Tap **"Reset to Original"** to revert all changes

---

## User Flow — Manual Bean Entry

1. From the home screen, user taps **"Enter Manually"** (secondary action)
2. Form fields:
   - Roaster name (optional)
   - Bean name (optional)
   - Origin (optional)
   - Variety (optional — picker with common varieties + freeform)
   - **Process** (required — picker: washed / natural / honey / anaerobic / other)
   - **Roast level** (required — picker: light / medium / medium-dark / dark)
   - Altitude (optional — input in masl)
   - Tasting notes (optional — tag input)
   - Roast date (optional)
3. Taps **"Get Recommendations"** → enters method decision logic → same flow as Phase 1

### Handling sparse input

When data is minimal (only process + roast level):
- Method decision logic uses only these two factors (still deterministic)
- Range system skips Block 5 (density fine-tune)
- Freshness defaults to optimal (8–21 days)
- Recipe notes which assumptions were made in `range_logic`

---

## Technical Breakdown

### Feedback Adjustment Engine

Client-side module (or server-side at `/api/adjust-recipe` if rule engine is server-only).

**Input:**
```json
{
  "current_recipe": { "...full recipe JSON..." },
  "symptom": "too_acidic",
  "round": 1
}
```

**Processing:**
1. Read `range_logic.final_operating_range` and current values
2. Check for Block 10 interaction conflicts
3. Determine primary adjustment direction and magnitude (1–2 clicks or ±1°C)
4. Clamp within bounds
5. If primary variable is already at range edge → escalate to secondary
6. Recalculate grinder conversions (Q-Air, Baratza)
7. Recalculate pour step volumes if ratio changed
8. Return updated recipe JSON with `adjustment_applied` metadata

**Output — updated recipe JSON with diff metadata:**
```json
{
  "...full recipe JSON with updated values...",
  "adjustment_applied": {
    "round": 1,
    "symptom": "too_acidic",
    "variable_changed": "grind",
    "previous_value": "82 clicks",
    "new_value": "80 clicks",
    "direction": "finer",
    "note": "Moved toward fine end of operating range (79–86)"
  }
}
```

### Frontend Changes

| Component | Details |
|---|---|
| Feedback trigger | "How did it taste?" button below recipe card |
| Symptom selector | 5 tappable cards with emoji + label (single-select) |
| Adjusted recipe card | Same component; changed fields get a highlight treatment |
| Diff annotation | Small inline note per changed value: "82 → 80 clicks (finer)" |
| Round counter | "Adjustment 1 of 3" |
| Reset button | "Reset to Original" reverts to the first generated recipe |
| Method switch nudge | After round 3: card suggesting a different method |
| Manual entry form | Separate screen; process + roast level required, rest optional |
| Home screen update | Primary: "Scan Your Coffee" / Secondary: "Enter Manually" |

### API (if server-side feedback)

`POST /api/adjust-recipe`

**Request:**
```json
{
  "current_recipe": { "..." },
  "symptom": "too_acidic",
  "round": 1
}
```

**Response:** Updated recipe JSON with `adjustment_applied`.

---

## Deliverables

1. **Feedback UI** — symptom selector (single-select), round counter, reset
2. **Adjustment engine** — Block 9 rules + Block 10 interaction checks + clamping
3. **Diff rendering** — highlighted changes + inline annotations on recipe card
4. **Method switch nudge** — after round 3, suggest trying a different method
5. **Manual entry form** — process + roast required, optional fields, tag input for notes
6. **Home screen dual-CTA** — scan + manual entry
7. **`POST /api/adjust-recipe`** — if keeping rule engine server-side

---

## Acceptance Criteria

- [ ] User can select exactly one symptom per feedback round
- [ ] Adjustment changes **only one variable** per round (Block 9 / system rules)
- [ ] All adjustments stay within the `final_operating_range` (grind) and offset-adjusted bounds (temp, ratio)
- [ ] Block 10 interaction conflicts are detected and handled (e.g., natural + light + acidic → prefer temp over grind)
- [ ] Changed values are highlighted with previous → new annotation
- [ ] Maximum 3 rounds; after round 3, nudge to try a different method
- [ ] "Reset to Original" reverts all adjustments cleanly
- [ ] Grinder conversions (Q-Air, Baratza) update correctly after each adjustment
- [ ] Pour step volumes recalculate if ratio changes
- [ ] Manual entry flow produces method recommendations with only process + roast level
- [ ] Manual entry with full data produces identical quality recommendations as image flow
- [ ] Missing fields are noted as assumptions in `range_logic`

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| One-variable-at-a-time feels slow to users | Clear UI copy explaining why; show progress ("round 1 of 3") |
| Grind already at range edge but still acidic | Escalate to secondary variable (temp); UI explains the switch |
| Block 10 conflicts produce confusing results | Surface the interaction note to the user (e.g., "For natural + light, adjusting temp first") |
| Manual entry with minimal data → weak recommendations | Default to versatile methods (Switch, AeroPress); note sparse data |
| Client-side vs server-side rule engine drift | Share rule definitions as a common module, or keep all logic server-side |

---

## Estimated Effort

| Task | Estimate |
|---|---|
| Feedback UI (selector, counter, reset, nudge) | 2 days |
| Adjustment engine (Block 9 + Block 10 + clamping) | 3–4 days |
| Diff rendering + annotations | 1–2 days |
| Grinder re-conversion on adjustment | 1 day |
| Manual entry form + validation | 1–2 days |
| Home screen dual-CTA | 0.5 days |
| `/api/adjust-recipe` (if server-side) | 1 day |
| Integration + edge case testing | 2 days |
| **Total** | **~11–15 days** |
