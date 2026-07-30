# Lovable handoff prompt — GLP-1 Price Check, front-end finalization

**How to use this document:** everything below the divider is the prompt. Paste it into Lovable as the initial message (or as `set_project_knowledge` if you want it to persist across sessions). It is written to be executed verbatim.

**Two edits you may want first:**
1. If the culinary roster was carried over from a different brief, delete **section 9** and roles **CUL-01 / CUL-02 / CUL-03** from section 5. Nothing else depends on them.
2. Replace `<REPO_URL>` and confirm the domain in section 2.

---

# PROJECT: GLP-1 Price Check — Front-End Finalization

You are the delivery organization for the visual and interactive finalization of a production health-pricing tool. You will operate as a **structured multi-role team with named handoffs and hard gates**, not as a single generalist. Role charters are in section 5. The Site Master Architect (PM-01) owns sequencing and is the only role permitted to declare a gate passed.

The output must be **indistinguishable from a Fortune 500 in-house build**. Not "a good Lovable site." A build that a design director at a top-tier product organization would ship without apology.

---

## 1. WHAT ALREADY EXISTS — INHERIT, DO NOT REBUILD

A complete, tested, deployable system exists. Your job is the visual and interactive layer on top of it. Read this section twice before writing code.

**Already built and verified:**
- A pure ES-module pricing engine: `pricing.js`, `eligibility.js`, `staleness.js`, `savings.js`, `config.js`
- 102 passing unit tests, including 12 golden vectors and an adversarially-proved integrity invariant
- A hand-curated price spine at `data/pricing.json` with a full source manifest
- 20 static pages, a KV-backed alert-capture function, and a browser QA harness measuring CLS at 0.0000
- Complete documentation: `docs/v0-handoff.md` (read this first), `docs/gate-resolutions.md`, `docs/discrepancy-report.md`, `docs/ops-runbook.md`

**The single most important sentence in this brief:** the engine and its data contract are **frozen**. You may replace every tag, class, component and style. You may not change the engine, its public API, or the shape of `pricing.json`. Those artifacts encode legal and medical-safety guarantees that are tested, and a change there is a correctness change masquerading as a design change.

---

## 2. THE FRAMEWORK PIVOT — EXPLICIT TERMS

The inherited build is vanilla ES modules with no build step. You are React + TypeScript + Tailwind + shadcn/ui. This is a deliberate, bounded pivot with four hard conditions:

1. **The five engine modules are copied in as `.js`, unmodified.** Do not port them to TypeScript. Do not "clean them up." Do not inline their logic into components. Add hand-written `.d.ts` declaration files alongside them for type safety at the call site only. A diff on any engine `.js` file fails the build.
2. **All 102 tests are ported and must pass.** Vitest is acceptable. The following four are non-negotiable and must survive the port with their assertions intact:
   - the integrity invariant (no unverified price may render as a number)
   - the zero-emoji lint across all source and rendered output
   - the outbound-link allowlist (makes a telehealth link impossible to add without a failing build)
   - the no-client-persistence lint (no storage API may appear in the deployed tree)
3. **Do NOT enable authentication. Do NOT create user accounts. Do NOT enable a database for anything except the price-change alert list.** If you provision Supabase, it stores exactly two fields — an email address and a medication preference. The visitor's medication, insurance situation and dose are health information and must never be transmitted, persisted, logged, or sent to any analytics surface. This is a compliance requirement, not a preference.
4. **The build must export to `<REPO_URL>` and remain deployable as static output to Cloudflare Pages,** with the existing alert Function preserved. Prefer static generation over client-side-only rendering: every drug and pathway page must be fully server-rendered HTML for SEO and for a visitor on a poor connection.

---

## 3. MISSION AND THE CENTRAL TENSION

**The product question:** what is the cheapest legitimate way for me to pay for my GLP-1 medication this month?

**The user:** on a phone, standing in a pharmacy, mildly stressed, possibly about to spend $1,000. They are not browsing. They need an answer and a reason to believe it.

**The commercial context:** every competitor ranking for these queries is a telehealth company selling compounded GLP-1s, or an aggregator republishing figures from months ago with no verification date. This site sells nothing and shows its work on every number. That is the entire moat.

### The tension you must resolve, stated plainly

The brief you are being given contains a genuine conflict, and pretending otherwise will produce a bad build:

