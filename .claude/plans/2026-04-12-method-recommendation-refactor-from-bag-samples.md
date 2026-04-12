# Method Recommendation Refactor From Bag Samples

## Bag Sample Findings To Preserve

- [ ] Use these six sample bags as concrete fixtures for recommendation design and verification:
  - `/Users/guillermoabrego/Downloads/bolsas café/bourbon-rosa Large.jpeg`
  - `/Users/guillermoabrego/Downloads/bolsas café/gesha-anaerobico Large.jpeg`
  - `/Users/guillermoabrego/Downloads/bolsas café/gesha-natural Large.jpeg`
  - `/Users/guillermoabrego/Downloads/bolsas café/gesha-natural-2 Large.jpeg`
  - `/Users/guillermoabrego/Downloads/bolsas café/kenya-natural-el-salvador Large.jpeg`
  - `/Users/guillermoabrego/Downloads/bolsas café/sl28-natural Large.jpeg`
- [ ] Treat the sample set as `6 images` but only `5 distinct coffees` because `gesha-natural Large.jpeg` and `gesha-natural-2 Large.jpeg` appear to be the same `Geisha Natural` lot photographed twice.
- [ ] Preserve the following extracted bean examples as real-world reference cases:
  - `Bourbon Rosa`, washed, likely light roast, notes `manzana`, `mandarina`, `panela`
  - `Geisha`, anaerobic, African beds, `1800 msnm`, medium roast, notes `lime`, `black tea`, `coffee flower`, `maple honey`, `rum-like`
  - `Geisha Natural`, `1200 masl`, medium-light, notes spanning `floral`, `fig`, `peach`, `forest fruit jam`, `pu-erh tea`, `creamy`
  - `Kenya Natural`, `1850 masl`, medium-light, notes spanning `dark chocolate`, `guava`, `peach`, `tamarind`, `cherry`, `orange`, `medium body`, `light floral`
  - `Kenya SL28`, natural, African beds, `1550 msnm`, roast label `brew`, notes `grapefruit`, `pear`, `green tea`, `caramel`
- [ ] Treat these fields as proven bag-visible inputs the parser and recommender should understand because they appear repeatedly in the sample set:
  - cultivar or variety
  - process
  - roast descriptor
  - altitude
  - producer or farm
  - drying method such as `African beds`
  - structured tasting notes
  - body or texture hints such as `medium body` or `creamy aftertaste`
  - tea-like descriptors such as `black tea`, `green tea`, `pu-erh tea`
- [ ] Treat these normalization problems as first-class because they already appear in the sample set:
  - `Gesha` vs `Geisha`
  - `msnm` vs `masl`
  - roast labels like `medio`, `medio claro`, and `brew`
  - mixed Spanish and English note text
  - cultivar names used as bean names when the bag lacks a dedicated product name

## Refactor Priorities

- [ ] Expand the recommendation input model to capture recommendation-relevant signals that the current engine ignores:
  - drying method
  - texture or body hints
  - tea-like note family
  - sweetness family
  - ferment intensity
- [ ] Plumb extraction confidence into recommendation scoring as separate metadata rather than storing it as a bean trait:
  - parser confidence per field
  - source type such as `scan` vs `manual`
- [ ] Add a normalization layer before recommendation scoring so bag text becomes stable internal categories:
  - map `Gesha` and `Geisha` to one canonical variety family
  - map altitude labels to a numeric field
  - map roast words into stable roast-development buckets
  - map raw tasting notes into broader sensory families instead of direct regex matching on every literal phrase
  - map note language across Spanish and English into the same internal tags
- [ ] Refactor recommendation scoring so it uses weighted sensory families instead of only raw process and roast tables.
- [ ] Add a freshness-aware method score path so very fresh coffees can favor more forgiving brewers when appropriate.
- [ ] Add a user brew-goal input to ranking with options like `clarity`, `balanced`, `sweetness`, `body`, and `forgiving`.
- [ ] Make recommendations confidence-aware:
  - degrade certainty when scan extraction confidence is weak
  - ask for confirmation when process, roast, or variety is uncertain
  - avoid presenting strong top-3 language when the app is guessing from sparse inputs
