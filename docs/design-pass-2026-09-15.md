# Visual design pass — "Cinematic one-sheet"

Ported from the Lovable project **GLP-1 Aesthetics**
(`2e65516d-307b-4b90-9371-7746d2197ba7`), file `src/styles.css`, against the
design plan at `.lovable/plan/glp-1-price-check-visual-design-pass-2026-09-14.md`.

Everything else in that project was discarded. It was TanStack Start + React +
Tailwind v4 + shadcn/ui with 50+ generated components, a bun lockfile and a Vite
config. This site is hand-authored static HTML, one CSS file and one vanilla ES
module, served exactly as committed with an empty build command. **No framework,
no bundler, no package manager, no build step was introduced.**

> A note for whoever edits this file next: do not name the hosting provider in
> this document. `test/integrity.test.js` flags a 40-character base62 run as a
> possible leaked API token when that provider's name appears in the same file,
> and the Lovable plan's filename above is a 46-character run. The heuristic is
> right to be blunt about credentials; the fix is to not put both strings in one
> file, not to loosen the test.


The stylesheet was worth porting because it was written against the real class
names rather than against React components, and because it preserves the
existing token names (`--confirmed`, `--warn`, `--urgent`, `--paper`, `--ink`),
the `prefers-reduced-motion` block, the dimensioned ad slots and the 3px focus
outline.

---

## 1. What was stripped before porting

### Tailwind plumbing — removed

The first four lines and the whole `@theme inline { … }` block are gone. Nothing
in this repository consumes them.

```
$ grep -rn '@import "tailwindcss"\|--tw-\|@theme\|tw-animate\|@source ' public/ tools/
public/assets/css/base.css:14: *   1. The Tailwind header (@import "tailwindcss" / @source / tw-animate-css)
public/assets/css/base.css:15: *      and the @theme inline block. Nothing here consumes them.
```

Two hits, both inside the stylesheet's own header comment recording the removal.
No declaration, no selector, no custom property.

### `.eyebrow` and `.section-kicker` — removed from CSS *and* markup

`text-transform: uppercase; font-size: .7rem; letter-spacing: .14em` — the
tracked-out all-caps eyebrow the brief bans as template chrome. Removed from the
stylesheet, and no markup hook was ever emitted for either; `grep -rni
'eyebrow\|section-kicker' public/ tools/` returns only the header comment above.

The same reasoning removed `.interior-hero::after`, which set the words
`SOURCE / DATE / CONTEXT` as a giant ghost word behind every interior page — the
same all-caps chrome, with the added problem of being copy injected from a
stylesheet.

### Every image reference — removed

The Lovable build generated `src/assets/glp1-research-still.jpg` and used it as a
full-bleed hero (`.hero > img`, `.hero__veil`). The brief said to generate no
imagery, and this project's own rules forbid AI-generated pictures presented as
real.

The hero **composition** is intact. The photograph is a CSS placeholder —
`.hero__media`, three gradients and a fine horizontal structure, no `url()`, no
request. The only `url()` calls in the whole stylesheet are the two font files.

Requirement logged in `IMAGE-MANIFEST.md` with delivery size (2400×1350),
aspect ratio, placement, focal point, weight budget, a paste-ready generation
prompt, explicit rejection criteria, and the alt-text slot.

### Colour notation — `oklch()`, consistently

The Lovable file was `oklch()`; the previous `base.css` was hex. The whole file
is now `oklch()`.

**Why.** The palette is a ladder of four near-black surfaces (`--bg`,
`--surface`, `--surface-2`, `--surface-3`) plus signal colours that each have to
hold a measured contrast ratio against all four. In oklch the `L` channel *is*
perceived lightness, so each surface step is a number you can reason about
(+0.037 L, uniformly) and each signal colour has a lightness budget you can
compute before you look at it. In hex that ladder is eyeballed, and it drifts —
which is how a dark theme ends up with one panel that is invisible on a phone at
40% brightness. Support is universal in current browsers.

One hex value survives, outside the stylesheet: `<meta name="theme-color">` and
the two colours in `site.webmanifest`, which are consumed by OS browser chrome
rather than by CSS. Both were updated to `#0c1215`, the sRGB rendering of
`--bg`.

---

## 2. Typography

The Lovable file loaded **three** families — IBM Plex Sans, Archivo Black, Libre
Baskerville — from Google Fonts, against a two-family budget.

### Libre Baskerville is cut

It was carrying `.lede`, every `h2`/`h3`, `.prose`, `.ledger-entry__body` and
`.card__cost--unverified`. Three reasons it went:

1. It was the third family, and the budget is two.
2. It was set at 0.86–1.0rem on a near-black ground. A transitional serif with
   fine hairline strokes at 14px reversed out of `oklch(0.178 …)` is the single
   most reliable way to make dark-mode body copy look smeared on a phone.
