# Verification fleet report

**Run:** 15 agents, 0 errors, 556 tool calls, 1,448,127 subagent tokens, 76 minutes.
**Shape:** 7 primary-source research clusters, each followed by an independent adversarial verifier instructed to refute rather than agree, then a completeness critic over the whole set.
**Date:** 2026-07-30

This document records what the fleet found, what it found wrong **in my own work**, and what was changed as a result. It is written so that a reviewer can check my corrections rather than take them on trust.

---

## 1. Verdict table

| Cluster | Verdict | Issues | Blocking | Downgrades demanded |
| --- | --- | --- | --- | --- |
| GATE-ORF | PARTIALLY_CONFIRMED | 11 | 2 | 9 |
| GATE-BRIDGE | PARTIALLY_CONFIRMED | 11 | 3 | 0 |
| GATE-TRUMPRX | PARTIALLY_CONFIRMED | 18 | 5 | 1 |
| GATE-COMPOUND | PARTIALLY_CONFIRMED | 12 | 0 | 8 |
| LILLY | PARTIALLY_CONFIRMED | 12 | 2 | 1 |
| NOVO | PARTIALLY_CONFIRMED | 8 | 1 | 2 |
| CROSS-RULES | PARTIALLY_CONFIRMED | 8 | 2 | 7 |

**Not one cluster returned CONFIRMED.** Every verifier independently reproduced the egress blockade and concluded that no figure in its cluster could be confirmed. That unanimity is the strongest evidence in the run, and it is why the shipped site prints no prices.

The completeness critic's summary judgement: **"NOT SHIPPABLE AS A PRICING TOOL."** It is right, and the site now says so on its own front page rather than only in a document.

---

## 2. What the fleet found wrong in my work, and what I changed

These are corrections to code and copy I had already written and pushed. Each was found by an agent whose instruction was to refute me.

### 2.1 The ranking heading was lying — the most serious finding in the run

**Found:** because every price is null, every pathway ties, so the entire result list falls back to alphabetical ordering. The heading said **"Your pathways, cheapest first."** A cost ranking was being promised over an alphabetically-ordered list.

This is small, quiet, and exactly the class of dishonesty the site exists to oppose. A user would reasonably conclude the first card was the cheapest option.

**Changed:** the heading is now derived from how many verified prices actually exist. With none, it reads "Your pathways" and the count line states plainly: *"None has a price we have been able to verify, so these are listed alphabetically rather than by cost. We cannot tell you which is cheapest."* With some, the heading claims a ranking and the note says unpriced pathways follow the priced ones and are not ranked.

### 2.2 I presented an unread filename as structural evidence

**Found:** my GATE-ORF writeup argued that the Complete Response Letter `CRL_BLA125827_20260410.pdf` proved Claim B concerned a different drug, because FDA's filename convention encodes the application type. **The file was never opened — it returned 403 — and since `example.com` returns an identical 403, that response does not establish the file exists at all.** Reasoning from the filename of a document you have not retrieved, on a host that refuses everything equally, is inference dressed as observation.

**Changed:** `docs/gate-resolutions.md` now says so explicitly, retains only the two arguments that survive (the NDA-versus-BLA regulatory category distinction, which needs no retrieval, plus secondary corroboration), and drops the `primary_government` designation. The conclusion still holds; its stated basis is now accurate.

### 2.3 The introductory-price caveat was too vague to protect anyone

**Found:** I had flagged the low headline figures as "introductory, lowest doses and first two fills." The verifiers established something sharper and worse: **the introductory price applies to the two starting doses ONLY, and a patient titrated to a higher dose pays the higher price from their FIRST fill** — not after a promotional period. A 1 mg patient reading the advertised figure arrives at the counter with a roughly $150 wrong expectation on day one.

My data compounded this by filing the TrumpRx Wegovy row at `dose_or_tier: "any"`, which structurally implied the introductory price covered every dose.

**Changed:** TrumpRx Wegovy is now dose-tiered like the NovoCare rows. Two distinct caveats exist: one for starting doses explaining the promotional window, and one for higher doses stating that the advertised figure does not apply to them at all and the higher price starts immediately. Ozempic carries both plus a conflicting confidence.

### 2.4 A dropped pen-versus-vial restriction

**Found:** the Zepbound savings card is reported to apply to **pen presentations only**; single-dose vials are excluded from it entirely and sold only through the separate cash-pay programme. My copay-card row recorded no such restriction, so a vial patient would have been shown a savings-card price they cannot use.

**Changed:** the row is re-scoped in its notes and carries an explicit caveat telling the reader to check which presentation they were prescribed.

### 2.5 The refill penalty was understated by roughly half

**Found:** I described the missed-refill-window penalty as a vague aggregator range. The located evidence is a **per-dose schedule whose ceiling is far higher than the range I cited**, rising into four figures a month at the top doses. The reduced price is also reported to exclude the two starting doses.

**Changed:** the caveat now says the penalty scales by dose and reaches roughly four figures at the highest doses, and tells the reader to ask for the exact figure at their own dose. It does not print the located numbers — see 2.8.

### 2.6 A Medicare Bridge over-promise

**Found:** the Bridge is reported to cover a specific pen presentation of Zepbound and **not** the single-dose vials. My data filed the Bridge for Zepbound at `any`, implying vial patients qualify. Two further adverse conditions were located and I had neither: that what a beneficiary pays may **not** count toward the Part D deductible or annual out-of-pocket cap, and that **low-income subsidies may not reduce it** — which makes the programme worse precisely for the most price-sensitive users. A second cost tier also exists for basic Part D plans at a materially higher figure than the one I recorded.