- [ ] Separate rare-cultivar handling from generic note handling because the sample set shows repeated cultivar-led coffees where variety matters materially.
- [ ] Add support for tea-like and floral combinations because several sample bags would currently collapse into generic `floral` or `fruity` behavior even though they likely call for higher-clarity brewers.
- [ ] Add support for texture descriptors such as `creamy`, `medium body`, and syrupy sweetness because these can push a recommendation toward more balanced or body-friendly brewers.
- [ ] Add support for ferment and funk intensity as a gradient rather than a single anaerobic shortcut, since the sample set includes natural and anaerobic coffees with very different risk levels.

## Implementation Checklist

- [ ] Audit the current `BeanProfile`, `ExtractionResponse`, and recommendation engine inputs to identify which new recommendation signals belong on the bean profile and which belong in separate extraction metadata.
- [ ] Define a normalized sensory taxonomy for method recommendation:
  - clarity or tea-like
  - floral
  - citrus
  - orchard fruit
  - tropical fruit
  - dark fruit or jammy
  - chocolate or caramel
  - ferment or boozy
  - body or creamy
- [ ] Build a note-normalization helper that maps bag phrases from the sample set into the taxonomy above.
- [ ] Build a variety-normalization helper that recognizes `Gesha`, `Geisha`, `SL28`, `Pink Bourbon`, `Bourbon Rosa`, and similar forms.
- [ ] Build a roast-normalization helper that can interpret bag language like `medio claro`, `medium light`, `medium`, and `brew`.
- [ ] Decide whether `African beds` should affect extraction style directly or feed a softer density or clarity proxy until a better model exists.
- [ ] Replace the current single-pass point table with composable scoring stages:
  - structural bean traits
  - normalized sensory families
  - freshness adjustment
  - user goal adjustment
  - confidence penalty or fallback
- [ ] Redesign rationale generation so each recommendation explains the actual reasons that fired, instead of generic static copy.
- [ ] Add a low-confidence fallback mode that recommends safer brewers and changes the UI copy from “best methods” to “good starting points”.
- [ ] Add fixtures derived from these sample images for deterministic tests:
  - `5` unique coffee fixtures for recommendation behavior
  - `1` duplicate-image fixture pair to test extraction and normalization consistency on the same `Geisha Natural` lot
- [ ] Add tests that prove normalization works for multilingual labels, synonym forms, and mixed note structures.
- [ ] Add tests that prove a tea-like floral Gesha and a jammy natural Kenya do not collapse into the same recommendation path.
- [ ] Add tests that prove low-confidence extraction weakens recommendation certainty.

## Verification Checklist

- [ ] Recreate the `5` unique coffees as structured recommendation test inputs and snapshot the top-3 method output before and after the refactor.
- [ ] Verify that the duplicate `Geisha Natural` image pair normalizes to the same structured bean profile or to materially equivalent recommendation inputs.
- [ ] Manually verify that washed floral coffees like `Bourbon Rosa` and delicate `Geisha Natural` no longer get grouped too broadly with heavier-fruit naturals.
- [ ] Manually verify that natural coffees with clearer tea-like structure such as `SL28 Natural` can land differently from heavier chocolate-forward naturals.
- [ ] Manually verify that anaerobic coffees with floral-citrus structure do not get forced into one blunt anaerobic bucket.
- [ ] Manually verify that low-data manual entry still returns reasonable fallback methods.
- [ ] Run the existing test suite plus the new recommendation tests.
- [ ] Bump `package.json` version in the implementation PR because this refactor changes user-facing recommendation behavior.
- [ ] Suggested commit message: `refactor brew method recommendations around normalized bean signals`