3. Its job here — making the editorial passage read as a printed page rather
   than as an interface — is done better by the inverted **paper band**, which
   flips the whole section to bone and ink. That is a stronger, cheaper signal
   than a serif at body size, and it costs no font file.

### What ships: two families, two files, 62.8 KB

| File | Family | Bytes |
| --- | --- | --- |
| `public/assets/fonts/ibm-plex-sans-v23-latin.woff2` | IBM Plex Sans, **variable** wght 100–700, latin | 45,712 |
| `public/assets/fonts/archivo-black-v23-latin.woff2` | Archivo Black, latin | 18,604 |
| | **Total** | **64,316 (62.8 KB)** |

Both self-hosted under `assets/fonts/`, both `font-display: swap`, both
preloaded with `crossorigin`. No Google Fonts, no CDN, no `@import`. Cached
`immutable` for a year — safe because the release version is in the filename, so
a new cut is a new URL.

IBM Plex Sans ships as a **variable** font, which is why two files cover every
weight. That also disposes of the Android weight-collapse bug recorded in
`docs/handoff/GLP1-Fund-30-day-plan.pdf`: there is no second static face to
collapse onto.

### Tabular lining figures — confirmed, not assumed

The brief asked for confirmation that the body face carries true tabular lining
figures. It does, and not via an OpenType feature:

```
IBM Plex Sans, digit advance widths from the font's own hmtx table
  wght 400: all ten digits 600 units   -> equal
  wght 600: all ten digits 600 units   -> equal
  wght 700: all ten digits 600 units   -> equal
  GSUB/GPOS features present: ccmp dnom frac kern liga mark numr
  tnum: absent    onum: absent    pnum: absent

Archivo Black
  all ten digits 667 units -> equal
```

There is no `tnum` feature because tabular is not an *alternate* in IBM Plex —
it is the default, and there is no proportional or oldstyle set to switch away
from. That is a stronger guarantee than a feature flag: it cannot be lost to a
renderer that ignores `font-feature-settings`. `font-variant-numeric:
tabular-nums lining-nums` is still declared on `td.num`, `.receipt` and
`.pipeline__n` as belt-and-braces for the fallback stack.

Also verified: **every character the 19 rendered pages contain is inside both
latin subsets**, so nothing falls back mid-sentence.

This replaces the T-12 stack (`-apple-system / Segoe UI / Roboto / Helvetica
Neue / Arial`).

---

## 3. What the Lovable build got wrong about the site

It invented routes `pricing`, `team`, `research-ledger` and `data-sources`. This
site has no team and sells nothing. It also built none of the real interior
pages.

**No page was created to justify CSS.** The 19 real pages are: `/`,
`/methodology/`, `/changelog/`, `/alerts/`, six medication pages, five pathway
pages, `/about/`, `/contact/`, `/privacy/`, `/terms/`.

### Components mapped onto real pages

| Lovable component | Mapped to |
| --- | --- |
| `.hero`, `.hero__veil`, `.hero__content` | The homepage hero, photograph replaced by a CSS placeholder |
| `.page-grid` | The homepage tool + verification position, side by side from 800px |
| `.research-band`, `.editorial-grid`, `.prose` | The **paper band**: the "Why this site and not a telehealth cost guide" passage on `/` |
| `.research-table` | Folded into `.table-scroll table` — the real evidence tables on `/methodology/`, the six drug pages and the five pathway pages. Sticky header, per-container scroll, full-width track |
| `.method-flow` | Folded into the existing `.pipeline` on `/methodology/` |
| `.interior-hero` | The `h1` + `.lede` + rule opening on all 18 interior pages, via `main.interior` — as type and space, with no ghost word and no second composition to maintain |
| `.research-pill--*` | Folded into the existing `.pill--*` on the evidence tables |
| `.link-list` | The medication index on `/` |

### Components dropped

| Dropped | Why |
| --- | --- |
| `.ledger-filters` | Nothing on this site is filterable. Adding filters is a feature, not a skin, and it would need new copy for every control label. |
| `.ledger-index` | A four-up big-number index. No page has four headline statistics; `/methodology/`'s tally has eight rows and already has a treatment. |
| `.ledger-record` | A card-with-`<dl>` record. The changelog is dated prose, not records, and restructuring it into records would have moved copy between elements for decoration's sake. |
| `.source-card` | No page is structured as one card per source. It also wanted a kicker and a status label — new copy. |
| `.ledger-entry`, `.ledger-close`, `.editorial-ledger` | Belonged to the invented `research-ledger` route. The numbered-row rhythm was tempting for `/changelog/`, but the numbers would have been generated ordinals presented as editorial structure. |
| `.masthead__brand strong/small` | Needed a tagline. There isn't one. |
| `.live-status` | A status chip claiming live data, on a site that currently publishes no verified price. |
| `.tool__head` / visible `.tool__head h2` | The tool's heading stays `visually-hidden`; three numbered labels already say what the form is. |
| `.site-shell`, `.masthead--interior`, `.brand-mark`, `.footer-date`, `.legal-notice`, `.site-footer--interior`, `.index-section`, `.pathway-section` | No corresponding markup, and none worth inventing markup for. |
| `.research-receipt` | **Held for your decision — see section 8.** |

