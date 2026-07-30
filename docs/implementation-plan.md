# GLP-1 Price Check — Implementation Plan (Phases 1–6)

**Status:** awaiting human review. No product code may be written until this document is approved.
**Authored:** 2026-07-30
**Plan owner:** build agent
**Build standard applied:** Fortune-500 web engineering gate model (see §8, Grading Scale)

---

## 0. Phase 0 findings — workspace discovery

`REPO_TARGET` resolved to **standalone**.

The repository at `/home/user/GLP-Fund` was found in a genuinely empty state:

| Check | Result |
| --- | --- |
| Tracked files | 0 |
| Commits | 0 (`fatal: your current branch ... does not have any commits yet`) |
| Remote branches | none — `git ls-remote --heads origin` returned empty |
| Remote default branch | not yet established |
| Existing CSS/design tokens to reuse | none |
| Existing site-descriptor JSON schema | none |
| Existing Pages Function / KV patterns | none |
| Existing deploy configuration | none |

There is therefore **no existing convention to honour and no risk of inventing a parallel one**. Every convention in this plan is established fresh, and is documented here precisely so that a second site in the same portfolio can adopt rather than re-invent it.

Working branch: `claude/glp1-price-check-tool-w4j8y5`. This branch is the first commit in the repository's history.

### 0.1 Scaffold created

```
.
├── docs/                              plan, handoff, ops runbook
├── functions/
│   └── api/                           Cloudflare Pages Functions (root-level, per CF convention)
├── public/                            <- Cloudflare Pages build output directory
│   ├── assets/
│   │   ├── css/
│   │   └── js/                        DOM/view layer only
│   ├── data/                          pricing.json + sources.json, fetched at runtime
│   ├── engine/                        pure ES modules: served to browser AND unit-tested
│   ├── about/
│   ├── alerts/
│   ├── changelog/
│   ├── methodology/
│   ├── lillydirect/  novocare/  trumprx/  medicare-glp1-bridge/  patient-assistance/
│   └── wegovy-cost/  ozempic-cost/  zepbound-cost/  mounjaro-cost/  wegovy-pill-cost/
├── test/
│   └── fixtures/                      frozen primary-source responses with retrieval timestamps
├── package.json                       test script only — zero dependencies
└── public/engine/config.js            the CONFIG block, single source of truth
```

### 0.2 Two structural decisions worth recording

**Why `public/` is the deploy root rather than the repository root.** Cloudflare Pages will serve every file in its output directory. With the repository root as output, `test/fixtures/` — which by design contains frozen copies of manufacturer page excerpts — and `docs/` would both be publicly fetchable. Scoping the output directory to `public/` keeps the fixture corpus and internal documentation out of the deployed surface without a copy step. `functions/` correctly stays at the repository root, which is where Pages looks for it.

**Why the engine lives at `public/engine/` and not `src/engine/`.** The brief requires (a) pure ES modules with zero DOM dependencies that are unit-testable, and (b) no build step. Those two constraints together mean the exact same file must be `import`-able by the browser at runtime and by the Node test runner. A `src/` directory that is not served would require a copy or bundle step to reach the browser — that is a build step, so it is rejected. `public/engine/*.js` is imported by the browser as `/engine/pricing.js` and by tests as `../public/engine/pricing.js`. One file, one source of truth, no build.

---

## 1. Technical envelope — compliance statement

| Constraint | Status | Note |
| --- | --- | --- |
| Static HTML/CSS + vanilla ES-module JS | Committed | |
| No frameworks | Committed | Zero runtime dependencies. |
| **No build step** | Committed, with one disclosure below | |
| Cloudflare Pages deployable from GitHub | Committed | Output dir `public/`, no build command. |
| Mobile-first | Committed | 390px is the design target, not an afterthought. |
| Pages Function + KV for email capture only | Committed | `functions/api/alerts.js`. Nothing else server-side. |
| No accounts, no trackers beyond ad scaffolding | Committed | |
| Hand-drawn inline SVG icons, never emoji | Committed | Enforced by a test, not by discipline — see §3.4. |
| Monetary logic in pure DOM-free modules | Committed | |

### 1.1 Disclosure: `package.json` exists, and it is not a build step

The brief says to stop and justify if a build step is required. **No build step is required, and none is being introduced.** The site deploys with an empty build command.