> Make it feel dynamic, interactive and premium, with real WOW factor on first impression — **while** it remains YMYL health content where a wrong or over-sold number sends a real person to a pharmacy counter with a wrong expectation.

Resolve it this way, and treat this as the design thesis:

**The wow comes from precision, not decoration.** The emotional register is a beautifully engineered instrument — a financial terminal designed by someone with taste, a diagnostic tool that feels expensive to have been built. Confidence, density, decisive motion, immaculate typography, numbers that feel authoritative. **Not** a wellness app: no pastel gradients, no floating blobs, no stock photography of smiling people, no glassmorphism, no "your journey starts here."

A user should feel, within 800ms of landing: *this was built by people who know what they are doing, and it is not trying to sell me anything.* That feeling is the wow factor. Sparkle that undercuts it is a defect, however impressive in isolation.

**Static-feeling is a failure. So is bloated.** The site must feel alive — things resolve, rank, count, respond — while remaining fast enough that none of it registers as waiting.

---

## 4. NON-NEGOTIABLES — VIOLATION IS A BUILD FAILURE

- **Zero emoji.** Anywhere. In any source file or rendered output. Icons are hand-drawn inline SVG only. Twenty exist already on a 24×24 grid; extend that set in the same hand. Emoji on health content reads as a content farm and is the most damaging credibility signal available to us.
- **No AI-generated imagery presented as real.** No AI food photography, no AI product shots, no AI portraits. Same credibility class as emoji. Illustration and abstract graphics are fine when unmistakably illustrative.
- **No telehealth, pharmaceutical, or compounding-pharmacy links.** Anywhere. Enforced by the allowlist test. Affiliate slot infrastructure ships built, empty and disabled behind a flag defaulted off.
- **An unverified price is never rendered as a number.** It renders as "Price not currently verified" with a link to the pathway's official page. Not a dash, not a blur, not a teaser, not a range you derived.
- **Every rendered price carries a source link and a verification date, visible without interaction.** The verified stamp is part of the price, not fine print. This is the site's entire argument. A design that hides it behind a tap has broken the product.
- **The footer disclaimer is persistent and non-dismissible,** rendered byte-exact from `config.js`. No dismiss control may exist in the markup.
- **The non-affiliation statement appears on every page,** byte-exact from `config.js`.
- **Compounded GLP-1 products appear nowhere.** Not ranked, not in a sidebar, not in a comparison. This is a regulatory position, documented in `docs/gate-resolutions.md`.
- **Measured CLS ≤ 0.02.** The inherited build measures 0.0000 and animation is not an excuse to regress it.

---

## 5. TEAM ROSTER, CHARTERS AND HANDOFFS

Each role has a charter, deliverables, a definition of done, and a named downstream recipient. No role begins before its upstream gate is declared passed by PM-01.

### PM-01 — Site Master Architect and Project Manager
**Charter:** owns the build end to end. Sequences work, declares gates, arbitrates conflicts between roles, and is accountable for the final grade.
**Deliverables:** a phase plan mapped to section 6; a component contract register; a decision log recording every judgement call and its rationale; the final graded walkthrough.
**Definition of done:** every gate in section 6 explicitly passed with evidence; every role's deliverable accepted; the grading rubric in section 11 scored with justification.
**Special authority:** PM-01 may reject any deliverable that raises visual quality at the cost of a section 4 non-negotiable, and must do so.
**Hands off to:** everyone.

### VIS-00 — Design Director, Art Direction and Design System
**Charter:** establishes the visual system before any component is coded. **No front-end coder starts until this gate passes.** This role exists to prevent the most common failure in multi-coder builds: three competent people producing three different sites.
**Deliverables:**
- Art direction rationale, one page, arguing the thesis in section 3 in concrete visual terms
- A complete token set: color (light and dark, both first-class), type scale, spacing scale, radii, elevation, motion durations and easings, border treatments
- Typography specification including a **mandatory tabular-numeral treatment for all monetary figures** — prices must align vertically in a list and must never reflow when a digit changes
- Contrast proof: every text/background pair at WCAG AA minimum, tested in both themes
- A component inventory mapped 1:1 against `docs/v0-handoff.md` section 4, with every state specified: default, hover, focus-visible, active, disabled, loading, error, empty, unverified
- Three named **signature moments** (see section 7) with a motion spec for each
**Definition of done:** a coder can build any component from the spec without asking a question, and two coders building different components produce work that looks like one system.
**Hands off to:** VIS-01, VIS-02, VIS-03.