---

## 4. Accessibility

### Contrast — 126 pairs, measured on rendered pages, zero failures

The ratios below are not read off the token table. Each one is taken from a real
element on a real page in real Chromium using `CSS.getBackgroundColors`, the
same DevTools API the browser's own contrast tool uses, which resolves what is
actually painted behind a node — gradients, translucent veils and tinted panels
included. Where a backdrop is a gradient, the **worst** stop is the one
reported.

Reproduce with `node tools/contrast-audit.mjs`; it exits non-zero on any
failure.

Thresholds: **1.4.3 AA** 4.5:1 for text, 3:1 where the text is large (≥24px, or
≥18.66px at weight 700+); **1.4.11 AA** 3:1 for the visual boundary of a control
and for the focus indicator. Purely decorative hairlines are reported as
`decorative` and not gated — WCAG exempts them, and claiming a 1px rule is a UI
component would make the table dishonest in the other direction.

Four of the runs drive the tool with fixture datasets, because the shipped data
confirms nothing and the fresh / warn / urgent / savings / best-card states
would otherwise go unmeasured until the day a price is verified — which is the
day nobody is looking at contrast.

| Pair | Page | Foreground | Background | Size / weight | Ratio | Needs | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Display headline over the hero veil | `/` | `#f3f0e7` | `#0c1215` | 30.4px / 400 (large) | **16.56** | 3.00 | PASS |
| Hero lede over the hero veil | `/` | `#aab9bd` | `#0c1215` | 17px / 400 | **9.33** | 4.50 | PASS |
| Masthead brand | `/` | `#f3f0e7` | `#0c1215` | 15.2px / 400 | **16.56** | 4.50 | PASS |
| Masthead nav link | `/` | `#aab9bd` | `#0c1215` | 14px / 600 | **9.33** | 4.50 | PASS |
| Field label on the tool panel | `/` | `#f3f0e7` | `#131b1e` | 16px / 600 | **15.32** | 4.50 | PASS |
| Select control text | `/` | `#f3f0e7` | `#0c1215` | 16px / 400 | **16.56** | 4.50 | PASS |
| Disabled select text | `/` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Privacy note on the tool panel | `/` | `#aab9bd` | `#131b1e` | 16px / 400 | **8.63** | 4.50 | PASS |
| Data stamp | `/` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Verification-state heading | `/` | `#f3f0e7` | `#131b1e` | 17px / 600 | **15.32** | 4.50 | PASS |
| Verification-state body | `/` | `#aab9bd` | `#131b1e` | 16px / 400 | **8.63** | 4.50 | PASS |
| Verification-state link | `/` | `#57d8b5` | `#131b1e` | 16px / 400 | **9.89** | 4.50 | PASS |
| Empty-results text | `/` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Advertisement label | `/` | `#aab9bd` | `#0c1215` | 13px / 600 | **9.33** | 4.50 | PASS |
| Paper-band heading (inverted) | `/` | `#172023` | `#f3f0e7` | 20.95px / 600 | **14.54** | 4.50 | PASS |
| Paper-band prose (inverted) | `/` | `#465256` | `#f3f0e7` | 17px / 400 | **7.08** | 4.50 | PASS |
| Paper-band link (inverted) | `/` | `#006e57` | `#f3f0e7` | 17px / 600 | **5.47** | 4.50 | PASS |
| Index link | `/` | `#f4bb5b` | `#0c1215` | 16px / 600 | **10.88** | 4.50 | PASS |
| Index link trailing text | `/` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Footer disclaimer | `/` | `#f3f0e7` | `#131b1e` | 17px / 400 | **15.32** | 4.50 | PASS |
| Footer non-affiliation | `/` | `#f3f0e7` | `#131b1e` | 16px / 600 | **15.32** | 4.50 | PASS |
| Footer body text | `/` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Footer nav link | `/` | `#aab9bd` | `#131b1e` | 16px / 400 | **8.63** | 4.50 | PASS |
| Footer link in body text | `/` | `#57d8b5` | `#131b1e` | 16px / 400 | **9.89** | 4.50 | PASS |
| Skip link (focused) | `/` | `#0c1215` | `#f4c55a` | 16px / 600 | **11.66** | 4.50 | PASS |
| Select border against the tool panel | `/` | `#6d7c81` | `#0c1215` | UI boundary | **4.36** | 3.00 | PASS |
| Focus ring against the tool panel | `/` | `#f4c55a` | `#0c1215` | UI boundary | **11.66** | 3.00 | PASS |
| Tool panel edge against the page | `/` | `#6d7c81` | `#0c1215` | UI boundary | **4.36** | 3.00 | PASS |
| Advertisement slot edge | `/` | `#6d7c81` | `#0c1215` | UI boundary | **4.36** | 3.00 | PASS |
| Verification-state accent edge | `/` | `#f4bb5b` | `#0c1215` | UI boundary | **10.88** | 3.00 | PASS |
| Hairline rule inside a panel | `/` | `#2d373b` | `#0c1215` | decorative | **1.55** | n/a | exempt |
| Interior headline | `/methodology/` | `#f3f0e7` | `#131b1e` | 25.3px / 400 (large) | **15.32** | 3.00 | PASS |
| Interior lede | `/methodology/` | `#aab9bd` | `#131b1e` | 17px / 400 | **8.63** | 4.50 | PASS |
| Body paragraph | `/methodology/` | `#aab9bd` | `#131b1e` | 17px / 400 | **8.63** | 4.50 | PASS |
| Receipt row label | `/methodology/` | `#f3f0e7` | `#131b1e` | 16px / 400 | **15.32** | 4.50 | PASS |
| Receipt total | `/methodology/` | `#f3f0e7` | `#131b1e` | 16px / 600 | **15.32** | 4.50 | PASS |
| Pipeline step number | `/methodology/` | `#f4bb5b` | `#131b1e` | 16px / 600 | **10.06** | 4.50 | PASS |
| Pipeline step body | `/methodology/` | `#f3f0e7` | `#0c1215` | 16px / 400 | **16.56** | 4.50 | PASS |
| Pipeline muted step | `/methodology/` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Pipeline note | `/methodology/` | `#aab9bd` | `#0c1215` | 13px / 400 | **9.33** | 4.50 | PASS |
| Urgent banner text | `/methodology/` | `#fb7764` | `#0c1215` | 16px / 400 | **7.12** | 4.50 | PASS |
| Table header | `/methodology/` | `#f3f0e7` | `#242c30` | 13px / 600 | **12.47** | 4.50 | PASS |
| Table cell | `/methodology/` | `#f3f0e7` | `#131b1e` | 13px / 400 | **15.32** | 4.50 | PASS |
| Table numeric cell | `/methodology/` | `#f3f0e7` | `#0c1215` | 13px / 400 | **16.56** | 4.50 | PASS |
| Table link | `/methodology/` | `#57d8b5` | `#0c1215` | 13px / 400 | **10.69** | 4.50 | PASS |
| Pill: sources conflict | `/methodology/` | `#f4c55a` | `#121212` | 13px / 600 | **11.58** | 4.50 | PASS |
| Pill: not verified | `/methodology/` | `#b5bcbe` | `#0c1215` | 13px / 600 | **9.79** | 4.50 | PASS |
| Table hairline | `/methodology/` | `#2d373b` | `#131b1e` | decorative | **1.43** | n/a | exempt |
| Intro-warning heading | `/zepbound-cost/` | `#f4c55a` | `#0c1215` | 17px / 600 | **11.66** | 4.50 | PASS |
| Intro-warning body | `/zepbound-cost/` | `#f3f0e7` | `#251d0b` | 16px / 400 | **14.63** | 4.50 | PASS |
| Intro-warning scope note | `/zepbound-cost/` | `#aab9bd` | `#0c1215` | 13px / 400 | **9.33** | 4.50 | PASS |
| Warn banner text | `/zepbound-cost/` | `#f4c55a` | `#0c1215` | 16px / 400 | **11.66** | 4.50 | PASS |
| Eligibility list item | `/lillydirect/` | `#aab9bd` | `#131b1e` | 16px / 400 | **8.63** | 4.50 | PASS |
| Eligibility pending note | `/medicare-glp1-bridge/` | `#aab9bd` | `#0c1215` | 13px / 400 | **9.33** | 4.50 | PASS |
| Email input text | `/alerts/` | `#f3f0e7` | `#0c1215` | 16px / 400 | **16.56** | 4.50 | PASS |
| Submit button label | `/alerts/` | `#0c1215` | `#f4c55a` | 16px / 600 | **11.66** | 4.50 | PASS |
| Email input border | `/alerts/` | `#6d7c81` | `#0c1215` | UI boundary | **4.36** | 3.00 | PASS |
| Submit button against the form panel | `/alerts/` | `#f4c55a` | `#0c1215` | UI boundary | **11.66** | 3.00 | PASS |
| Card pathway name | `results, shipped` | `#f3f0e7` | `#1b2427` | 17px / 600 | **13.87** | 4.50 | PASS |
| Card price (verified) | `results, shipped` | `#b5bcbe` | `#1b2427` | 17px / 600 | **8.21** | 4.50 | PASS |
| Card price (unverified) | `results, shipped` | `#b5bcbe` | `#1b2427` | 17px / 600 | **8.21** | 4.50 | PASS |
| Card annual figure | `results, shipped` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Card note | `results, shipped` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Card caveat | `results, shipped` | `#f4c55a` | `#0c1215` | 16px / 500 | **11.66** | 4.50 | PASS |
| Verified stamp: unverified | `results, shipped` | `#b5bcbe` | `#0c1215` | 16px / 400 | **9.79** | 4.50 | PASS |
| Card source link | `results, shipped` | `#57d8b5` | `#0c1215` | 16px / 400 | **10.69** | 4.50 | PASS |
| Results count line | `results, shipped` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Suppression summary | `results, shipped` | `#f3f0e7` | `#0c1215` | 16px / 600 | **16.56** | 4.50 | PASS |
| Suppression item | `results, shipped` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Card leading edge against the page | `results, shipped` | `#6d7c81` | `#0c1215` | UI boundary | **4.36** | 3.00 | PASS |
| Card hairline edge | `results, shipped` | `#6d7c81` | `#0c1215` | UI boundary | **4.36** | 3.00 | PASS |
| Warn banner edge | `results, shipped` | `#f4c55a` | `#0c1215` | UI boundary | **11.66** | 3.00 | PASS |
| Card pathway name | `results, fresh` | `#f3f0e7` | `#1b2427` | 17px / 600 | **13.87** | 4.50 | PASS |
| Card price (verified) | `results, fresh` | `#f3f0e7` | `#0c1215` | 37.11px / 400 (large) | **16.56** | 3.00 | PASS |
| Card price (unverified) | `results, fresh` | `#b5bcbe` | `#1b2427` | 17px / 600 | **8.21** | 4.50 | PASS |
| Card annual figure | `results, fresh` | `#aab9bd` | `#1b2427` | 16px / 400 | **7.82** | 4.50 | PASS |
| Card rank line | `results, fresh` | `#57d8b5` | `#0c1215` | 16px / 600 | **10.69** | 4.50 | PASS |
| Card caveat | `results, fresh` | `#f4c55a` | `#0c1215` | 16px / 500 | **11.66** | 4.50 | PASS |
| Verified stamp: fresh | `results, fresh` | `#57d8b5` | `#0c1215` | 16px / 600 | **10.69** | 4.50 | PASS |
| Verified stamp: unverified | `results, fresh` | `#b5bcbe` | `#0c1215` | 16px / 400 | **9.79** | 4.50 | PASS |
| Card source link | `results, fresh` | `#57d8b5` | `#0c1215` | 16px / 400 | **10.69** | 4.50 | PASS |
| Results count line | `results, fresh` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Savings figure | `results, fresh` | `#57d8b5` | `#0f221d` | 25.3px / 400 (large) | **9.39** | 3.00 | PASS |
| Suppression summary | `results, fresh` | `#f3f0e7` | `#0c1215` | 16px / 600 | **16.56** | 4.50 | PASS |
| Suppression item | `results, fresh` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Best-card accent edge | `results, fresh` | `#57d8b5` | `#0c1215` | UI boundary | **10.69** | 3.00 | PASS |
| Card leading edge against the page | `results, fresh` | `#57d8b5` | `#0c1215` | UI boundary | **10.69** | 3.00 | PASS |
| Card hairline edge | `results, fresh` | `#57d8b5` | `#0c1215` | UI boundary | **10.69** | 3.00 | PASS |
| Card pathway name | `results, 40d old` | `#f3f0e7` | `#1b2427` | 17px / 600 | **13.87** | 4.50 | PASS |
| Card price (verified) | `results, 40d old` | `#f3f0e7` | `#0c1215` | 37.11px / 400 (large) | **16.56** | 3.00 | PASS |
| Card price (unverified) | `results, 40d old` | `#b5bcbe` | `#1b2427` | 17px / 600 | **8.21** | 4.50 | PASS |
| Card annual figure | `results, 40d old` | `#aab9bd` | `#1b2427` | 16px / 400 | **7.82** | 4.50 | PASS |
| Card rank line | `results, 40d old` | `#57d8b5` | `#0c1215` | 16px / 600 | **10.69** | 4.50 | PASS |
| Card caveat | `results, 40d old` | `#f4c55a` | `#0c1215` | 16px / 500 | **11.66** | 4.50 | PASS |
| Verified stamp: warn | `results, 40d old` | `#f4c55a` | `#0c1215` | 16px / 600 | **11.66** | 4.50 | PASS |
| Verified stamp: unverified | `results, 40d old` | `#b5bcbe` | `#0c1215` | 16px / 400 | **9.79** | 4.50 | PASS |
| Card source link | `results, 40d old` | `#57d8b5` | `#0c1215` | 16px / 400 | **10.69** | 4.50 | PASS |
| Results count line | `results, 40d old` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Savings figure | `results, 40d old` | `#57d8b5` | `#0f221d` | 25.3px / 400 (large) | **9.39** | 3.00 | PASS |
| Suppression summary | `results, 40d old` | `#f3f0e7` | `#0c1215` | 16px / 600 | **16.56** | 4.50 | PASS |
| Suppression item | `results, 40d old` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Best-card accent edge | `results, 40d old` | `#57d8b5` | `#0c1215` | UI boundary | **10.69** | 3.00 | PASS |
| Card leading edge against the page | `results, 40d old` | `#57d8b5` | `#0c1215` | UI boundary | **10.69** | 3.00 | PASS |
| Card hairline edge | `results, 40d old` | `#57d8b5` | `#0c1215` | UI boundary | **10.69** | 3.00 | PASS |
| Warn banner edge | `results, 40d old` | `#f4c55a` | `#0c1215` | UI boundary | **11.66** | 3.00 | PASS |
| Card pathway name | `results, 120d old` | `#f3f0e7` | `#1b2427` | 17px / 600 | **13.87** | 4.50 | PASS |
| Card price (verified) | `results, 120d old` | `#f3f0e7` | `#0c1215` | 37.11px / 400 (large) | **16.56** | 3.00 | PASS |
| Card price (unverified) | `results, 120d old` | `#b5bcbe` | `#1b2427` | 17px / 600 | **8.21** | 4.50 | PASS |
| Card annual figure | `results, 120d old` | `#aab9bd` | `#1b2427` | 16px / 400 | **7.82** | 4.50 | PASS |
| Card rank line | `results, 120d old` | `#57d8b5` | `#0c1215` | 16px / 600 | **10.69** | 4.50 | PASS |
| Card caveat | `results, 120d old` | `#f4c55a` | `#0c1215` | 16px / 500 | **11.66** | 4.50 | PASS |
| Verified stamp: urgent | `results, 120d old` | `#fb7764` | `#0c1215` | 16px / 600 | **7.12** | 4.50 | PASS |
| Verified stamp: unverified | `results, 120d old` | `#b5bcbe` | `#0c1215` | 16px / 400 | **9.79** | 4.50 | PASS |
| Card source link | `results, 120d old` | `#57d8b5` | `#0c1215` | 16px / 400 | **10.69** | 4.50 | PASS |
| Results count line | `results, 120d old` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Savings figure | `results, 120d old` | `#57d8b5` | `#0f221d` | 25.3px / 400 (large) | **9.39** | 3.00 | PASS |
| Suppression summary | `results, 120d old` | `#f3f0e7` | `#0c1215` | 16px / 600 | **16.56** | 4.50 | PASS |
| Suppression item | `results, 120d old` | `#aab9bd` | `#0c1215` | 16px / 400 | **9.33** | 4.50 | PASS |
| Best-card accent edge | `results, 120d old` | `#57d8b5` | `#0c1215` | UI boundary | **10.69** | 3.00 | PASS |
| Card leading edge against the page | `results, 120d old` | `#57d8b5` | `#0c1215` | UI boundary | **10.69** | 3.00 | PASS |
| Card hairline edge | `results, 120d old` | `#57d8b5` | `#0c1215` | UI boundary | **10.69** | 3.00 | PASS |
| Urgent banner edge | `results, 120d old` | `#fb7764` | `#0c1215` | UI boundary | **7.12** | 3.00 | PASS |
| Warn banner edge | `results, 120d old` | `#fb7764` | `#0c1215` | UI boundary | **7.12** | 3.00 | PASS |
| Pill: confirmed (no data yet; class applied in place) | `/methodology/` | `#57d8b5` | `#0c1215` | 13px / 600 | **10.69** | 4.50 | PASS |
| Pill: primary source (no data yet; class applied in place) | `/methodology/` | `#57d8b5` | `#0c1215` | 13px / 600 | **10.69** | 4.50 | PASS |
| Pill: secondary source (no data yet; class applied in place) | `/methodology/` | `#f4c55a` | `#0c1215` | 13px / 600 | **11.66** | 4.50 | PASS |

