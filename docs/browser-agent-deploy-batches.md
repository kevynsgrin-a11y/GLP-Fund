# Claude in Chrome — condensed deploy prompts

The full version is `browser-agent-deploy-prompt.md`. It carries the reasoning and is too long for the extension's input. This file is the same procedure cut to what a browser agent needs to act on, split into four batches. Paste one at a time, in order; each ends with a report and a stop.

Only batch 1 unblocks anything. Steps 4 and 5 of it are what the failed deploy runs have been waiting on.

---

## Batch 1 — audit, kill the ungated path, fix the secrets

```
Operate my browser. Repo: github.com/kevynsgrin-a11y/GLP-Fund. Cloudflare account: 820e7cee61fccc60d14c8e20bc686942.
Rules: never display, retype or save the API token — copy it straight from Cloudflare into the GitHub field. Never edit the repo. Never use Cloudflare's "Connect to Git".

1. github.com/kevynsgrin-a11y/GLP-Fund/settings/secrets/actions
   Record every secret NAME (never values) on the Actions tab, plus the Codespaces tab, the Dependabot tab, and the Variables section. Only the Actions tab is readable by a workflow — a secret on any other tab looks correct and resolves empty.
2. dash.cloudflare.com → Compute (Workers & Pages). List every project. Open `glp-fund` → Settings → Build → DISCONNECT the GitHub repo. Do not delete the project.
3. dash.cloudflare.com/profile/api-tokens → Create Token → Create Custom Token. One permission row only: Account / Cloudflare Pages / Edit. Delete any other rows. Create, then use the copy button.
4. Back on the secrets page → New repository secret → name CLOUDFLARE_API_TOKEN → paste → Add secret.
5. New repository secret → name CLOUDFLARE_ACCOUNT_ID → value 820e7cee61fccc60d14c8e20bc686942 → Add secret. Confirm that ID matches the dashboard sidebar; the sidebar wins if it differs.

Report: which tab each Cloudflare secret was on, the project list, what you disconnected, and that both names now appear under Repository secrets on the Actions tab. Say "token stored" and nothing else about its value. Then stop.
```

## Batch 2 — create the project and deploy

```
Continue in the same browser. Repo: github.com/kevynsgrin-a11y/GLP-Fund.
Rules: do not edit the repo. Do not use "Connect to Git". If a test fails, never disable or skip it.

1. Cloudflare → Compute (Workers & Pages) → Create → Pages → Upload assets (NOT Connect to Git). Project name exactly: glp1-fund. If it demands an initial upload, upload any small placeholder file.
2. That project → Settings → Builds: build command must be EMPTY, output directory `public`. There is no build step.
3. github.com/kevynsgrin-a11y/GLP-Fund/actions → "Deploy to Cloudflare Pages" → Run workflow → branch main → Run workflow. ~2 minutes.
4. If it fails, fix and re-run:
   - "secret is not set" → wrong name or wrong tab; redo batch 1 steps 4-5.
   - project not found → name mismatch with glp1-fund.
   - auth/authorization error → token missing Account > Cloudflare Pages > Edit.
   - "Verify before deploy" fails → STOP. Change nothing. Paste the error and tell me.
5. On success, open the Deploy job log, find the publish step, record the *.pages.dev URL it prints.

Report: final run conclusion, the pages.dev URL, any error verbatim. Then stop.
```

## Batch 3 — domain and acceptance test

```
Continue in the same browser.
Rules: do not edit the repo. The site deliberately shows no prices — never add a number.

1. Cloudflare → glp1-fund project → Custom domains → add glp1-fund.com, then www.glp1-fund.com. Do NOT change nameservers. Wait for the certificate; refresh rather than re-adding.
2. Make www 301-redirect to the apex, not the reverse. If Pages won't do it, add a zone Redirect Rule: hostname www.glp1-fund.com → 301 to https://glp1-fund.com, preserving path and query.
3. Verify. If the apex isn't resolving yet, run these against the pages.dev URL instead and SAY WHICH host you used:
   a. / loads, heading begins "The cheapest legal way to pay for your GLP-1"
   b. choose Zepbound / "No insurance, paying cash" / 15mg → result cards appear without the page navigating
   c. EVERY card reads "Price not currently verified". A dollar figure anywhere in a card is a serious defect — stop and tell me
   d. each card shows a "Not verified" date stamp and a Source link
   e. /methodology/ shows a table with source and confidence columns
   f. /data/pricing.json returns JSON, not 404
   g. /sitemap.xml URLs say glp1-fund.com, NOT glp1pricecheck.com
   h. www.glp1-fund.com redirects to the apex
   i. at 390px wide: all three form inputs visible without scrolling, no horizontal scrollbar

Report pass/fail for a-i with exact failure text. Don't tell me prices are missing — that is deliberate.
```

## Batch 4 — optional, the alert form only

```
Optional. Everything else on the site works without this.
1. Cloudflare → Storage & Databases → KV → create two namespaces: ALERTS and ALERTS_preview.
2. glp1-fund project → Settings → Bindings → Production binding: variable name ALERTS → the ALERTS namespace. Same for Preview → ALERTS_preview.
3. Visit /alerts/ on the live site, submit an address you control, report success or error. A 503 means the binding didn't take.
Report both namespace IDs — they are not secret.
```
