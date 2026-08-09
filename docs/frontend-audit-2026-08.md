# Front-end audit — 2026-08-08

**Scope:** full front-end design and function, top to bottom, across all 16 deployed pages.
**Method:** six parallel audit agents (visual design; accessibility; client-side function; UX and content; performance, SEO and consistency; responsive behaviour and architecture). Every finding below was verified against source before being recorded here.
**Baseline at time of audit:** 105 unit tests passing, browser QA green.

This document is a findings record. It changes no code. Companion to `docs/v0-handoff.md`, which describes what a design pass may and may not touch — and which this audit finds is **internally contradictory** (see C4).

---

## Verdict

The engineering is disciplined in the places most sites are sloppy. The generator makes cross-page drift structurally impossible; every internal link on all 16 pages resolves; the compliance strings are byte-identical everywhere because they are interpolated from one constant; 14 of 16 pages ship zero JavaScript; the integrity invariant genuinely holds — no path renders an unverified figure as a number.

The design surface is, by its own admission, not finished. `public/assets/css/base.css:1-15`:

> This is a SHELL for a later design pass, not a finished skin… It does not establish a brand.

That pass never happened. The shell shipped and has been the product since. What a visitor meets is a 640px column of near-unstyled document, four identical grey blocks reading "Price not currently verified", and three dashed boxes labelled *Advertisement* containing nothing.

**Severity counts:** 7 critical · 21 high · 24 medium · 19 low.

---

## Critical findings

### C1 — No doctype on any page; all 16 render in quirks mode

Every page begins at `<meta charset="utf-8">`. No `<!DOCTYPE html>`, no `<html>` element, and therefore nowhere for `lang="en"`. Origin: `tools/build-pages.mjs:114`.

- Browsers set `document.compatMode === "BackCompat"` — a legacy rendering path nobody designed for, and which any future redesign would unknowingly be built on.
- With no language declared, screen readers fall back to the user's default voice. On a page listing *semaglutide*, *tirzepatide* and *orforglipron*, mispronunciation is a comprehension problem. **WCAG 2.2 SC 3.1.1 (Level A) fails on all 16 pages.**

**Fix:** three lines at the top of `layout()` in `tools/build-pages.mjs`, then regenerate. Add `documentElement.lang` and `document.compatMode` assertions to `tools/qa.mjs`.

### C2 — The staleness banner is 22 days from contradicting the page it sits on

All 45 rows in `public/data/pricing.json` carry `value: null`. But `overallStaleness` (`public/engine/pricing.js:305`) is computed from `verified_date` alone, with no reference to confidence. Verified by running the engine directly:

| Date | Age | Renders |
| --- | --- | --- |
| 2026-08-29 | 30 d | nothing |
| **2026-08-30** | 31 d | "Some prices may be outdated." |
| **2026-09-29** | 61 d | red `role="alert"`: "These prices are likely out of date." |

The site will warn that figures below are stale, directly above a paragraph explaining that none of them is a figure.

**Fix:** compute overall staleness over priced results only — `results.filter(r => r.monthlyCost !== null)`.

### C3 — The site is anonymous, and it collects email addresses

No author, no organisation, no legal entity, no contact method, **no privacy policy and no terms** anywhere in the tree. Verified: no `/privacy/`, `/terms/` or `/contact/` directory; zero `mailto:` links sitewide. Meanwhile `functions/api/alerts.js:109-118` writes an email address and `cf-ipcountry` to KV.

This is a live compliance exposure (CCPA/CPRA; GDPR for any EU traffic) independent of any design question. It is also the ceiling on every other improvement here — for YMYL topics, publisher identity is weighted heavily, and an anonymous publisher cannot accumulate trust regardless of methodology quality.

Both `/about/` and `/methodology/` invite corrections while providing no channel to send one.

**Fix:** privacy policy and a monitored contact address first, as a legal matter. Then a named publisher and maintainer, plus an `Organization` node in structured data.

### C4 — `tools/qa.mjs` is coupled to presentational class names, and fails with correctness-shaped messages

