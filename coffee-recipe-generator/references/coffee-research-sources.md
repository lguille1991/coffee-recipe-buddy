# Coffee Research from Primary Sources

**Trigger:** User asks for research on coffee brewing, extraction, flavor science, equipment (brewers, grinders, filters, bottoms), or competition techniques.

## Pitfall: Search Engines Are Often Blocked
Google, DuckDuckGo, and Bing frequently present CAPTCHAs or bot checks in headless browser sessions. Do not rely on them as a first step.

## Pitfall: Coffee Blogs and Manufacturer Sites Also Block Headless Browsers
- **Barista Hustle**, **Prima Coffee**, **Perfect Daily Grind**, **Sprudge**, and **Blue Bottle** frequently return 404s or serve Cloudflare bot challenges to headless sessions.
- **Medium** (where some coffee articles are cross-published) presents Cloudflare verification.
- **Shopify manufacturer sites** (e.g., Orea) may 404 on direct product URLs.
- **YouTube** search results are accessible, but extracting precise timing data or procedure details from video pages is unreliable in headless mode.

> **Workaround:** When blog posts are inaccessible, search GitHub for open-source **calculator implementations** or **recipe apps** of the method in question. These repos often contain the exact parameters, timing intervals, and formulas extracted from primary sources (e.g., `aeyoll/4-6-method`, `meenaviyal/v60-calculator`). Raw file URLs (`raw.githubusercontent.com`) bypass all rendering issues.

## Reliable Primary Source Domains
Navigate directly to these sites with `browser_navigate`:

| Domain | Focus | Search Method |
|---|---|---|
| `coffeeadastra.com` | Percolation physics, extraction science, dripper design | Use site search box or navigate `/category/...` |
| `scottrao.com/blog` | Brewing theory, roasting, equipment | Use blog search box |
| `jameshoffmann.co.uk` | Brew guides, technique videos, equipment reviews | Browse `/the-ultimate` or search (may be limited) |
| `baristahustle.com/blog` | Barista technique, research, education | Browse categories |
| `honestcoffeeguide.com` | Grinder settings, brew guides | Direct article navigation; see HCG workflow below |
| `orea.uk` | Orea brewer specs, bottoms, filters, official guides | Navigate via shop or guides pages; direct product URLs may fail |

## HCG Grinder Settings Extraction Workflow

When adding a new grinder to the `references/grinder-settings.md`:

1. Navigate to `https://honestcoffeeguide.com/coffee-grind-size-chart/`
2. Use the **Brand** dropdown → select the manufacturer (e.g., "Timemore")
3. Scroll down to the manufacturer heading in the static list below the chart
4. Click the specific **model** link (e.g., "C2") — this loads a dedicated page with the full table
5. Extract the table data: brew method names and click ranges
6. Note any warnings (e.g., "Avoid settings below 6 clicks")
7. Also note the micron range if stated on the page
8. Append to `grinder-settings.md` using the same format as existing tables (Brew Method | Setting | Notes)
9. Add practical starting-point notes for common methods (V60, AeroPress, Chemex) based on the midpoints of the HCG ranges
10. Include the HCG source URL

> **Tip:** The interactive dropdowns on HCG's chart page can be finicky in headless browsers. If the dropdowns don't populate, scroll down to the static brand/model link list below the chart and click the model name directly — it links to `/[brand]-[model]-grind-settings/`.

## Workflow
1. **Skip search engines.** Go directly to 2-3 relevant domains above.
2. **Use site-internal search** with the browser tool (`browser_type` into search box + Enter).
3. **Extract content** with `browser_snapshot(full=true)` or `browser_vision` for complex layouts.
4. **Synthesize** findings into structured markdown with sections:
   - Summary
   - Key Mechanisms
   - Practical Effects / Comparison Table
   - Expert Techniques (Hoffmann, Rao, Kasuya, Winton, Gagné, etc.)
   - Sources (with exact URLs)
   - Action Items for the user to test
5. **Save** using the `obsidian-research` skill or directly to `~/Documents/Obsidian Vault/`.

## Note Structure Template
Use this for research notes saved to Obsidian:

```markdown
# [Topic]

**Date:** YYYY-MM-DD
**Agent:** Hermes
**Tags:** #coffee-brewing #[topic-tag]

## Summary

## Key Mechanisms

## Effects on [Flavor/Clarity/Body/etc.]

| Technique | Pour Count | Flavor | Clarity | Body | Risks |
|---|---|---|---|---|---|

## Expert Techniques

## Sources and References

## Action Items
- [ ] Test...
```

## Tips
- For Gagné's physics posts, `browser_navigate` to the exact URL if known; his content is text-heavy and renders well in snapshots. **However, very long WordPress articles (e.g., AeroPress brews) can exceed 1000 lines and truncate severely in `browser_snapshot(full=true)`.** If the snapshot is clearly incomplete, use `browser_console` with `document.querySelector('article').innerText` to extract the full text.
- **CrossRef API for DOI verification:** When you need to confirm a DOI or find bibliographic details for a peer-reviewed paper (e.g. Cameron et al. 2020), use `curl "https://api.crossref.org/works?query.title=<title>&rows=3"`. This bypasses paywalls and bot checks. Extract the DOI from the JSON response under `.message.items[0].DOI`.
- For Hoffmann's Squarespace site, `curl` often returns mostly JS/CSS; prefer the browser. Note that deep links (e.g., `/the-ultimate-aeropress-technique`) may 404 in headless mode; browse from the homepage or `/the-ultimate-series` instead.
- Scott Rao's blog is searchable and loads well in the browser. If clicking a search result does not navigate, extract text directly from the search result page or navigate to the article URL manually.
- **Manufacturer Shopify sites (e.g., Orea):** Direct product URLs may return "Not Found" in headless sessions. Navigate to the shop page first, then click through product listings. Use `browser_vision` or scroll to reveal product descriptions if snapshots are sparse.
- **Cross-reference manufacturer claims with expert theory:** When researching equipment (brewer bottoms, grinder burrs, filters), pair manufacturer descriptions with theory blogs (Rao on bed depth, Gagné on bypass/percolation) to explain *why* a design choice produces a given cup result.
- **HCG recipe pages** (e.g., `/brew-recipes/aeropress-espresso/`) contain embedded equipment and accessory commentary beyond the grind chart. Search recipe pages when researching filters, attachments, or brewer modifications.
- Always include exact URLs in Sources so the user can verify claims.

## Equipment Comparison Note Template
When researching accessories, filters, or bottoms, use this enhanced structure that emphasizes side-by-side comparison:

```markdown
# [Equipment / Accessory Name]

**Date:** YYYY-MM-DD
**Agent:** Hermes
**Tags:** #coffee-brewing #[equipment-tag]

## Summary

## Key Mechanisms
(How it works physically — pressure, bypass, pore size, etc.)

## Effects on the Final Cup

### [Body, Clarity, Flavor, etc.]

## Comparison Table

| Setup | Pressure | Bypass | Clarity | Body | [Other] | Grind Recommendation | Steep Time |
|---|---|---|---|---|---|---|---|
| Baseline | | | | | | | |
| With accessory | | | | | | | |

## Expert Techniques

## Sources and References

## Action Items
- [ ] Test...
```
