# Image and content generation audit — 2026-08

**Scope:** what this site needs generated — pictures and words — to stop being a text file with a pricing engine attached.
**Companion to:** `docs/frontend-audit-2026-08.md` (structural front-end audit). This document does not repeat it.
**Baseline:** 105 tests passing, 16 pages, `main` at the front-end-audit merge.

---

## How this was run, and what that means for trust

Seven agents ran in parallel: one mapping the constraint contract, six auditing lenses (share identity, page imagery, diagrams and data visualisation, trust content, editorial content, structured data). They returned 17 constraints and 94 findings.

**The adversarial verification pass did not run.** All six verifier agents and all three prompt-authoring agents failed on an account session limit. So the 94 findings arrived unchecked, and I verified the load-bearing ones myself rather than publish agent output as confirmed. Two agent claims did not survive that check:

| Agent claim | What I measured |
| --- | --- |
| "The outbound allowlist is an exact 40-host set" | It holds **50** hosts. `www.w3.org` absent, `www.sitemaps.org` present. |
| "NOTHING in the test suite gates an invented price, dosage or fabricated source" | **Refuted.** Injecting a fabricated `$4.99` verified price failed 2 tests. The real finding is sharper and is recorded as ASSET-13 below. |

Every finding below carries an evidence grade. **VERIFIED** means I reproduced it myself in this session. **MEASURED** means an agent executed or counted something and cited it, but no second pass confirmed it. Treat MEASURED as strong-but-unaudited.

Prompts in the final section were written by me, not by the failed prompt agents.

---

## The one-sentence verdict

This site has no pictures at all — not one PNG, SVG, ICO or WebP in the tree — and the reason is not neglect: **the build gate makes the obvious image formats structurally impossible to ship**, and nobody has yet found the compliant path. Meanwhile the words it does have are honest and well-written, and the words it is missing are the ones that make a publisher a publisher.

---

## Part 1 — The constraint contract

Any prompt that ignores this section produces something that fails the build. Every rule was reproduced in this session unless marked otherwise.

### ASSET-1 — A standalone `.svg` file cannot exist under `public/` (VERIFIED)

`TEXT_EXTENSIONS` at `test/integrity.test.js:24-26` includes `.svg`. The allowlist test at `:175-203` scans every file in `public/` for `https?://` and rejects any host not in `ALLOWED_HOSTS` (`:115-146`, **50 hosts**, verified by parsing the set). `www.w3.org` is not among them.

The mandatory SVG namespace declaration is therefore parsed as an outbound link:

```
public/assets/img/probe.svg:1 links to non-allowlisted host "www.w3.org"
```

I reproduced this by writing a normal `<svg xmlns="http://www.w3.org/2000/svg">` file into `public/` — 103 pass, 2 fail. Removing the `xmlns` passes the suite but is not a valid standalone SVG document and will not render as a favicon or an og:image.

**This is why all 20 icons live as JS strings inside `icons.js`.** Inline SVG in HTML needs no `xmlns`, and the `svg()` helper at `icons.js:36-39` emits none. The architecture is already working around a constraint nobody wrote down.

Three compliant routes, and only three:
1. **Inline SVG** in HTML or as a JS string — no `xmlns`, no external reference.
2. **Raster** (`.png` / `.webp` / `.avif` / `.ico`) — not scanned at all.
3. **Add `w3.org` to the allowlist** — a deliberate, reviewable change to a neutrality control. Do not do this casually; that list is the site's editorial spine.

### ASSET-2 — Raster files are invisible to every integrity check (VERIFIED)

I committed a 106KB PNG into `public/assets/img/` and ran the suite: **105 pass, 0 fail.** The walk at `test/integrity.test.js:30-42` only collects files whose extension is in `TEXT_EXTENSIONS`.

The consequence is not convenience, it is exposure: **an emoji, a manufacturer logo, an invented price or a stock photograph baked into a PNG is undetectable by CI.** `tools/qa.mjs` reads `document.body.innerText` and cannot see pixels either. Every raster asset needs a named human reviewer. Say so in the prompt, because the build will not.

### ASSET-3 — The emoji gate is real, and it is not where the code says it is (VERIFIED)

`test/no-emoji.test.js` **does not exist.** The repo has exactly five test files. The emoji gate is `test/integrity.test.js:67-102`.

`public/assets/js/icons.js:8` says *"Enforced by test/no-emoji.test.js, not by discipline."* — a dangling reference to a file that has never existed. Anyone who greps for it concludes there is no emoji gate.

*(I repeated this phantom filename earlier in this session when describing the constraints. It was wrong; the citation above is correct.)*

I confirmed the gate fires: an SVG containing `U+1F48A` failed with `contains U+1F48A`.

### ASSET-4 — The glyph near-misses that break the build (MEASURED)

