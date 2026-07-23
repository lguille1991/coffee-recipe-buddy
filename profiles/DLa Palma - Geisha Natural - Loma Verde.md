---
coffee:
  brand: "D'La Palma Café"
  variety: "Geisha"
  process: "Natural"
  farm: "Loma Verde"
  producer: "Esperanza Aguilar"
  origin: "El Salvador, Central America"
  elevation: "1200 msnm / masl"
  roast_level: "Medium-light"
  weight_options:
    - "454 g"
    - "340 g"
    - "227 g"
  format: "Whole bean indicated; bag also lists ground options"
source_image: "bags/gesha-natural-large.jpeg"
reference_method: "Human visual transcription from original image"
local_ocr_method: "Browser OCR against original image"
tags:
  - coffee/profile
  - coffee/el-salvador
  - coffee/geisha
  - coffee/natural
  - coffee/medium-light
  - ocr/reference
---

# D'La Palma — Geisha Natural — Loma Verde

## Human Reference Profile

| Field | Reference value |
|---|---|
| Roaster / brand | D'La Palma Café de Especialidad |
| Variety | Geisha |
| Process | Natural |
| Farm | Loma Verde |
| Producer | Esperanza Aguilar |
| Origin | El Salvador, Centroamérica |
| Elevation | 1200 msnm / masl |
| Roast level | Medio Claro / Medium Light |
| Edition | Special Edition |
| Weight options | 454 g, 340 g, 227 g |
| Roast date | Blank / not supplied |

### Tasting Notes

> **Original:** Fragancia dulce, delicada y floral, chocolate. Notas a higo, durazno, mermelada de frutos del bosque, Pu-erh tea. Resabio cremoso.  
> **English:** A sweet, delicate, and floral fragrance with chocolate notes. Hints of fig, peach, forest-fruit jam, Pu-erh tea, and a creamy aftertaste.

The printed profile is sweet, delicate, floral, and creamy. Acidity is not explicitly characterized.

## Local OCR Snapshot

```json
{
  "process": "unknown",
  "roast_level": "medium-light",
  "variety": "Geisha",
  "finca": "Loma Verde",
  "tasting_notes": [
    "Fragancia dulce",
    "delicada y floral",
    "Notas a Hi",
    "igo",
    "Durazno",
    "erh tea",
    "Resabio",
    "chocolate"
  ],
  "origin": "El Salvador",
  "producer": "Esperanza Aguilar"
}
```

## Field Comparison

| Field | Human reference | Local OCR | Result |
|---|---|---|---|
| Brand | D'La Palma Café | Not extracted | Missing |
| Variety | Geisha | Geisha | Exact |
| Process | Natural | `unknown` | Missing |
| Farm | Loma Verde | Loma Verde | Exact |
| Producer | Esperanza Aguilar | Esperanza Aguilar | Exact |
| Origin | El Salvador, Central America | El Salvador | Partial |
| Elevation | 1200 msnm | Not extracted | Missing |
| Roast level | Medium-light | medium-light | Exact |
| Tasting notes | Complete bilingual paragraph | Fragmented list | Partial / noisy |
| Roast date | Blank | Not mapped | Correctly absent |

## OCR Gaps

- The curved orange `NATURAL` text is missed on the original image.
- `1200` and its `msnm / masl` unit are visible but not paired.
- `Higo` is split into `Hi` + `igo`; `Pu-erh` loses its prefix.
- Forest-fruit jam and creamy-aftertaste semantics are incomplete.
- The sanitized fixture currently hides these original-resolution failures.