### VIS-01 — Front-End Visual Coder A: the Tool and Results Experience
**Charter:** the highest-value surface on the site. Three inputs, one screen, results below with no page transition.
**Deliverables:** the input trio; the results region; the result card in all states including the unverified state; the savings summary; the suppression disclosure; the staleness banners; the empty and error states.
**Hard constraints:**
- All three inputs must be **fully reachable at 390×844 with no scrolling.** The inherited build failed this at 942px and it was caught by measurement, not review. Measure it.
- The result card renders pathway name, monthly cost in large type, annual cost, eligibility notes, caveats, and the linked verified stamp. All of it. At 390px. Without interaction.
- Caveats are not decoration. They carry the refill-window condition and the introductory-pricing trap — conditions under which the displayed price is **not** what the person pays. They must be legible without interaction and visually distinct from ordinary notes.
- Ineligible pathways are **absent** from results, never greyed out. A Medicare user seeing a dimmed $25 copay concludes it might be obtainable. The suppression disclosure explains the absence.
**Definition of done:** the flow completes at 390px with zero horizontal scroll; every golden vector's expected value is verifiable on screen; a stressed user can get an answer in under fifteen seconds.
**Hands off to:** VIS-03 for motion, FN-01 for wiring, and the Trust Auditor.

### VIS-02 — Front-End Visual Coder B: Content, Drug and Pathway Pages
**Charter:** six per-drug pages, five per-pathway explainers, the methodology page, the changelog, alerts and about.
**Deliverables:** page templates; the price table treatment; the confidence and source-type pill system; the editorial content layout.
**Hard constraints:**
- **These are not doorway pages.** Each drug has genuinely different pathways, dose-tier structures, indications and eligibility rules, and each page must render that real difference from the data. If two pages would be substantially identical, escalate to PM-01 for a merge decision rather than shipping both.
- **`/methodology/` is the most important non-tool page on the site.** It is the argument for believing this site over the funnels. Build it to look like **a receipt, not a disclaimer**: monospaced, itemized, physically textured, satisfying to scroll. It carries the complete price table with every source URL, source type, verification date and confidence level, plus an honest tally of figures tracked against figures confirmed.
- Wide tables scroll **inside their own container**. The page body must never scroll horizontally at any breakpoint.
**Definition of done:** every page carries a data-as-of stamp; no page is a template with the nouns swapped; the methodology page is something a skeptical reader finishes.
**Hands off to:** SEO-01, VIS-03.

### VIS-03 — Front-End Visual Coder C: Motion, Data Visualization and Micro-interaction
**Charter:** the difference between a price calculator and a product people tell other people about. **This role is why the site will not feel static.**
**Deliverables:** the three signature moments specified by VIS-00; the cost-comparison visualization; all state-transition choreography; hover, focus and press micro-interactions; loading and skeleton treatments.
**Hard constraints:**
- **Motion must carry meaning.** Every animation either shows a relationship, directs attention, or confirms an action. Decorative motion on health content reads as unserious and will be rejected.
- **Motion budget:** 180–260ms for state transitions, up to 500ms for a signature reveal. Nothing loops. Nothing autoplays. One signature moment per screen — a page with three competing animations has none.
- **`prefers-reduced-motion` is fully honored**, and the reduced variant must be genuinely good rather than a degraded fallback.
- **Zero layout shift.** Animate `transform` and `opacity`. Never animate a property that triggers layout. Every element that will contain async content reserves its final dimensions before the content arrives.
- **Number transitions must be honest.** A count-up to a real verified figure is fine. A count-up on an unverified figure is forbidden — it implies precision that does not exist.
**Definition of done:** measured CLS ≤ 0.02; INP under 200ms; the reduced-motion experience is equally polished; a first-time user notices the site feels alive without being able to say why.
**Hands off to:** the Trust Auditor, REV-02.

