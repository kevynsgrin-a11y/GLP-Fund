# Discrepancy report

**Date:** 2026-07-30
**Status:** Phase 1 could not verify any price. The build proceeded under an explicit reviewer decision, with every price filed unverified and the deployed site rendering no number it cannot source.

The brief requires a halt and a discrepancy report if a gate fails to resolve, and forbids writing product code around an unresolved price. This document is that report. It also records how the build continued without violating the second instruction.

---

## 1. The blocker

Every primary source is unreachable from this environment. The organizational egress policy answers `403` to the HTTP `CONNECT` handshake for all of them, so no TLS session is established and no request reaches the origin.

Verified independently by four research clusters and by direct probe. **Control test:** `https://example.com/` and `en.wikipedia.org` are also refused, neither of which blocks automated clients. The denial is a blanket environment policy, not bot protection at any source.

`WebSearch` works. Under this project's rules of evidence, a search engine's summary of a page is a secondary rendering, not a read, so it can locate a fact and never confirm one.

Per `/root/.ccr/README.md`: *"403 / 407 from the proxy: The destination host is not allowed by your organization's egress policy for this session. Do not retry or route around it -- report the blocked host."* No attempt was made to circumvent it.

---

## 2. Why the build continued, and how the second instruction was honoured

The instruction is "do not write product code **around an unresolved price**." The distinction that matters is between building machinery and asserting a number.

What was **not** done: no price was estimated, averaged, inferred from a percentage, back-calculated from a discount claim, or promoted on the strength of press coverage. No figure that failed verification renders as a number anywhere in the deployed site.

What was done: the engine, the eligibility model, the frontend, the compliance layer and the ops tooling were built and tested, with the data spine filed honestly. The system is complete and the data is empty in exactly the places the evidence is empty.

This was put to the reviewer as an explicit choice between shipping strict, attesting to the researched figures, and halting with nothing built. **The reviewer chose ship-strict-and-promote-later.** The build reflects that decision.

The mechanism that makes it safe:

- Every price carries `value: null` and `confidence: "unverified"` or `"conflicting"`.
- Each datum carries an inert `candidate` block: the figure research located, the provenance actually held, and precisely what would confirm it.
- **The engine never reads `candidate`.** A test asserts no engine module accesses that property, so the unverified figures cannot leak into a rendered price by any code path.
- `validateDataset` fails the build on any datum whose confidence is not `confirmed` but whose value is non-null.
- Promotion after a real verification pass is a data edit. No code changes.

---

## 3. Gate-by-gate outcome

| Gate | Outcome | Blocking? |
| --- | --- | --- |
| GATE-ORF | **Resolved.** Approved 2026-04-01 as Foundayo, NDA 220934. The conflicting Complete Response Letter is BLA 125827, an unrelated oncology product from a different sponsor. Prices unverified. | No |
| GATE-BRIDGE | **Structure resolved, cost not.** Launch, covered formulations and a broader-than-briefed exclusion mechanism located; none confirmable against CMS. Cost null; eligibility rules applied as the conservative direction. | Partially -- see 4.1 |
| GATE-TRUMPRX | **Resolved.** Programmatic access not permitted; manual curation only, disclosed. The apparent price conflict is resolved as average-versus-lowest-dose, not a contradiction. All figures null. | No |
| GATE-COMPOUND | **Resolved: excluded.** Legality unestablished, FDA's proposed 503B bulks exclusion not final, and FDA is issuing warning letters over how consumer sites *present* these products. | No |
| GATE-MEDICAID | **Resolved.** BALANCE Model exists, spans Part D and Medicaid, voluntary, participating states unconfirmed. No Medicaid price published. | No |

All five gates are resolved in writing. None resolved to a verified price.

---

## 4. Open items a reader should not mistake for settled

### 4.1 The Medicare Bridge exclusion is applied without a verbatim source

The rule suppresses the Bridge for a beneficiary flagged `osaCovered` or `partDGlp1Eligible`. Its basis is CMS-attributed material located via search, not a read of a CMS page.

The asymmetry justifying it: applying a wrong suppression tells an eligible beneficiary to confirm with Medicare; omitting a real one quotes a fixed monthly price to somebody who cannot get it. But this is a rule that *removes an option a user might qualify for*, so it is marked `pending_primary_verification`, counted by `verificationDebt()`, asserted by the test suite, and rendered on `/methodology/` as pending rather than as sourced fact.

**This is the single item most in need of a real verification pass.**

### 4.2 The introductory-pricing condition is material and unconfirmed

The low headline figures for TrumpRx and NovoCare self-pay are reported to be introductory: lowest doses only, first two fills only, after which they rise to roughly $349-$399. If accurate, a patient budgeting the headline figure would be understating by $150-$300/month from the third fill.

It is attached as a caveat to all five affected drug-pathway combinations and asserted by test. It is stated as reported, not as fact. **Confirming or refuting this should be the first task of the next verification pass** -- it is more consequential to a patient than any single price on the site.

### 4.3 FDA's verbatim risk language was not obtained

Three candidate sentences were located as search-index paraphrases of unknown fidelity. None may be published as FDA's words. This independently forecloses the conditional "separate section with verbatim FDA risk language" that the brief allowed for compounded products.

### 4.4 Lilly Cares has no single income threshold

Located material describes thresholds tiered by medication group (300%, 400%, 500% of federal poverty guidelines) rather than one percentage, and is **self-contradictory on whether Zepbound is covered at all**. The tool publishes no threshold figure and shows the pathway with an income caveat instead.

### 4.5 An oral Ozempic product exists and is not modelled

The TrumpRx product inventory located via search includes `/p/ozempic-pill`. No oral Ozempic product is currently in `data/pricing.json`. Logged as follow-up in the runbook; a missing drug is a coverage gap rather than a wrong price, so it does not block.

### 4.6 The savings-card amount for a covered-plan-excluded-indication case is missing

The tool needs to price the case of a commercially insured user whose plan does **not** cover the weight-management indication. The copay amount for that case was not obtained. It is filed null.

---

## 5. What the reader should conclude

The machinery is verified. The data is not.

Every claim the *software* makes about itself is tested: 100 unit tests including all twelve Appendix B vectors and the integrity invariant proved adversarially, plus 25 browser checks at 390px with a measured CLS of 0.0000.

Every claim about a *price* is marked unverified, because it is. A visitor sees pathway names, eligibility reasoning, caveats, source links and verification dates, and is told plainly on the tool and on `/methodology/` that no figure has been confirmed. That is a less useful product than the one the brief describes. It is the honest version of it, and on YMYL health content the honest version is the only version worth shipping.

---

## 6. Remediation

One change unblocks everything: widen the egress allowlist to the hosts in `docs/ops-runbook.md`, section "Prerequisite: egress allowlist", then re-run the verification fleet. Each datum already records what would confirm it, so the pass is mechanical and touches no code.

Until then, the site is deployable and correct. It just does not yet print prices.
