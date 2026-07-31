# Claude in Chrome — autonomous diagnose-fix-deploy prompt

**How to use:** open Chrome logged in to both your Cloudflare account and your GitHub account, then paste everything below the divider into the Claude Chrome extension. It is written to be executed verbatim.

**Expect permission prompts.** The extension will ask before acting on some pages. That is normal — approve the steps that match the plan below, and stop it if it proposes something the prompt did not ask for.

**Why this replaced the earlier version.** The first deploy attempts have already run and failed. This prompt encodes what they proved, and opens with an audit rather than a build, so nothing gets created twice.

---

# TASK: Diagnose, fix, and deploy glp1-fund.com to Cloudflare Pages

You are operating my logged-in browser to take an already-built, already-tested static site from GitHub to a live public URL. Three deploy attempts have failed at the same place. Your job is to find out why, fix it, deploy, and verify the result.

Work autonomously through the phases below. Stop and ask me only where this prompt explicitly says to stop.

## Context: what already exists, and what has already been tried

- **Repository:** `github.com/kevynsgrin-a11y/GLP-Fund`, default branch `main`. The site is complete, tested and committed. **You will not be editing any code.**
- **Domain:** `glp1-fund.com`, already registered in my Cloudflare account.
- **Deploy workflow:** `.github/workflows/deploy.yml` exists and is correct. It runs the unit tests, a page-drift check and a real-browser QA pass, and only then publishes `public/` to Cloudflare Pages.
- **Build settings:** there is **no build step**. Cloudflare must run **no build command**. The directory `public/` is committed ready-to-serve. If any Cloudflare screen asks for a build command, leave it **empty**.

**Deploy history — this is the evidence you are starting from.** Three runs of that workflow, the most recent being run `30608119738`. Every one of them passed the `Verify before deploy` job in full, then failed on the first step of the `Deploy` job. The runner printed its own environment immediately before failing:

```
env:
  TOKEN:
  ACCOUNT:
##[error]CLOUDFLARE_API_TOKEN secret is not set.
##[error]CLOUDFLARE_ACCOUNT_ID secret is not set.
```

Both values are empty. I believe I added a token already, so **assume it exists somewhere and is simply in a place GitHub Actions cannot read.** Phase 1 exists to find out where. Do not assume from the start that nothing was configured.

**A second, separate problem has since surfaced, and it is the more serious of the two.** The Cloudflare GitHub App posted a build status onto a pull request in this repository, which means **a Cloudflare Git integration is already connected to this repo and is deploying from it right now.** From that comment:

- The connected project is named **`glp-fund`** — note the missing `1`. The deploy workflow publishes to `glp1-fund`. These are two different projects.
- It built commit `09cb3cc2` automatically on push and the build **failed**.
- The dashboard link it produced was `dash.cloudflare.com/?to=/820e7cee61fccc60d14c8e20bc686942/workers/services/view/glp-fund/production/builds/...`, so the account ID is very likely **`820e7cee61fccc60d14c8e20bc686942`**. Confirm this against the dashboard sidebar in Phase 1c rather than trusting it outright.

**Why this matters more than the failed build:** a Git-integrated project deploys on every push *without running the test suite*. This site's one guarantee — that it never displays a price it cannot source — is enforced by a test. A deployment path that skips the tests can publish a broken guarantee to the public, which is the specific outcome the gated workflow exists to prevent. Phase 1B deals with this before anything else.

## Absolute rules

**1. Never reveal the API token.** If you create or handle a Cloudflare API token, its value must go **directly** from the Cloudflare page into the GitHub secret field via copy and paste. Do not type it into your chat responses, do not summarise it, do not save it anywhere, do not put it in a file, an issue, a commit, or a URL. When you report back, say "token created and stored" and nothing more about its value. If you cannot copy it without displaying it, stop and tell me.

**2. Never grant broader permissions than specified.** The token gets exactly one permission: **Account → Cloudflare Pages → Edit**. No Zone permissions. No DNS permissions. No "Global API Key". If a template offers more, use the custom-token path instead.

**3. Do not modify the repository.** No code edits, no data edits, no workflow edits, no new files, no commits. Triggering a workflow run is not a modification and is expected. If a deploy fails, diagnose and report it — do not fix it by changing the repo.

**4. Never weaken the test gate.** If the deploy workflow fails because a test failed, **do not** disable the test, skip the job, re-run with the job deselected, or edit the workflow to deploy anyway. That gate is a safety property, not a formality. Report it to me instead.

**5. The site intentionally displays no prices.** Every price currently reads "Price not currently verified". That is correct and deliberate — the underlying figures could not be verified against primary sources. **Do not try to fix, fill in, or improve this.** Do not edit the data. If you find yourself wanting to add a number, stop.

