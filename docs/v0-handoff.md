# v0 handoff: component inventory, engine API, data contract

**For:** the designer or developer taking this shell to a finished skin.
**The rule:** you may replace every tag, class and style in the view layer. **You may not change the engine or its data contract.** Those are tested against Appendix B's golden vectors, and a change there is a correctness change, not a design change.

---

## 1. What you can and cannot touch

| Path | Status | Why |
| --- | --- | --- |
| `public/assets/css/base.css` | **Replace freely** | Layout, contrast, focus and reserved ad space only. No brand. |
| `public/assets/js/render.js` | **Replace freely** | Pure string builders. Every tag here is yours. |
| `public/assets/js/icons.js` | **Extend or restyle** | Hand-drawn inline SVG. See the hard rule in section 6. |
| `tools/build-pages.mjs` | **Edit the templates** | Page structure and copy. Keep the data-driven parts data-driven. |
| `public/engine/*.js` | **Do not change** | Money and eligibility logic. Covered by 100 tests. |
| `public/data/pricing.json` | **Do not change** | The price spine. Edits follow `docs/ops-runbook.md`. |
| `functions/api/alerts.js` | **Do not change** | The only server-side surface permitted by the technical envelope. |
| `test/**` | **Do not weaken** | If a test fails after your change, the change is wrong until proven otherwise. |

Run `npm test` and `node tools/qa.mjs` before and after. Both must stay green.

---

## 2. Engine public API

Four pure ES modules under `public/engine/`. No DOM access, no fetch, no dependencies. The same files are imported by the browser (`/engine/pricing.js`) and by the Node test runner (`../public/engine/pricing.js`), so there is no build step and no copy.

### `pricing.js`

```js
rankPathways(input, dataset, options) -> PathwayResult[]
```
Ranked cheapest-first. Ineligible pathways are **absent**, not deranked.

- `input`: `{ drug, dose, insuranceStatus | insurance, medicareEligible, incomeTier, osaCovered, partDGlp1Eligible, bmi, hasComorbidity }`
- `dataset`: parsed `pricing.json`
- `options`: `{ today: 'YYYY-MM-DD' }` -- **required** unless the dataset carries `generatedAt`. Staleness is not optional, so a price cannot be produced without knowing its age.

```js
suppressedPathways(input, dataset, options) -> PathwayResult[]
```
Pathways hidden for this user, each carrying `suppressedBy` (rule id) and `suppressionReason`. Powers the "why am I not seeing a copay card" disclosure. Silently omitting an option makes a tool look incomplete; explaining it makes it look honest.

```js
savingsSummary(results, dataset, { drug, currentPathway }) -> SavingsSummary
overallStaleness(results) -> 'fresh' | 'warn' | 'urgent'
validateDataset(dataset) -> string[]        // empty means valid
comparePathways(a, b) -> number             // the sort comparator
resolveDoseTiers(dataset, drug, dose) -> string[]
UNVERIFIED_DISPLAY                          // 'Price not currently verified'
```

### `staleness.js`

```js
classify(verifiedDate, today, { warnDays, urgentDays }) -> 'fresh' | 'warn' | 'urgent'
ageInDays(verifiedDate, today) -> number
describeAge(verifiedDate, today) -> string
worstOf(states) -> 'fresh' | 'warn' | 'urgent'
parseIsoDate(value) -> number
```
Boundaries are inclusive-fresh: an age of exactly `warnDays` is still fresh. Malformed dates **throw** rather than becoming `NaN`, because a `NaN` comparison is false everywhere and would silently classify a stale price as fresh.

### `savings.js`

```js
annualize(monthly) -> number | null
delta(currentMonthly, cheapestMonthly) -> { monthlyDelta, annualDelta, isSaving, comparable }
percentReduction(current, cheapest) -> number | null
formatUsd(amount, fallback) -> string
cheapestOf(results) -> result | null
isUsableAmount(value) -> boolean
```
**Every function propagates `null` outward rather than coercing.** `annualize(null)` returns `null`, not `0`. If it returned `0`, an unverified monthly price would render as a confident "$0 per year".

### `eligibility.js`

```js
matches(predicate, ctx) -> boolean
describePredicate(predicate) -> string      // renders a rule as English for /methodology/
evaluatePathway(pathwayId, ctx, rules) -> { eligible, suppressedBy, eligibilityNotes, caveats, appliedRules }
validateRules(rules) -> string[]
verificationDebt(rules) -> { total, pending, pendingIds }
toContext(input) -> ctx
EFFECTS, PENDING_VERIFICATION
```