A `package.json` is nonetheless present. It declares `"type": "module"` and one script: `node --test test/`. It has **zero dependencies** — no devDependencies either. It installs nothing, compiles nothing, bundles nothing, and emits no artifact. Node's built-in test runner is used precisely so that the requirement "all monetary logic is unit-testable" can be met without importing a test framework.

If this still reads as a violation to the reviewer, the fallback is a single `test/run.mjs` executed as `node test/run.mjs`, deleting `package.json` entirely, at the cost of hand-rolling assertion reporting. **Recommendation: keep `package.json`.** It is inert with respect to the deploy, and Cloudflare Pages will be configured with no build command so it is never even read at deploy time. Flagging it rather than deciding silently.

---

## 2. Phase 1 — blocking data verification

**This phase is already in flight** as a 15-agent verification fleet, because it blocks everything and is the long pole. It writes no product code.

### 2.1 Rules of evidence, as enforced on the researchers

- Only these may **confirm** a figure: `fda.gov`, `cms.gov`, `medicare.gov`, `hhs.gov`, `trumprx.gov`, `investor.lilly.com`, `lilly.com`, `lillydirect.lilly.com`, `zepbound.lilly.com`, `novonordisk.com`, `novocare.com`, `wegovy.com`, `ozempic.com`, `sec.gov`.
- Secondary sources — press, `drugs.com`, `prnewswire.com`, aggregators — may **locate** a fact and may never confirm one. A PR-newswire copy of a company release is secondary; the company's own investor-relations page is primary.
- Conflicting figures are never reconciled into a midpoint. They are recorded as `confidence: "conflicting"`.
- Every figure supported only by secondary sources becomes `confidence: "unverified"` and `value: null`.

Every cluster of findings passes through a dedicated **adversarial verifier** whose instruction is to refute, not agree — specifically hunting figures attributed to a primary source that the source does not actually state, mislabeled `source_type`, 403/dead URLs presented as read, and dropped conditions such as refill windows and pen-vs-vial distinctions. A **completeness critic** then reports what remains unsafe to ship.

### 2.2 `data/sources.json` schema

Every price datum is an object carrying exactly:

```json
{
  "value": 299,
  "unit": "USD/month",
  "drug": "zepbound",
  "dose_or_tier": "2.5mg",
  "pathway": "lillydirect_self_pay",
  "source_url": "https://...",
  "source_type": "primary_manufacturer",
  "verified_date": "2026-07-30",
  "confidence": "confirmed",
  "notes": "conditions, refill windows, exclusions"
}
```

`source_type` ∈ `primary_manufacturer | primary_government | secondary_press | secondary_aggregator`.
`confidence` ∈ `confirmed | conflicting | unverified`.

### 2.3 The five named gates

| Gate | Question | Product consequence of each outcome |
| --- | --- | --- |
| **GATE-ORF** | Is orforglipron approved? One source reports FDA approval ~2026-04-01 as Foundayo; another reports a Complete Response Letter dated 2026-04-10 with the drug unavailable. | Approved → a `/foundayo-cost/` page exists and the drug enters the tool at its **actual launched** self-pay price, not pre-approval agreement pricing. Not approved → excluded entirely with a "pending" note. |
| **GATE-BRIDGE** | Did the Medicare GLP-1 Bridge launch 2026-07-01? Actual eligibility, actual patient cost, pen-only restriction, OSA exclusion. | Drives golden vectors 7 and 8. The OSA exclusion specifically must be confirmed verbatim or the vector-8 suppression cannot ship. |
| **GATE-TRUMPRX** | What does trumprx.gov show *today*, and is programmatic access permitted? | **Early finding: a direct fetch of `https://trumprx.gov/` from this environment returned HTTP 403 Forbidden.** If that holds, the site uses manual curation only and says so on `/methodology/`. If no `.gov` page states a current per-drug price, every TrumpRx figure is `unverified` with `value: null` — press reports of the live site will not be laundered into "confirmed". |
| **GATE-COMPOUND** | Current lawful status of compounded semaglutide/tirzepatide after shortage-list resolution and subsequent litigation. | **Default is exclusion.** If included at all: visually separate section, verbatim FDA risk language, never in the ranked list, never recommended. |
| **GATE-MEDICAID** | Does the CMS BALANCE Model exist; which states; does it change patient cost? | If real and state-variable, the tool must not imply a national Medicaid price. |

Every gate is written up in `docs/gate-resolutions.md`. **If any gate fails to resolve, the build HALTS and a discrepancy report is written instead of product code.**