**6. Stop and ask me if** any step requires a paid plan or a payment method, asks to change nameservers, asks to delete an existing project, DNS record or namespace, or offers something materially different from what is described here.

**7. Reject the Git-integration shortcut — and undo the one that already exists.** Cloudflare deploys straight from a connected GitHub repo on every push, skipping the test suite entirely. This is not hypothetical here: it is already connected and already deploying, as the context above describes. Never connect a new one, never re-connect the one you disconnect, and if Cloudflare offers "Connect to Git" at any point, decline it. The gated GitHub Actions workflow is the only permitted publish path.

**8. Create nothing that already exists.** Phase 1 tells you what is already there. Reuse it. Two Pages projects or two KV namespaces with confusable names will cause a failure that is much harder to diagnose than the current one.

---

## PHASE 1 — Audit before you touch anything

Read-only. Change nothing in this phase. Record every answer; you will report all of them at the end.

**1a. Which GitHub secret store was used.** Go to `https://github.com/kevynsgrin-a11y/GLP-Fund/settings/secrets/actions`.

This page has **three tabs** — Actions, Codespaces, Dependabot — and workflows read **only the Actions tab**. A secret added under Codespaces or Dependabot is saved, looks completely correct, and is invisible to the deploy. That is the single most likely explanation for the failure above.

Check and record, **names only, never values**:
- On the **Actions** tab, under **Repository secrets**: is there a secret named exactly `CLOUDFLARE_API_TOKEN`? One named exactly `CLOUDFLARE_ACCOUNT_ID`? List every secret name you see.
- On the same page, under **Repository variables**: are either of those names sitting there instead? A variable is not a secret and the workflow will not read it.
- Click the **Codespaces** tab and the **Dependabot** tab. Record any Cloudflare-looking secret names on either.
- Go to `https://github.com/kevynsgrin-a11y/GLP-Fund/settings/environments`. If an environment exists, open it and record any secrets defined there and the environment's exact name. The workflow's deploy job declares an environment named `production`; a secret under an environment with any other name will not resolve.

**1b. Which Cloudflare projects exist, and which are Git-connected.** Go to `https://dash.cloudflare.com` → **Compute (Workers & Pages)**. List **every** project you see. Specifically:
- Is there one named exactly `glp1-fund` (what the workflow publishes to)?
- Is there one named `glp-fund` (the one the bot comment named)? Record any other near-miss such as `glp1fund` or `glp-1-fund`.
- For each one that exists, open it and record whether its **Settings → Build** shows a **connected GitHub repository**, and what build command and output directory it is configured with. A project with a connected repo is the ungated path described above.

**1c. The account ID.** On the Cloudflare account home page, find the **Account ID** in the right-hand sidebar. It also appears in the dashboard URL as the long hex string after `/`. Record it, and say whether it matches `820e7cee61fccc60d14c8e20bc686942` — the value inferred from the bot's link. If it does not match, **the dashboard sidebar wins**; use that and tell me about the discrepancy. This value is **not secret**; you may show it to me.

**1d. Existing KV namespaces.** Go to **Storage & Databases → KV**. Record whether namespaces named `ALERTS` and `ALERTS_preview` already exist.

**1e. Existing custom domains.** If the `glp1-fund` Pages project exists, open it and record what is listed under **Custom domains**.

**Report this audit to me in one short block before continuing.** Then continue without waiting for my reply — you do not need my approval to proceed to Phase 2.

## PHASE 1B — Stop the ungated deploy path

Do this before the secrets. An ungated project that publishes on every push is a live risk; a gated one that has not published yet is merely inconvenient.

For **every** project Phase 1b found with a connected GitHub repository — `glp-fund`, and any other:

1. Open the project → **Settings** → the **Build** or **Builds & deployments** section.
2. Find the Git connection and **disconnect it**. The control is usually "Disconnect", "Unlink", or "Manage" next to the repository name. Disconnecting stops future automatic builds; it does not delete the project, its deployments, or its domains.
3. **Do not delete the project itself**, even though its builds are failing. Rule 6 applies. A failing build that no longer triggers is harmless.
4. Record what you disconnected.

**If you cannot find a disconnect control**, do not start deleting things to achieve the same effect. Report exactly what you see and continue to Phase 2 — a gated deploy that races an ungated one is still better than no gated deploy, and I will sort out the rest.

**Which project should the real deploy publish to?** The workflow passes `--project-name=glp1-fund` and I have told you not to edit the repo, so the target is `glp1-fund`. If Phase 1b found `glp-fund` but no `glp1-fund`, **do not rename `glp-fund` and do not repoint the workflow.** Leave `glp-fund` disconnected and idle, and create `glp1-fund` fresh in Phase 4. Two projects is untidy but correct; a rename mid-flight risks breaking the custom domain later.

