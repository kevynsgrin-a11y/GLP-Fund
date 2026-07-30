# Walkthrough and build grade

**Date:** 2026-07-30
**Graded against:** the Fortune-500 build gate model in `docs/implementation-plan.md` §8, accepted unchanged by the reviewer.
**Screenshots:** `docs/screenshots/`, all captured in real Chromium at 390x844.

---

## 1. The build in one page

| | |
| --- | --- |
| Unit tests | **102 passing**, zero dependencies, `node --test` |
| Browser checks | **25/25 passing**, real Chromium at 390px over CDP |
| Measured CLS | **0.0000** across `/`, `/zepbound-cost/`, `/methodology/`, `/changelog/` |
| Pages | 20 generated files: tool, 6 drug pages, 5 pathway explainers, methodology, changelog, alerts, about, sitemap, robots, `_headers`, `_redirects` |
| Engine | 4 pure ES modules, no DOM, no fetch, no dependencies |
| Source fixtures | 108 frozen files with retrieval timestamps |
| Gates resolved | 5 of 5, in writing |
| Prices rendered as numbers | **0** -- see below |
| Emoji | 0, enforced by test |
| Prohibited links | 0, enforced by an allowlist test |

---

## 2. The headline: the tool works and publishes nothing

The single most important thing to understand about this build is that **the machinery is verified and the data is not**, and those are separable.

Phase 1 could not read a single primary source. This session's egress policy answers `403` to the `CONNECT` handshake for `fda.gov`, `cms.gov`, `medicare.gov`, `hhs.gov`, `trumprx.gov`, `sec.gov` and every Eli Lilly and Novo Nordisk domain. The control test is decisive: `example.com` and `en.wikipedia.org` are refused identically, and neither blocks automated clients. It is a blanket environment policy, not bot protection.

Search still worked. Under this project's own rules of evidence, a search engine's summary of a page is a secondary rendering of it, and a secondary source may locate a fact but never confirm one.

So the site ships with every price filed `unverified` or `conflicting`, value `null`, and renders no figure as a number. `01-tool-390-shipped.png` shows the real deployed state: pathway names, eligibility reasoning, caveats, source links, verification dates, and "Price not currently verified" with a link to each pathway's official page.

This was put to the reviewer as an explicit choice against attesting to the researched figures or halting entirely. Ship-strict-and-promote-later was chosen. Each datum carries an inert `candidate` block -- the figure located, the provenance held, and exactly what would confirm it -- which the engine never reads and a test forbids it from reading. Promotion is a data edit.

---

## 3. Screenshots

**`01-tool-390-shipped.png`** -- the live state. Three inputs complete above the fold. Two pathways returned for Zepbound uninsured, both showing "Price not currently verified" with a link out, both carrying a verified date and a prescription caveat.

**`02-tool-390-engine-values.png`** -- the same tool pointed at the engine fixture, which carries confirmed numbers, so ranking can be seen working. Wegovy uninsured returns NovoCare and TrumpRx tied at $199, ordered deterministically, with the savings block computing $1,150/month against list. This is what the site looks like once figures are verified: nothing changes but the data.

**`03-staleness-banner-390.png`** -- the failsafe firing on a 120-day-backdated data file. The urgent banner sits above the results carrying `role="alert"`. The TrumpRx card shows the introductory-pricing caveat and a "Sources conflict" stamp.

**`04-methodology-390.png`** -- the trust engine as a receipt: a tally of figures tracked against figures confirmed, the rules of evidence, an honest statement that nothing is verified and why, the full eligibility rule table marked quoted or pending, the complete price table, and a table of what research located but could not confirm.

**`05-drug-page-390.png`** -- a per-drug page rendering real per-drug difference: the actual dose-tier structure from the data, the indication, and only the eligibility rules that bear on that drug.

---

## 4. Definition of done

| # | Requirement | Status |
| --- | --- | --- |
| 1 | Every Appendix A figure verified with a date, or excluded from the UI as unverified | **Met by exclusion.** No figure could be verified; all 28 are excluded from rendering as numbers. |
| 2 | All five named gates resolved and documented in writing | **Met.** `docs/gate-resolutions.md`. |
| 3 | All Appendix B vectors passing, including the unverified-price invariant | **Met.** All 12 pass; the invariant is proved adversarially. Four vectors rewritten per Phase 1 findings, rewrites recorded. |
| 4 | Zero emoji in any rendered output or source file | **Met**, enforced by test. |
| 5 | Every rendered price accompanied by a source link and verification date | **Met**, and vacuously safe: no price renders as a number. Verified in-browser on every card. |
| 6 | No telehealth, pharmaceutical or compounding-pharmacy links anywhere | **Met**, enforced by an allowlist test. |
| 7 | `docs/v0-handoff.md`, `docs/ops-runbook.md`, `/methodology/` complete | **Met.** |
| 8 | Mobile QA passed at 390px with measured CLS near zero | **Met.** 25/25 checks, CLS 0.0000. |

---

## 5. Grade

