# Phase 1 gate resolutions

**Date:** 2026-07-30
**Method:** 15-agent verification fleet. Seven primary-source research clusters, each followed by a dedicated adversarial verifier instructed to refute rather than agree, then a completeness critic.
**Fixtures:** 68 files under `test/fixtures/`, each carrying its retrieval timestamp, the URL attempted, the HTTP status actually received, and a verbatim excerpt where one was obtainable.

---

## The finding that governs every gate below

**No primary source could be read.** This session's organizational egress policy answers `403` to the HTTP `CONNECT` handshake for every host on the project's primary-source allowlist. No TLS session was ever established and no HTTP request ever reached any of them.

Hosts denied at CONNECT, confirmed across four independent research clusters:

```
www.fda.gov          fda.gov              api.fda.gov          accessdata.fda.gov
dps.fda.gov          cacmap.fda.gov       download.open.fda.gov
www.cms.gov          cms.gov              innovation.cms.gov
www.medicare.gov     medicare.gov         medicaid.gov
www.hhs.gov          aspe.hhs.gov         www.whitehouse.gov
trumprx.gov          www.trumprx.gov      www.sec.gov
www.federalregister.gov  www.govinfo.gov  www.regulations.gov
www.lilly.com        lilly.com            investor.lilly.com
lillydirect.lilly.com    zepbound.lilly.com   pricinginfo.lilly.com
www.lillycares.com   www.novonordisk.com  www.novocare.com
www.wegovy.com       www.ozempic.com
```

**The control test is decisive.** `https://example.com/` also returns 403, and so does `en.wikipedia.org`. Neither blocks automated clients. The denial is therefore a blanket egress policy in this environment, not bot protection at any target site and not a property of any source. The proxy's own diagnostic endpoint records `kind: "connect_rejected"`, `detail: "gateway answered 403 to CONNECT (policy denial or upstream failure)"`.

`WebSearch` continues to function. Under this project's rules of evidence a search engine's summary of a page is a secondary rendering of it, not a read of it, so **search results may locate a fact and may never confirm one.** Every figure below is consequently `unverified` or `conflicting`, with a null value, and the deployed site renders no price as a number.

The proxy README is explicit: *"Do not retry or route around it -- report the blocked host."* That instruction was followed.

**What this does and does not invalidate.** Gate resolutions that turn on *structural* or *documentary* facts -- whether a drug is approved, which application number a letter belongs to, whether an enforcement deadline has expired -- can be reasoned about from evidence that does not require reading a page's body. Those are resolved below with their evidentiary basis stated. Gate resolutions that turn on *a current number* cannot be, and are not.

---

## GATE-ORF -- orforglipron approval status

**RESOLVED: APPROVED.** 2026-04-01, brand name **Foundayo**, NDA 220934, Eli Lilly and Company.
**Product decision: included as a first-class drug** with a dedicated page at `/foundayo-cost/`, per the reviewer's decision.

### The conflict, and why it was not a conflict

The brief presented two directly contradictory claims: FDA approval around 2026-04-01 as Foundayo, versus a Complete Response Letter dated 2026-04-10 with the drug unavailable. A Complete Response Letter is issued when FDA declines to approve, so both cannot be true of one application.

**They are not about the same drug.**

| | Approval | The CRL |
| --- | --- | --- |
| Application | **NDA** 220934 | **BLA** 125827 |
| Type | New Drug Application, small-molecule tablet | Biologics License Application |
| Date | 2026-04-01 | 2026-04-10 |
| Product | Foundayo (orforglipron) | RP1 (vusolimogene oderparepvec) with nivolumab |
| Sponsor | Eli Lilly and Company | Replimune Group, Inc. |
| Indication | chronic weight management | advanced melanoma |

Orforglipron is a small-molecule tablet, reviewed as an NDA. **A BLA number cannot refer to it.** The 2026-04-10 Complete Response Letter belongs to an unrelated oncology product from a different sponsor. Claim B is real; it is simply about a different drug, and it was almost certainly conflated by date proximity.

### Evidentiary basis, stated honestly

Direct retrieval failed (403) for the FDA approval letter, the FDA label, the FDA press announcement, the openFDA API, Lilly investor relations, and the SEC filing. The resolution rests on two arguments that do not require reading a page body:

1. **FDA's own URL taxonomy.** The approval letter sits at `accessdata.fda.gov/drugsatfda_docs/appletter/2026/220934Orig1s000ltr.pdf`. FDA publishes documents under `/appletter/` **only for applications it has approved**. A Complete Response Letter is not published at an `appletter` path; FDA posts those under `download.open.fda.gov/crl/`. The path itself indicates an approval, and the search index reports the document's title as `NDA 220934 NDA APPROVAL Eli Lilly and Company`.
2. **FDA's CRL filename convention.** The CRL is `CRL_BLA125827_20260410.pdf`. The document type, application type, application number and date are all encoded in the filename by FDA's own convention, and `BLA` is dispositive.

The identity of BLA 125827 as Replimune's RP1 was established through secondary sources and is used **only** to name which drug the CRL concerns -- not to confirm any figure.

**What remains unverified:** every Foundayo price. The figures in circulation ($149 lowest dose, up to $399, $25 with a commercial savings card, $50 Medicare) are pre-approval agreement pricing or "as little as" best cases, which are different claims from a launched price. All are filed null.

---

## GATE-BRIDGE -- Medicare GLP-1 Bridge

**RESOLVED as to existence and structure; NOT resolved as to cost.** Reported launched 2026-07-01, running through 2027-12-31, at $50/month for eligible beneficiaries. **Cost filed unverified.** Eligibility rules **applied anyway** -- see below for why.

### Corrections to the briefed description

Three material differences from what the brief described, all located in CMS-attributed material:

1. **It covers more than Zepbound.** Reported covered: **Foundayo (all formulations)**, **Wegovy (injection and tablets)**, and the **Zepbound KwikPen** specifically -- not Zepbound vials. The brief described it as Zepbound-only. The data file now files Bridge data for Wegovy injection, Wegovy tablets and Foundayo as well as Zepbound.
2. **The pen-only restriction is real but narrower than "pen not vials".** It is the KwikPen formulation that is named.
3. **The exclusion mechanism is broader than the brief's.** The brief described beneficiaries "already covered under the obstructive sleep apnea pathway" as ineligible. The located material frames the gate condition as: the program is for beneficiaries **who are not eligible to receive a GLP-1 through their Part D plan**. The disqualifier is therefore *having a Part D-qualifying diagnosis*, not being enrolled in coverage for one. The qualifying diagnosis set is reported as **type 2 diabetes, moderate to severe obstructive sleep apnea, and noncirrhotic MASH**. Note the qualifier: *moderate to severe* OSA specifically, not all OSA. The exclusion is reported to bite even where the beneficiary meets every clinical criterion.

Appendix B vector 8 asked for the Bridge to be suppressed when `osaCovered: true`. That behaviour is preserved, and the rule was **widened** to suppress on either `osaCovered` or `partDGlp1Eligible`, so both the narrower briefed reading and the broader located mechanism are honoured until one can be confirmed. `test/pricing.test.js` asserts both paths.

### Why an unconfirmed eligibility rule is applied when an unconfirmed price is not

This is the central judgement call of Phase 1, and it is not inconsistent.

A **suppression** rule only ever narrows what a user is shown. If the exclusion turns out not to exist, the cost of having applied it is that an eligible beneficiary was told to confirm their position with Medicare. If the exclusion is real and we had omitted it, the cost is that we quoted a fixed monthly price to somebody who cannot obtain it, and they find that out at a pharmacy counter. Between those two errors there is no contest.

A **price** has no such asymmetry: a wrong number is simply wrong in whichever direction it errs. So prices are gated on `confidence` alone, with no latitude, and rules pending verification are marked `pending_primary_verification` in the data, counted by `verificationDebt()`, asserted by the test suite, and rendered on `/methodology/` as "Pending verification" rather than presented as sourced fact.

---

## GATE-TRUMPRX -- current TrumpRx prices and terms

**RESOLVED as to method; prices NOT verifiable.** Programmatic access: **NOT PERMITTED.** The site operates on **manual curation only** and `/methodology/` says so.

### The apparent price conflict is resolved, and it was a category error

The brief presented these as conflicting: a November 2025 announcement of roughly $350/month for Ozempic and Wegovy and roughly $346 for Zepbound, against later readings of the live site showing roughly $199 and $299.