### Keyboard walkthrough of the three-step tool

`node tools/keyboard-audit.mjs`, real `Tab` keypresses at 390×844, walking from
the top of the document to the source link of the first result card.

```
Keyboard walkthrough of the three-step tool at 390x844

  #  element                                        focus indicator        target      in view
  ----------------------------------------------------------------------------------------------------
  1  a.skip-link                                   3px solid @2px         144x50             yes
  2  a.masthead__brand                             3px solid @2px         187x44             yes
  3  a                                             3px solid @2px         61x44              yes
  4  a                                             3px solid @2px         84x44              yes
  5  a                                             3px solid @2px         90x44              yes
  6  a                                             3px solid @2px         44x44              yes
  7  select#drug                                   3px solid @2px         324x46             yes
  8  select#insurance                              3px solid @2px         324x46             yes
  9  a                                             3px solid @2px         261x46 inline      yes
  10 a                                             3px solid @2px         177x22 inline      yes
  11 a                                             3px solid @2px         110x44 inline      yes
  12 a                                             3px solid @2px         104x44 inline      yes
  13 a                                             3px solid @2px         93x44 inline       yes
  14 a                                             3px solid @2px         99x44 inline       yes
  15 a                                             3px solid @2px         149x44 inline      yes
  16 a                                             3px solid @2px         107x44 inline      yes
  17 a                                             3px solid @2px         133x20 inline      yes
  18 a                                             3px solid @2px         145x20 inline      yes
  19 a                                             3px solid @2px         65x20 inline       yes
  20 a                                             3px solid @2px         165x20 inline      yes
  21 a                                             3px solid @2px         195x20 inline      yes
  22 a                                             3px solid @2px         315x46 inline      yes
  23 a                                             3px solid @2px         262x20 inline      yes
  24 a                                             3px solid @2px         73x44              yes
  25 a                                             3px solid @2px         56x44              yes
  26 a                                             3px solid @2px         63x44              yes

26 focus stops walked.
Focus indicator painted at every stop: yes
Every stop inside the viewport: yes
Every standalone target at least 44x44: yes
Links inline in a sentence (WCAG 2.2 2.5.8 inline exception, not gated): 15
```