---

## 3. `PathwayResult` -- the object your markup consumes

```js
{
  pathway: 'lillydirect_self_pay',        // stable id, safe for CSS hooks and analytics
  pathwayLabel: 'LillyDirect Self Pay',   // display name
  drug: 'zepbound',
  doseOrTier: 'all_other_doses',

  monthlyCost: 449,                       // number, or NULL when not confirmed
  annualCost: 5388,                       // number, or NULL
  displayCost: '$449',                     // ALWAYS a string. UNVERIFIED_DISPLAY when null.
  displayAnnualCost: '$5,388',

  eligibilityNotes: ['...'],              // conditions that apply but do not disqualify
  caveats: ['...'],                       // things that change what you actually pay

  sourceUrl: 'https://...',               // the citation. RENDER IT. See section 5.
  sourceType: 'primary_manufacturer',
  officialUrl: 'https://...',             // pathway landing page, for unverified prices
  verifiedDate: '2026-07-30',
  confidence: 'confirmed',                // confirmed | conflicting | unverified
  staleness: 'fresh',                     // fresh | warn | urgent

  eligible: true,
  suppressedBy: null,                     // rule id when suppressed
  suppressionReason: null,
  appliedRules: ['manufacturer-direct-requires-prescription']
}
```

**Design against `monthlyCost === null`, not against a falsy check.** `0` is a real price and `null` is an absent one; `if (!cost)` conflates them and would render a free medication as unverified.

---

## 4. Component inventory

| Component | Selector | Notes for a redesign |
| --- | --- | --- |
| Masthead | `.masthead` | Brand plus four nav items. Wraps at 390px. |
| Data-as-of stamp | `.data-stamp` | Required on every page carrying a price. |
| Tool form | `.tool`, `[data-tool-form]` | Three selects. **Must fit in a 390x844 viewport with no scrolling** -- `tools/qa.mjs` measures this and fails if the form bottom exceeds the viewport. |
| Privacy note | `.privacy-note` | Sits with the form deliberately. The promise is only useful where the input happens. |
| Results region | `.results`, `[data-results]` | `aria-live="polite"`. Replaced wholesale on each render. |
| Result card | `.card`, `.card--best` | See section 5. |
| Price | `.card__cost`, `.card__cost--unverified` | Reserves `min-height` so a slow fetch cannot shift the card. |
| Verified stamp | `.card__verified` | **Non-optional.** See section 5. |
| Staleness banner | `.banner--warn`, `.banner--urgent` | `urgent` carries `role="alert"` and must render above results. |
| Savings block | `.savings` | Renders nothing when `comparable` is false. Never dress an incomparable delta as a zero saving. |
| Suppression disclosure | `.suppressed` | `<details>`. Keep it discoverable. |
| Empty state | `.empty` | Also the data-load failure state. Must always point at `/methodology/`. |
| Price table | `.table-scroll > table` | Wide content scrolls **inside its container**; the page body must never scroll horizontally. |
| Receipt | `.receipt` | The methodology tally. The brief asks that page to look like a receipt, not a disclaimer. |
| Confidence pill | `.pill--confirmed`, `--conflicting`, `--unverified` | |
| Ad slot | `.ad-slot--leaderboard`, `--inline`, `--footer` | See section 7. |
| Affiliate slot | `.affiliate-slot` | Ships empty, `display: none`, behind a flag defaulted off. |
| Alert form | `.alerts-form`, `[data-alerts-form]` | |
| Footer | `.site-footer`, `.disclaimer` | See section 6. |

---

## 5. Five things that are correctness, not taste

**1. Every rendered price carries a source link and a verification date.** Non-negotiable and non-optional. The verified stamp is styled as part of the price rather than as fine print because it is the site's entire argument. If a price is on screen, its provenance is on screen. A redesign that moves the stamp behind a tap is a redesign that breaks the product.

**2. An unverified price is never a number.** When `monthlyCost` is `null`, render `displayCost` (which is already `UNVERIFIED_DISPLAY`) and link to `officialUrl`. Do not render a dash, a "call for pricing", a blurred placeholder, or a range you derived yourself.

**3. Suppressed pathways are absent from results.** They are in `suppressedPathways()` for the disclosure. Do not render them in the main list "greyed out" -- a Medicare beneficiary seeing a greyed-out $25 copay concludes it might be obtainable.

**4. Caveats are not decoration.** They carry the refill-window condition and the introductory-pricing trap: conditions under which the stated price is not what the person pays. They must be legible at 390px without interaction.