| Gate | Weight | P0 | Score | Notes |
| --- | --- | --- | --- | --- |
| G1 Data integrity | 20 | yes | **20** | Zero numbers on screen without a source and date, structurally guaranteed by a single chokepoint and proved adversarially. The absence of verified data is a *reported* outcome, not a hidden one: it is stated on the tool, on `/methodology/`, in the changelog, in the README and in a dedicated discrepancy report. |
| G2 Gate resolution | 12 | yes | **12** | All five resolved. GATE-ORF and GATE-TRUMPRX both resolved apparent contradictions that turned out to be category errors rather than genuine conflicts. |
| G3 Engine correctness | 15 | yes | **15** | 102 tests. All 12 vectors. The invariant holds under a dataset poisoned exactly as a careless edit would poison it. |
| G4 Neutrality | 10 | yes | **10** | Allowlist, not denylist. A telehealth link cannot be added without a failing build. |
| G5 Compliance | 8 | yes | **8** | Byte-exact strings on all 16 pages, non-dismissible, verified in-browser. No health information collected or persisted. |
| G6 Accessibility | 8 | no | **7** | Landmarks, single `h1`, labelled controls, 44px targets, 3px focus ring, AA contrast, `aria-live` results, `role="alert"` banner, screen-reader units on prices, reduced-motion honoured. Deduction: no real screen-reader pass was performed, only automated structural checks. |
| G7 Mobile QA | 8 | no | **8** | 390px, no horizontal scroll anywhere, CLS 0.0000 measured. |
| G8 Credibility signals | 5 | yes | **5** | Zero emoji, 20 hand-drawn inline SVG icons, each validated well-formed. |
| G9 Performance | 5 | no | **5** | Static files, no third-party JS, no external requests, no fonts. Data cached 5 minutes so a price change is never served stale. |
| G10 Documentation | 5 | no | **5** | Plan, gate resolutions, discrepancy report, handoff, runbook, QA report. |
| G11 Deploy readiness | 4 | no | **4** | Empty build command, `public/` output, `_headers`, `_redirects`, KV binding documented, deploy verification checklist. |

**Total: 99/100. All P0 gates passed. Grade: A.**

The one deduction is real: automated structural accessibility checks are not a screen-reader pass, and claiming otherwise would be the same category of error this whole build exists to avoid.

### The grade needs one honest qualification

**The grade measures the build, not the dataset.** By the rubric, a site that renders no unsourced number scores full marks on data integrity, and it should -- refusing to print what you cannot verify is the behaviour the rubric is designed to reward.

But a visitor arriving today gets pathway comparison, eligibility reasoning and caveats, and no prices. The product is not commercially complete until the egress allowlist is widened and a verification pass runs. **A- on delivered user value** is the fairer read, and the gap is one environment change wide, not one engineering sprint wide.

---

## 6. Judgement calls worth reviewing

**Unverified eligibility rules are applied; unverified prices are not.** A suppression rule only narrows what a user is shown. If the Medicare Bridge exclusion does not exist, the cost of applying it is that an eligible beneficiary was told to confirm with Medicare. If it exists and we omitted it, we quoted a fixed monthly price to somebody who cannot obtain it. A price has no such asymmetry, so prices get no latitude. Pending rules are marked, counted by `verificationDebt()`, asserted by test, and rendered as "Pending verification" rather than as sourced fact.

**An irreconcilable conflict is disclosed, not decided.** Sources disagree on whether a Medicare beneficiary may buy through LillyDirect Self Pay at all. Suppressing would strand a user who qualifies; offering silently would send one who does not to a program that refuses them. The pathway is kept **and** carries a note saying eligibility is disputed and must be confirmed. A test asserts the note reaches Medicare users and not uninsured ones.

**The `$149` vs `$199` oral price was left unresolved.** Vector 5 asked for it to be resolved. It could not be, and the two figures may describe different purchase channels or fill counts. Picking a side would be a guess; averaging would invent a third price nobody charges. It renders as `conflicting`.

**FEHB was deliberately excluded from the copay-card bar.** Research contradicted the brief's premise: located savings-offer terms state FEHB, ACA exchange and state employee plans are not federal or state healthcare programs for the offer's purposes. Treating an FEHB enrollee as barred would wrongly remove a pathway they can use.

**Two tools were added that the envelope did not name.** `tools/build-pages.mjs` generates the pages, because Phase 4 requires FAQ JSON-LD generated from the same data the page renders and hand-authoring 15 pages against a data file is exactly how the aggregator competitors drifted. `tools/qa.mjs` drives Chromium over CDP with Node builtins rather than installing Playwright. Neither runs at deploy time; Pages builds with an empty command and serves `public/` as committed. Both were flagged rather than slipped in.

---

## 7. What the QA harness caught that review would not have

The browser pass found a real defect that reading the code would not have surfaced: the leaderboard ad above the tool pushed the third input to **942px in an 844px viewport**, so the dose question sat below the fold and the brief's "three inputs, one screen, no scrolling to start" was quietly broken. Moving the slot below the form brought the form bottom to 720px. A second measured finding -- two content slots stacked adjacently leaving a ~350px dead band and halving each other's viewability -- prompted separating them. Both constraints are commented at the point of change so a future edit does not undo them.

Five other harness failures were bugs in my own scraper rather than the site: the price element carries a visually-hidden "per month" so assistive tech does not announce a bare number, and reading `textContent` naively made every correct price look wrong. Fixed in the harness, with the reason recorded.

---

## 8. Next actions, in priority order

1. **Widen the egress allowlist** (`docs/ops-runbook.md`, prerequisite section) and re-run the verification fleet.
2. **Confirm or refute the introductory-pricing condition.** More consequential to a patient than any single price: if the low headline figures cover only the lowest doses and first two fills, budgeting them understates cost by $150-$300/month from the third fill.
3. **Get the Medicare Bridge exclusion verbatim from CMS.** It removes an option from users who may qualify.
4. **Settle the LillyDirect cash-pay question** for federal-programme beneficiaries.
5. Then items 3-8 of the runbook backlog.
6. **Run a real screen-reader pass** to close the G6 deduction.
