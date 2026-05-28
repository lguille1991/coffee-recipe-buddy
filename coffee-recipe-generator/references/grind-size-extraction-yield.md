# Grind Size vs. Extraction Yield in Pour-Over

**Topic:** How grind size affects extraction yield in pour-over brewing.
**Sources:** Primary — original experiments, peer-reviewed physics, first-principles analysis.
**Last updated:** 2026-05-01

---

## Core Finding

Grind size affects extraction yield through a tension between **surface area** (finer = more potential extraction) and **flow uniformity** (finer = slower, less uniform flow). The relationship is NOT simply linear, and grinding too fine can produce astringency without lowering the *average* extraction yield.

## Key Mechanisms

### 1. Diffusion Limit at Typical Grind Sizes
Barista Hustle cupping experiment (sifted narrow PSDs): measured extraction yield vs. time for fine/medium/coarse.

Gagné (2020) modeled this and found water extracts to a characteristic depth of ~**40 microns**. Particles larger than ~100 microns have under-extracted cores within normal brew times. This means typical filter grind sizes waste significant coffee mass.

### 2. The Extraction Yield vs. Grind Size Curve
Gagné controlled V60 experiment (EG-1 grinder, SSP ultra-low-fines burrs), grind settings 3.0–9.0:
- Beverage concentration (and extraction yield) **kept rising** as grind got finer.
- Taste peaked at grind size **8.0**; became astringent below **6.0**.
- This contradicts the old "bell curve" assumption from espresso research.
- Hypothesis: deviation from linear trend indicates **uneven flow**, not a drop in average yield.

### 3. Flow Uniformity / Percolation Physics
Gagné (2019) applied **Stanley et al. (2003)** percolation simulations to coffee beds:
- Water flows faster through larger voids, slower through smaller voids (no-slip boundary condition + viscosity).
- At very slow flow rates (Re < ~0.6, ~0.2 g/s in V60), uniformity is poor and barely improves with small flow increases.
- Finer grinds increase bed resistance, slowing flow into the **low-uniformity regime**, causing uneven extraction and astringency even without visible channels.

### 4. Brew Ratio + Contact Time
Gagné proposes the problem is not grind size alone, but **fine grind + long contact time + high brew ratio** (e.g. 1:16–17).
- Solution: **bypass brewing** — use a smaller ratio (e.g. 1:10–12) with finer grind, then dilute to desired strength. Reduces contact time while preserving higher surface-area extraction.

### 5. Grinder Quality (PSD)
- Narrower particle size distribution (e.g. SSP ultra-low-fines burrs) raises average extraction yield ~1% and delays astringency, but does **not** eliminate the threshold.
- Excessive agitation/spinning can cause fines migration and filter clogging, imitating a lower-quality grinder.

## Peer-Reviewed Paper

**Cameron et al. (2020)** — *Systematically Improving Espresso: Insights from Mathematical Modeling and Experiment.* Matter, 2(3), 631-648. DOI: 10.1016/j.matt.2019.12.019
- Mathematical model: even flow → linear increase in extraction yield as grind size decreases.
- Espresso experiments: uneven flow causes yield to peak then drop at very fine grinds.
- Framework applied by Gagné to filter coffee (pour-over regime is wider but physics is similar).

## Practical Comparison Table

| Factor | Coarser Grind | Finer Grind | Too Fine |
|--------|--------------|-------------|----------|
| Surface area | Lower | Higher | Higher |
| Avg. extraction yield | Lower | Higher | Plateau / context-dependent |
| Flow rate | Faster | Slower | Very slow / clogged |
| Flow uniformity | Better | Worse | Poor |
| Taste | Under-extracted, sour | Balanced, sweet | Astringent, harsh |
| Particle core extraction | Poor | Better | Better surface, uneven overall |

## Expert Techniques to Push the Finer-Grind Limit

1. **Bypass brewing** — lower ratio (1:10–12), finer grind, dilute afterward.
2. **Continuous pour / maintain slurry volume** (Hoffmann method) — keeps flow rate higher, avoids low-flow end phase.
3. **Warmer slurry** — less viscous water → faster, more uniform flow.
4. **Cut off brew early** — eliminate final low-flow phase.
5. **Minimize agitation/spin** — just enough to break channels, not enough to cause fines migration.
6. **High-quality grinder with narrow PSD** — delays astringency threshold.

## Primary Sources

1. Gagné, J. (2020). *Why Can't we Grind Coffee Finer for Pour Over?* Coffee Ad Astra. https://coffeeadastra.com/2020/04/02/why-cant-we-grind-coffee-finer-for-pour-over/
2. Gagné, J. (2019). *Extraction Uniformity and Channeling.* Coffee Ad Astra. https://coffeeadastra.com/2019/10/04/extraction-uniformity-and-channeling/
3. Gagné, J. (2019). *Measuring and Reporting Extraction Yield.* Coffee Ad Astra. https://coffeeadastra.com/2019/02/17/measuring-and-reporting-extraction-yield/
4. Gagné, J. (2016/2019). *Why Spin the Slurry?* Guest post, Scott Rao blog.
5. Cameron, M. I. et al. (2020). *Systematically Improving Espresso.* Matter. DOI: 10.1016/j.matt.2019.12.019
6. Stanley, H. E. et al. (2003). Percolation in disordered porous media (cited in Gagné 2019).
7. Barista Hustle. Cupping experiment with sifted particle sizes (video data referenced in Gagné 2020).
