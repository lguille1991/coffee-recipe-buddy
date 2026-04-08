import fs from 'fs'
import path from 'path'
import { BeanProfile } from '@/types/recipe'

function readDoc(relativePath: string): string {
  const full = path.join(process.cwd(), 'docs', relativePath)
  try {
    return fs.readFileSync(full, 'utf-8')
  } catch {
    return `[Missing doc: ${relativePath}]`
  }
}

export function buildExtractionPrompt(): string {
  return `You are an expert coffee specialist with deep knowledge of specialty coffee bags and their labeling conventions.

Your task is to analyze the image of a coffee bag and extract structured metadata.

Return ONLY a valid JSON object with this exact structure:
{
  "bean": {
    "bean_name": "string or null",
    "roaster": "string or null (the coffee brand or roastery — look for logos, brand stamps, company names printed on the bag; NOT the farm or producer)",
    "variety": "string or null (e.g. Gesha, Bourbon, Typica, Caturra, Pacamara, SL28, SL34). IMPORTANT: If the bag prominently shows a country name like 'Kenya' but the origin is different (e.g., origin is El Salvador), extract 'Kenya' as the variety - this indicates Kenyan varieties (SL28/SL34) grown outside Kenya",
    "finca": "string or null (farm/estate name, e.g. Finca La Palma)",
    "producer": "string or null (producer or farmer name)",
    "process": "washed" | "natural" | "honey" | "anaerobic" | "unknown",
    "origin": "string or null (country or region)",
    "altitude_masl": number or null,
    "roast_level": "light" | "medium-light" | "medium" | "medium-dark" | "dark",
    "tasting_notes": ["string", ...] or []
  },
  "confidence": {
    "bean_name": 0.0–1.0,
    "roaster": 0.0–1.0,
    "variety": 0.0–1.0,
    "finca": 0.0–1.0,
    "producer": 0.0–1.0,
    "process": 0.0–1.0,
    "origin": 0.0–1.0,
    "altitude_masl": 0.0–1.0,
    "roast_level": 0.0–1.0,
    "tasting_notes": 0.0–1.0
  }
}

Rules:
- Confidence score reflects how certain you are about each field (1.0 = explicit text on bag, 0.5 = inferred, 0.3 = guessed).
- For process: if not stated, infer from roast level and origin clues. If truly unknown, use "unknown".
- For roast_level: if not stated, infer from color descriptions (e.g., "bright", "fruity" → light; "dark chocolate", "bold" → dark).
- Tasting notes: extract as an array of individual descriptors (e.g., ["blueberry", "jasmine", "citrus"]).
- altitude_masl: extract the number only (e.g., 1800 for "1800m" or "1800 masl").
- Return null for unknown fields — do NOT make up values you cannot infer from the image.
- Zero extra text outside the JSON object.`
}

export function buildRecipePrompt(
  bean: BeanProfile,
  method: string,
  targetVolumeMl?: number,
): { system: string; user: string } {
  const rangeSystem = readDoc('coffee-range-system-skill.md')
  const methodLogic = readDoc('method-decision-logic.md')
  const outputFormat = readDoc('output-format.md')
  const kUltraTable = readDoc('grinder-tables/1zpresso-k-ultra-grind-table.md')
  const qAirTable = readDoc('grinder-tables/1zpresso-q-air-grind-table.md')
  const baratzaTable = readDoc('grinder-tables/baratza-encore-esp-grind-table.md')
  const timemoreC2Table = readDoc('grinder-tables/timemore-c2-grind-table.md')

  const system = `You are an expert specialty coffee barista and recipe developer. Your task is to generate a precise, structured pour-over recipe following the Coffee Range System.

## COFFEE RANGE SYSTEM (follow exactly)

${rangeSystem}

---

## METHOD DECISION LOGIC (context for why this method was selected)

${methodLogic}

---

## OUTPUT FORMAT (your output must match this exactly)

${outputFormat}

---

## GRINDER CONVERSION TABLES

### 1Zpresso K-Ultra (primary reference)

${kUltraTable}

### 1Zpresso Q-Air

${qAirTable}

### Baratza Encore ESP

${baratzaTable}

### Timemore C2

${timemoreC2Table}

---

## HARD CONSTRAINTS (MUST follow every one)

1. Follow Block 6 mandatory decision order exactly — record every step in range_logic.
2. Final operating range MUST be ≤ 10 K-Ultra clicks wide (Block 5B accumulation cap).
3. Include grind settings for ALL 4 grinders (k_ultra, q_air, baratza_encore_esp, timemore_c2).
4. Baratza starting_point MUST be within clicks 14–24 for any pour-over method.
4b. Timemore C2 starting_point MUST be within clicks 14–22 for any pour-over method.
5. steps[].water_poured_g must sum to exactly water_g.
6. water_accumulated_g in last step must equal water_g.
7. All 5 quick_adjustments keys must be present and actionable.
8. ratio must be within the method's Block 1B range.
9. Output ONLY the JSON object — zero extra text before or after.
10. compressed field in range_logic MUST be true if you applied Block 5B compression, false otherwise.
11. If target_volume_ml is provided in the input, scale the recipe so that water_g equals that value exactly. Adjust coffee_g to maintain the method's ratio.
12. coffee_g MUST be a whole integer — always round to the nearest gram. Never output a decimal dose (e.g. 14.97 → 15).`

  const payload: Record<string, unknown> = { method, bean }
  if (targetVolumeMl && targetVolumeMl > 0) {
    payload.target_volume_ml = targetVolumeMl
  }
  const user = JSON.stringify(payload, null, 2)

  return { system, user }
}
