# Claude in Chrome — autonomous deploy prompt

**How to use:** open Chrome logged in to both your Cloudflare account and your GitHub account, then paste everything below the divider into the Claude Chrome extension. It is written to be executed verbatim.

**Expect permission prompts.** The extension will ask before acting on some pages. That is normal — approve the steps that match the plan below, and stop it if it proposes something the prompt did not ask for.

---

# TASK: Deploy glp1-fund.com to Cloudflare Pages

You are operating my logged-in browser to take an already-built, already-tested static site from GitHub to a live public URL. Work autonomously through the phases below and report at the end. Stop and ask me only where this prompt explicitly says to stop.

## Context: what already exists

- **Repository:** `github.com/kevynsgrin-a11y/GLP-Fund`, default branch `main`. The site is complete, tested and committed. **You will not be editing any code.**
- **Domain:** `glp1-fund.com`, already registered in my Cloudflare account.
- **Deploy workflow:** `.github/workflows/deploy.yml` already exists and is correct. It runs the test suite, a page-drift check and a browser QA pass, and only then publishes `public/` to Cloudflare Pages. It currently fails at its first deploy step with `CLOUDFLARE_API_TOKEN secret is not set`, which is the designed behaviour and the exact thing you are about to fix.
- **Build settings:** there is **no build step**. Cloudflare must run **no build command**. The directory `public/` is committed ready-to-serve. If any Cloudflare screen asks for a build command, leave it **empty**.

## Absolute rules

**1. Never reveal the API token.** You will create a Cloudflare API token. Its value must go **directly** from the Cloudflare page into the GitHub secret field via copy and paste. Do not type it into your chat responses, do not summarise it, do not save it anywhere, do not put it in a file, an issue, a commit, or a URL. When you report back, say "token created and stored" and nothing more about its value. If you cannot copy it without displaying it, stop and tell me.

**2. Never grant broader permissions than specified.** The token gets exactly one permission: **Account → Cloudflare Pages → Edit**. No Zone permissions. No DNS permissions. No "Global API Key". If a template offers more, use the custom-token path instead.

**3. Do not modify the repository.** No code edits, no data edits, no workflow edits, no new files, no commits. If a deploy fails, report the failure — do not fix it by changing the repo.

**4. Never weaken the test gate.** If the deploy workflow fails because a test failed, **do not** disable the test, skip the job, or edit the workflow to deploy anyway. That gate is a safety property, not a formality. Report it to me instead.

**5. The site intentionally displays no prices.** Every price currently reads "Price not currently verified". That is correct and deliberate — the underlying figures could not be verified against primary sources. **Do not try to fix, fill in, or improve this.** Do not edit the data. If you find yourself wanting to add a number, stop.

**6. Stop and ask me if** any step requires a paid plan or a payment method, asks to change nameservers, asks to delete an existing project or DNS record, or offers something materially different from what is described here.

**7. Reject the Git-integration shortcut.** Cloudflare may offer to connect the GitHub repository directly so it deploys on every push. **Do not use it.** It would bypass the test suite, and this site's core guarantee is enforced by a test. Use the Direct Upload project plus the GitHub Actions workflow described below.

---

## PHASE 1 — Cloudflare account ID

1. Go to `https://dash.cloudflare.com`.
2. Open the account. Find the **Account ID** — it is in the right-hand sidebar of the account home page, and also appears in the dashboard URL after `/`.
3. Record it. This one is not secret; you may show it to me.

## PHASE 2 — Create the Pages project

1. Go to **Compute (Workers & Pages)** → **Create** → **Pages** → **Upload assets** (the Direct Upload path, *not* "Connect to Git" — see rule 7).
2. Project name: **`glp1-fund`** exactly. The deploy workflow passes this name and a mismatch will fail the deploy.
3. It may require an initial upload to create the project. If so, upload any single small placeholder file to complete creation — the real deploy in Phase 6 will overwrite it entirely.
4. Confirm afterwards, in the project's **Settings → Builds**, that the **build command is empty** and the **output directory** is `public`. Correct it if not.

## PHASE 3 — KV namespace for the alert list

The site has one server-side feature: an email list for price-change alerts. It needs a KV namespace or its endpoint returns 503. Everything else works regardless.

1. Go to **Storage & Databases → KV** → **Create a namespace**.
2. Create one named **`ALERTS`**.
3. Create a second named **`ALERTS_preview`** for preview deployments.
4. Go back to the `glp1-fund` Pages project → **Settings → Bindings** (or **Functions → KV namespace bindings** depending on dashboard version).
5. Add a binding for **Production**: variable name **`ALERTS`** (exactly, uppercase), pointing at the `ALERTS` namespace.
6. Add the same binding for **Preview**, pointing at `ALERTS_preview`.
7. Record both namespace IDs and show them to me at the end — they are not secret, and I need them for a config file.

## PHASE 4 — Create the API token

