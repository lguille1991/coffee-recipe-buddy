# Timemore C2 Grind Table

The Timemore C2 is an entry-level hand grinder with a click-based adjustment system.

**Scale:** 0 (finest) to ~30 (coarsest). Whole-number clicks only.
**Resolution:** ~40–80 microns per click (non-linear; coarser zones have wider steps).
**Pour-over useful range: clicks 14–22** (outside this zone, precision is reduced).

---

## Click → Approximate Micron Mapping

| C2 Clicks | Approx. Microns | Grind Zone |
|---|---|---|
| 2  | 100  | Turkish |
| 4  | 200  | Turkish / Espresso border |
| 6  | 230  | Espresso fine |
| 8  | 300  | Espresso |
| 10 | 350  | Espresso coarse / Moka |
| 12 | 400  | Moka |
| 14 | 450  | Moka / fine filter |
| 16 | 550  | Pour-over fine |
| 18 | 650  | Pour-over mid |
| 20 | 750  | Pour-over (V60 / Kalita typical) |
| 22 | 870  | Pour-over coarse / Chemex lower |
| 24 | 950  | Coarse |
| 26 | 1050 | French Press |
| 28 | 1200 | Very coarse |
| 30 | 1400 | Cold brew / coarsest |

---

## Pour-Over Zone Constraint

**For ALL pour-over methods, C2 starting_point MUST be within clicks 14–22.**

- If conversion maps below 14: floor at 14, add note "At minimum pour-over setting; may extract slightly fast."
- If conversion maps above 22: cap at 22, add note "At maximum recommended pour-over setting; reduced precision above this point."

AeroPress may go below 14 (fine filter range is acceptable).

---

## Precision Note

The Timemore C2 has wider step intervals than most hand grinders. Dial adjustments are less granular — compensate with other variables (water temp, pour speed). Always note this reduced precision in `timemore_c2.note`.