Two things this found and this pass fixed:

- The masthead's "Alerts" link measured **39px wide**. `min-width: 2.75rem` on
  every masthead nav link.
- The medication index links measured **40px tall**. Raised to 44px.

The 15 stops marked `inline` are links inside a sentence, which WCAG 2.2's
2.5.8 inline exception exempts. They are reported rather than silently skipped,
and they are deliberately *not* padded: padding a link inside running text
breaks the paragraph's line rhythm to nobody's benefit.

### State is never carried by colour alone

| State | Hue | Shape | Weight / style | Word |
| --- | --- | --- | --- | --- |
| Verified, fresh | teal | check-circle icon | 600 | "Verified" |
| Verified, may be outdated | amber | clock icon | 600 | "Verified, may be outdated" |
| Verified, likely outdated | red | triangle icon | 600 | "Verified, likely outdated" |
| Not verified | neutral | question-circle icon | 400, *italic* | "Not verified" |
| Pill: confirmed | teal | **solid** 1px border | 600 | "Confirmed" |
| Pill: sources conflict | amber | **dashed** 1px border | 600 | "Sources conflict" |
| Pill: not verified | neutral | **dotted** 1px border | 600 | "Not verified" |
| Card note | muted | shield icon | 400 | — |
| Card caveat | amber | triangle icon | 500 | — |
| Banner, warn | amber | clock icon, 3px edge | — | — |
| Banner, urgent | red | triangle icon, 5px edge | — | `role="alert"` |