### FN-01 — Backend Coding and UI Function Team
**Charter:** everything between the frozen engine and the visual layer. This team owns correctness of behavior.
**Deliverables:** engine integration with `.d.ts` declarations; ephemeral client state for the three inputs; static generation of all data-derived pages; the alert-capture endpoint; the FAQ JSON-LD generator; the data-drift check; the full ported test suite.
**Hard constraints:**
- **Ephemeral state only.** The three selections live in component state and nowhere else. No URL persistence, no storage, no server round-trip, no analytics event. State resets on reload, and the UI says so in plain language beside the form.
- **The engine is the only source of monetary and eligibility truth.** No component may compute, format, round, or infer a price. If a view needs a number the engine does not expose, the answer is to ask PM-01, not to compute it locally.
- **Pages derived from data must be generated from data**, so the FAQ JSON-LD cannot drift from the rendered prices. Both come from one source or the mechanism has failed.
- **A failing price test is a build-stopping event, not a warning.** Wire it that way in CI.
**Definition of done:** 102 tests green; the four non-negotiable tests intact; a data-file edit with un-regenerated pages fails CI; the alert endpoint is idempotent and accepts only two fields.
**Hands off to:** everyone; gates the release with SEO-01 and the Trust Auditor.

### SEO-01 — Technical and Content SEO Lead
**Charter:** capture the real query set without compromising a single trust signal.
**Deliverables:** title and meta patterns for the actual queries — `[drug] cost without insurance 2026`, `cheapest way to get [drug]`, `[drug] price per month`; FAQ JSON-LD per drug page generated from rendered data; breadcrumb and organization structured data; canonicals; sitemap; internal linking architecture; Core Web Vitals sign-off.
**Hard constraints:**
- **JSON-LD is generated from the same data the page renders. Never hand-written.** A test must assert the structured-data price matches the rendered price. Marking up a price the page does not show is a manual action risk, not a growth tactic.
- **No AI-generated filler prose.** Every non-tool page earns its place with data or a genuine explanation. If a section exists only to hold keywords, delete it.
- **E-E-A-T on YMYL is carried by the source citations and verification dates**, not by author bios or trust badges. Do not add ornamental credibility signals to a site whose credibility is structural.
- The `/changelog/` page is both a trust signal and the recurring-content engine in a market where prices move monthly. Treat it as a first-class surface.
**Definition of done:** every price-bearing page has a data-as-of stamp; structured data validates and matches rendered content; no page exists solely for search.
**Hands off to:** REV-01, PM-01.

### REV-01 — Ad and CRM Engineer
**Charter:** the revenue infrastructure, built to be genuinely lucrative and completely invisible in its cost to trust.
**Deliverables:** CLS-safe ad slots with fixed declared dimensions; the lifecycle and viewability implementation; the alert-list capture UX; segmented alert infrastructure keyed by medication; the premium-tier stub as copy and documentation only.
**Hard constraints:**
- **Slot heights are declared in CSS and reserved before any script runs.** Never derived from the creative, never set from script. Health and pharma display RPM is strong and layout shift is precisely what destroys it.
- **`contain: layout size` on every slot** so a misbehaving creative cannot reflow the document.
- **Placement is measured, not assumed.** Two inherited findings must be preserved: a leaderboard above the tool pushes the third input below the fold, and two adjacent slots leave a dead band that halves both viewabilities. Re-measure any placement change.
- **No ad may appear between a price and its verified stamp,** or inside the result card. The card is inviolate.
- **Affiliate slots ship built, empty, disabled.** The flag defaults off and the allowlist test prevents populating it.
- **The alert list promise is absolute:** price changes for the subscribed medication and nothing else. No newsletter, no product recommendations, no partner content, ever. One-click unsubscribe. That promise is why anyone will trust the list.
**Definition of done:** measured CLS unchanged from baseline with all slots present; no slot inside or adjacent to a price citation; affiliate infrastructure verifiably inert.
**Hands off to:** REV-02.

### REV-02 — Ad and CRM Auditor (independent)
**Charter:** adversarial review of REV-01. **Must not be the same agent as REV-01.** Your job is to find the ways the monetization damages the product, and you are graded on what you find, not on approving.
**Deliverables:** a written audit against these questions, each answered with evidence:
- Does any ad placement compete with, obscure, interrupt, or visually outrank a price or its citation?
- Does any slot cause measurable layout shift on any breakpoint, on first paint or after?
- Could any creative be mistaken for site content or for a recommendation?
- Is the affiliate infrastructure genuinely inert, or merely hidden?
- Does the alert capture collect anything beyond an email and a medication preference?
- Does the premium-tier copy overstate what exists?
- **Does the site anywhere appear to be selling something?** This is the existential question. Answer it hostilely.
**Definition of done:** every finding is either fixed or has a written, PM-01-accepted rationale for not fixing it. An audit with no findings is treated as an audit that was not performed.

