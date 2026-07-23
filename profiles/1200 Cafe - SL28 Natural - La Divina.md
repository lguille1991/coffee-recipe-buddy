---
coffee:
  brand: "1200 Café"
  variety: "SL28"
  process: "Natural"
  farm: "La Divina"
  producer: "Roberto Ulloa"
  origin: "Apaneca, Ilamatepec, Santa Ana, El Salvador"
  elevation: "1550 msnm"
  roast_level: "Unknown canonical level — bag says Brew"
  weight_options:
    - "300 g"
  format: "Whole bean or ground"
  drying: "African beds"
source_image: "bags/sl28-natural-large.jpeg"
reference_method: "Human visual transcription from original image"
local_ocr_method: "Browser OCR against original image"
tags:
  - coffee/profile
  - coffee/el-salvador
  - coffee/sl28
  - coffee/natural
  - ocr/reference
---

# 1200 Café — SL28 Natural — La Divina

## Human Reference Profile

| Field | Reference value |
|---|---|
| Roaster / brand | 1200 Café |
| Label identity | Kenya SL28 |
| Variety | SL28 |
| Process | Natural |
| Farm | La Divina |
| Producer | Roberto Ulloa |
| Region / origin | Apaneca, Ilamatepec, Santa Ana, El Salvador |
| Elevation | 1550 msnm |
| Drying | Camas africanas / African beds |
| Roast text | `Brew` — not a canonical roast level |
| Format | Grano / Molido |
| Net weight | 300 g |
| Roast date | Not printed |

### Tasting Notes

> **Original:** Toronja, pera, té verde, caramelo.  
> **English:** Grapefruit, pear, green tea, caramel.

The profile suggests bright citrus balanced by caramel sweetness and tea-like structure. Body is not explicitly described.

## Local OCR Snapshot

```json
{
  "process": "natural",
  "roast_level": "unknown",
  "finca": "La Divina",
  "producer": "Roberto Ulloa",
  "origin": "Apaneca, Ilamatepec, Santa Ana",
  "altitude_masl": 1550,
  "tasting_notes": ["Toronja", "Pera", "Te verde", "Caramelo"],
  "variety": "SL28"
}
```

## Field Comparison

| Field | Human reference | Local OCR | Result |
|---|---|---|---|
| Brand | 1200 Café | Not extracted | Missing |
| Variety | SL28 | SL28 | Exact |
| Process | Natural | natural | Exact |
| Farm | La Divina | La Divina | Exact |
| Producer | Roberto Ulloa | Roberto Ulloa | Exact |
| Region | Apaneca, Ilamatepec, Santa Ana | Same | Exact |
| Country | El Salvador, from bag seal | Not included in origin | Partial auxiliary detail |
| Elevation | 1550 msnm | 1550 | Exact |
| Roast level | `Brew`, unsupported | `unknown` | Correct canonical behavior |
| Tasting notes | Four printed notes | Same four notes | Exact |
| Drying | African beds | Not mapped | Missing auxiliary detail |
| Format / weight | Whole/ground; 300 g | Not mapped | Unsupported / missing |

## OCR Gaps

- Core Analysis fields are correct.
- Brand, country seal, drying method, format, and weight are not represented.
- Keeping `Brew` as `unknown` is correct because it is not a supported roast level.