Permitted: `©` `®` `™` `✓` `✗` `×` `→` `•` `—` `–` `★` `°` `§` `$` `▲` `▼` `●` `■` `'` `…`
Rejected (named, not shown — writing these glyphs into a file in this repo fails the build, as this document did on first draft): heavy check U+2714, cross mark U+274C, warning triangle U+26A0, information U+2139, right arrow U+27A1, glowing star U+2B50, hourglass U+231B, pill U+1F48A, syringe U+1F489, any flag pair, any ZWJ sequence, and any character followed by `U+FE0F`.

The trap is the near-miss: `✓` (U+2713) passes but heavy check U+2714 fails; `★` (U+2605) passes but glowing star U+2B50 fails; `©` passes but the same character plus a variation selector fails. Status and warning semantics must come from `icons.js` (`alertTriangle`, `checkCircle`, `shieldCheck`), never from a character.

`U+FE0F` is rejected file-wide by a bare `.test()` at `:84`, which reports only the filename with no line number — the hardest failure in the repo to locate.

### ASSET-5 — `base.css` has no `img` rule at all (VERIFIED)

Zero `img` selectors in the stylesheet, and no `max-width: 100%` anywhere that would catch one. The first image added to this site overflows its container. Any image work ships the CSS rule in the same commit.

### ASSET-6 — Images inherit a 1-hour revalidating cache (VERIFIED)

`public/_headers:8-9` maps `/assets/*` to `max-age=3600, must-revalidate`. A new `/assets/img/` path inherits that — wrong for immutable content-hashed assets, which want `max-age=31536000, immutable`. A root `/favicon.ico` matches no rule at all and gets no cache header whatsoever.

### ASSET-13 — What actually gates a fabricated price, and why it expires (VERIFIED — supersedes the agent's claim)

An agent reported that nothing in the suite gates an invented price. **That is wrong.** I injected a fabricated `$4.99` marked `verified` into `pricing.json` and got two failures:

```
not ok 32 - the shipped dataset is structurally valid
not ok 34 - the shipped dataset renders no numbers at all, by design
```

But read what test 34 actually asserts (`test/pricing.test.js:63`):

```js
const numeric = SHIPPED.prices.filter((p) => p.value !== null);
assert.deepEqual(numeric.map(...), [], 'No shipped price may carry a value until it is confirmed against a primary source.');
```

It asserts that **every value is null**. Its own comment says it exists so the dataset "cannot regress into 'someone pasted a number in without a source'".

This is not a provenance check. It is a "we publish no prices yet" check, and it protects against fabrication only as a side effect of the site currently publishing nothing. **The moment the site verifies its first legitimate price, this test must be relaxed or deleted — and at that moment nothing remains that checks a published figure has a source.**

That is the single most important thing in this document. The site's integrity guarantee is strongest while it has nothing to say, and evaporates on the day it does.

### Remaining constraints (MEASURED, agent-reported, not independently reproduced)

- **ASSET-7** — 31 named telehealth and compounding hosts are banned as bare *mentions* inside `public/`, not merely as links. Generated copy cannot name them even to disparage them.
- **ASSET-8** — Icon SVG vocabulary is restricted to seven elements; `ellipse`, `polygon`, `use`, `defs` and gradients are rejected (`test/integrity.test.js:420-444`).
- **ASSET-9** — A base64 asset can trip the committed-credential scanner via the 40-character Cloudflare-token pattern, but only if the same file also contains `cloudflare`, `api_token` or `CF_API` (`:334-384`, confirm-regex gated).
- **ASSET-10** — Two byte-exact compliance strings (`DISCLAIMER`, `NON_AFFILIATION` in `public/engine/config.js`) are asserted verbatim. Generated copy must not paraphrase or restate them.
- **ASSET-11** — Non-base64 SVG data URIs in CSS fail via the same `xmlns` trap as ASSET-1. Base64 data URIs pass.
- **ASSET-12** — Ad-slot and affiliate-slot geometry are CLS and compliance controls, not styling (`base.css:453-487`, gated at `qa.mjs:526-529`).

---

## Part 2 — What the site needs generated

### 2.1 Images

There are **zero image files in the repository**. Confirmed by walking the tree for `.png`, `.jpg`, `.svg`, `.webp`, `.avif`, `.ico`: nothing. The only graphics are 20 hand-drawn inline SVG icons in `icons.js`.

| ID | Need | Grade | Why it matters |
| --- | --- | --- | --- |
| IMG-1 | **Favicon set** | VERIFIED | `rel="icon"` appears on 0 of 16 pages. Every page load requests `/favicon.ico` and gets a 404. The browser tab is a blank sheet. |
| IMG-2 | **og:image / twitter:image** | VERIFIED | 0 of 16 pages. `twitter:card` is `summary`, not `summary_large_image`. Every share of this site on every surface is a grey text box. |
| IMG-3 | **Wordmark** | VERIFIED | The masthead is the site name in body type beside a 22px receipt icon. There is no mark. |
| IMG-4 | **Empty-state treatment** | MEASURED | The no-verified-price condition renders as four identical grey blocks. This is the site's *dominant* visual state, since all 45 rows are null. |
| IMG-5 | `theme-color`, `apple-touch-icon`, manifest | VERIFIED | 0 of 16 pages each. No web app manifest exists. |