The icons were already emitted by `render.js` and were not changed. A
`forced-colors: active` block keeps the shape signals when the OS discards the
hues.

### Also

- **Visible focus everywhere**: 3px solid amber at 2px offset, painted at all
  26 stops. Amber rather than teal so the ring can never be misread as a
  verification signal.
- **Doctype and language added.** Every page previously began at `<meta
  charset>` — no `<!DOCTYPE html>`, so all 19 pages rendered in **quirks mode**,
  and no `<html lang>`, failing WCAG 3.1.1 (Level A). A design pass cannot be
  delivered into quirks mode: box sizing and table layout are not the same
  there. This is the one markup change in this pass that is not purely visual,
  and it is named here because it is a correctness fix riding along with a skin.

---

## 5. Performance

Lighthouse 12.8.2, mobile form factor, simulated throttling, against the built
site.

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | **99** | **100** | **100** | **100** | 2.0 s | 0 | 0 ms |
| `/methodology/` | **99** | **100** | **100** | **100** | 2.0 s | 0 | 0 ms |
| `/zepbound-cost/` | **100** | **100** | **100** | **100** | 1.8 s | 0 | 0 ms |
| `/alerts/` | **100** | **100** | **100** | **100** | 1.7 s | 0 | 0 ms |
| `/changelog/` | **100** | **100** | **100** | **100** | 1.7 s | 0 | 0 ms |