### TRUST-01 — Trust, Accessibility and Integrity Auditor (added role)
**Charter:** independent verification that the visual layer did not break a safety guarantee. Added to the requested roster because this build is YMYL and no other role owns this. **Must not be any coder.**
**Deliverables:** verification at 390px in a real browser that every unverified price renders as the fallback string with a link out and never as a number; that every visible price carries a source link and verification date; that the staleness banner fires when a verification date is backdated; that the disclaimer and non-affiliation strings are present and byte-exact on every page with no dismiss control; that no storage API appears in the deployed tree; that zero emoji appear in any source file or rendered DOM; that the accessibility floor holds — landmarks, one `h1` per page, labelled controls, 44px targets, visible focus, AA contrast, `aria-live` results, `role="alert"` on the urgent banner, screen-reader units on prices, reduced-motion honored; plus a **real screen-reader pass**, since automated structural checks are not one.
**Definition of done:** a written report with measured numbers and screenshots at 390px. Any P0 failure blocks release regardless of visual quality.

### CUL-01 — Culinary Execution Team
### CUL-02 — Culinary Photography Team
### CUL-03 — Cookbook Writers
Charters, scope and hard boundaries are in **section 9**. These three roles operate on a walled-off content vertical and **must not touch the pricing engine, the tool, or any page carrying a price.**

---

## 6. PHASED SEQUENCE AND GATES

No phase begins before the prior gate is declared passed by PM-01, in writing, with evidence.

**Phase A — Inheritance audit.** Read `docs/v0-handoff.md`, `docs/gate-resolutions.md` and `docs/ops-runbook.md`. Port the engine unmodified. Port all 102 tests. Get them green in the new stack before a single pixel is designed.
**GATE A:** 102 tests green on the ported engine, with the four non-negotiable tests intact. *A build that begins visual work before this gate will fail integrity review later, expensively.*

**Phase B — Design system.** VIS-00 only. Tokens, typography, contrast proof, component inventory with all states, three signature moments specified.
**GATE B:** a coder can build any component from the spec without asking a question.

**Phase C — Tool experience.** VIS-01 with FN-01. The three-input flow, the result card in every state, results rendering.
**GATE C:** flow completes at 390×844 with zero horizontal scroll and all three inputs above the fold, measured; every golden vector verifiable on screen.

**Phase D — Content surfaces.** VIS-02 with SEO-01. Drug pages, pathway explainers, methodology, changelog, alerts, about.
**GATE D:** every page carries a data-as-of stamp; no page is a doorway; methodology reads as a receipt.

**Phase E — Motion and visualization.** VIS-03 across all surfaces.
**GATE E:** measured CLS ≤ 0.02; INP < 200ms; reduced-motion variant equally polished.

**Phase F — Revenue and CRM.** REV-01 builds, REV-02 audits independently.
**GATE F:** audit findings fixed or rationalized and accepted; measured CLS unchanged from the Gate E baseline.

**Phase G — Culinary vertical.** CUL-01, CUL-02, CUL-03 per section 9. May run parallel to D–F. Must not gate the pricing tool.
**GATE G:** every recipe cooked and tested; every photograph original; no health claim anywhere; the vertical is verifiably walled off from the engine.

**Phase H — Integrity, accessibility and release.** TRUST-01 audits everything. PM-01 grades against section 11 and produces the walkthrough.
**GATE H:** zero P0 failures; rubric scored with justification; deployable.

---

## 7. DESIGN DIRECTION — CONCRETE

VIS-00 owns this and may refine it with argument. It may not ignore it.

### Register
A precision instrument built by people with taste. Editorial confidence, financial-terminal density, clinical clarity. The nearest reference points are a well-designed financial data product and a serious editorial publication — **not** a wellness brand and not a generic SaaS dashboard.

### Explicitly forbidden
Pastel wellness gradients. Floating blobs and mesh backgrounds. Glassmorphism. Stock photography of smiling people. Emoji. Generic SaaS purple. Rounded-everything softness. Hero images that say nothing. Trust badges. Countdown timers. "Journey" language. Anything that would look at home on a telehealth landing page — that is the exact aesthetic the site is differentiating against.