Deployment is gated behind `tools/qa.mjs`. It locates everything it checks by CSS class name — twelve of them, at `qa.mjs:333, 336-342, 479, 502, 559, 569-570, 606`.

| Rename this | And QA reports |
| --- | --- |
| `.visually-hidden` | `vector 1 on screen` — reads as **a wrong price** |
| `.card__caveat` | reads as **a missing safety caveat** |
| `.card__verified-state` | reads as **a compliance violation** |
| `.card` | `0 cards` — reads as a broken render |

Every failure is shaped like a correctness defect. A redesigner would spend days inside a pricing engine that was never touched.

One check fails silently in the *safe* direction: `qa.mjs:606` looks for a dismiss control inside `.disclaimer`. Rename that class and the check returns `false` permanently — it passes forever, while checking nothing.

Meanwhile `public/assets/js/render.js` — the file `docs/v0-handoff.md:4` designates as replaceable — has **zero tests**. All 105 protect the engine that must not change.

**This makes `v0-handoff.md:4` ("replace every tag, class and style") and `v0-handoff.md:21` ("`qa.mjs` must stay green") mutually unsatisfiable.**

**Fix:** convert every scraping hook to `data-*`; declare that set in the handoff as a third category — the *testing contract* — alongside "replace freely" and "do not change". Add behaviour tests for `render.js`.

### C5 — Assistive text asserts the opposite of the visible text, on every card

`public/engine/staleness.js:125-133` hardcodes the word *verified* into every return branch of `describeAge()`. `public/assets/js/render.js:80` calls it unconditionally, regardless of `result.confidence`. Result:

> "**Not verified** 2026-07-30 … Source, opens in a new tab … **verified 9 days ago**"

On a site whose entire proposition is verification state, the AT-only text contradicts the visible text on every card on every page — all 45 figures are unverified. `qa.mjs:330-334` strips `.visually-hidden` before scraping, so the harness is structurally incapable of catching it.

**Fix:** branch the age string on confidence. Add a QA pass that reads AT text and asserts it does not contradict visible state.

### C6 — One select change announces up to 771 words

`public/index.html:91` marks the results section `aria-live="polite"`; `public/assets/js/app.js:90` replaces the entire subtree. Measured by rendering shipped data through the real engine:

| Selection | Words | Speech @180wpm |
| --- | --- | --- |
| zepbound · no insurance | 377 | 2 min 6 s |
| wegovy · commercial covered | 592 | 3 min 17 s |
| **ozempic · medicare** | **771** | **4 min 17 s** |

A keyboard user arrowing through the five-option insurance select fires this four times consecutively. The urgent staleness banner carries `role="alert"` but is nested *inside* the polite region (`render.js:141`), so it forfeits assertive priority and arrives as words 1–60 of an uninterruptible block.

**Fix:** remove `aria-live` from `.results`; add a one-line `role="status"` element outside it; debounce `render()` by ~250 ms.

### C7 — Desktop is the mobile column centred, and it clips the evidence table

One layout breakpoint exists (`base.css:555-559`, 40rem) changing three declarations. `--measure: 42rem` never changes at any width. Measured content width is a flat **640px from 768px to 2560px**; gutters reach 937px per side.

| Table (`/methodology/`) | Needs | Gets | Clipped |
| --- | --- | --- | --- |
| Complete price table (8 col) | 935px | 638px | **297px** |
| Candidates (6 col) | 653px | 638px | 15px |

The clipped columns are *Verified date* and *Source* — the two fields carrying the site's argument. On a 1440px monitor a reader must drag a table sideways to reach a citation, with 754px of white space beside it.

At 390px the same tables overflow by up to 579px with **no scroll affordance of any kind**. The sticky header (`base.css:410`) is dead code: `.table-scroll` has no bounded height, so it has no scrollport and `position: sticky` never fires (measured: `scrollHeight === clientHeight`).

**Fix:** split `--measure` into prose / app / data. Add real breakpoints. The tool is three inputs and a ranked list — a sticky input rail beside a results column needs no markup change.

---

## The pattern underneath

Several findings are one problem in different clothes: **the interface was designed for a product that publishes prices, and now runs one that does not.**