**What must never be generated.** No stock photography of patients, injection pens, or clinicians. No manufacturer trade dress or product likeness. No image that implies clinical endorsement. The site's own emoji rule already makes this argument, at `icons.js:4-8`: emoji "read as a content farm, and a visitor who does not trust the presentation will not trust the numbers." A smiling stock patient fails the same test harder.

**The pipeline already exists.** `tools/qa.mjs` drives headless Chromium over CDP using Node 22's built-in WebSocket — no Playwright, no dependency — and already calls `Page.captureScreenshot` at line 285. `package.json` has zero dependencies. Build-time og:image generation therefore needs **no new dependency at all**: render an HTML template, screenshot it, write the PNG. That reduces IMG-2 from a project to an afternoon.

### 2.2 Diagrams

| ID | Need | Grade |
| --- | --- | --- |
| VIZ-1 | Visual summary layer above the methodology evidence table (reported 8,655px tall, starting 52% down the page) | MEASURED |
| VIZ-2 | **The dose-tier and introductory-fill cliff** — the strongest diagram candidate on the site, currently reaching zero of 16 pages | MEASURED |
| VIZ-3 | Verification pipeline: how a figure moves from located to verified to published | MEASURED |
| VIZ-4 | Eligibility decision diagram (savings cards excluded for Medicare/Medicaid; cash-pay open to anyone with a prescription) | MEASURED |

**Two things that must not be charted.** `changelog.json` contains exactly **one** entry (VERIFIED) and all 45 price rows are null (VERIFIED). A price-history chart and a price-comparison chart would both render empty. Do not propose them until there is data.

**Diagram labels must be HTML, not SVG `<text>`** (MEASURED): SVG text scales with the viewBox and was measured rendering at 7.27px on a phone. `base.css:113` sets `svg { flex: none }`, which combined with the absent `img`/`svg` max-width rule (ASSET-5) makes a fixed-width chart fail the deploy gate.

### 2.3 Content

| ID | Need | Grade | Evidence |
| --- | --- | --- | --- |
| TRU-1 | **Privacy policy** | VERIFIED | Does not exist. The site stores personal data. |
| TRU-2 | **Honest disclosure of what is stored** | VERIFIED | The alerts page says "We store your email address and your medication preference. That is all." The endpoint stores **five** fields — `email`, `drug`, `createdAt`, `source`, `country` (`alerts.js:109-118`) — and writes the email into a **second** KV object, the per-drug index. |
| TRU-3 | **Resolve a self-contradiction** | VERIFIED | The alerts page states "It does not collect health information: the medication, insurance situation and dose you select are never stored or transmitted" — on the page whose own form stores a medication preference against an email address. The code anticipates the tension at `alerts.js:106`: "`drug` is a preference, not a diagnosis." |
| TRU-4 | **Unsubscribe mechanism** | VERIFIED | `public/alerts/index.html:72` promises "One-click unsubscribe in every email." `functions/` contains exactly one file. There is no unsubscribe endpoint, no token, and no send path. |
| TRU-5 | **Contact channel** | VERIFIED | Zero `mailto:` links sitewide. Both `/about/` and `/methodology/` invite corrections with no way to send one. |
| TRU-6 | **Named publisher** | VERIFIED | 0 of 16 pages carry `author`, `publisher`, `Organization` or `dateModified`. |
| TRU-7 | Terms of service | MEASURED | Does not exist. |
| EDI-1 | **The introductory-pricing caveat** | VERIFIED | The caveat lives in `pricing.json` and reaches **zero static pages**. `/methodology/` mentions the concept once, inside an unconfirmed-candidates table cell, not as guidance. |
| EDI-2 | **Homepage rewrite** | VERIFIED | `<main>` is 445 words, contains **zero drug names**, links to all five pathway pages and methodology but **none of the six drug pages**, and never states that the site currently publishes no verified price. |
| EDI-3 | **Pathway page caveats** | MEASURED | All five pathway pages omit 100% of the caveats and eligibility rules the site's own data holds for that pathway. |
| EDI-4 | **Meta descriptions** | VERIFIED | 5 of 16 truncate at exactly 155 chars mid-word, via a blind `slice(0,155)`. All five are pathway pages. |
| EDI-5 | **Changelog arithmetic** | VERIFIED | `/changelog/` states "all 26 tracked price figures". `pricing.json` holds 45. |
| SD-1 | **Structured data** | VERIFIED | Four pages emit none at all: `/about/`, `/alerts/`, `/changelog/`, and `/methodology/` — the 4,235-word flagship that publishes a sourced 45-row dataset. Sitewide totals: `FAQPage` 6, `BreadcrumbList` 11, `WebApplication` 1. `Organization`, `Person`, `Dataset`, `ImageObject`, `MedicalWebPage`, `dateModified`: **zero**. |