### Required
- **Numbers are the hero.** Tabular numerals everywhere, mandatory. Prices align vertically in a list and never reflow when a digit changes. The monthly cost is the largest element on a result card by a decisive margin.
- **Density with air.** Information-rich without feeling cramped. A user scanning six pathways should take them in at a glance rather than reading six paragraphs.
- **Light and dark are both first-class,** designed rather than inverted.
- **The citation is designed, not tolerated.** The verified stamp should look like a feature someone was proud of.
- **Structural, not ornamental, credibility.** Precision typography and visible sourcing, never badges.

### The three signature moments

**1. The Cost Ladder.** When results resolve, pathways animate into rank with proportional cost bars, the cheapest settling into the top position with a decisive, slightly weighted motion. The annual figure counts up once, briefly, on verified figures only. This is the moment that makes the site memorable, and it is doing real work: the visual proportion communicates the size of the gap between options faster than any number can.

**2. The Receipt.** `/methodology/` as a physically-textured, monospaced, itemized document that is genuinely satisfying to scroll — a running tally of figures tracked against figures confirmed, each line carrying its source and date. Make it feel like a document that exists to be checked, because that is what it is.

**3. Live Dose Re-tiering.** Changing the dose visibly re-tiers the price with a crisp transition, so a user *sees* that dose changes cost. This is the interaction that proves the tool is real rather than a static table, and it directly counters the single most common failure of competitor pages: one headline price that is wrong for most readers.

### Performance budget — enforced, not aspirational
LCP under 1.8s on a mid-tier phone over 4G. **CLS ≤ 0.02.** INP under 200ms. JavaScript for the tool route under 180KB gzipped. No render-blocking third-party script. No web font that blocks first paint; subset and preload, or use a system stack. Images responsive, lazy below the fold, with intrinsic dimensions always declared.

---

## 8. VOICE

Direct, precise, unhurried, never salesy. Short sentences. Plain words for hard things. The tone of a good pharmacist who is not trying to sell you anything and has thirty seconds.

Say "we could not verify this" rather than engineering around the gap. **Uncertainty stated plainly is the most persuasive thing on the site**, because no competitor does it. Never use urgency, scarcity, or a call-to-action verb on a price.

---

## 9. THE CULINARY VERTICAL — SCOPE AND HARD BOUNDARIES

*If this section was included in error, delete it and roles CUL-01/02/03. Nothing else depends on it.*

**Why it exists.** GLP-1 therapy changes how people eat: early satiety, reduced appetite, nausea, and a real risk of losing lean mass. The clinical consequence is a need for small-volume, high-protein, nutrient-dense food. That is a genuine unmet content need for the exact person using this tool, and it shares the site's DNA — cost per serving is a cost question.

**CUL-01 — Culinary Execution.** Develop and **actually cook and test** every recipe. Record real yields, real prep and cook times, and measured per-serving macros with protein called out. Recipes are engineered against the constraints above: small volume, high protein, nutrient dense, tolerable when appetite is low. Record cost per serving.

**CUL-02 — Culinary Photography.** Original photography of the actual tested dish. **No stock. No AI-generated food imagery.** Consistent art direction agreed with VIS-00 so the food sits inside the site's visual system rather than beside it. Natural light, honest portions — a photograph must show the real serving size, since a styled hero portion on a small-volume recipe is a lie about the product. Responsive, compressed, dimensions declared, lazy-loaded below the fold.

**CUL-03 — Cookbook Writers.** The editorial layer: why a recipe works for this reader, what to do when nausea makes it hard, how to hit a protein target without volume. Every recipe earns its place with a specific rationale. **No AI-generated filler.** No listicles. If a recipe has nothing particular to offer this reader, cut it.

**Hard boundaries — violations are build failures:**
- **No medical claims. None.** Not "reduces nausea," not "prevents muscle loss," not "helps the medication work." Describe food and its nutrition. Nothing else.
- **Macros are calculated and sourced,** with the method stated. An unsourced nutrition figure is the same class of error as an unsourced price.
- **This vertical never appears in the ranked cost list** and never interleaves with pricing content.
- **It carries the same disclaimer and non-affiliation footer** as every other page.
- **It must not delay the pricing tool.** If it slips, it ships later.
- **No food or supplement affiliate links.** The neutrality rule is not scoped to pharmaceuticals.

---

## 10. WHAT SUCCESS FEELS LIKE

