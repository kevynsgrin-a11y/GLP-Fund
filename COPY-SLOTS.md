# Copy slots

Every place this design pass needs words that do not already exist.

The rule this pass worked under: **every word on the site is final.** No
rewriting, no tightening, no fixing apparent errors. Verified — the visible copy
on all 19 pages is byte-identical to `main`, checked by extracting the rendered
text of every page before and after and diffing (`docs/design-pass-2026-09-15.md`,
"Copy").

So this file is short by design. A long list here would mean the pass invented
components that needed explaining, which is the failure mode the brief's ban on
eyebrow labels exists to prevent.

---

## Open slots

### COPY-01 — alt text for the homepage hero still

```
[[COPY: alt text for the homepage hero still — describes what is in the frame
for someone who cannot see it, states nothing about prices, medications or
verification — max 140 characters]]
```

- **Where:** `.hero__media`, `public/index.html`, generated from
  `tools/build-pages.mjs` → `buildIndex()`.
- **Why it is needed:** the hero carries the page's register rather than
  decorating it, so it is not automatically a `role="presentation"` image.
- **Blocked on:** IMG-01 in `IMAGE-MANIFEST.md`. The alt text cannot be written
  before the still exists, because it has to describe the frame that was
  actually generated.
- **Legitimate resolution without writing copy:** decide the still is purely
  atmospheric, ship `alt=""` with `role="presentation"`, and close this slot.
  That is a decision to record, not a default to fall into.

---

## Slots deliberately not opened

Components the Lovable file carried that would have required new words. Each was
dropped rather than filled, because a design pass that writes its own copy has
stopped being a design pass:

| Lovable component | Words it would have needed | Decision |
| --- | --- | --- |
| `.masthead__brand small` | A tagline under the wordmark | Dropped. The site has no tagline and does not need one under a name that already says what it is. |
| `.tool__head h2` (visible) | A visible heading over the three inputs | Not filled. The existing heading stays `visually-hidden`; three numbered labels already say what the form is. |
| `.live-status` | A status chip, e.g. a live-data label | Dropped. It would claim freshness the data does not currently have. |
| `.eyebrow` / `.section-kicker` | A tracked-out label above each section | Dropped — banned by the brief, and removed from CSS and markup both. |
| `.interior-hero::after` | A ghost word set in the page background (`SOURCE / DATE / CONTEXT` in the original) | Dropped. It is copy injected from a stylesheet, and it is the same all-caps template chrome the brief bans. |
| `.ledger-index` | Four big-number stat cells with captions | Dropped. No page has four headline statistics, and inventing captions for the ones it does have would be writing copy. |
| `.source-card` | A per-source card with a kicker and a status label | Dropped. No page is structured as one card per source. |
| `.ledger-filters` | Filter control labels and a result count | Dropped. Nothing on this site is filterable, and adding filters would be a feature, not a skin. |

---

## How to close a slot

1. Write the string. Keep it inside the character budget — the budget is what the
   layout was measured against.
2. Put it in `tools/build-pages.mjs`, not in the generated HTML: the HTML under
   `public/` is output and gets overwritten.
3. Run `node tools/build-pages.mjs`, then `node tools/qa.mjs`. The QA harness
   checks the 390×844 fold contract and CLS on every change, and new copy is the
   most common way to break the first of those.