**Credit where it is due:** `sitemap.xml` covers 16 of 16 pages with `lastmod` on every entry (VERIFIED). The About page's funding disclosure is unusually candid. The editorial voice is genuinely good — the problem is that too little of it exists and none of it is signed.

---

## Part 3 — Generation prompts

Paste the **constraint header** first, then one task prompt. The header is what stops a generator producing something the build rejects.

### The constraint header (paste before every prompt below)

```text
You are working in the GLP-1 Price Check repository. It is a static, zero-dependency site
about US medication pricing. Read docs/image-content-audit-2026-08.md before starting.

HARD RULES — violating any of these fails the build:
1. No standalone .svg file may exist under public/. The mandatory xmlns="http://www.w3.org/2000/svg"
   is parsed as an outbound link to a non-allowlisted host and fails test/integrity.test.js:175.
   Ship SVG only as inline markup in HTML or as a JS string in public/assets/js/icons.js, with no
   xmlns attribute. Raster (.png/.webp/.ico) is unscanned and safe.
2. Zero emoji anywhere in any text file. The gate is test/integrity.test.js:67-102 — NOT
   test/no-emoji.test.js, which does not exist despite being cited in icons.js:8.
   These pass: (c) (r) (tm) checkmark U+2713, ballot-X U+2717, multiplication-X U+00D7, arrow U+2192,
   bullet, em-dash, star U+2605, degree, section, dollar, triangles U+25B2/U+25BC.
   These FAIL: heavy checkmark U+2714, cross-mark U+274C, warning U+26A0, info U+2139, star U+2B50,
   any flag, any zero-width-joiner sequence, and ANY character followed by U+FE0F.
   Use icons from public/assets/js/icons.js for status and warning semantics, never a character.
3. Every outbound URL inside public/ must be on the 50-host allowlist at test/integrity.test.js:115-146.
   31 named telehealth and compounding hosts may not even be MENTIONED inside public/.
4. Never invent a price, a dose, a clinical claim, a date, or a source. All 45 rows in
   public/data/pricing.json carry value: null. The site currently publishes no verified price and
   that is deliberate. If a figure is needed, cite the primary source already held in the data file.
5. Do not alter, paraphrase or restate DISCLAIMER or NON_AFFILIATION in public/engine/config.js.
   They are asserted byte-exact.
6. Do not weaken or delete a test to make your change pass.
7. Preserve the editorial position: the machinery is verified, the data is not. Do not soften it
   into marketing confidence.

Run `npm test` (105 tests) and `node tools/build-pages.mjs` after every change. The tree must be
clean under `git status --porcelain` except for your intended files.
```

### P1 — Favicon, head slots, and the missing image CSS

```text
Add the favicon and share-image slots the head template has never had, plus the CSS rule that
stops the first image on this site overflowing its container.

1. In tools/build-pages.mjs, in the head template (around lines 114-125), add:
   - <link rel="icon" href="/favicon.ico" sizes="32x32 16x16">
   - <link rel="icon" href="/assets/img/icon.svg" type="image/svg+xml">  ONLY IF you ship the SVG
     inline-safe; otherwise omit this line entirely rather than shipping a standalone .svg.
   - <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
   - <meta name="theme-color" content="...">  matching the existing token in base.css
   - <meta property="og:image">, <meta property="og:image:width">, <meta property="og:image:height">,
     <meta property="og:image:alt">, <meta name="twitter:image">
   - change twitter:card from "summary" to "summary_large_image"
2. Generate favicon.ico (multi-resolution 32x32 + 16x16, under 5KB) at public/favicon.ico and
   apple-touch-icon.png (180x180) at public/assets/img/. Base both on the existing "receipt" icon
   in public/assets/js/icons.js, which is already the masthead mark.
3. public/_headers: /favicon.ico at the root matches no existing rule and gets no cache header.
   Add one. /assets/img/* currently inherits max-age=3600 must-revalidate from /assets/* — if you
   content-hash image filenames, give them max-age=31536000, immutable instead.
4. base.css has ZERO img selectors and no max-width:100% anywhere. Add:
      img, picture, video { max-width: 100%; height: auto; }
   Note base.css:113 sets `svg { flex: none }` — do not let your rule collide with it.
5. Add a qa.mjs assertion that /favicon.ico returns 200, and that og:image is present and absolute
   on all 16 pages.

og:image alt text must describe the card, must not contain a price, and must not claim
verification the data does not support.
```

