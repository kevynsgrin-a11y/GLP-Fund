# Operations runbook

Everything needed to run this site: how to verify a price, how to publish a change in under an hour, what breaks and what to do about it, and how to deploy.

---

## Prerequisite: egress allowlist

**Nothing in this runbook works until this is done.** As of 2026-07-30 the build environment refuses outbound HTTPS to every primary source, so no figure can be verified and the site publishes no prices. See `docs/discrepancy-report.md`.

Add these hosts to the environment's network policy allowlist:

```
fda.gov                  www.fda.gov              accessdata.fda.gov
api.fda.gov              download.open.fda.gov    dps.fda.gov
cms.gov                  www.cms.gov              innovation.cms.gov
medicare.gov             www.medicare.gov         medicaid.gov
hhs.gov                  www.hhs.gov              aspe.hhs.gov
whitehouse.gov           www.whitehouse.gov
trumprx.gov              www.trumprx.gov
sec.gov                  www.sec.gov              federalregister.gov
lilly.com                www.lilly.com            investor.lilly.com
lillydirect.lilly.com    zepbound.lilly.com       mounjaro.lilly.com
pricinginfo.lilly.com    www.lillycares.com
novonordisk.com          www.novonordisk.com      www.novocare.com
wegovy.com               www.wegovy.com           ozempic.com
www.ozempic.com
```

Confirm with `curl -sS "$HTTPS_PROXY/__agentproxy/status"` -- `recentRelayFailures` should stop recording `connect_rejected` for these hosts. Then run the first full verification pass (section 2).

---

## 1. The price-update procedure

### 1.1 Per-source checklist

Work source by source, not drug by drug: one page usually carries several figures, and reading it once is both faster and less error-prone.

| Source | Read | Record |
| --- | --- | --- |
| `lillydirect.lilly.com` | Zepbound vial tiers (2.5, 5, all others); KwikPen per-dose; Mounjaro self-pay; **the refill-window condition and its exact terms** | value per tier, as-of date, exact conditions |
| `zepbound.lilly.com` | List/WAC figure with its as-of date; savings card copay **for both** covered and non-covered indication; **verbatim** federal-program exclusion sentence | figures plus the quote |
| `investor.lilly.com` | Any price-change release since the last pass | date, drug, old and new figure |
| `www.novocare.com` | Wegovy injection per-dose; Wegovy tablets per-strength; Ozempic; **whether a low figure is introductory, how many fills it covers, its end date, and the ongoing price after it** | per-dose table plus offer mechanics |
| `wegovy.com`, `ozempic.com` | List prices; savings card copay and maximum benefit; **verbatim** exclusion sentence | figures plus the quote |
| `trumprx.gov` | `/p/wegovy`, `/p/wegovy-pill`, `/p/ozempic`, `/p/ozempic-pill`, `/p/zepbound`, `/p/zepbound-kwikpen`; **and `robots.txt` and any terms page** | per-product price, whether introductory, and the access terms |
| `cms.gov`, `medicare.gov` | Medicare Bridge: launch, beneficiary cost, BMI criteria, covered formulations, **the exclusion mechanism verbatim**; BALANCE Model participating states | figures plus quotes |
| `fda.gov` | Approval status of anything pending; shortage-list state for semaglutide and tirzepatide; 503B bulks list final determination | status plus date |
| `aspe.hhs.gov` | Current federal poverty guidelines table and its year | table plus year |
| `www.lillycares.com` | Income thresholds per medication group; **whether Zepbound is covered** | thresholds, and resolve the contradiction noted in the discrepancy report |

### 1.2 Rules of evidence, non-negotiable

- **Only a primary source confirms.** Manufacturer own-site or investor relations, or a `.gov` source. A press-wire copy of a company release is secondary; the company's own page is primary.
- **Secondary sources locate, never confirm.** Press, aggregators and drug databases tell you a price may have moved. They never establish what it is.
- **A search-engine summary of a page is not a read of that page.** This is the trap the whole current dataset fell into. If you did not see it on the source, it is not confirmed.
- **Never reconcile a conflict.** Two disagreeing figures become `confidence: "conflicting"` with `value: null`. The average of two prices is a price nobody charges.
- **Never derive a price from a percentage.** "50 to 60 percent off list" is a range, not a price. A back-calculated figure must never ship.
- **"As low as" and "up to" are not prices.** They are bounds. File the bound in `notes`, not in `value`.
- **Capture conditions, not just numbers.** A price with an unrecorded refill window or introductory period is a wrong price.

### 1.3 Promoting a candidate figure

When a figure is confirmed by direct read:

