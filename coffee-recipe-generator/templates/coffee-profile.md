---
coffee:
  brand: "{{BRAND_NAME}}"
  variety: "{{VARIETY}}"
  process: "{{PROCESS}}"
  farm: "{{FARM_NAME}}"
  producer: "{{PRODUCER_NAME}}"
  origin: "{{COUNTRY, REGION}}"
  elevation: "{{ELEVATION msnm/masl}}"
  roast_level: "{{ROAST_LEVEL}}"
  weight_options:
    - "{{WEIGHT_1}}"
  format: "{{Grain / Ground / Whole Bean}}"
  grind_suggestion:
    - "{{METHOD_1}}"
    - "{{METHOD_2}}"
tags:
  - coffee/profile
  - coffee/{{COUNTRY_TAG}}
  - coffee/{{VARIETY_TAG}}
  - coffee/{{PROCESS_TAG}}
  - coffee/{{ROAST_TAG}}
---

# {{BRAND}} — {{VARIETY}} {{PROCESS}} — {{FARM}}

**Roaster:** {{BRAND}}  
**Origin:** {{ORIGIN}}  
**Farm:** {{FARM}}  
**Producer:** {{PRODUCER}}  
**Variety:** {{VARIETY}}  
**Process:** {{PROCESS}}  
**Elevation:** {{ELEVATION}}  
**Roast Level:** {{ROAST_LEVEL}}  
**Format:** {{FORMAT}}  
**Bag Options:** {{WEIGHTS}}

---

## Tasting Notes

> **Original language:**  
> {{TASTING_NOTES_ORIGINAL}}
>
> **English (if different):**  
> {{TASTING_NOTES_ENGLISH}}

---

## Flavour Profile Summary

- **Fragrance / Aroma:** {{AROMAS}}
- **Flavour:** {{FLAVOURS}}
- **Acidity:** {{ACIDITY_DESCRIPTION}}
- **Aftertaste:** {{AFTERTASTE}}
- **Body:** {{BODY_ESTIMATE}}
- **Balance:** {{BALANCE_NOTES}}

---

## Brewing Notes

| Attribute | Starting Point |
|-----------|---------------|
| **Temperature** | {{TEMP_RANGE}}°C |
| **Grind** | {{GRIND_DESCRIPTION}} |
| **Ratio** | {{RATIO_RANGE}} |
| **Recommended Methods** | {{METHODS}} |

- **Process context:** {{PROCESS_BREWING_NOTES}}
- **Variety context:** {{VARIETY_BREWING_NOTES}}
- **Roast context:** {{ROAST_BREWING_NOTES}}

---

## Equipment Pairing Suggestions

- **{{BREWER_1}}** — {{WHY_BREWER_1}}
- **{{BREWER_2}}** — {{WHY_BREWER_2}}

---

## Related

- [[Grind Settings Reference]]
- [[Brewer Choice Logic]]
- [[Coffee Brewing Index]]

---

*Profile created from bag analysis on {{DATE}}.*