### P2 — Build-time og:image generation, no new dependency

```text
Generate a per-page share card at build time. Do NOT add a dependency.

tools/qa.mjs already drives headless Chromium over the DevTools Protocol using Node 22's built-in
WebSocket — see the launch code around lines 121-155 and Page.captureScreenshot at line 285.
package.json has zero dependencies and must keep zero. Reuse that harness.

Build a new tool, tools/build-og.mjs, that:
1. Renders an HTML template per page, styled from the tokens already in public/assets/css/base.css.
   Do not introduce a new palette or a webfont — an external font URL in CSS fails the build.
2. Screenshots it at 1200x630 via CDP and writes PNG to public/assets/img/og/<slug>.png.
3. Is invoked from the same place tools/build-pages.mjs runs, and is idempotent: running it twice
   with unchanged data produces byte-identical output, so CI's build-drift check stays green.

The card must carry, for every page: the site name, the page title, and the "Pricing data as of
<date>" stamp taken from DATA.generatedAt.

The card must NOT carry: any price, any figure, any claim of verification, any manufacturer logo
or trade dress, any photograph, any emoji or emoji-styled pictogram. Note that PNG content is
invisible to every test in the suite, so nothing will catch a violation here except a human.
State in your PR description that the cards need visual review before merge.

For the four pages whose entire subject is that no price is verified, the card should say so
plainly rather than staying silent. Honesty is this site's product.
```

### P3 — The introductory-pricing cliff diagram

```text
This is the highest-value visual on the site and it currently reaches zero of the 16 pages.

The site's data holds a caveat that headline low prices cover only the lowest doses for the first
fills, after which the price rises. Read the exact wording and the exact figures in
public/data/pricing.json — do not restate them from memory and do not round them.

Build a diagram that shows this cliff: what a person pays at first, what they pay after, and what
triggers the change. It must be immediately legible to someone who has just been told a low number
somewhere else and is trying to work out whether it applies to them.

Constraints:
- Inline SVG only, emitted from tools/build-pages.mjs or as a function in public/assets/js/icons.js.
  No standalone .svg file, no xmlns attribute.
- ALL text labels must be HTML positioned over or beside the SVG, never SVG <text>. SVG text scales
  with the viewBox and was measured rendering at 7.27px on a 390px viewport.
- The icon test restricts SVG to seven elements; ellipse, polygon, use, defs and gradients are
  rejected. Check test/integrity.test.js:420-444 before choosing shapes.
- Must work in both light and dark: use stroke="currentColor" and the existing CSS tokens.
- Must carry an accessible text equivalent that states the same thing in words.
- Must not present any figure as verified. Every number carries its provenance and its date.

Place it on: the six drug pages, and /methodology/. Then say in the PR which pages you placed it
on and why the others were excluded.
```

### P4 — The verification pipeline diagram

```text
The site's core argument — how a figure moves from located, to checked against a primary source,
to published or withheld — exists only as prose on /methodology/. Draw it.

Read /methodology/ and public/engine/pricing.js first so the diagram matches the code's real
states, not an idealised version. If the diagram and the engine disagree, the diagram is wrong.

Same constraints as P3: inline SVG, no xmlns, HTML labels not SVG text, seven-element vocabulary,
currentColor, light and dark, accessible text equivalent.

Place it near the top of /methodology/, above the evidence table. The table is reported at
8,655px tall starting 52% down the page; this diagram's job is to let a reader understand the
argument without scrolling into it.
```

### P5 — Empty-state visual treatment

```text
All 45 price rows carry value: null, so the no-verified-price state is not an edge case on this
site — it is the dominant state, and it currently renders as four identical grey blocks.

Redesign that state so it communicates the site's actual position: we looked, we found figures, we
could not confirm them against a primary source, and here is what we did find and what would
confirm it. The unconfirmed-candidates content on /methodology/ is the best material on the site
and should be reachable from this state.

Constraints:
- The empty state and the advertisement slots currently render as similar grey boxes. They must
  become unmistakably different. Ad-slot geometry is a CLS control gated at qa.mjs:526-529 — do not
  change ad slot dimensions.
- .affiliate-slot { display: none } in base.css is a compliance control, not dead style. Leave it.
- Do not invent a price to fill the space. Do not soften "we could not confirm this" into
  "prices vary". The admission is the product.
```

### P6 — Privacy policy (LAWYER REVIEW REQUIRED BEFORE PUBLISHING)