- The `<h1>` promises "the cheapest legal way to pay"; the tool ranks nothing.
- `.card__cost--unverified` (`base.css:323-328`) overrides `font-size` but not `min-height`, leaving **~31px of dead space under every card**.
- `renderSavings` returns `''` unless a saving exists (`render.js:172`) — the one place a large motivating number appears never renders.
- "None has a price we have been able to verify" is set in `.results__count` — the smallest, faintest type on the page (`base.css:270`).
- The user who gets no answer receives *more* text than one who gets everything: LillyDirect carries four caveats, one of them 79 words.

`/methodology/` holds a table headed "what our research located but could not confirm" with real figures ($299, $399, $1,349), each beside the provenance held and what would confirm it. That is the most valuable content on the site. It sits ~730 lines below the fold, inside a horizontally-clipped table.

**The introductory-pricing caveat** — headline low prices cover the two lowest doses for the first two fills only, then rise to roughly $349–$399 — appears on **zero of the 16 static pages**. It reaches the interface only as a bullet inside a card, styled identically to "requires a valid prescription".

---

## High-severity findings

| # | Finding | Location |
| --- | --- | --- |
| H1 | A failed data load is overwritten by a false "Loading" message permanently — the `!dataset` branch runs first on the next interaction | `app.js:64-68, 152-164` |
| H2 | No fetch timeout, no retry, no abort — a hung request never settles, so the catch never runs | `app.js:149` |
| H3 | Without JS the alerts form does a native GET, putting the subscriber's email in the URL, history and referrers | `alerts/index.html:45` |
| H4 | Alerts KV write is a two-step non-transaction; a mid-failure retry returns `{ok:true}` while leaving the subscriber unreachable | `functions/api/alerts.js:134-143` |
| H5 | No rate limiting, no confirmation step — the endpoint will accept and store a breach dump, then mail all of it | `functions/api/alerts.js` |
| H6 | No `og:image` and no favicon anywhere; every share renders as a grey text box | all pages |
| H7 | Meta descriptions truncated mid-word on 5 pathway pages by a blind `slice(0,155)` | `build-pages.mjs:781` |
| H8 | Unhashed assets at `max-age=3600` while HTML revalidates — a redesign ships new HTML against up to an hour of stale CSS | `_headers:8-12` |
| H9 | Alerts CTA appears only in the masthead; homepage has none, footer omits it entirely | all pages |
| H10 | `.empty` and `.ad-slot` are both dashed grey boxes — the results placeholder is indistinguishable from unsold inventory | `base.css:382-388, 453-461` |
| H11 | Footer ad slot renders directly above the medical disclaimer | `build-pages.mjs:149` |
| H12 | Print loses every source URL and still clips the evidence table by 297px | `base.css:570-573` |
| H13 | No dark mode; no `color-scheme`, so native select popovers render dark over a white page | `base.css` |
| H14 | Form control borders fail SC 1.4.11 — select 1.72:1, email input 1.86:1 with 1.00:1 fill contrast | `base.css:233, 500` |
| H15 | Results section carries a dangling `aria-labelledby` until first render, so it is not a named landmark on arrival | `index.html:91` |
| H16 | `list-style:none` strips list semantics in Safari/VoiceOver — the ordinal *is* the ranking | `base.css:287` |
| H17 | "Lowest verified cost" sits in a `<p>` before the `<h3>`, so heading navigation skips it | `render.js:119-126` |
| H18 | Alerts validation error is not associated with the field; `.focus()` races the live-region announcement | `alerts.js:38-42` |
| H19 | Submit button never re-enabled on success — the form is single-use per page load | `alerts.js:65-69` |
| H20 | Results empty-state double layout shift (~0.066), invisible to CI because `qa.mjs` runs unthrottled on loopback | `app.js:64-77` |
| H21 | Weight 650 collapses to bold on Roboto/Arial/Helvetica, flattening the entire heading hierarchy on Android | `base.css:88` |

---

## Notable medium findings