1. Set `value` to the confirmed number.
2. Set `confidence` to `"confirmed"`.
3. Set `verified_date` to today, `YYYY-MM-DD`.
4. Set `source_url` to the exact page read, and `source_type` correctly.
5. Move any condition discovered into `caveats` -- refill windows, introductory periods, fill counts, indication limits.
6. **Delete the `candidate` block.** It has served its purpose and a stale one is confusing.
7. Update `verification.status` at the top of the file once no unverified figures remain.

If a figure is **refuted**, leave `value: null`, update `notes` with what you found, and update `candidate.provenance` to say it was checked and did not hold. A refutation is as valuable as a confirmation and must not be silently dropped.

### 1.4 Retiring a pending eligibility rule

When you obtain the verbatim terms for a rule marked `pending_primary_verification`:

1. Add `quote` with the exact sentence.
2. Remove `verification` and `basis`.
3. If the terms **contradict** the rule, change or delete the rule and log it in the changelog. A rule that removes a pathway wrongly is denying someone an option they have.
4. Update the `verificationDebt` assertion in `test/pricing.test.js`, which currently asserts every hard rule is pending. Update it deliberately, so the count can never drift silently.

---

## 2. Price-change day: the newsjack sequence

Target: **under 60 minutes** from announcement to published. Price-change days are this site's spike events, and being first with a *sourced* figure is the whole opportunity.

```
 0-10 min   READ THE PRIMARY SOURCE
            The manufacturer's own release or the .gov page. Not the press
            coverage of it. Screenshot or save it. Note the effective date --
            an announcement date and an effective date are different things.

10-20 min   UPDATE data/pricing.json
            Change value, verified_date, notes and caveats. Delete the
            candidate block if promoting. Then:
              npm test
            A failing price test stops the release. It is not a warning.

20-30 min   ADD A CHANGELOG ENTRY
            public/data/changelog.json, newest first:
              date, title, summary, changes[], sources[]
            State the old figure and the new one. "Zepbound 5 mg vial: $399
            to $349" is the entry. "Prices updated" is not.

30-40 min   REGENERATE AND VERIFY
              node tools/build-pages.mjs
              node tools/qa.mjs
            This refreshes every affected drug page, the methodology table,
            the FAQ JSON-LD and the sitemap from the one data file. The FAQ
            answers cannot drift from the rendered prices because both are
            generated from the same source.

40-50 min   DEPLOY
              git add -A && git commit && git push
            Cloudflare Pages builds on push. Confirm the live page shows the
            new figure and the new verified date.

50-60 min   SEND THE ALERT
            Segment by drug from the KV index (section 5). Subject line names
            the drug and the direction: "Zepbound 5 mg self-pay drops to
            $349". Body: old figure, new figure, effective date, source link,
            and what it means for the cheapest pathway. One link to the drug
            page. No upsell.
```

**If the 60 minutes cannot be met honestly, miss the 60 minutes.** A wrong figure published fast is worse for this site than a right figure published slow, because the only asset here is being the one that is right.

---

## 3. The staleness failsafe

Configured in `public/engine/config.js`: warn past 30 days, urgent past 60.

| Age | State | Rendered |
| --- | --- | --- |
| 0-30 days | `fresh` | "Verified [date]" with source link |
| 31-60 days | `warn` | Inline note on the card; a warn banner above results |
| 61+ days | `urgent` | Prominent `role="alert"` banner above all results |

Boundaries are inclusive-fresh: exactly 30 days is still fresh. Malformed dates **throw** rather than becoming `NaN`, because `NaN` comparisons are false and a garbage date would otherwise classify as fresh.

**The failsafe degrades visibly rather than failing silently.** That is the design: if the site is abandoned, a visitor is told the data is old rather than being shown a confident two-year-old price. This is the single most important behavioural difference between this site and the aggregators still quoting November 2025 figures with no date rendered.

**Test it, do not trust it.** `node tools/qa.mjs` backdates every `verified_date` to 120 days and asserts the urgent banner renders above the results. It serves the backdated file from memory, so the working tree is never modified.

**Monthly full re-verification.** On the first working day of each month, walk section 1.1 end to end regardless of whether anything was announced. Prices in this market have moved at least five times in nine months, and several moves were not announced in a way that reached press. Bump `verified_date` on every figure you re-read, even where nothing changed -- **re-confirming is a verification event and the date must move.** Do not bump a date you did not re-read. That converts the freshness signal into a lie, which is the only unrecoverable failure mode this site has.

---

## 4. Failure modes