```text
Write a privacy policy for this site at public/privacy/index.html, generated from
tools/build-pages.mjs like every other page.

Do NOT write generic boilerplate. Describe exactly what functions/api/alerts.js does, which I have
verified:
- It stores five fields per subscriber: email, drug, createdAt, source, country.
- country comes from the cf-ipcountry edge header and is used to keep the list US-scoped.
- The email is written into TWO objects: subscriber:<email> and the per-drug index index:<drug>.
- Re-submitting updates the preference and preserves the original signup date.
- Storage is Cloudflare KV.
- The code explicitly records no IP address, no user agent, no fingerprint.
- The price tool itself transmits nothing: drug, insurance and dose selections stay in the browser.
That last point is a genuine privacy strength and should be stated plainly, not buried.

The policy must disclose, at minimum: what is collected, why, where it is stored, how long it is
kept, who it is shared with (nobody), how to unsubscribe, how to request deletion, and how to make
contact. It must cover CCPA/CPRA and should be written to be GDPR-safe for EU visitors.

MARK AS OWNER-SUPPLIED, do not invent: the legal entity name, jurisdiction of incorporation, a
postal address, a contact email address, a data-retention period, and the name of any data
controller. Use a clearly-marked placeholder such as [OWNER: legal entity name] for each and list
every placeholder at the top of your PR description.

Two things must be fixed in the same change, because the policy will contradict the site otherwise:
1. public/alerts/index.html says "We store your email address and your medication preference.
   That is all." Five fields are stored. Correct the page.
2. The same page says "It does not collect health information: the medication, insurance situation
   and dose you select are never stored or transmitted" while its own form stores a medication
   preference against an email address. That sentence is true of the price tool and false of the
   alerts form on the same page. Rewrite so both statements are unambiguous about which surface
   they describe.

This document must be reviewed by a lawyer before it is published. Say so in the PR title.
```

### P7 — Unsubscribe, contact, corrections, terms

```text
public/alerts/index.html:72 promises "One-click unsubscribe in every email." The functions/
directory contains exactly one file, alerts.js, and there is no unsubscribe endpoint, no token
generation, and no send path anywhere in the codebase. An unsubscribe mechanism is legally
required from the moment the first email is sent.

Deliver four things:

1. An unsubscribe endpoint at functions/api/unsubscribe.js. It must work from a signed link with
   no login, remove the address from BOTH the subscriber:<email> key and the index:<drug> array,
   and be idempotent. Add tests.
2. A contact page or a monitored address. Both /about/ and /methodology/ invite corrections and
   the site offers no channel of any kind — zero mailto: links exist sitewide. The contact route
   must be reachable from the footer on all 16 pages.
3. A corrections policy: how an error is reported, how fast it is assessed, how a correction is
   recorded. The site already logs changes to /changelog/, so tie the policy to that.
4. Terms of service at public/terms/index.html, covering acceptable use, no-warranty on pricing
   accuracy, and the limits of the medical disclaimer that already exists.

MARK AS OWNER-SUPPLIED: entity name, jurisdiction, contact address, response-time commitments.

Do not restate or paraphrase DISCLAIMER or NON_AFFILIATION from public/engine/config.js. They are
asserted byte-exact and must appear only through the existing constant.

Terms and the unsubscribe flow both need legal review before publishing.
```

### P8 — Publisher identity and the About rewrite

```text
The site is anonymous. Zero of 16 pages carry an author, a publisher, an Organization node or a
dateModified. /about/ is 451 words and establishes no identity: no entity, no person, no location,
no credentials, no contact. On a YMYL health-and-pricing topic, an anonymous publisher cannot
accumulate trust regardless of how good the methodology is.

Rewrite public/about/index.html to establish: who publishes this, who maintains it, what their
relevant background is, where they are, how to reach them, how the site is funded, and what the
editorial standards are.

The existing About page is genuinely well-written on funding and neutrality — the section
explaining that affiliate infrastructure ships switched off because "the moment this site earns
money from one of the options it ranks, its ranking is worthless" is the strongest paragraph on
the site. Keep it. Add identity around it, do not replace it.

MARK AS OWNER-SUPPLIED and do not invent under any circumstances: the publisher's name, any
person's name, any credential, any professional qualification, any institutional affiliation, any
location. Fabricating a credential on a medical-adjacent site is the single worst failure
available here. Use [OWNER: ...] placeholders and list them all in the PR.

Also add an editorial standards section covering: what qualifies as a primary source, what happens
when sources conflict, who reviews changes, and how often figures are rechecked. Derive this from
what /methodology/ and public/engine/pricing.js actually do — do not invent a process the code
does not implement.
```

### P9 — Homepage rewrite

```text
public/index.html <main> is 445 words. I verified it contains ZERO drug names, links to all five
pathway pages and /methodology/ but NONE of the six drug pages, and never states that the site
currently publishes no verified price.

Meanwhile the h1 promises "The cheapest legal way to pay for your GLP-1" while the tool ranks
nothing, because every figure is unverified.

Rewrite the homepage so that:
1. The h1 promises what the site can currently deliver. Do not promise a ranking that does not
   render. Do not retreat into vagueness either — the site's real offer is that every figure is
   sourced and dated, and that it will tell you when it does not know.
2. The current verification state is stated above the fold, in normal-sized type, not in the
   smallest grey text on the page.
3. All six drug pages are linked. They are 1,471-1,748 words each and are the site's most
   substantial content; they are currently unreachable from the homepage.
4. Drug names appear, because people search for them.

Length: aim for 700-900 words of <main>. Cite no figure that is not in public/data/pricing.json
with its source and date. Do not add a price. Preserve the editorial position.
```

