# Image manifest

Images this design pass requires but did not create.

**I generate no imagery.** The design brief said to generate none, and the
project's own non-negotiables forbid AI-generated pictures presented as real —
same credibility class as emoji. So this file specifies what is needed, at what
size, in what position, with a ready-to-paste generation prompt and the alt text
that has to be written; the owner generates the asset and drops it in.

Until then the slot is a CSS placeholder that issues no request, reserves the
identical space, and cannot shift the layout. Measured CLS on the home page is
**0.0000** with the placeholder in place (`docs/qa-report.json`), and it will
still be 0.0000 with the photograph in place, because the box is sized by CSS
rather than by the asset.

---

## IMG-01 — Homepage hero still

The only image this pass requires. Everything else on the site is drawn inline
SVG (`public/assets/js/icons.js`) or a generated share card
(`tools/build-images.mjs`).

| | |
| --- | --- |
| **Slot** | `.hero__media`, `public/index.html` — first element inside `<section class="hero">` |
| **Delivery size** | **2400 × 1350 px** |
| **Aspect ratio** | **16 : 9** — held in CSS as `--hero-media-ratio: 16 / 9` so the stylesheet and this file cannot drift |
| **Format** | AVIF with a WebP fallback; no JPEG unless the AVIF exceeds 180 KB |
| **Weight budget** | ≤ 140 KB for the AVIF. The whole page is currently 16 requests and ~270 KB; this must not double it |
| **Placement** | Absolute fill behind the headline, `object-fit: cover`, `object-position: 68% center` (held as `--hero-media-focal`) |
| **Focal point** | Right third of the frame. The headline and lede occupy the left, and the veil is at 0.985 alpha there — anything important on the left will not be seen |
| **Colour** | Must sit inside the site palette: near-black cool greys, one cool teal-grey highlight, no warm skin tones, no saturated brand colours |
| **Decorative?** | No. It carries the register, so it takes real alt text — see below |

### Why it is a still and not a photograph of a person

The brief bans stock photography of smiling people, and the section 4
non-negotiables ban AI portraits and AI product shots. A GLP-1 pen photographed
as a product hero would also read as promotional on a site whose entire claim is
that it sells nothing. What the composition needs is atmosphere behind type: a
dark, evidently-real, non-promotional still life.

### Generation prompt (paste as-is)

> A single-source studio still life, photographed on a matte charcoal seamless
> background. Subject: a plain stack of printed A4 documents, slightly fanned,
> with a stainless steel ruler laid across them at a shallow angle. Raking light
> from the upper right, hard-edged, one source, no fill — deep shadows falling to
> the left of frame. Cool colour temperature, roughly 5600K, with a faint
> blue-green cast in the shadows. Shot on a 50mm lens at f/4, focus on the ruler's
> edge, background falling gently out of focus. No text legible on the documents.
> No people, no hands, no pill bottles, no syringes, no medication, no branding,
> no logos. Editorial, forensic, unstyled. 16:9, 2400×1350.

**Rejection criteria** — send it back if any of these are true:

- any legible text, number or currency symbol appears anywhere in the frame
  (a rendered figure inside an image bypasses every one of this repo's
  verification tests, all of which read text files);
- a person, a hand, or any part of a body is visible;
- any medication, pen, vial, syringe or pharmacy packaging is visible — it would
  read as promoting a product the site ranks;
- any real or invented brand mark is visible;
- the left 45% of the frame carries the subject rather than the shadow.

### Alt text to be written by the owner

Alt text is copy, and copy on this site is the owner's. The slot is therefore:

```
[[COPY: alt text for the homepage hero still — describes what is in the frame
for someone who cannot see it, states nothing about prices, medications or
verification — max 140 characters]]
```

If the decision is that the still is purely atmospheric and carries no
information, the correct answer is `alt=""` plus `role="presentation"`, and this
slot closes with no copy written. That is a legitimate outcome, but it is a
decision, not a default.

### How to install it

1. Put the files at `public/assets/img/hero/glp1-hero-still.avif` and `.webp`.
2. In `tools/build-pages.mjs`, `buildIndex()`, replace

   ```html
   <div class="hero__media" aria-hidden="true"></div>
   ```

   with a `<picture>` carrying **explicit `width="2400" height="1350"`** and
   `fetchpriority="high"` (it is the LCP element), keeping the class on the
   `<img>`.
3. In `public/assets/css/base.css`, add to `.hero__media`:
   `object-fit: cover; object-position: var(--hero-media-focal);` and drop the
   three `background-image` gradients. Leave `position: absolute; inset: 0;`
   exactly as it is — that is what makes the swap CLS-free.
4. Re-run `node tools/build-pages.mjs`, then `node tools/qa.mjs` and confirm CLS
   is still 0.0000 and the 390×844 fold contract still passes.
5. Re-run `node tools/contrast-audit.mjs`. The headline is measured against the
   veil, not against the photograph, but a lighter still changes what the veil
   is compositing over and the table has to be re-taken.

---

## Not required

For the avoidance of doubt, this design pass introduced **no other image
dependency**. There is no icon sprite, no illustration set, no background
texture file, no logo file and no decorative asset. The three `background-image`
declarations in `base.css` are CSS gradients and reference no URL; the only
`url()` calls in the stylesheet are the two self-hosted font files.
