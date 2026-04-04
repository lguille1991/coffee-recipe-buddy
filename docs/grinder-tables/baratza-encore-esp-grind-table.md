# Baratza Encore ESP Grind Table

The Baratza Encore ESP is an entry-level electric grinder with 40 click settings (1–40).

**Scale:** 1 (finest) to 40 (coarsest). Whole-number clicks only.
**Pour-over useful range: clicks 14–24** (outside this zone, precision is reduced).
**Espresso range: clicks 1–10.**

---

## Click → Approximate Micron Mapping

| Baratza Click | Approx. Microns | Grind Zone |
|---|---|---|
| 1 | 200 | Finest espresso |
| 5 | 300 | Espresso |
| 8 | 380 | Espresso medium |
| 10 | 430 | Espresso coarse |
| 12 | 500 | Moka / fine filter |
| 14 | 600 | Pour-over fine (lower bound for pour-over) |
| 15 | 650 | Pour-over fine-mid |
| 16 | 700 | Pour-over mid-fine |
| 17 | 750 | Pour-over mid |
| 18 | 800 | Pour-over mid (V60 typical) |
| 19 | 850 | Pour-over mid-coarse |
| 20 | 900 | Pour-over coarse (Switch / Kalita) |
| 21 | 950 | Pour-over coarse |
| 22 | 1000 | Coarse pour-over / Chemex lower |
| 23 | 1050 | Chemex mid |
| 24 | 1100 | Chemex / coarse (upper pour-over bound) |
| 26 | 1150 | Coarse |
| 28 | 1200 | Very coarse |
| 30 | 1250 | Cold brew lower |
| 35 | 1350 | Cold brew |
| 40 | 1500 | Coarsest |

---

## Conversion from K-Ultra Microns to Baratza

| K-Ultra Clicks | Microns | Baratza Click | Notes |
|---|---|---|---|
| 70 | 770 | 17 | Fine pour-over |
| 72 | 792 | 17–18 | AeroPress fine |
| 74 | 814 | 18 | |
| 76 | 836 | 18–19 | Orea fine |
| 78 | 858 | 19 | V60 lower |
| 80 | 880 | 19–20 | V60 mid / Switch lower |
| 82 | 902 | 20 | |
| 84 | 924 | 21 | V60 upper |
| 86 | 946 | 21–22 | Switch / Kalita |
| 88 | 968 | 22–23 | Chemex lower |
| 90 | 990 | 23 | Chemex mid |

---

## Pour-Over Zone Constraint

**For ALL pour-over methods, Baratza starting_point MUST be within clicks 14–24.**

- If conversion maps below 14: floor at 14, add note "At minimum pour-over setting; may extract slightly fast."
- If conversion maps above 24: cap at 24, add note "At maximum recommended pour-over setting; reduced precision above this point."

AeroPress may go below 14 (fine filter range is acceptable).

## Precision Note

The Baratza Encore ESP has wider step intervals than hand grinders. This means:
- 1 Baratza click ≈ 3–5 K-Ultra clicks in coarseness change.
- Dial adjustments are less granular — compensate with other variables (water temp, pour speed).
- Always note this reduced precision in `baratza_encore_esp.note`.