### P10 — Propagate the introductory-pricing caveat

```text
The introductory-pricing caveat is the site's most valuable original reporting and it reaches ZERO
of the 16 static pages. It lives only in public/data/pricing.json and surfaces as a bullet inside
a rendered card, styled identically to routine caveats like "requires a valid prescription".
/methodology/ mentions the concept once, inside an unconfirmed-candidates table cell, which is not
guidance a reader will find.

Read the exact caveat text and figures in pricing.json. Do not restate them from memory, do not
round, and do not merge two different caveats into one sentence.

Then:
1. Render it on every drug page it applies to, as a distinct, visually-weighted element — not as
   one bullet among five. A reader who has seen a low headline price elsewhere must meet this
   before they act on it.
2. Give it a heading a person would scan for.
3. Ensure it survives the no-verified-price state. It is guidance about how pricing WORKS, and it
   is true whether or not a figure is confirmed.
4. Add a test asserting the caveat renders on every page whose data carries it, so it cannot
   silently stop appearing.

Do not present the caveat's figures as verified prices. They carry the same provenance rules as
everything else.
```

### P11 — Pathway page caveats and eligibility

```text
The five pathway pages (lillydirect, novocare, trumprx, patient-assistance, medicare-glp1-bridge)
are 492-647 words each. An agent reported they omit 100% of the caveats and eligibility rules the
site's own data already holds for that pathway. VERIFY THAT CLAIM FIRST by comparing each page
against the pathway's entry in public/data/pricing.json and DATA.eligibilityRules. Report what you
actually find before changing anything.

For each pathway page, add: who is eligible and who is explicitly excluded, what the program does
and does not cover, what it costs where the data supports a figure, and what would confirm the
figures currently unconfirmed.

The Medicare/Medicaid exclusion from manufacturer savings cards is the single most consequential
eligibility rule on the site and must appear on every page it applies to.

Also fix the meta descriptions: tools/build-pages.mjs truncates with a blind slice(0,155) and I
verified 5 of 16 pages currently break mid-word — all five are these pathway pages. Truncate on a
word boundary, or better, author a real description per page.
```

### P12 — Structured data

```text
Four pages emit no JSON-LD at all: /about/, /alerts/, /changelog/ and /methodology/. The last is a
4,235-word page publishing a sourced, dated 45-row dataset. Sitewide there are zero Organization
nodes, zero author, zero publisher, zero dateModified, zero Dataset, zero ImageObject.

Add structured data, in this order, and only where the page already displays what the schema
asserts:
1. Organization with publisher identity — BLOCKED until P8 lands. Schema must not name a publisher
   the page does not name.
2. dateModified on every page, from DATA.generatedAt.
3. Dataset on /methodology/, describing the 45-row price dataset: its source, its licence, its
   update cadence, and honestly, that its values are currently unverified.
4. BreadcrumbList on the five pages missing it.
5. ImageObject once og:image exists (P1/P2).

Rules:
- Never assert in schema anything the page does not display to a human. If the schema needs a
  fact, author the fact into the page first.
- Do not add Drug schema properties that constitute clinical claims: no dosageForm, doseSchedule,
  warning, contraindication, adverseOutcome, maximumIntake or prescribingInfo. The dose tiers in
  this data are PRICING tiers, not a dosing regimen, and mapping them to a clinical property would
  turn a price bracket into a medical instruction. This is the most dangerous available mistake.
- Fix the changelog arithmetic in the same pass: /changelog/ states "all 26 tracked price figures"
  and pricing.json holds 45. Derive the count from the data rather than typing it, and add a test.
```

### P13 — Wordmark

```text
The masthead is the site name set in body type beside a 22px receipt icon. There is no mark.

Design a wordmark that works at favicon size and in the masthead. It must be consistent with the
existing icon system: a 24x24 grid, 1.75 stroke, round caps and joins, currentColor, drawn not
typeset.

Ship it as: an inline SVG string added to public/assets/js/icons.js following the existing svg()
helper pattern with NO xmlns attribute, plus a rasterised favicon.ico and apple-touch-icon.png.
A standalone .svg file will fail the build (see ASSET-1).

The seven-element vocabulary restriction applies — check test/integrity.test.js:420-444.
No gradients, no defs, no text elements.

It must not resemble a pharmaceutical brand mark, a pill, a syringe, or any manufacturer's trade
dress. The subject of this site is prices and evidence, not medication.
```