1. Go to `https://dash.cloudflare.com/profile/api-tokens`.
2. **Create Token** → **Create Custom Token** (scroll past the templates).
3. Name it something identifiable, e.g. `glp1-fund-pages-deploy`.
4. **Permissions:** one row only — **Account** / **Cloudflare Pages** / **Edit**. Delete any other rows.
5. **Account Resources:** include only the account that owns the `glp1-fund` project.
6. **TTL:** if offered, set a finite expiry rather than leaving it immortal.
7. Continue → Create Token.
8. The token is shown **once**. Use the copy button. **Do not display it, retype it, or store it anywhere.** Go straight to Phase 5 with it on the clipboard.

## PHASE 5 — Store the secrets in GitHub

1. Go to `https://github.com/kevynsgrin-a11y/GLP-Fund/settings/secrets/actions`.
2. **New repository secret** → Name: **`CLOUDFLARE_API_TOKEN`** → paste the token into the value field → Add secret.
3. **New repository secret** → Name: **`CLOUDFLARE_ACCOUNT_ID`** → paste the account ID from Phase 1 → Add secret.
4. Confirm both now appear in the list. GitHub will show only the names; the values are write-only from here, which is the intended property.

## PHASE 6 — Trigger the deploy

1. Go to `https://github.com/kevynsgrin-a11y/GLP-Fund/actions`.
2. Select the **Deploy to Cloudflare Pages** workflow.
3. **Run workflow** → branch `main` → Run workflow.
4. Watch it. Two jobs run in sequence:
   - **Verify before deploy** — unit tests, a check that generated pages match the data file, then a real-browser QA pass at a 390px viewport. Takes roughly 90 seconds.
   - **Deploy** — the secrets check, then the publish, then a smoke check of four URLs.
5. **If `Verify before deploy` fails:** stop. Do not proceed and do not modify anything. Report which step failed and paste the error. This means a real problem in the build, and deploying past it is explicitly forbidden.
6. **If `Deploy` fails at the secrets step:** a secret name is wrong. Check for typos or trailing whitespace in Phase 5, fix, and re-run.
7. **If `Deploy` fails inside the wrangler step:** report the error verbatim. Common causes are a project-name mismatch with Phase 2, or a token missing the Pages Edit permission.
8. **If the final smoke check warns about non-200 responses:** that is expected on a first deploy, because the custom domain does not exist yet. Continue to Phase 7.

## PHASE 7 — Custom domain

1. In the `glp1-fund` Pages project → **Custom domains** → **Set up a custom domain**.
2. Add **`glp1-fund.com`**. Because the domain is registered in the same Cloudflare account, the DNS record is created automatically — **do not change nameservers**.
3. Add **`www.glp1-fund.com`** as well.
4. Wait for the certificate to issue. This is usually a few minutes and can take longer. Refresh rather than re-adding the domain.
5. **Set `www` to redirect to the apex domain**, not the reverse. The site's canonical URLs are all apex (`https://glp1-fund.com/...`). Serving both without a redirect splits search ranking between two hosts. If the Pages UI does not offer this directly, create a **Redirect Rule** under the zone's **Rules** section: match hostname `www.glp1-fund.com`, action 301 to `https://glp1-fund.com` preserving path and query.

## PHASE 8 — Verify the live site

Do these in the browser and report each result explicitly. This is an acceptance test, not a glance.

1. **`https://glp1-fund.com/`** loads and shows a heading beginning "The cheapest legal way to pay for your GLP-1".
2. **The tool works.** Select medication **Zepbound**, insurance **No insurance, paying cash**, dose **15mg**. Result cards appear below without the page navigating.
3. **No price shows a number.** Every card should read "Price not currently verified". **If you see a dollar figure anywhere in a result card, stop immediately and tell me — that is a serious defect**, not an improvement.
4. **Sources are present.** Each result card shows a "Not verified" stamp with a date, and a "Source" link.
5. **The footer disclaimer is present** on the home page, beginning "This tool provides pricing information only." Confirm there is no button or control to dismiss it.
6. **`https://glp1-fund.com/methodology/`** loads and shows a table of price figures with source and confidence columns.
7. **`https://glp1-fund.com/data/pricing.json`** returns JSON, not a 404.
8. **`https://glp1-fund.com/sitemap.xml`** loads and its URLs use `glp1-fund.com` — **not** `glp1pricecheck.com`. If you see the latter, an old build was deployed; report it.
9. **`https://www.glp1-fund.com/`** redirects to the apex domain.
10. **Mobile check.** Open DevTools device emulation at 390px wide, reload the home page, and confirm all three form inputs are visible without scrolling and that there is no horizontal scrollbar.
11. **Alert form.** Go to `https://glp1-fund.com/alerts/`, enter a real address you control, submit, and report whether it returns a success message or an error. A 503 here means the KV binding in Phase 3 did not take effect; everything else still works.

## REPORT BACK

Give me, concisely:

1. The live URL and whether it is serving.
2. Pass or fail for each of the 11 checks in Phase 8, with the specific failure text for any that failed.
3. The two KV namespace IDs from Phase 3.
4. The Cloudflare account ID.
5. Confirmation that the token was created and stored — **and nothing about its value**.
6. Anything you had to deviate from, and why.
7. Anything that looked wrong but that you left alone because this prompt told you not to touch it.

Do not tell me the site needs prices added. I know. That is a separate, deliberate piece of work.