Located White House material states **both figures in the same sentence structure**: **$350/$346 are AVERAGE prices** and **$199/$299 are "as low as" LOWEST-DOSE prices**. These are two different statistics describing one program, not two competing readings of it. No reconciliation was performed by the research; the source itself states both. Platform launch is reported as 2026-02-05.

### The finding that matters most to a patient

**The $199 figure is reported to be an introductory price covering only the first two monthly fills, after which it rises to $349/month or higher.**

A patient who budgets $199/month indefinitely would face an increase of $150 to $300/month from the third fill onward. The same introductory structure is reported for NovoCare's Wegovy and Ozempic self-pay pricing, where the low figure is additionally reported to be limited to the two lowest doses.

This is exactly the condition a lead-generation cost guide has no incentive to surface, and it is now attached as a caveat to every affected pathway in the data file. `test/pricing.test.js` asserts the caveat reaches the rendered card for all five affected drug-pathway combinations. It is unconfirmed, and it is stated as reported rather than as fact -- but a patient is far better served by a flagged uncertainty than by a clean number that triples.

### Programmatic access: a definite answer, not a hedge

1. **Permission was never established.** `robots.txt` was never retrieved. No terms-of-use document was retrieved, and domain-restricted search did not establish that one exists. A crawler may not infer permission from silence it has never actually heard. For a YMYL product, absence of a verified grant is a denial, not a default-allow.
2. **This environment is affirmatively forbidden to reach the host,** and the proxy README instructs that policy denials be reported rather than routed around.

Both point the same way. The tool curates TrumpRx by hand and discloses it.

**Note on the 403s specifically:** they were generated by this session's own egress proxy at the CONNECT stage. **Nothing whatsoever was learned about what trumprx.gov itself permits or denies.** The methodology page states the access limitation without attributing it to the platform, because attributing it to trumprx.gov would be an unsupported claim about a third party.

Product page inventory discovered via search index (not read): `/p/wegovy`, `/p/wegovy-pill`, `/p/ozempic`, `/p/ozempic-pill`, `/p/zepbound`, `/p/zepbound-kwikpen`. Note that an oral Ozempic product appears in that list and is not yet modelled in the data file -- logged as follow-up in the runbook.

**No CMS or HHS page states a per-drug TrumpRx price.** Domain-restricted search across both found the Medicare Bridge and the MFN framework in the abstract, but no page carrying the per-drug TrumpRx self-pay figures. So there is no primary government fallback, and every TrumpRx figure is null.

---

## GATE-COMPOUND -- compounded semaglutide and tirzepatide

**RESOLVED: EXCLUDED ENTIRELY.** Not in the ranked list, not in a separate section, not anywhere.

The brief permitted a visually separate, clearly labelled section with verbatim FDA risk language if the legality could be established. It could not, and a fourth finding makes inclusion actively inadvisable.

### The legal chain

1. **The statutory hinge.** Sections 503A and 503B both restrict compounding a drug that is "essentially a copy" of a commercially available or approved drug. FDA does not treat a drug as commercially available while it is on the shortage list -- so while listed, the copies restriction is lifted. **Delisting restores it.**
2. **Both drugs are off the shortage list.** Tirzepatide resolved 2024-10-02, reaffirmed by declaratory order December 2024. Semaglutide resolved per an FDA decision memorandum dated 2025-02-21. No evidence of re-listing was found.
3. **Every enforcement-discretion deadline has expired,** the latest by more than fourteen months: tirzepatide 503A 2025-02-18 and 503B 2025-03-19; semaglutide 503A 2025-04-22 and 503B 2025-05-22.
4. **The litigation failed.** *Outsourcing Facilities Association v. FDA* (N.D. Tex., No. 4:24-cv-00953-P for tirzepatide, No. 4:25-cv-00174 for semaglutide). Preliminary injunction denied 2025-03-05; on 2025-05-07 the court concluded FDA acted within its statutory authority.
5. **FDA has moved to close the remaining route.** On or about 2026-04-30 FDA proposed to **exclude** semaglutide, tirzepatide and liraglutide from the 503B bulks list, finding no clinical need. The comment period closed 2026-06-29. **No final determination was located,** so the picture is still in motion -- which is itself a reason for this site to make no affirmative legality representation.

