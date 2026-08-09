# Portfolio front-end audit — reusable playbook

Paste-ready prompts for running the audit in `docs/frontend-audit-2026-08.md` against any other
site in the portfolio, with an autonomous-fix policy and a click-by-click visual pass.

Three prompts, run in order. Prompt A produces the findings and ships the safe fixes. Prompt B
turns those findings into a design contract. Prompt C is the Claude Design loop.

Replace `{{SITE}}` with the repo or site name wherever it appears. Nothing else needs editing.

---

## Why this produces findings a normal review misses

Five mechanics do the work. If you cut anything, do not cut these.

1. **Nothing is recorded until it is reproduced.** Every finding is executed, measured, or counted.
   That is why the GLP audit could name a date (2026-08-30) rather than say "the staleness logic
   looks fragile", and give a clipped width (297px) rather than "tables feel cramped".
2. **The audit audits the deploy gate.** The single highest-leverage finding — the QA script keyed
   to CSS class names, so any rename reports a wrong price — came from asking what gates deploys
   and what it is coupled to. Almost no review asks this, and it is the finding that decides
   whether a redesign is a week or a month.
3. **The project's own docs are read against the code.** That is how the handoff doc turned out to
   contain two mutually unsatisfiable instructions.
4. **Time is a variable.** Any logic derived from a date eventually says something the page
   contradicts. Running the site forward finds the bug before the user does.
5. **Severity reflects consequence, not category.** A missing doctype and a missing `og:image` are
   both "SEO/markup". One fails WCAG Level A on every page; one makes shares ugly.

---

## Prompt A — audit and autonomous fix

> Paste verbatim. The opening sentence is load-bearing: without an explicit request for
> orchestration the session runs single-threaded and you get roughly a third of the coverage.

```text
Use a workflow for this. Run a full top-to-bottom front-end audit of this repository — design and
function — and then autonomously fix what is safe to fix.

## Scope

Every page the site actually deploys, at every viewport it actually serves. Enumerate the pages
from the build output or the router, never from memory or the README. Include pages that ship no
JavaScript, states only reachable after a form interaction, and error states.

## Capability preflight — before anything else

Establish and report, in one line each, which of these you actually have:
- Can you build and serve the site locally?
- Can you drive a real browser against it?
- Can you fetch the live public URL?

Browser automation and web fetching are pre-authorised. Do not ask permission, just use them.
These capabilities fail independently — losing the live URL does not cost you the local browser,
which is where most measurement happens.

If any of them is unavailable, say so explicitly under an "Evidence coverage" heading in the
deliverable, and name which lenses are degraded as a result. Never silently downgrade a
measurement to an impression.

## Method

Fan out audit agents across these six lenses. Keep them non-overlapping so findings do not
duplicate:

1. Visual design — hierarchy, type scale, spacing rhythm, colour, brand presence or absence,
   empty states, loading states, error states.
2. Accessibility — WCAG 2.2 A and AA. Live-region behaviour, focus order and visibility, computed
   contrast, assistive text versus visible text, landmark and list semantics.
3. Client-side function — every code path a user can reach. Failed loads, slow and hung networks,
   double submits, no-JS fallbacks, back-button state, repeat interactions on one page load.
4. UX and content — what each page promises against what it delivers, reading order, and whether
   the most valuable content on the site is actually reachable.
5. Performance, SEO and consistency — cache headers against asset hashing, metadata, structured
   data, share previews, favicons, cross-page drift.
6. Responsive and architecture — measured widths at real viewports, overflow and scroll
   affordances, print, and how the code is organised for change.

## Evidence rule — this is the part that matters

Do not record a finding you have not verified yourself. Plausibility is not evidence.

- Run the code. If any logic depends on the current date, run it across a range of future dates
  and identify the exact date its output changes.
- Measure in a real browser. Report pixel values at named viewports, not impressions.
- Compute contrast ratios. Do not estimate them.
- Count anything that is claimed — rows, cards, words announced by a live region, tracked items.
- Cite file:line for every finding.

Tag every finding with an evidence grade:
- MEASURED — you executed code, drove a browser, or computed a value. Include the number.
- OBSERVED — you read it directly in source, or saw it in a screenshot supplied to you.
- INFERRED — reasoned from code you did not execute. State what would confirm it.

Report the mix of grades in the summary. Any finding at high severity or above that is only
INFERRED must carry that word in its own heading, so nobody mistakes reasoning for measurement.

Before writing anything down, re-verify each finding against source yourself. Discard whatever you
cannot reproduce, and state how many you discarded.

## Four checks that reviews usually skip — do these explicitly

1. Audit the gate. Find whatever blocks deploys — CI workflow, QA script, test suite — and
   determine what it is coupled to. If it locates things by presentational selector, then every
   future redesign failure will misreport its own cause. Report that as critical and include the
   exact mapping: rename this, and the gate says that.
2. Read the project's own docs against the code. Report every place a doc promises a contributor
   something the code does not permit, and every place two docs contradict each other.
3. Time-travel the data. Anything derived from a date will eventually contradict the page it sits
   on. Find the date.
4. Find the untested file. Compare where the tests are concentrated against where change is
   expected to happen. Report the gap.

## Then fix, under this policy

One commit per finding, prefixed with the finding id, so any single fix can be reverted alone.

FIX NOW, without asking — only when all four hold:
- the correct behaviour is provable from the code or an existing spec, not from taste
- you can write a test that fails before the fix and passes after — write it
- it changes no copy carrying legal, medical, financial, or brand meaning
- the change stands alone in its own commit

FIX BUT FLAG — separate commits, listed in the pull request as needing human review:
anything that alters what a user reads or acts on; anything touching money, dosage, eligibility,
or compliance strings; anything with a visible consequence.

NEVER — report it with a draft attached, and ship nothing:
legal documents; publisher identity, company facts, or contact addresses; removing anything that
looks like dead code but is functioning as a compliance control; changing any number a user might
act on; brand or visual identity decisions. And never weaken, skip, or delete a test to make a fix
pass — if a fix requires changing a test, that is a finding, not a fix.

## Deliverable

Commit docs/frontend-audit-<YYYY-MM>.md and open a draft pull request. Structure:

- Verdict. What is genuinely good here, in specifics, before any criticism. Then what a visitor
  actually meets on arrival.
- Severity counts: critical / high / medium / low.
- Every critical in full: evidence, consequence, fix, effort.
- High findings as a table: finding, file:line.
- The pattern underneath — where several findings share one root cause, name it.
- Redesign blocker list — what must be resolved before any visual work begins.
- Undocumented constraints a redesigner must be told — every rule that fails the build but appears
  in no document. Harvest these from the test suite, not the docs.
- If you do only five things — ranked, with effort estimates.
- What to defend — what a redesign must not "fix". Some things that look like flaws are decisions.

Report honestly. Say which fixes you shipped, which you flagged, and anything in scope you did not
finish and why.
```