| Budget | Required | Measured |
| --- | --- | --- |
| Lighthouse mobile, all four categories | ≥ 90 | **99–100** |
| Total CSS uncompressed | < 60 KB | **43.2 KB** (12.2 KB gzipped) |
| Font files | ≤ 4 | **2** |
| Font weight | — | 62.8 KB total |
| Third-party requests | 0 | **0** — 16 requests, one host |

The 16 requests on `/` are: the document, two fonts, the stylesheet, seven
engine/view modules, the pricing data, the manifest, the favicon and one icon.
Nothing else, from anywhere.

**Layout**: the content track went from a flat 640px at every desktop width to
`min(100% - 2 × gutter, 72rem)`. That closes the audit finding that the
methodology price table needed 935px and was being clipped by 297px even on a
2560px monitor. Prose still holds a 40rem measure; only tables and the grid use
the full track.

---

## 6. What did not change

| | |
| --- | --- |
| `public/engine/**` | byte-identical |
| `public/assets/js/**` (`app.js`, `render.js`, `icons.js`, `alerts.js`) | byte-identical |
| `public/data/**` | byte-identical |
| `functions/api/alerts.js` | byte-identical |
| `test/**` | byte-identical |
| Visible copy, all 19 pages | byte-identical |

Verified by SHA-256 per file against `origin/main`, and for copy by extracting
the rendered text of every page before and after and diffing. No pricing figure,
eligibility rule, formula or data file was touched.