**Changed:** presentation-specific caveat added; both adverse conditions now surfaced as caveats on every Bridge row, stated as reported and unconfirmed, with a direct instruction to ask Medicare.

### 2.7 Two declared pathways could never render

**Found:** `patient_assistance` carried three eligibility rules and **no price row for any drug**, and `medicare_part_d` was in the pathway enum with no row at all. Both were dead code, and patient assistance matters most to exactly the users least able to pay.

**Changed:** both now carry honest rows for all six drugs. Patient assistance states the Medicare-or-uninsured requirement and carries a caveat that whether it covers these medications is genuinely contradicted in sources. Part D states that no national figure exists by the pathway's nature and points at plan formularies and the payment-smoothing programme.

### 2.8 A new invariant: no currency figure in rendered prose

**Found (by implication of several findings):** the integrity invariant guards the price *field*. It said nothing about the prose beside it. A card showing "Price not currently verified" directly above a note reading "$149" has told the user a price, whatever the field says — and a user scanning six cards on a phone will not parse the distinction.

**Changed:** a test now asserts that **no note, caveat or eligibility rule in the shipped data contains a `$`-prefixed figure.** Magnitudes may be conveyed in words — "roughly 150 dollars", "four figures a month" — which reads as an estimate rather than a quotable price. The located figures live in the `candidate` block, which `/methodology/` renders under an explicit not-confirmed heading. This is the tightest guard in the build after the invariant itself.

### 2.9 Foundayo was a two-tier stub built on a superseded figure

**Found:** I modelled Foundayo as `lowest_dose` / `higher_doses` with a candidate ceiling of $399. That figure is the **pre-approval agreement price**, superseded post-launch — precisely what the brief warned against shipping. The real dose ladder is six strengths, and a 45-day refill condition applies at the top two. A TrumpRx product page for the drug also exists and was missing from my data entirely.

**Changed:** six declared strengths across four price tiers; the superseded figure removed; the top tier marked `conflicting` because a regular price and a refill-conditional price are both reported and they are not alternatives; the refill condition surfaced as a caveat; the TrumpRx pathway added; the list-price row now cites Lilly's statutory price-disclosure host.

---

## 3. Findings recorded but deliberately not acted on

**Fabricated `verbatim_quote` fields.** Both verifiers flagged as blocking that research payloads emitted quotation-marked text never read from a source. This does not reach the shipped build: the shipped rule table uses `verification: "pending_primary_verification"` plus a prose `basis`, and contains no quote fields at all. The only invented quotes live in `test/fixtures/engine-dataset.json`, which declares itself synthetic engine-exercise data in its own header. **No change needed, and the reason is worth recording so a future reader does not "fix" it by copying fixture quotes into shipped data.**

**Nine of twelve golden vectors cannot be populated with verified values.** Correct, and already documented. The vectors test engine *behaviour* against a declared-synthetic fixture, which is the only way to prove ranking works when no real figure is confirmable. The three that are pure product policy — staleness, the invariant, tie-breaking — are populated against real data.

**No formulation axis in the drug model.** Correct and real: a KwikPen-only restriction cannot be expressed as data, only as a caveat. Adding a formulation dimension is a schema change that would ripple through the dose-tier model, and with every price null it would buy nothing today. **Logged as the first schema task for the verification pass**, when a pen price and a vial price will actually differ.

**Two-phase pricing has no ranking policy.** When a pathway is cheap for two fills and dearer after, ranking on month one flatters it and ranking on month three overstates it. Nothing ranks by cost today so the decision is moot, but it must be made before the first figure is promoted. **Logged; recommendation is to rank on the ongoing price and surface the introductory price as a labelled saving, because the ongoing price is what the patient lives with.**

**Staleness reports `fresh` for figures never verified.** Technically true: `verified_date` is functioning as last-checked. The rendered stamp reads "Not verified 2026-07-30" rather than "Verified", so the display is honest. Renaming the field is a data-contract change for a cosmetic gain. **Logged, not done.**

**Eleven of seventeen eligibility rules carry no `verification` field**, so editorial notes and located-but-unread claims look alike. A real weakness. **Logged as a follow-up**; the hard rules that remove pathways are all marked, which is where the risk concentrates.

---

## 4. Current state

| | |
| --- | --- |
| Unit tests | **103 passing** |
| Browser checks | **25/25 passing** at 390px |
| Measured CLS | **0.0000** |
| Price rows | 45 across 8 pathways and 6 drugs |
| Rows rendering a number | **0** |
| Source fixtures | 109 |

---

## 5. What one change would unlock

Widen the environment's egress allowlist (`docs/ops-runbook.md`, prerequisite section) and re-run this fleet. The highest-value unread documents, in the priority order the critic assigned:

1. CMS Bridge prescriber guidance — the BMI tiers, the disqualifying diagnosis set, the low-income-subsidy treatment
2. `novocare.com` per-dose price tables — the introductory-price scope and the offer end dates, where three conflicting dates are in circulation and one has passed
3. LillyDirect self-pay terms — the 45-day refill schedule per dose, and the pen-versus-vial split
4. `trumprx.gov` product pages, including the Foundayo and oral Ozempic pages
5. Lilly and Novo savings-card terms — the covered-plan-excluded-indication case the tool still cannot price
6. `aspe.hhs.gov` poverty guidelines, where the located figures failed the fleet's own arithmetic check

Every row already records what would confirm it. The pass is mechanical and touches no code.