---

## When browsing is unavailable — the screenshot path

Screenshots supplement an audit. They do not substitute for one, and sending more of them makes
the audit worse, not better.

**What screenshots structurally cannot carry.** Roughly half of the GLP-Fund critical list is
invisible to a camera. Assistive-only text is hidden by definition, so the contradiction between
what a screen reader announced and what the page displayed could not appear in any capture.
Quirks mode renders identically to standards mode. A date-triggered bug has not happened yet.
A live-region announcement has no visual form. Clipping is visible but not measurable, and the
flat-640px-from-768-to-2560 finding needs widths nobody screenshots.

**The context cost is real.** Sixteen pages at three viewports is roughly forty-eight images, and
that budget comes directly out of reading source. The GLP-Fund run used about eight captures, all
aimed at a specific doubt. Exhaustive capture would have produced a weaker audit.

**The rule that turns a screenshot into evidence: state the viewport width.** With a stated width,
proportions can be measured. Without one, a screenshot supports opinions only, and every finding
drawn from it is graded OBSERVED at best.

Capture these, and little else:

| Capture | Why |
| --- | --- |
| The two or three highest-value pages, full-page, at three widths | Aesthetic judgment — rhythm, hierarchy, whether it reads as designed |
| Every state a URL cannot reach | Validation errors, post-submit, empty results, mid-load |
| Anything auth-gated or rendered by a third party | Unreachable from a local build |
| The one screen that made you commission the audit | Your instinct is a finding; it just needs locating |

Send alongside each: viewport width, device pixel ratio, browser, OS, and light or dark theme.
Width is the one that matters; the rest resolve ambiguities.

Append this to Prompt A when supplying screenshots:

```text
I am supplying screenshots because browser automation is unavailable for this site. Each is
labelled with the viewport width it was captured at.

Treat them as OBSERVED evidence, never MEASURED. Use them for the visual design and UX lenses.
For accessibility, client-side function, performance and responsive behaviour, audit from source
and grade every finding INFERRED unless you can execute something to confirm it.

State plainly in the deliverable which lenses were degraded by the absence of a live browser, and
list what you would have measured first had one been available.
```

---

## Prompt B — the design contract

Run after Prompt A's pull request has landed. Its output is what makes the visual pass safe.