**5. The footer disclaimer is persistent and non-dismissible.** There is no dismiss control in the markup and none may be added. `tools/qa.mjs` asserts the absence of one on all 16 pages, and asserts the exact text and the non-affiliation statement are present on every page. Both strings live in `public/engine/config.js` and are byte-exact-asserted; edit them there or not at all.

---

## 6. Icons: hand-drawn inline SVG, never emoji

Twenty icons in `public/assets/js/icons.js`, authored on a 24x24 grid at 1.75 stroke with `currentColor`.

**Zero emoji anywhere, in any rendered output or source file.** This is portfolio-wide and it is enforced by `test/integrity.test.js`, which walks every text file and fails on any Extended_Pictographic codepoint, on `U+FE0F`, on regional indicators and on ZWJ sequences. The three typographic exceptions are `(c)`, `(r)` and the trademark sign in text form only.

To add an icon: draw it on the same grid, export as inline paths, add it to `ICONS`. The test asserts every icon is well-formed, uses the 24x24 viewBox, inherits `currentColor`, references no external asset, contains no `<text>`, and has balanced markup. Icons default to `aria-hidden="true"`; pass `{ title }` only when an icon is the sole carrier of meaning.

---

## 7. Ad slots: measured, not assumed

Slots reserve height in CSS **before any script runs**, with `contain: layout size` so a misbehaving creative cannot reflow the document. Current: leaderboard 100px mobile / 90px from 48rem, inline 250px, footer 100px.

Measured CLS is **0.0000** across `/`, `/zepbound-cost/`, `/methodology/` and `/changelog/`. `tools/qa.mjs` fails above 0.1 and reports the number.

Two placement constraints learned by measurement, both commented in `tools/build-pages.mjs`:

- **The leaderboard sits below the tool, not above it.** Above the form it pushed the third input to 942px in an 844px viewport, so the dose question fell below the fold and "three inputs, one screen, no scrolling to start" was quietly broken.
- **The two content slots are separated.** Stacked adjacently they left a dead band of roughly 350px on a 390px viewport and halved each other's viewability.

If you move a slot, re-run `node tools/qa.mjs`. If you change a height, change it in CSS, never from script.

---

## 8. Data contract

`public/data/pricing.json`:

```
schemaVersion, generatedAt, verification{}
pathways{ <id>: { label, kind, manufacturer, officialUrl, description } }
drugs{ <id>: { label, genericName, manufacturer, route, indication, slug, doses[], doseTiers{} } }
eligibilityRules[ { id, pathway, effect, when, reason, sourceUrl?, quote?, verification?, basis? } ]
prices[ { value, unit, drug, dose_or_tier, pathway, source_url, source_type,
           verified_date, confidence, notes, caveats?, candidate? } ]
```

Three things worth understanding before you touch it:

- **`pathways[id].kind === 'reference'`** excludes a pathway from results structurally. `list_price` uses it. This is a presentation fact, so it is deliberately *not* an eligibility rule -- a rule that removes a pathway must cite a source, and "list price is a reference" has none to cite.
- **`doseTiers`** maps a user-selectable dose to the tier its price is filed under. Tiers are a manufacturer's commercial decision and they change, so this is data. Adding a tier must never mean editing code. `validateDataset` fails on any declared dose that cannot reach a price datum, because a drug that silently returns nothing reads to a user as "no options exist", which is worse than a wrong number.
- **`candidate`** holds a figure research located plus the provenance held for it. **The engine never reads it** and a test enforces that. It exists so `/methodology/` can show its work and so a verification pass can promote a figure with no code change.

---

## 9. Accessibility floor to preserve

Semantic landmarks with one `h1` per page; a skip link; labelled controls with 44px minimum targets; a visible 3px focus ring (do not remove it without replacing it); AA contrast; `aria-live="polite"` on results; `role="alert"` on the urgent banner; screen-reader-only text supplying units so a price is not announced as a bare number; `prefers-reduced-motion` honoured.

`tools/qa.mjs` checks landmarks, `h1` count, titles, overflow and emoji on all 16 pages. It does not replace an audit with a real screen reader.

---

## 10. Before you open a pull request

```bash
npm test                    # 100 tests. All must pass.
node tools/build-pages.mjs  # regenerate if you touched templates or data
node tools/qa.mjs           # 25 browser checks at 390px. All must pass.
```

`tools/build-pages.mjs` is a development and ops tool, not a deploy step: Cloudflare Pages deploys with an **empty build command** and serves `public/` exactly as committed. Its output is committed. Regenerating is step 3 of the price-change sequence in `docs/ops-runbook.md`.