---

## Part 4 — Order of work

Dependencies matter more than severity here. Several items are blocked by others.

| # | Do this | Why first | Effort |
| --- | --- | --- | --- |
| 1 | **P6 + P7** — privacy policy, fix the two false statements on `/alerts/`, ship unsubscribe | The site stores personal data with no policy, tells the reader it stores two fields while storing five, and promises an unsubscribe that does not exist. This is legal exposure, not a content task. Nothing else on this list matters if this stays open. | Days, plus legal review |
| 2 | **P1** — favicon, head slots, the missing `img` CSS rule | Three lines of template plus one CSS rule ends a 404 on every page load and unblocks every later image. | Hours |
| 3 | **P8** — publisher identity | Blocks P12 structured data, and is the ceiling on trust for a YMYL topic. | Days, owner-dependent |
| 4 | **P2** — build-time og:image | The CDP harness already exists in `qa.mjs`. No dependency, high visible return. | Half a day |
| 5 | **P10** — propagate the introductory-pricing caveat | The best original reporting on the site currently reaches nobody. | Half a day |

P3, P4, P5, P9, P11, P12 and P13 follow. P12 is blocked by P8; P1 and P2 unblock the `ImageObject` half of P12.

---

## Part 5 — Grade

Graded on a Fortune 500 launch-review curve: not "is this good for an independent site", but "would this pass the review gates a large organisation puts in front of a public health-adjacent property". On that curve most independent sites score F outright. This one does not, and the spread between its best and worst dimension is the most interesting thing about it.

| Dimension | Grade | Basis |
| --- | --- | --- |
| Engineering discipline | **A-** | Zero dependencies. 105 passing tests. Every page a pure function of one data file, making cross-page drift structurally impossible. Compliance strings asserted byte-exact. An outbound-link allowlist used as an editorial control rather than a security one. This would pass a Fortune 500 code review with distinction. Deductions: the deploy gate is coupled to CSS class names, `render.js` has no tests, and `icons.js:8` cites a test file that has never existed. |
| Data integrity | **A** | 45 rows, every one `null`, because not one could be confirmed against a primary source — on a site whose commercial incentive is to publish numbers. The evidence table showing what was located and what would confirm it is genuinely excellent. Held back from A+ only by ASSET-13: the guarantee is enforced by a test asserting nothing is published, so it expires on the day the site succeeds. |
| Machine-readability | **C-** | `sitemap.xml` is clean: 16 of 16 with `lastmod`. `FAQPage` and `BreadcrumbList` are present and correct. But four pages emit no structured data at all, including the 4,235-word flagship, and `Organization`, `author`, `publisher` and `dateModified` are absent sitewide. |
| Content | **D** | The prose that exists is better than most of this category — the funding disclosure and the neutrality argument are quotable. There is just far too little of it, and it is pointed the wrong way: a 445-word homepage with zero drug names that links to none of the six substantial drug pages, the best reporting on the site reaching zero pages, and five meta descriptions truncated mid-word. |
| Visual design | **F** | Zero images in the repository. No favicon, so every page load 404s. No share image, so every link shared anywhere renders as a grey text box. No wordmark. The stylesheet's own opening comment calls itself a shell for a design pass that never happened. On this curve it is a wireframe, not a product. |
| Trust and compliance | **F** | Not a grade so much as a gate. Personal data stored in two objects with no privacy policy. A page stating it stores two fields while the endpoint stores five. A page stating medication selections are never stored, above a form that stores a medication preference against an email address. A promised one-click unsubscribe with no implementation. No contact channel on a site that twice invites corrections. An anonymous publisher on a YMYL health topic. Any one of these stops a launch review. |

### Overall: **D+**

A Fortune 500 review board would split on this in a way it rarely does. The engineering half would be held up as an example — the integrity architecture here is better than most internal tooling, and the decision to publish nothing rather than publish unverified is the kind of judgment that usually loses inside a large organisation. The launch half would not get past legal, and would not get past brand.

**What moves the grade.** Compliance is not a curve, it is a gate: shipping P6 and P7 is the difference between a D+ and a C+, and no amount of design work substitutes for it. P1, P2 and P13 together move Visual Design from F to C in about a day, because the floor is so low that a favicon and a share card are most of the distance. Publisher identity (P8) is worth a full grade on its own, since it unblocks structured data and is the ceiling on trust for the whole property.

Realistic ceiling with everything in this document delivered and no new content: **B+**. Reaching A requires the site to verify actual prices — which is the one thing this audit cannot help with, and the one thing the whole apparatus was built to do well.

### The thing to protect

The site is graded down here for having too little, never for being dishonest. That is a rare direction of failure. Every prompt in Part 3 is written to add without softening, because the fastest way to turn this into a C-grade site permanently would be to fill the silence with confident numbers.
