---
coffee:
  brand: "Tropicália"
  variety: "Bourbon Rosa"
  process: "Washed"
  farm: "Bella Vista"
  producer: "Familia Plazas"
  origin: "Acevedo, Huila (country not printed)"
  elevation: "1750 msnm"
  roast_level: "Unknown — not printed"
  weight_options:
    - "340 g / 12 oz"
  format: "Whole bean"
source_image: "bags/bourbon-rosa-large.jpeg"
reference_method: "Human visual transcription from original image"
local_ocr_method: "Browser OCR against original image"
tags:
  - coffee/profile
  - coffee/bourbon-rosa
  - coffee/washed
  - ocr/reference
---

# Tropicália — Bourbon Rosa Washed — Bella Vista

## Human Reference Profile

| Field | Reference value |
|---|---|
| Roaster / brand | Tropicália |
| Coffee / variety | Bourbon Rosa |
| Process | Lavado / Washed |
| Farm | Bella Vista |
| Producer | Familia Plazas |
| Origin / territory | Acevedo, Huila |
| Elevation | 1750 msnm |
| Roast level | Not printed |
| Format | Whole bean (`fresco en grano`) |
| Bag weight | 340 g / 12 oz |
| Roast date | Not printed |

### Tasting Notes

> **Original:** Manzana, mandarina, panela.  
> **English:** Apple, mandarin, panela (unrefined cane sugar).

The bag presents a fruit-forward, sweet profile. Acidity and body are not explicitly described.

## Local OCR Snapshot

```json
{
  "process": "unknown",
  "roast_level": "unknown",
  "producer": "Familia Plazas",
  "origin": "CASICUL TORA _",
  "finca": "BELLAVISTA",
  "altitude_masl": 1750,
  "variety": "Se a",
  "tasting_notes": ["manzana", "mandarina", "panela"]
}
```

## Field Comparison

| Field | Human reference | Local OCR | Result |
|---|---|---|---|
| Brand | Tropicália | Not extracted | Missing |
| Variety | Bourbon Rosa | `Se a` | Wrong |
| Process | Washed | `unknown` | Missing |
| Farm | Bella Vista | `BELLAVISTA` | Partial — semantic match, formatting wrong |
| Producer | Familia Plazas | Familia Plazas | Exact |
| Origin | Acevedo, Huila | `CASICUL TORA _` | Wrong — column label mapped as value |
| Elevation | 1750 msnm | 1750 | Exact |
| Roast level | Not printed | `unknown` | Correct unknown |
| Tasting notes | Manzana, mandarina, panela | manzana, mandarina, panela | Exact |
| Format / weight | Whole bean; 340 g / 12 oz | Not mapped | Unsupported / missing |

## OCR Gaps

- The original high-resolution photo does not reproduce the sanitized fixture result.
- The label grid is mis-associated: `CAFICULTORA` becomes the origin instead of `ACEVEDO-HUILA`.
- `BOURBON ROSA` and `LAVADO` are visible but not recovered correctly.
- `BELLAVISTA` needs normalization to `Bella Vista`.