### The JS contract

| Hook | Status |
| --- | --- |
| `[data-tool-form]` | present, on the same `<form>` |
| `[data-input="drug"]` | present, on the same `<select>` |
| `[data-input="insurance"]` | present, on the same `<select>` |
| `[data-input="dose"]` | present, on the same `<select>` |
| `[data-results]` | present, on the same `<section>` |
| `id="main"` | present |
| `id="drug"` / `id="insurance"` / `id="dose"` | present, each with its matching `<label for>` |

`data-drugs` **does not exist in this repository and never has** —
`git log --all -S 'data-drugs'` returns no commits. It was not added, because
adding an attribute nothing reads in order to satisfy a checklist would be
worse than reporting the discrepancy. The data attributes the deployed tree
actually uses are `data-tool-form`, `data-input`, `data-results`, `data-ad-slot`,
`data-alerts-form`, `data-alerts-status`, `data-entry` and `data-stamp`.

`tools/qa.mjs` also locates eleven elements by class name (`.card`,
`.card__cost`, `.card__verified-state`, `.visually-hidden`, `.suppressed`,
`.savings__figure`, `.disclaimer` and others). **Every one of those class names
survives this pass unchanged**, which is why the deploy gate still reports on the
thing it thinks it is reporting on.

---

## 7. Prominence, preserved and raised

| Element | Before | After | Position |
| --- | --- | --- | --- |
| Footer disclaimer | 0.8125rem (13px) | **1.0625rem (17px)** | unchanged — footer, non-dismissible, no dismiss control in the markup |
| Non-affiliation statement | 0.8125rem | **1rem (16px)**, 600, red accent edge | unchanged |
| Tool privacy note | 0.8125rem | **1rem (16px)** | unchanged — last element inside the form |
| Card verified stamp | 0.8125rem | **1rem (16px)** | unchanged — bottom of every card, with its source link |
| Per-figure source link | 0.8125rem | **1rem (16px)** | unchanged |
| Data stamp | 0.8125rem | **1rem (16px)** | unchanged |

Nothing was collapsed, nothing is below body size, and nothing moved lower on
the page on mobile. Three of these were *below* body size before this pass; a
promise about health data set in the smallest type on the page is a promise made
quietly.

### Ad slots

Positions unchanged. Reserved heights unchanged and still declared rather than
derived, with `contain: layout size`:

| Slot | Height | CLS |
| --- | --- | --- |
| `ad-slot--leaderboard` | 6.25rem (100px) | |
| `ad-slot--inline` | 15.625rem (250px) | |
| `ad-slot--footer` | 6.25rem (100px) | |

Measured CLS is **0.0000** across `/`, `/zepbound-cost/`, `/methodology/` and
`/changelog/` (`tools/qa.mjs`), and Lighthouse reports 0 on all five pages it was
run against. The "Advertisement" label is at 13px/600 with 0.08em tracking,
uppercase, at 9.33:1 — the one place on this site where tracked-out caps is
correct, because the entire job of that label is to be unmistakably not
editorial.

---

## 8. One judgement call for you: `.research-receipt`

The Lovable file contains a receipt treatment for the methodology tally: dashed
borders, dotted rows, a double-rule total, and a torn-paper zigzag edge drawn
with a repeating gradient.

**It is not in this PR.** The stylesheet ships the restrained version —
`.receipt`, aligned rows, one hairline per row, an amber-ruled total — and the
skeuomorphic variant is carried in a standalone preview instead, so you can look
at both before anything is committed to:

**https://claude.ai/artifact/LcypXZwd2zVYhkfMPKfWzE**

Both are rendered there at real scale, in the real palette, with the real
figures the page currently holds.

The case for it: the methodology page's own copy calls itself "the receipt", and
the site's whole argument is that it shows its work. Craft.

The case against it: torn paper is decoration pretending to be evidence, on a
page whose value is that it does not decorate. Kitsch.

I have no vote worth more than yours on this. Tell me which and I will either
add the rules or delete the preview.

---

## 9. Reproducing every number in this document

```bash
npm test                      # 118 unit tests
node tools/build-pages.mjs    # regenerate the 19 pages
node tools/qa.mjs             # 25 browser checks at 390x844, CLS, fold contract
node tools/contrast-audit.mjs # 126 contrast pairs, exits non-zero on failure
node tools/keyboard-audit.mjs # 26 focus stops, exits non-zero on failure
```

`tools/contrast-audit.mjs` and `tools/keyboard-audit.mjs` are new in this pass.
Like `build-pages.mjs` and `qa.mjs` they are development tools with zero
dependencies, driving the pre-installed Chromium over CDP with Node builtins.
Nothing at deploy time reads them and the site works if they are deleted.