### 2.4 Fixtures

Every verified source response is frozen under `test/fixtures/<gate>-<source-slug>.json` carrying `retrieved_at`, `url`, `http_status`, `source_type`, the extracted figures, and a short verbatim excerpt. Fixtures make the price tests reproducible without a network call and make a future re-verification a diff rather than a re-read.

---

## 3. Phase 2 — the engine

`public/engine/`, pure ES modules, zero DOM access, zero dependencies.

### 3.1 Public API (frozen contract — the later design pass may not change this)

```js
// pricing.js
rankPathways({ drug, dose, insuranceStatus, medicareEligible, incomeTier, osaCovered }, priceData)
  -> PathwayResult[]

// PathwayResult
{
  pathway: 'lillydirect_self_pay',
  pathwayLabel: 'LillyDirect Self Pay',
  monthlyCost: 299,          // number, or null when confidence is not 'confirmed'
  annualCost: 3588,          // number, or null
  displayCost: '$299',       // string; 'Price not currently verified' when monthlyCost is null
  eligibilityNotes: [ ... ],
  caveats: [ ... ],
  sourceUrl: 'https://...',
  sourceType: 'primary_manufacturer',
  verifiedDate: '2026-07-30',
  confidence: 'confirmed',
  staleness: 'fresh'         // fresh | warn | urgent
}
```

- `eligibility.js` — every rule encoded **as data**, not as branching prose. A rule is `{ pathway, predicate, reason, sourceUrl }`; the evaluator is generic and the rules are a table. Adding a rule must never mean adding an `if`.
- `staleness.js` — `classify(verifiedDate, today, { warnDays, urgentDays }) -> 'fresh' | 'warn' | 'urgent'`. Every rendered price passes through this. Pure, injectable `today` so it is testable without clock mocking.
- `savings.js` — `annualize(monthly)`, and `delta(currentPathway, cheapestPathway) -> { monthlyDelta, annualDelta }`.

### 3.2 Suppression vs. deranking — a correctness distinction, not a UI nicety

Golden vector 7 requires that a Medicare user does not merely see the copay card ranked lower; the pathway must be **absent from the returned array**. `eligibility.js` therefore returns a hard `eligible: false` that removes the pathway before ranking, and a separate soft `notes[]` channel for pathways that remain eligible but carry conditions. The test asserts absence, not position.

### 3.3 The integrity invariant

A dedicated test asserts that **no code path** can return a pathway with `confidence: "unverified"` and a numeric `monthlyCost`. Implementation: `monthlyCost` is not copied from the data file; it is derived through a single chokepoint function that returns `null` unless `confidence === 'confirmed'`. The test enumerates every datum in the real data file, plus adversarial synthetic data, and asserts the invariant holds. This is the site's integrity guarantee, enforced in code rather than promised in prose.

### 3.4 Two mechanical guarantees enforced as tests

- **No emoji** — a test walks every tracked source file and every rendered HTML file and fails on any codepoint in the emoji ranges. The brief identifies emoji as the single most damaging credibility signal across the portfolio; a lint is more reliable than vigilance.
- **No prohibited links** — a test fails the build on any link to a telehealth vendor, pharmaceutical affiliate, or compounding pharmacy anywhere in the deployed tree, against a denylist plus a heuristic for known telehealth domains.

### 3.5 Test source

Every vector in Appendix B becomes a test. **Expected values are populated from Phase 1 verified data. Where Phase 1 contradicts the Appendix A draft value, the verified value wins and the vector is rewritten** — with the rewrite recorded in `docs/gate-resolutions.md` so the change is auditable rather than silent. All tests green before Phase 3 begins; a failing price test is a build-stopping event.

---

## 4. Phase 3 — frontend shell

Semantic, accessible, mobile-first HTML bound to the engine's JSON output. **Minimal base styles only** — this is a shell for a later design pass, not a finished skin.

Core flow: three inputs on one screen, no scrolling to start — medication → insurance situation → dose. Results render immediately below with no page transition.

Every result card renders, non-optionally: pathway name, monthly cost in large type, annual cost, eligibility notes, caveats, and a **"verified [date]" stamp linked to the primary source**. `warn` staleness renders an inline note; `urgent` renders a prominent banner above all results.