### The finding that settles it

**FDA is issuing warning letters to consumer-facing websites over how they present compounded GLP-1s.** Thirty warning letters to telehealth companies for false or misleading claims regarding compounded GLP-1 products on their websites, a second wave after a September 2025 action on direct-to-consumer pharmaceutical advertising.

The regulated conduct is **presentation and claims**, not only manufacturing. A price-comparison site displaying compounded GLP-1s alongside approved drugs would be engaging in precisely the category of conduct FDA is policing. Exclusion is both the honest answer and the correct one.

### A note on who is claiming otherwise

Every source located that frames compounded GLP-1s as a currently available consumer option in 2026 is a seller of compounded GLP-1s, a telehealth intermediary, or a marketing property serving that industry. Several rank for queries a cost-conscious patient would plausibly type. No primary FDA source endorsing the pathway was located. Those hosts are recorded by name in `test/fixtures/gate-compound-commercially-interested-source-audit.json` for the audit trail, with their URLs withheld under the site's neutrality policy.

**FDA's verbatim risk language was NOT obtained.** Three candidate sentences were located as search-index paraphrases of unknown fidelity. None may be published as FDA's words, which independently forecloses the "separate section with verbatim FDA risk language" option the brief conditioned inclusion on.

---

## GATE-MEDICAID -- CMS BALANCE Model

**RESOLVED as to existence; the tool must not imply a national Medicaid price, and does not.**

- **Exists.** BALANCE -- Better Approaches to Lifestyle and Nutrition for Comprehensive hEalth -- a CMS Innovation Center model.
- **Broader than briefed.** The brief described it as a Medicaid obesity-care program. Located material describes it as covering **both Medicare Part D and Medicaid**, not Medicaid alone.
- **Mechanism:** CMS negotiates pricing and coverage terms with manufacturers on behalf of state Medicaid agencies and Part D plan sponsors. Negotiations reported completed with Eli Lilly and Novo Nordisk.
- **Voluntary participation.** Participating states were not confirmed.
- **Effect on patient cost:** not established.

**Product consequence, implemented:** the tool publishes **no Medicaid price at all**, and a rule (`medicaid-balance-model-is-state-variable`) attaches a note to every pathway for a Medicaid user stating that coverage is state-by-state, that participation in the federal program is voluntary, and that there is no national Medicaid price for these medications. A national figure would have been the single most misleading number this site could print, because it would be wrong in a different direction in each state.

---

## Appendix B rewrites

The brief instructs that where Phase 1 contradicts a draft value, the verified value wins and the vector is rewritten. Recorded here so the changes are auditable:

| Vector | As briefed | Rewritten to | Why |
| --- | --- | --- | --- |
| 4 | Wegovy injection at a flat price across doses, dose `any` | Wegovy injection is **dose-tiered** (`low_doses`, `standard_doses`) | Research contradicts flat pricing: the low figure is reported to apply only to the two lowest doses. Dose `any` was an invalid modelling assumption. |
| 5 | "resolves the $149 vs $199 conflict" | Renders as `conflicting` with a null value | The conflict could not be resolved. The two figures may describe different purchase channels or fill counts. Picking a side would be a guess; averaging would invent a third price nobody charges. |
| 8 | Bridge suppressed on `osaCovered` | Suppressed on `osaCovered` **or** `partDGlp1Eligible` | The located mechanism is broader: having a Part D-qualifying diagnosis, not being covered for one. Both readings are honoured. |
| 11 | Zepbound list price ~$1,059-$1,086 | `conflicting`, null | Four mutually inconsistent figures located: 1086, 1059, 1059.87, 1087. |
| 1, 2, 3 | LillyDirect vial tier prices | Structure preserved; values null in shipped data, exercised in the test fixture | Tier *structure* is confirmed as real and is what the vectors actually test. The *values* are unverifiable. |

All twelve vectors pass. The four new tests added from these findings also pass. **100 tests green.**

---

## What would resolve everything

One change: widen the environment's egress allowlist to the hosts listed at the top of this document, then re-run the verification fleet. The exact list to paste is in `docs/ops-runbook.md`, section "Prerequisite: egress allowlist". Every figure's promotion path is already recorded in the data file, so verification is a data edit and requires no code change.