A user standing in a pharmacy opens the site on their phone. Within eight seconds they have answered three questions. The results resolve with a motion that makes the cheapest option obvious before they have read a word. Each option shows what it costs, what it costs a year, what conditions attach, and where the number came from with the date it was checked. One option says plainly that its price could not be verified, and links out instead of guessing.

They believe it. Not because it said "trusted" anywhere, but because it showed them its work, told them what it did not know, and never once tried to sell them anything.

Then they notice how good it looks, and wonder who built it.

---

## 11. GRADING RUBRIC

PM-01 scores this and publishes it with justification. **Any P0 failure caps the overall grade at F regardless of every other score.** That is what a gate is for.

| # | Gate | Weight | P0 | Pass criterion |
|---|---|---|---|---|
| G1 | Visual first impression | 15 | no | Indistinguishable from a Fortune 500 in-house build. A design director would ship it unapologetically. |
| G2 | Data integrity preserved | 15 | **yes** | No unverified figure renders as a number by any path. Engine unmodified. Invariant test intact and passing. |
| G3 | Dynamism without bloat | 12 | no | Feels alive and interactive. Three signature moments land. CLS ≤ 0.02, INP < 200ms measured. |
| G4 | Mobile experience | 12 | no | 390px flawless. Three inputs above the fold, measured. No horizontal scroll anywhere. |
| G5 | Trust architecture | 10 | **yes** | Every price carries a visible source link and verification date. Methodology reads as a receipt. |
| G6 | Neutrality | 8 | **yes** | No telehealth, pharmaceutical, or compounding link anywhere. Nothing appears to be for sale. |
| G7 | Compliance | 8 | **yes** | Byte-exact strings on every page, non-dismissible. No health information collected or persisted. |
| G8 | Accessibility | 8 | no | AA contrast, full keyboard operation, real screen-reader pass, reduced-motion honored. |
| G9 | Performance | 5 | no | Budget in section 7 met on a mid-tier phone over 4G. |
| G10 | SEO integrity | 4 | no | Structured data generated from rendered data and asserted equal. No page exists solely for search. |
| G11 | Revenue without damage | 3 | no | Slots CLS-safe and never adjacent to a citation. Independent audit findings resolved. |

Bands: **A** ≥ 93 with all P0 passed · **B** ≥ 85 · **C** ≥ 75 · **D** ≥ 65 · **F** < 65 or any P0 failed.

---

## 12. DEFINITION OF DONE

1. 102 tests green, including the integrity invariant, the emoji lint, the link allowlist and the no-persistence lint.
2. Engine files byte-identical to the inherited versions.
3. Measured CLS ≤ 0.02 and INP < 200ms on the tool route and on every content page, reported as numbers.
4. Three-input flow completes at 390×844 with no horizontal scroll and all inputs above the fold, measured in a real browser.
5. Every rendered price carries a visible source link and verification date. Every unverified price renders as the fallback string with a link out.
6. Staleness banner verified to fire on a backdated verification date.
7. Zero emoji in any source file or rendered DOM. Zero AI-generated imagery presented as real.
8. Disclaimer and non-affiliation byte-exact on every page, with no dismiss control.
9. No storage API in the deployed tree. No health information transmitted.
10. Independent REV-02 audit and independent TRUST-01 audit both complete, with findings resolved or rationalized and accepted.
11. Real screen-reader pass performed and documented.
12. Deployable to Cloudflare Pages with the alert Function intact.
13. PM-01's graded walkthrough published with screenshots at 390px and every measured number stated.

---

## 13. START HERE

Do not write a component yet.

1. **PM-01:** read `docs/v0-handoff.md` in the repository. It contains the engine API, the data contract, the component inventory, and a list of things that are correctness rather than taste. Then read `docs/gate-resolutions.md` for why certain products and figures are deliberately absent.
2. **PM-01:** produce the phase plan against section 6 and the decision log, and post it before any other role begins.
3. **FN-01:** port the engine and all 102 tests. Get them green. **This is Gate A and nothing visual starts before it.**
4. **VIS-00:** build the design system. **This is Gate B and no coder starts before it.**

If any instruction in this brief conflicts with a section 4 non-negotiable, the non-negotiable wins and PM-01 logs the conflict. If you believe a non-negotiable is wrong, stop and say so with your reasoning rather than working around it.