**Per-drug pages.** `/wegovy-cost/`, `/ozempic-cost/`, `/zepbound-cost/`, `/mounjaro-cost/`, `/wegovy-pill-cost/`, plus a Foundayo page only if GATE-ORF resolves to approved. These are not doorway pages: each drug has genuinely different pathways, prices and eligibility rules, and each page renders that real difference — Mounjaro's diabetes indication changes eligibility, the oral product has a distinct dose ladder and price structure, Zepbound has a three-tier vial ladder and a refill-window condition. **A merge decision is recorded in the handoff for any two pages that would be substantially identical.**

**Per-pathway explainers.** `/trumprx/`, `/lillydirect/`, `/novocare/`, `/medicare-glp1-bridge/`, `/patient-assistance/`.

**`/methodology/`** — the trust engine. Renders the complete price table with every source URL, source type, verification date and confidence level, generated from `sources.json` rather than hand-written. This page is the argument for believing this site over the telehealth funnels. **It is built to look like a receipt, not a disclaimer.**

Deliverable: `docs/v0-handoff.md` — component inventory, engine public API, sample JSON payloads, written so a later design pass replaces markup and styles only, never the engine or its data contract.

---

## 5. Phase 4 — content and SEO

- Data-as-of stamp on every page carrying a price. No exceptions.
- Title/meta targeting the real query set: `[Drug] cost without insurance 2026`, `cheapest way to get [drug]`, `[drug] price per month`.
- **FAQ JSON-LD generated from the same data the page renders**, at page-build time from `pricing.json` — never hand-written prose that can drift from the data file. A test asserts the JSON-LD price matches the rendered price.
- `/changelog/` — every price change logged with date and source. Both a trust signal and the recurring-content engine in a market where prices move monthly.
- Newsjack playbook in `docs/ops-runbook.md`: data file → changelog entry → affected drug pages → alert-list send, target under 60 minutes.
- No AI-generated filler prose. Every non-tool page earns its place with data or a genuine explanation.

---

## 6. Phase 5 — monetization scaffolding and compliance

- **CLS-safe ad slots** with fixed dimensions reserved in CSS via `aspect-ratio` and explicit `min-height`, so the slot occupies its final space before any script runs. Health/pharma display RPM is strong and layout shift is what kills it.
- **No telehealth, pharmaceutical, or compounding-pharmacy links anywhere, in v1.** The slot infrastructure is built but ships empty and disabled behind `FLAGS.AFFILIATE_SLOTS_ENABLED = false`. Enforced by the denylist test in §3.4, so the flag cannot be flipped without a failing build.
- **Email capture** via Pages Function + KV — "tell me when the price of my medication changes." Captures drug preference alongside email so alerts can be segmented. This is the Cusp+ hook.
- **Premium alert tier: UI copy and documentation only. Not built.**

Compliance implemented as code, not advice:

- Persistent, **non-dismissible** footer disclaimer, rendered verbatim from `config.js` (`DISCLAIMER`). No dismiss control exists in the markup.
- `NON_AFFILIATION` string on every page, also from `config.js`.
- Compounded products, if GATE-COMPOUND permits inclusion at all: separate section, verbatim FDA risk language, never ranked, never recommended.
- **No collection of health information.** Dose and insurance selectors are ephemeral client-side state — no `localStorage`, no `sessionStorage`, no query-string persistence, never transmitted. A test asserts no storage API is referenced in the view layer. Stated in plain language next to the form, because a stressed user in a pharmacy should not have to infer it.

---

## 7. Phase 6 — QA, deploy-readiness, ops

Verified in a real browser at a **390px viewport** via Playwright against the pre-installed Chromium:

1. Three-input flow completes with **zero horizontal scroll** (`scrollWidth <= clientWidth` asserted).
2. On-screen engine values match Appendix B expected outputs **exactly** — scraped from the rendered DOM and compared, not eyeballed.
3. **Zero layout shift from ad slots, measured** via `PerformanceObserver` on `layout-shift` entries. Reported as a number.
4. **The staleness banner actually fires** — tested by temporarily backdating a `verified_date` and asserting the banner appears, then restoring.
5. **Every source link resolves to a live page** — every URL in `sources.json` checked, status recorded. 403-blocking sources such as trumprx.gov are reported as blocked-not-broken, with that distinction visible.

Deliverables: `docs/ops-runbook.md` (price-update procedure with per-source checklist, staleness failsafe behaviour, price-change-day newsjack sequence, monthly full-reverification cadence, failure modes, Cloudflare Pages deploy notes) and a walkthrough artifact with screenshots.

