# Working notes for Claude

Read this before changing anything. It is the short version; the long versions
are in `docs/`.

## What this is

A static site that answers one question: what is the cheapest legitimate way to
pay for a GLP-1 this month. It sells nothing, takes no pharmaceutical or
telehealth money, and shows a source and a verification date on every figure.

**Hand-authored static HTML, one CSS file, one vanilla ES module.** No
framework, no bundler, no package manager, no build step. `package.json` exists
only to invoke `node --test` and has no dependencies. The host serves `public/`
exactly as committed, with an empty build command.

Do not add a framework, a bundler, a lockfile or a build step. If a task seems
to need one, the answer is almost always that it does not.

## The frozen contract

These are not preferences. Changing them is a correctness change wearing a
design change's clothes:

- **`public/engine/**`** — pricing, eligibility, staleness, savings, config.
  Pure, DOM-free, unit-tested. Do not touch.
- **`public/assets/js/**`** — `render.js` (pure string builders), `app.js` (the
  only file that touches the DOM), `icons.js`, `alerts.js`.
- **`public/data/**`** — the price spine and the eligibility rule table.
- **Every word of copy.** No rewriting, no tightening, no fixing apparent
  errors. New components that need words get a `[[COPY: purpose — max N
  characters]]` placeholder and an entry in `COPY-SLOTS.md`.

`render.js` is the layer a design pass may rewrite — it may change every tag and
class name — but see the class-name coupling warning below before you do.

**Never render an unverified price as a number.** Not a dash, not a range, not a
blur. It renders as "Price not currently verified" with a link to the official
page. One chokepoint function enforces it and a test tries to break it.

## The pages are generated

`public/**/index.html` is **output**. Edit `tools/build-pages.mjs` and run it:

```bash
node tools/build-pages.mjs
```

CI regenerates and diffs `public/`, so committing a hand-edited page fails the
build. That is deliberate — it is how price drift is made structurally
impossible.

## Gates

Run all of these before pushing. Each exits non-zero on failure.

```bash
npm test                      # 118 unit tests, zero dependencies
node tools/build-pages.mjs    # then confirm `git diff public/` is clean
node tools/qa.mjs             # 25 browser checks at 390x844, real Chromium, measured CLS
node tools/contrast-audit.mjs # 126 WCAG pairs, measured on rendered pages
node tools/keyboard-audit.mjs # 26 focus stops, focus ring and target sizes
```

`tools/` are development tools, not deploy steps. Nothing at deploy time reads
them and the site works if they are deleted.

## Traps that have already caught someone

**`tools/qa.mjs` locates about eleven elements by CSS class name** — `.card`,
`.card__cost`, `.card__verified-state`, `.visually-hidden`, `.suppressed`,
`.savings__figure`, `.disclaimer` and others. Rename one and the deploy gate
reports *a wrong price* or *a missing safety caveat*, not "selector not found",
and the next person goes hunting in a pricing engine nobody touched. If you
rename a class, update `qa.mjs` in the same commit.

**The 390×844 fold contract.** All three tool inputs must sit above the fold on
a phone; `qa.mjs` measures the form's bottom edge and fails the deploy. Anything
you add above the form spends that budget. Re-run `qa.mjs` after any change to
the masthead, the hero or the tool.

**A standalone `.svg` file cannot exist under `public/`.** The mandatory `xmlns`
declaration parses as an outbound link to a non-allowlisted host and fails
`test/integrity.test.js`. This is why all icons live as inline SVG strings in
`icons.js`. Raster files are invisible to every integrity check, so a wrong
figure baked into a PNG ships undetected — a human has to look.

**The credential heuristic is blunt on purpose.** `test/integrity.test.js` flags
a 40-character base62 run as a possible leaked API token when the hosting
provider's name appears in the same file. A long dashed filename plus the word
in one document will fail the build. Fix it by not putting both strings in one
file. Never loosen that test.

**Compliance strings are byte-exact.** The footer disclaimer and the
non-affiliation statement are interpolated from `engine/config.js` on every page
and asserted verbatim. The disclaimer is non-dismissible; no dismiss control may
exist in the markup.

**Outbound links are an allowlist, not a denylist.** Every `https://` URL inside
`public/` must be a primary manufacturer or government source. That is what makes
a telehealth or affiliate link impossible to add without a failing build. It also
means a webfont `@import` or a CDN reference fails the build.

**Zero emoji anywhere**, in any source or rendered file. Enforced across every
text file. Icons are hand-drawn inline SVG on a 24×24 grid.

**No client-side persistence.** The visitor's medication, insurance situation and
dose are health information and live in local variables only. No
`localStorage`, no `sessionStorage`, no cookie, no query string, no beacon. A
storage API anywhere in `public/` fails the build.

## The visual system

`public/assets/css/base.css` is the whole thing, one file, currently 44 KB
against a 60 KB budget. Full rationale in `docs/design-pass-2026-09-15.md`.

- **Colour is `oklch()` throughout.** Do not reintroduce hex. The palette is a
  ladder of four near-black surfaces plus signal colours that each hold a
  measured ratio against all four; `oklch`'s L channel is what makes that
  ladder reasonable about rather than eyeballed.
- **Two font families, two self-hosted `woff2` files, no third-party request.**
  IBM Plex Sans (variable, covers every weight from one file) and Archivo Black.
  Both carry tabular lining figures by construction. Adding a third family
  breaks the budget; loading one from a CDN breaks the allowlist test.
- **Mobile-first.** `min-width` queries at 480px and 800px, so a missed rule
  degrades toward the phone layout.
- **A prominence floor.** The disclaimer, the non-affiliation statement, the
  tool's privacy note and every verification stamp sit at or above body size
  (1rem), uncollapsed, and never move lower on the page on mobile.
- **State is never carried by colour alone.** Every verification state differs
  by icon and weight as well as hue; the confidence pills differ by border style
  (solid / dashed / dotted) and by their own word.
- **Ad slots reserve their height in CSS**, never derive it from the creative.
  Measured CLS is 0.0000 and must stay there.

## Structured data

Every page carries `Organization`, `WebSite` and `WebPage` nodes;
`/methodology/` also carries a `Dataset`. Where a page renders counts, generate
the visible markup and the structured data **from one array** so they cannot
disagree — see `buildMethodology()` in `tools/build-pages.mjs` for the pattern.

## Governance

- Work on a branch. Open a **draft** pull request.
- **Never merge, never enable auto-merge, never deploy.** The owner approves
  every merge.
- If you are unsure whether something crosses from appearance into logic or
  data, stop and ask.

## Where the detail lives

| | |
| --- | --- |
| `docs/v0-handoff.md` | the original architecture handoff |
| `docs/design-pass-2026-09-15.md` | the visual system, with every measured number |
| `docs/ops-runbook.md` | price-change sequence, deploy, secrets |
| `docs/gate-resolutions.md` | why each research gate was resolved the way it was |
| `docs/discrepancy-report.md` | why the site currently publishes no verified price |
| `IMAGE-MANIFEST.md` | images the design specifies but nobody has generated |
| `COPY-SLOTS.md` | words the design needs and nobody has written |

## House style

Report what was measured, not what was intended. If a check was skipped, say so.
If a number is in the report, it came from a command that can be re-run — the
commands are in `docs/design-pass-2026-09-15.md`, section 9.