- **A stray full stop on all 16 pages.** `.data-stamp` is `display:flex` with a `gap`, making the trailing "." its own flex item: *"Pricing data as of 2026-07-30 ."* The identical string in the footer renders correctly, which proves the cause. `base.css:183-186`.
- **Arithmetic error.** `changelog/index.html:56` states "all 26 tracked price figures"; `pricing.json` contains 45. Both counted.
- **`officialUrl` is never validated.** `validateDataset` enforces `^https://` on `source_url` but never iterates `dataset.pathways`, so `officialUrl` reaches `href` unchecked. `esc()` cannot neutralise a `javascript:` scheme. `pricing.js:386-388`, `render.js:103`.
- **Data stamp missing on `/about/` and `/alerts/`**, and `qa.mjs:601` computes `hasDataStamp` then never asserts it — a dead assertion creating false confidence.
- **No Content-Security-Policy**, on a site that intends to inject third-party ad scripts into three slots per page.
- **`.empty` is authored in five places** across three files (`app.js:66,72,157`, `render.js:231`, `build-pages.mjs:362`). A redesigner replacing `render.js` per the handoff updates one of five.
- **No JSON-LD** on `/methodology/`, `/changelog/`, `/about/`, `/alerts/`. No `Organization`, no `dateModified`, no `Dataset` on the page that literally publishes a sourced, dated 45-row dataset.
- **11px off-scale type** in `.pill` and `.ad-slot__label`, below the smallest scale step.
- **Three raw hex values** outside the token block: `base.css:283, 284, 572`.

---

## Redesign blocker list

Must be resolved before visual work begins:

1. **Decouple `qa.mjs` from presentational class names** (C4). Without this, every redesign failure misreports its own cause.
2. **Add behaviour tests for `render.js`** (C4). Assert the contract, not the classes: every card emits a source link and a verified date; `monthlyCost === null` never renders a number; suppressed pathways never enter the main list.
3. **Fix the cache story** (H8). Content-hash asset filenames, or drop them to revalidate-always. Ship this in its own deploy, before the redesign.
4. **Extend `qa.mjs` beyond one viewport** (`qa.mjs:34`). The stated fold contract already fails at 375×667 (+53px) and 320×568 (+270px) with nothing detecting it.
5. **Add network and CPU throttling to `qa.mjs`** (H20). The CLS gate currently measures a network condition no user has.

### Undocumented constraints a redesigner must be told

None of these appear in `docs/v0-handoff.md`, and all of them fail the build:

- **No external URLs in CSS.** `test/integrity.test.js:175-203` scans `.css` under `public/` against a primary-source allowlist. A Google Fonts `@import` fails the build. Self-host or use `data:` URIs.
- **No emoji anywhere**, including CSS `content:` — `test/integrity.test.js:67-102`.
- **`.affiliate-slot { display: none }`** (`base.css:487`) is a compliance control, not a style.
- **Ad slot heights and `contain: layout size`** (`base.css:453-482`) are CLS controls, measured and gated at `qa.mjs:526-529`.
- **Icons are constrained** to a 24×24 viewBox with `stroke="currentColor"`, no `url()`, no `<text>` — `test/integrity.test.js:420-444`.

---

## If you do only five things

| # | Action | Rationale | Effort |
| --- | --- | --- | --- |
| 1 | Doctype + `lang` in the page template | Level A failure; 16 pages out of quirks mode | 3 lines |
| 2 | Staleness banner suppressed when nothing is priced | Fires 2026-08-30 unattended | 1 line |
| 3 | Privacy policy + contact address | You collect PII. Legal, not cosmetic | Hours |
| 4 | QA onto `data-*`; test `render.js` | Unblocks every subsequent visual change | Half a day |
| 5 | Favicon + `og:image` | Every share currently renders as a grey box | Half a day |

---

## One thing worth defending

Do not let a redesign "fix" the honesty. The decision recorded in `docs/discrepancy-report.md` — *"The machinery is verified. The data is not"* — is correct, and `/methodology/`'s verification-status banner is the best content on the site.

The problem was never that the site admits it does not know. It is that the admission arrives in 13px grey, after a three-question form, on a page whose headline promised otherwise, beside an empty box labelled *Advertisement*.

Fix the delivery. Keep the position.