```text
Read docs/frontend-audit-<YYYY-MM>.md. We are moving to the visual pass.

First, confirm every item on the redesign blocker list is resolved and pushed. If any remain, fix
them now and tell me. Do not begin design work on top of an unresolved blocker.

Then produce these three things, in order.

1. The constraint contract — docs/design-contract.md. Three categories, with nothing ambiguous
   between them:
   - Replace freely: every selector that is purely presentational.
   - Testing contract: every hook the deploy gate depends on. Convert all of these to data-*
     attributes first, in their own commit, and confirm the gate is still green afterwards.
   - Do not change: compliance controls, integrity rules, anything enforced by a test.
   Every entry cites file:line and the test that enforces it.

2. The design brief. Pull the strongest existing statement of intent out of the repo's own
   documents — if a voice is already written down, do not invent a new one. Add: who this is for,
   what feeling arrival should produce, and what it must never look like. Then list every design
   token already defined in the stylesheet. A partial token set is a starting point, not something
   to throw away.

3. Three directions, not one. For the highest-value screen, build three visually distinct static
   comps as standalone HTML using the existing tokens. Show me all three at once. Do not proceed
   past this point until I choose.

Then implement the chosen direction one component at a time, running the deploy gate after each.
```

---

## Prompt C — the Claude Design loop, click by click

Two tracks. Pick by whether the site already has a component library worth syncing.

### Before either track: authorize once

1. In Claude Code, run `/design-login`. This grants design-system access for sessions that do not
   already carry a claude.ai login — which includes Claude Code on the web.
2. If `/design-login` and `/design-sync` are not available in your session, the surface you are on
   does not ship them. Use the local Claude Code CLI for this part, or work in Track A entirely
   through the browser.

### Track A — start in the browser (no existing component library)

1. Open **claude.ai/design** and create a new project. Choose the **design system** project type.
   That type is fixed at creation and cannot be changed later — a regular project will never
   accept a design-system push.
2. Paste the design brief from Prompt B step 2 as the opening message, then paste your existing
   token block underneath it. Ask for the token system first: colour, type scale, spacing, radius,
   elevation. Not components yet.
3. Iterate on tokens until the palette holds in both light and dark. Ask explicitly for the dark
   values — a system that only defines light will break the moment a viewer's OS is set to dark.
4. Only then ask for components, one group at a time: buttons, then form controls, then the card,
   then tables. Each group becomes a card in the Design System pane, grouped by the label you give
   it, so name groups the way you want them filed.
5. When the system looks right, use **Send to Claude Code** to move it into a working session.
6. In that session, run Prompt B step 3 — three comps of your highest-value screen, built on the
   new tokens. Choose one.

### Track B — sync from the repo (existing component library)

1. Run `/design-sync` in Claude Code.
2. It lists your writable design-system projects. Pick one, or create a new one.
3. It builds a structural diff between your local library and the remote project, then shows you
   the exact list of paths it will write and delete, plus the local directory it reads from. Read
   that list. It is the last checkpoint before anything is written.
4. Approve. Sync **one component at a time** — never a wholesale replace. The tool is designed for
   incremental pushes and a full-library overwrite loses remote work you cannot recover.
5. Edit in the browser at claude.ai/design, then sync back and run the deploy gate.

### Where each track breaks

- **Fonts.** If your integrity tests forbid external URLs in CSS, a generated `@import` for a web
  font fails the build. Self-host or inline as `data:` URIs. Tell the design session this
  constraint up front rather than fixing it afterwards.
- **Cache.** Ship asset content-hashing before the first visual deploy. Unhashed assets on a long
  `max-age` behind revalidating HTML means the redesign goes live against stale CSS for however
  long the cache lasts.
- **The gate.** Run it after every component, not at the end. A batch of twenty components failing
  one class-name assertion is unbisectable.

---

## Adapting this to a specific site

Change these four things and nothing else:

| Situation | Adjustment |
| --- | --- |
| App, not a static site | Replace "every page the build emits" with "every route, including authenticated and error routes", and add a lens for state management and optimistic UI. |
| No test suite | Prompt A's "harvest constraints from the test suite" returns nothing. Replace it with: infer the constraints from the deploy config and any linter, and report the absence of a gate as a critical finding. |
| Live site with real traffic | Move the entire FIX NOW category to FIX BUT FLAG for the first run. Read what it wants to do before granting autonomy. |
| Design system already exists | Skip Prompt B step 2. Point the design session at the existing system and audit conformance to it instead. |

---

## What to expect

The GLP-Fund run produced 71 findings across six agents — 7 critical, 21 high, 24 medium, 19 low —
on a codebase whose engineering is genuinely disciplined. A site with less rigour will produce more
findings, and more of them will be autonomously fixable, because more of them will be mechanical.

The single most valuable output is usually not the critical list. It is the *undocumented
constraints* section: the rules that fail the build and appear in no document. On this repo there
were five, including a total ban on emoji and on external URLs in CSS. Every one of them would have
been discovered the hard way, mid-redesign, by a failing deploy with an unhelpful message.