---

## 8. Grading scale — Fortune-500 build gate model

The build is graded against this rubric and the grade is published in the final walkthrough. Any **P0 gate failure caps the overall grade at F regardless of other scores** — that is the point of a gate.

| # | Gate | Weight | P0? | Pass criterion |
| --- | --- | --- | --- | --- |
| G1 | Data integrity | 20 | **yes** | Every Appendix A figure either verified against a primary source with a date, or excluded from the UI as unverified. Zero numbers on screen without a source link and verification date. |
| G2 | Gate resolution | 12 | **yes** | All five named gates resolved and documented in writing. |
| G3 | Engine correctness | 15 | **yes** | All Appendix B vectors pass, including the unverified-price invariant. |
| G4 | Neutrality | 10 | **yes** | No telehealth, pharmaceutical or compounding-pharmacy links anywhere. Enforced by test. |
| G5 | Compliance | 8 | **yes** | Exact disclaimer text, non-affiliation on every page, no health-information collection. |
| G6 | Accessibility | 8 | no | Semantic landmarks, labelled controls, visible focus, AA contrast, keyboard-operable flow, results announced to assistive tech. |
| G7 | Mobile QA | 8 | no | 390px, no horizontal scroll, measured CLS near zero. |
| G8 | Credibility signals | 5 | **yes** | Zero emoji in any rendered output or source file. Hand-drawn inline SVG icons only. |
| G9 | Performance | 5 | no | No render-blocking third-party JS; static assets only. |
| G10 | Documentation | 5 | no | `docs/v0-handoff.md`, `docs/ops-runbook.md`, `/methodology/` complete and accurate. |
| G11 | Deploy readiness | 4 | no | Cloudflare Pages config, `_headers`, `_redirects`, Function + KV binding documented. |

Letter bands: **A** ≥ 93 with all P0 gates passed · **B** ≥ 85 · **C** ≥ 75 · **D** ≥ 65 · **F** < 65 **or any P0 gate failed**.

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| trumprx.gov unreadable programmatically (403 already observed) | **confirmed likely** | High — TrumpRx is a headline pathway | Manual curation, disclosed on `/methodology/`. Figures unconfirmable from a `.gov` source render as "price not currently verified" with a link out, never as a number. |
| A gate resolves ambiguously | Medium | High | HALT and write a discrepancy report. Explicitly not permitted to write product code around an unresolved price. |
| Prices move during the build | Medium | Medium | `verified_date` on every datum plus the staleness system means a moved price degrades visibly instead of lying quietly. |
| Appendix A draft values differ from verified values | **High — expected** | Medium | Verified value wins, vector is rewritten, rewrite recorded in `docs/gate-resolutions.md`. |
| Medicare cash-pay carve-out genuinely unclear in primary terms | Medium | **High** — a wrong answer strands a Medicare user | Researchers instructed to return "unclear" rather than guess. If unclear, the pathway renders with an explicit "verify your eligibility" note and no cost claim. |
| Domain not actually available | Medium | Low | Placeholder isolated in `config.js`; nothing depends on it resolving. |

---

## 10. Sequencing and stop conditions

```
Phase 0  scaffold + this plan                    -> HUMAN REVIEW GATE (here)
Phase 1  verification fleet (in flight)          -> HALT on unresolved gate
Phase 2  engine + tests                          -> HALT on any failing price test
Phase 3  frontend shell + pages                  -> handoff doc
Phase 4  content, SEO, JSON-LD, changelog
Phase 5  ad slots, alert Function + KV, compliance
Phase 6  browser QA at 390px, CLS measurement, runbook, walkthrough + grade
```

**Two hard stops are wired in and will be honoured:** an unresolved gate halts Phase 2, and a failing Appendix B vector halts Phase 3. Neither is a warning.

---

## 11. What I want the reviewer to decide

1. **`package.json` for `node --test`** — keep (recommended) or hand-roll `test/run.mjs` and delete it. See §1.1.
2. **`public/` as deploy root, engine served from `public/engine/`** — confirm, or state a preference for a different layout. See §0.2.
3. **TrumpRx under a 403** — confirm that manual curation with a disclosure on `/methodology/` is the accepted answer, rather than blocking the pathway entirely.
4. **Anything in §8's weighting** that should shift before it is used to grade the build.
