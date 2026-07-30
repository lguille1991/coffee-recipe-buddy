---
coffee:
  brand: "Jaho Artisan Coffee"
  bean_name: "Minas"
  lot_name: "Summer Solstice"
  variety: "Not printed"
  process: "Washed"
  farm: "Not printed"
  producer: "Not printed"
  origin: "Brazil"
  elevation: "Not printed"
  roast_level: "Medium"
  weight_options:
    - "12 oz (handwritten)"
  format: "Not printed"
source_image: "bags/jaho-brazil-washed.jpg"
reference_method: "Human visual transcription from original image"
local_ocr_method: "Browser OCR against original image"
tags:
  - coffee/profile
  - coffee/brazil
  - coffee/washed
  - coffee/medium
  - ocr/reference
---

# Jaho — Minas Washed — Brazil

## Human Reference Profile

| Field | Reference value |
|---|---|
| Roaster / brand | Jaho Artisan Coffee |
| Product / coffee name | Minas |
| Seasonal / lot label | Summer Solstice |
| Origin | Single Origin Brazil |
| Process | Washed |
| Roast level | Medium Roast |
| Variety | Not printed |
| Farm / producer | Not printed |
| Elevation | Not printed |
| Bag weight | 12 oz, handwritten |
| Roast date | Not printed |

### Tasting Notes

> Concord grape, strawberry fruit tart, wildflower honey.

The profile is fruit-forward and honeyed. Acidity and body are not explicitly described.

## Local OCR Snapshot

```json
{
  "process": "washed",
  "roast_level": "medium",
  "bean_name": "Minas",
  "origin": "brazil",
  "tasting_notes": [
    "concord grape",
    "strawberry fruit tart",
    "wildflower honey"
  ]
}
```

## Field Comparison

| Field | Human reference | Local OCR | Result |
|---|---|---|---|
| Brand | Jaho Artisan Coffee | Not extracted | Missing |
| Coffee name | Minas | Minas | Exact |
| Seasonal / lot label | Summer Solstice | Not extracted | Missing auxiliary detail |
| Origin | Brazil | brazil | Exact, casing only |
| Process | Washed | washed | Exact |
| Roast level | Medium | medium | Exact |
| Tasting notes | Three printed notes | Same three notes | Exact |
| Variety / farm / producer / elevation | Not printed | Not extracted | Correctly absent |
| Weight | 12 oz | Not mapped | Unsupported / missing |

## OCR Gaps

- Core Analysis fields are correct for this bag.
- Brand, the `Summer Solstice` lot label, and handwritten weight are not represented.