## PHASE 2 — Fix the secrets

This is the confirmed cause of the current failure. Everything after it is contingent.

1. **If Phase 1a found the token in the wrong store** (Codespaces tab, Dependabot tab, a mis-named environment, or the Variables section): you cannot read the value back out — GitHub secrets are write-only once saved. You will need a fresh token. Go to Phase 3, create one, then come back here. Leave the misplaced secret alone; deleting it is not necessary and rule 6 says not to delete things.

2. **If `CLOUDFLARE_API_TOKEN` is genuinely absent from the Actions tab:** go to Phase 3, create a token, then return.

3. **If `CLOUDFLARE_API_TOKEN` is present on the Actions tab with the exact name:** it exists but resolved empty, which points at a name that only looks right. Check for a trailing space, a leading space, a lowercase letter, an en-dash instead of a hyphen, or a zero-vs-letter-O. Delete and recreate it with the exact name if anything is off. If the name is genuinely exact, the value may have been saved empty — recreate it from a fresh token via Phase 3.

4. **Add `CLOUDFLARE_ACCOUNT_ID`** on the Actions tab, under **Repository secrets**, with the account ID recorded in Phase 1c. Paste carefully — a trailing newline survives the paste and causes an authentication failure later, which is much harder to read than the failure you have now.

5. Confirm both names now appear under **Repository secrets** on the **Actions** tab. GitHub will show only the names; the values are write-only from here, which is the intended property.

## PHASE 3 — Create the API token (only if Phase 2 sent you here)

1. Go to `https://dash.cloudflare.com/profile/api-tokens`.
2. **Create Token** → **Create Custom Token** (scroll past the templates).
3. Name it something identifiable, e.g. `glp1-fund-pages-deploy`.
4. **Permissions:** one row only — **Account** / **Cloudflare Pages** / **Edit**. Delete any other rows.
5. **Account Resources:** include only the account that owns the `glp1-fund` project.
6. **TTL:** if offered, set a finite expiry rather than leaving it immortal.
7. Continue → Create Token.
8. The token is shown **once**. Use the copy button. **Do not display it, retype it, or store it anywhere.** Go straight back to Phase 2 step 4 with it on the clipboard and paste it into the `CLOUDFLARE_API_TOKEN` field.

## PHASE 4 — Create the Pages project (only if Phase 1b found it absent)

The deploy passes `--project-name=glp1-fund` and does not create the project itself. If the project is missing, the deploy fails with a project-not-found error.

1. Go to **Compute (Workers & Pages)** → **Create** → **Pages** → **Upload assets** (the Direct Upload path, *not* "Connect to Git" — see rule 7).
2. Project name: **`glp1-fund`** exactly.
3. It may require an initial upload to create the project. If so, upload any single small placeholder file to complete creation — the real deploy in Phase 6 overwrites it entirely.
4. Confirm afterwards, in the project's **Settings → Builds**, that the **build command is empty** and the **output directory** is `public`. Correct it if not.

## PHASE 5 — KV namespace for the alert list (only if Phase 1d found them absent)

The site has one server-side feature: an email list for price-change alerts. It needs a KV namespace or its endpoint returns 503. **Everything else on the site works regardless**, so do not let this block the deploy — if it gives you trouble, note it and move on to Phase 6.

1. Go to **Storage & Databases → KV** → **Create a namespace**.
2. Create one named **`ALERTS`**.
3. Create a second named **`ALERTS_preview`** for preview deployments.
4. Go back to the `glp1-fund` Pages project → **Settings → Bindings** (or **Functions → KV namespace bindings** depending on dashboard version).
5. Add a binding for **Production**: variable name **`ALERTS`** (exactly, uppercase), pointing at the `ALERTS` namespace.
6. Add the same binding for **Preview**, pointing at `ALERTS_preview`.
7. Record both namespace IDs and show them to me at the end — they are not secret, and I need them for a config file.

## PHASE 6 — Deploy, and drive it to green

1. Go to `https://github.com/kevynsgrin-a11y/GLP-Fund/actions`.
2. Select the **Deploy to Cloudflare Pages** workflow.
3. **Run workflow** → branch `main` → **Run workflow**.
4. Watch it. Two jobs run in sequence:
   - **Verify before deploy** — unit tests, a check that generated pages match the data file, then a real-browser QA pass at a 390px viewport. Roughly 90 seconds.
   - **Deploy** — the secrets check, then the publish, then a smoke check of four URLs.
5. **Open the `Deploy` job's log and read the publish step's output even on success.** It prints a `*.pages.dev` URL. **Record it.** That URL works immediately, before any custom domain exists, and it is how you verify the site in Phase 8 if DNS is still propagating.