| Symptom | Cause | Action |
| --- | --- | --- |
| Every price shows "Price not currently verified" | Working as designed under the current blockade | See the prerequisite section |
| "Pricing data could not be loaded" | `pricing.json` 404 or malformed | Validate JSON; check `_headers` caching; the page deliberately tells the visitor to go to the source rather than showing nothing |
| `npm test` fails on a price vector | A data edit broke a golden vector | **Stop.** Do not deploy. Either the edit is wrong or the vector needs a documented rewrite in `docs/gate-resolutions.md` |
| `validateDataset` reports a non-null value on a non-confirmed datum | The integrity invariant was violated | Set the value to null or confirm the figure. There is no third option |
| `validateDataset` reports a dose that reaches no price datum | A `doseTiers` entry has no matching price | Add the datum or fix the mapping. A drug returning nothing reads as "no options exist" |
| A drug returns no pathways | Same as above, or every pathway suppressed | Check `suppressedPathways()` for the reason |
| Urgent banner on a fresh figure | A future-dated `verified_date`, or a typo | `ageInDays` returns negative; check the date |
| CLS regression | An ad slot height changed at runtime, or a slot moved above the fold | Heights belong in CSS, never script. Re-run `tools/qa.mjs` |
| Emoji test fails | An emoji reached a source file | Replace it with an icon from `icons.js`. Never suppress this test |
| Link allowlist test fails | An outbound link is not a primary source | This is the neutrality guarantee. Remove the link; do not extend the allowlist to make it pass |
| Alert signup returns 503 | KV namespace `ALERTS` not bound | Bind it in Pages project settings |
| Source link 403s | Likely the egress policy, not a dead link | `tools/qa.mjs` records status per URL and distinguishes blocked from broken |

---

## 5. The alert list

**Endpoint:** `POST /api/alerts`, `functions/api/alerts.js`. The only server-side code in the project. Do not add a second endpoint.

**Accepts exactly two fields:** `email` and `drug`. Nothing else is stored. The visitor's insurance situation and dose are health information, are never transmitted from the client, and there is no field here to receive them.

**KV layout** (namespace `ALERTS`):

```
subscriber:<email>   { email, drug, createdAt, source, country }
index:<drug>         [ "email", ... ]        maintained on write
index:all            [ "email", ... ]
```

KV has no query, so the per-drug index is maintained at write time. Writes are idempotent: a resubmit updates the preference and preserves the original `createdAt`, so one person does not receive two emails on a price-change day.

**Sending:** read `index:<drug>` plus `index:all`, dedupe, send. Every email needs one-click unsubscribe. Never send anything that is not a price change for a subscribed drug -- no newsletter, no product recommendations, no partner content. Ever. That promise is made on `/alerts/` and it is the reason anyone will trust the list.

**Premium tier:** documented as copy on `/alerts/` and not built. Do not build it without deciding what stays free. The free tool is the reason the list exists.

---

## 6. Cloudflare Pages deploy

Target: **`glp1-fund.com`**, registered through Cloudflare.

### 6.0 The API token: read this before creating one

**The token must never be committed to this repository, pasted into a file in it, or included in a commit message, an issue, or a pull request comment.** A Pages-scoped token can publish arbitrary content to a live health-information site. Treat it as a credential that can deface the product.

Where it goes: **GitHub repository secrets**, at Settings > Secrets and variables > Actions. Two secrets:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | the token created below |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard, right-hand sidebar of the account overview |

GitHub secrets are write-only once saved: the workflow can use the value, and nobody -- including me -- can read it back. That is the property you want.

**Creating the token,** Cloudflare dashboard > My Profile > API Tokens > Create Token > Create Custom Token:

- Permissions: **Account > Cloudflare Pages > Edit**. That single permission is sufficient. Do not grant Zone or DNS permissions; this workflow does not touch DNS.
- Account Resources: include only the account that owns the Pages project.
- TTL: set an expiry you are willing to rotate. An immortal deploy token is a liability.

`.gitignore` already excludes `.dev.vars`, which is the only place Wrangler would look for a local token. If you deploy from a laptop instead of CI, export the token in your shell for that session rather than writing it to a file.

**If a token is ever exposed** -- pasted into a chat, a commit, or a log -- revoke it in the Cloudflare dashboard first and create a new one second. Rotation is cheap; a live token in a public repository is not.

### 6.1 Project settings

| Setting | Value |
| --- | --- |
| Project name | `glp1-fund` |
| Build command | **(empty)** |
| Build output directory | `public` |
| Root directory | `/` |
| Functions directory | `functions` (repo root, auto-detected) |
| Production branch | `main` |
| Node version | not required; nothing is built |

There is no build step. `public/` is served exactly as committed. `package.json` exists only to run `node --test` and is never read at deploy time. `wrangler.toml` holds these settings in version control so they are reviewable rather than click-configured.

