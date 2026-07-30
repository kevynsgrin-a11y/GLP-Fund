# GLP-1 Price Check

A static, mobile-first tool that answers one question: **what is the cheapest legitimate way for me to pay for my GLP-1 medication this month?**

Select a medication, an insurance situation and a dose. Get every available access pathway -- manufacturer direct-pay, the federal TrumpRx platform, insurance with a copay card, Medicare programs, patient assistance -- ranked by real monthly out-of-pocket cost, each with a source citation and a verification date.

The site sells nothing, links to no telehealth vendor, takes no pharmaceutical affiliate revenue, and shows its work on every number.

---

## Current status: the site publishes no prices, on purpose

**Every price is filed unverified with a null value, and the deployed site renders no figure as a number.**

On 2026-07-30 the build environment's egress policy refused outbound HTTPS to every primary source -- `fda.gov`, `cms.gov`, `medicare.gov`, `hhs.gov`, `trumprx.gov`, `sec.gov`, and every Eli Lilly and Novo Nordisk domain. Search still worked; reading did not. Under this project's rules of evidence a search engine's summary of a page is a secondary rendering, not a read, and a secondary source may locate a fact but never confirm one.

So the tool shows pathway names, eligibility reasoning, caveats, source links and verification dates, and says plainly that nothing has been confirmed. Every figure research located is recorded beside its datum with the provenance actually held for it, so a single verification pass promotes it with no code change.

- **Why:** `docs/discrepancy-report.md`
- **What was resolved anyway:** `docs/gate-resolutions.md`
- **How to fix it:** `docs/ops-runbook.md`, section "Prerequisite: egress allowlist"

This is a less useful product than the brief describes. It is the honest version of it.

---

## Quick start

```bash
npm test                    # 102 unit tests, zero dependencies
node tools/build-pages.mjs  # regenerate the 20 static pages from the data file
node tools/qa.mjs           # 25 browser checks in real Chromium at 390px
```

No install step. No dependencies. `package.json` exists only to invoke `node --test`.

---

## Layout

```
public/                   Cloudflare Pages output directory, served as committed
  engine/                 pure ES modules: pricing, eligibility, staleness, savings, config
  assets/js/              render.js (pure strings), app.js (the only DOM code), icons.js
  assets/css/base.css     minimal shell styles, CLS-safe ad slots
  data/pricing.json       the price spine and the eligibility rule table
  data/changelog.json     every price change, dated and sourced
  <16 pages>/index.html   generated, committed
functions/api/alerts.js   the only server-side code: KV-backed alert capture
test/                     102 tests, plus 108 frozen source fixtures
tools/build-pages.mjs     page generator (dev/ops tool, not a deploy step)
tools/qa.mjs              browser QA over CDP, Node builtins only
docs/                     plan, gate resolutions, discrepancy report, handoff, runbook
```

The engine lives inside `public/` deliberately: the brief requires both DOM-free unit-testable modules and no build step, so the identical file must be importable by the browser (`/engine/pricing.js`) and by the Node test runner (`../public/engine/pricing.js`). A `src/` directory would have needed a copy step, which is a build step.

---

## Four invariants enforced by tests, not by discipline

**1. An unverified price is never a number.** Exactly one function may produce a numeric `monthlyCost`, and it returns `null` unless `confidence === 'confirmed'`. A test poisons every datum with a value and a non-confirmed confidence, then asserts across seven user inputs that no result, no suppressed result and no savings delta leaks a figure.

**2. No telehealth, pharmaceutical or compounding-pharmacy links.** Enforced as an *allowlist*: every outbound link in the deployed tree must be a primary source. A denylist would need maintaining forever and would still miss the next vendor.

**3. Zero emoji.** A test walks every text file and fails on any Extended_Pictographic codepoint, `U+FE0F`, regional indicators or ZWJ sequences. Icons are 20 hand-drawn inline SVGs.

**4. No health information is collected.** The medication, insurance situation and dose live in one module's local variables and nowhere else. A test fails the build if a storage API appears in the deployed tree, with comments stripped first so documenting the rule is not punished.

---

## What makes this different from the pages it competes with

| Competitor pattern | This site |
| --- | --- |
| Telehealth cost guides that rank "cheapest GLP-1" while selling compounded GLP-1s | Sells nothing. Zero vendor links, enforced by a failing build. |
| Aggregator pages carrying figures from months ago with no date rendered | A verification date on every figure, and a staleness system that escalates to a prominent warning past 60 days. |
| Manufacturer sites, accurate about their own drug and structurally unable to say a competitor is cheaper | Cross-manufacturer comparison in one view. |
| TrumpRx listing its own prices with no comparison to anything | The pathway comparison it will never provide. |
| Health media explaining the news with no per-dose, per-insurance calculator | The user's own three inputs. |
| Nobody running a price-change alert list in a market that has moved five times in nine months | `/alerts/`, KV-backed, segmented by drug. |

One finding illustrates the point. The widely quoted low monthly figures for these pathways are reported to be **introductory prices covering the lowest doses and the first two fills only**, after which they rise to roughly $349-$399. A patient budgeting the headline figure would understate their cost by $150-$300 a month from the third fill. It is flagged as a caveat on every affected pathway here, and a test asserts it reaches the card.

---

## Compliance

A persistent, non-dismissible footer disclaimer and a non-affiliation statement render on all 16 pages, verbatim from `public/engine/config.js` and byte-exact-asserted. Browser QA verifies both are present and that no dismiss control exists.

Compounded semaglutide and tirzepatide are **excluded entirely** -- not ranked, not in a separate section, not anywhere. See GATE-COMPOUND in `docs/gate-resolutions.md`.

This is not medical advice.

---

## Deploy

Cloudflare Pages. Build command **empty**, output directory `public`, functions auto-detected at `functions/`. One KV namespace bound as `ALERTS`. Full notes in `docs/ops-runbook.md`.

Live domain: **`glp1-fund.com`**, registered through Cloudflare. Defined once in `public/engine/config.js`; see `docs/ops-runbook.md` §6 for the deploy procedure and the token scopes it needs.