**You are expected to iterate here.** If it fails, diagnose from the log and fix the cause, then run it again. Keep going until it is green or until you hit one of the stop conditions below. Do not report a failure you have not tried to fix.

- **Fails at `Fail early with a useful message if secrets are missing`:** the log names which secret is empty. Return to Phase 2 for that one specifically. This is the failure you started with; if it repeats identically, you are editing the wrong secret store — re-read Phase 1a.
- **Fails inside the wrangler publish step with a project-not-found error:** the Pages project name does not match. Go to Phase 4 and check the spelling character by character against `glp1-fund`.
- **Fails inside the wrangler publish step with an authentication or authorization error:** the token lacks **Account → Cloudflare Pages → Edit**, or it was scoped to a different account than the one holding the project. Create a replacement via Phase 3.
- **Fails in `Verify before deploy`:** stop. Do not proceed, do not re-run hoping it passes, and do not modify anything. Report which step failed and paste the error. This means a real problem in the build, and deploying past it is explicitly forbidden by rule 4.
- **The final smoke check warns about non-200 responses:** expected on a first deploy, because the custom domain does not exist yet. The job still succeeds. Continue to Phase 7.

## PHASE 7 — Custom domain

1. In the `glp1-fund` Pages project → **Custom domains** → **Set up a custom domain**.
2. Add **`glp1-fund.com`**. Because the domain is registered in the same Cloudflare account, the DNS record is created automatically — **do not change nameservers**.
3. Add **`www.glp1-fund.com`** as well.
4. Wait for the certificate to issue. Usually a few minutes; it can take longer. Refresh rather than re-adding the domain.
5. **Set `www` to redirect to the apex domain**, not the reverse. The site's canonical URLs are all apex (`https://glp1-fund.com/...`). Serving both without a redirect splits search ranking across two hosts. If the Pages UI does not offer this directly, create a **Redirect Rule** under the zone's **Rules** section: match hostname `www.glp1-fund.com`, action 301 to `https://glp1-fund.com` preserving path and query.

## PHASE 8 — Verify the live site

Do these in the browser and report each result explicitly. This is an acceptance test, not a glance.

If the apex domain is not resolving yet, **run every check against the `*.pages.dev` URL you recorded in Phase 6 instead**, and say clearly which host you tested. A verified pages.dev plus a pending certificate is a real, reportable result. Claiming the apex works when you could not load it is not.

1. **`https://glp1-fund.com/`** loads and shows a heading beginning "The cheapest legal way to pay for your GLP-1".
2. **The tool works.** Select medication **Zepbound**, insurance **No insurance, paying cash**, dose **15mg**. Result cards appear below without the page navigating.
3. **No price shows a number.** Every card should read "Price not currently verified". **If you see a dollar figure anywhere in a result card, stop immediately and tell me — that is a serious defect**, not an improvement.
4. **Sources are present.** Each result card shows a "Not verified" stamp with a date, and a "Source" link.
5. **The footer disclaimer is present** on the home page, beginning "This tool provides pricing information only." Confirm there is no button or control to dismiss it.
6. **`/methodology/`** loads and shows a table of price figures with source and confidence columns.
7. **`/data/pricing.json`** returns JSON, not a 404.
8. **`/sitemap.xml`** loads and its URLs use `glp1-fund.com` — **not** `glp1pricecheck.com`. If you see the latter, an old build was deployed; report it.
9. **`https://www.glp1-fund.com/`** redirects to the apex domain.
10. **Mobile check.** Open DevTools device emulation at 390px wide, reload the home page, and confirm all three form inputs are visible without scrolling and that there is no horizontal scrollbar.
11. **Alert form.** Go to `/alerts/`, enter a real address you control, submit, and report whether it returns a success message or an error. A 503 here means the KV binding in Phase 5 did not take effect; everything else still works.

## REPORT BACK

Give me, concisely:

1. **The Phase 1 audit findings** — especially which secret store the original token turned out to be in, and the full list of Cloudflare projects with which ones were Git-connected.
2. **What you disconnected in Phase 1B**, or why you could not.
3. The live URL and whether it is serving, and whether you tested the apex domain or the pages.dev URL.
4. Pass or fail for each of the 11 checks in Phase 8, with the specific failure text for any that failed.
5. Every workflow run you triggered, its conclusion, and for any failure, the step that failed and what you changed before re-running.
6. The two KV namespace IDs from Phase 5, and the Cloudflare account ID.
7. Confirmation that the token was created and stored — **and nothing about its value**.
8. Anything you had to deviate from, and why.
9. Anything that looked wrong but that you left alone because this prompt told you not to touch it.

Do not tell me the site needs prices added. I know. That is a separate, deliberate piece of work.