### 6.2 KV binding

The alert list is the only server-side state in the project. Create the namespaces once and paste the ids into `wrangler.toml`:

```bash
npx wrangler kv namespace create ALERTS
npx wrangler kv namespace create ALERTS --preview
```

Bind as variable name `ALERTS` for **both** production and preview. Without it the alert endpoint returns 503 and logs the missing binding, and every other part of the site is unaffected -- the intended failure mode, because a broken mailing list must never take down a page somebody is reading at a pharmacy counter.

### 6.3 Custom domain

In the Pages project, Custom domains > Set up a custom domain, add `glp1-fund.com` and `www.glp1-fund.com`. Because the domain is registered in the same Cloudflare account, the DNS records are created automatically and no nameserver change is needed. Allow a few minutes for the certificate to issue; until it does, the smoke check in the deploy workflow will report non-200 and say so rather than failing the deploy.

Decide one thing deliberately: whether `www` redirects to apex or the reverse. The site's canonical URLs are **apex** (`https://glp1-fund.com/...`), generated from `DOMAIN` in `config.js`, so `www` should redirect to apex. Serving both without a redirect splits ranking signals between two hosts.

### 6.4 Deploying

**Automatic**, and the intended path: push to `main`. `.github/workflows/deploy.yml` runs the full test suite, the page-drift check and the browser QA pass, and deploys only if all three are green. Deployment is gated behind the tests deliberately -- the integrity invariant that stops an unverified price rendering as a number *is* a test, so shipping past a red suite means shipping past the guarantee.

**Manual**, if needed:

```bash
npm test && node tools/qa.mjs           # do not skip this
npx wrangler pages deploy public --project-name=glp1-fund --branch=main
```

### 6.5 First-deploy checklist

1. Both GitHub secrets set.
2. KV namespace ids pasted into `wrangler.toml` and committed.
3. Custom domain added, certificate issued, `www` redirecting to apex.
4. `https://glp1-fund.com/` serves the tool.
5. `https://glp1-fund.com/data/pricing.json` serves JSON with `Cache-Control: max-age=300`.
6. `https://glp1-fund.com/sitemap.xml` lists apex URLs, not the old placeholder host.
7. An alert signup returns 200 and the KV record appears.
8. The tool completes at 390px on a real phone with no horizontal scroll.

**Headers and redirects** are in `public/_headers` and `public/_redirects`, generated by `tools/build-pages.mjs`. Note the caching split: assets and engine modules cache for an hour, but `pricing.json` and `changelog.json` cache for **five minutes** -- on a price-change day a hard-cached data file is the exact failure this site exists to avoid.

**Domain:** `glp1-fund.com`, registered through Cloudflare. Defined once in `public/engine/config.js` and flowing into canonical URLs, the sitemap, `robots.txt` and every JSON-LD block. To change it: edit `config.js`, update the self host in the allowlist in `test/integrity.test.js`, run `node tools/build-pages.mjs`, then `npm test`. The allowlist deliberately fails the build on a canonical URL pointing at a host we do not control.

**Deploy verification**, every time:

1. The changed figure and its new verified date appear on the live drug page.
2. `/methodology/` tally matches the data file.
3. `/data/pricing.json` serves the new content, not a cached copy.
4. The tool completes at 390px with no horizontal scroll.
5. An alert signup returns 200 and the KV record appears.

---

## 7. Follow-up backlog

Carried from Phase 1. None blocks deployment; all are logged so they are not lost.

1. **Confirm or refute the introductory-pricing condition.** The highest-value item on this list. If the low headline figures are introductory and limited to the lowest doses, a patient budgeting them understates by $150-$300/month from the third fill. Currently a flagged caveat on five drug-pathway combinations.
2. **Get the Medicare Bridge exclusion verbatim from CMS.** The rule is applied on located-not-read evidence and it removes an option from users who may qualify.
3. **Model oral Ozempic.** `trumprx.gov/p/ozempic-pill` exists in the located product inventory and no such drug is in the data file.
4. **Get the savings-card amount for a commercially insured user whose plan excludes the indication.** A case the tool must price and currently cannot.
5. **Resolve whether Lilly Cares covers Zepbound.** Located sources directly contradict each other.
6. **Watch for the FDA 503B bulks-list final determination.** The comment period closed 2026-06-29. A final rule would settle GATE-COMPOUND, which is currently resolved to exclusion partly on the grounds that the position is still in motion.
7. **Confirm the Zepbound list price and its as-of date.** Four inconsistent figures located; this is the denominator of the headline saving.
8. **Re-run the verification fleet once egress is opened,** then update `verification.status` and the `verificationDebt` assertion.
