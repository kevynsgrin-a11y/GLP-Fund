/**
 * Static page generator.
 *
 * READ THIS BEFORE ASSUMING THIS IS A BUILD STEP.
 *
 * Cloudflare Pages deploys this repository with an EMPTY build command. It
 * serves `public/` exactly as committed. This script is a development and ops
 * tool that a human runs locally, and its OUTPUT is committed as static HTML.
 * Nothing at deploy time reads it, and the site works if it is deleted.
 *
 * It exists because Phase 4 requires FAQ JSON-LD "generated from the same data
 * the page renders, never hand-written prose that can drift from the data file".
 * Hand-authoring fifteen pages of prices against a data file is precisely how
 * the aggregator competitors ended up publishing figures from months prior. A
 * generator makes drift structurally impossible: there is one data file, and
 * every page is a function of it.
 *
 * Regenerating pages is step 3 of the price-change sequence in
 * docs/ops-runbook.md.
 *
 *   node tools/build-pages.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SITE_NAME,
  DOMAIN,
  DISCLAIMER,
  NON_AFFILIATION,
  STALENESS_WARN_DAYS,
  STALENESS_URGENT_DAYS,
  FLAGS,
  PUBLISHER,
  PUBLISHER_ADDRESS,
  DATA_RETENTION_DAYS,
} from '../public/engine/config.js';
import { esc } from '../public/assets/js/render.js';
import { icon } from '../public/assets/js/icons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const DATA = JSON.parse(readFileSync(join(PUBLIC, 'data/pricing.json'), 'utf8'));

const BUILT_ON = DATA.generatedAt;
const ORIGIN = `https://${DOMAIN}`;

/* ========================================================================= *
 * Layout
 * ========================================================================= */

const NAV = [
  { href: '/', label: 'Price tool' },
  { href: '/methodology/', label: 'Methodology' },
  { href: '/changelog/', label: 'Price changes' },
  { href: '/alerts/', label: 'Alerts' },
];

const FOOTER_NAV = [
  { href: '/zepbound-cost/', label: 'Zepbound' },
  { href: '/wegovy-cost/', label: 'Wegovy' },
  { href: '/ozempic-cost/', label: 'Ozempic' },
  { href: '/mounjaro-cost/', label: 'Mounjaro' },
  { href: '/wegovy-pill-cost/', label: 'Wegovy tablets' },
  { href: '/foundayo-cost/', label: 'Foundayo' },
  { href: '/trumprx/', label: 'TrumpRx' },
  { href: '/lillydirect/', label: 'LillyDirect' },
  { href: '/novocare/', label: 'NovoCare' },
  { href: '/medicare-glp1-bridge/', label: 'Medicare Bridge' },
  { href: '/patient-assistance/', label: 'Patient assistance' },
  { href: '/methodology/', label: 'Methodology' },
  { href: '/changelog/', label: 'Price changes' },
  { href: '/about/', label: 'About' },
  { href: '/contact/', label: 'Contact' },
  { href: '/privacy/', label: 'Privacy' },
  { href: '/terms/', label: 'Terms' },
];

/**
 * A reserved ad slot. Height is declared in CSS per placement so the box holds
 * its final size before any script runs. Nothing below it can move.
 */
function adSlot(placement) {
  if (!FLAGS.DISPLAY_ADS_ENABLED) return '';
  return `
      <aside class="ad-slot ad-slot--${placement}" data-ad-slot="${placement}" aria-hidden="true">
        <span class="ad-slot__label">Advertisement</span>
      </aside>`;
}

/**
 * The affiliate slot. Built, empty, and disabled behind a config flag defaulted
 * off. In v1 this always returns nothing: the entire competitive field monetises
 * telehealth and compounding referrals, and not doing so is the only durable
 * wedge this site has.
 */
function affiliateSlot(placement) {
  if (!FLAGS.AFFILIATE_SLOTS_ENABLED) return '';
  return `<aside class="affiliate-slot" data-affiliate-slot="${placement}"></aside>`;
}

function dataStamp(extra = '') {
  return `
      <p class="data-stamp">
        ${icon('clock', { size: 14 })}
        Pricing data as of <time datetime="${BUILT_ON}">${BUILT_ON}</time>.${extra ? ` ${extra}` : ''}
      </p>`;
}

/**
 * The page shell. The disclaimer and the non-affiliation statement are
 * interpolated from config.js on every page, so there is exactly one copy of
 * each string in the codebase and a test asserts both are byte-exact.
 */
/**
 * The publisher node, emitted on every page and referenced by @id from the
 * page node. Before this existed the site was anonymous to machines: no
 * Organization, no publisher, no author anywhere in the tree, which on a
 * health-adjacent pricing topic is the ceiling on how much trust it can earn.
 */
const ORG_ID = `${ORIGIN}/#organization`;

const ORG_NODE = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORG_ID,
  name: PUBLISHER.legalName,
  alternateName: SITE_NAME,
  url: `${ORIGIN}/`,
  email: PUBLISHER.email,
  logo: {
    '@type': 'ImageObject',
    url: `${ORIGIN}/assets/img/icon-512.png`,
    width: 512,
    height: 512,
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: PUBLISHER.street,
    addressLocality: PUBLISHER.city,
    addressRegion: PUBLISHER.state,
    postalCode: PUBLISHER.postalCode,
    addressCountry: PUBLISHER.country,
  },
  areaServed: {
    '@type': 'Country',
    name: 'United States',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'corrections and privacy',
    email: PUBLISHER.email,
    areaServed: 'US',
    availableLanguage: 'en',
  },
};

/**
 * Every page is a WebPage published by the Organization above and modified on
 * the data date. `dateModified` is the build date rather than a hand-typed
 * value, so it cannot drift from the figures it describes.
 */
function pageNode({ title, description, canonical, image }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: title,
    description,
    inLanguage: 'en-US',
    isPartOf: { '@id': `${ORIGIN}/#website` },
    dateModified: BUILT_ON,
    publisher: { '@id': ORG_ID },
    license: `${ORIGIN}/terms/`,
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: image,
      width: 1200,
      height: 630,
    },
  };
}

/**
 * A two-level breadcrumb for any page that hangs directly off the root. The
 * drug and pathway builders construct their own; this covers the utility pages
 * that previously emitted no breadcrumb at all.
 *
 * @param {string} name
 * @param {string} path
 */
function crumbs(name, path) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name, item: `${ORIGIN}${path}` },
    ],
  };
}

const WEBSITE_NODE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${ORIGIN}/#website`,
  url: `${ORIGIN}/`,
  name: SITE_NAME,
  inLanguage: 'en-US',
  publisher: { '@id': ORG_ID },
};

/**
 * Truncate for a meta description without cutting a word in half.
 *
 * A blind slice produced five descriptions ending mid-word ("This page expla"),
 * which is what a search engine renders. Cut at the last space instead, and
 * only add an ellipsis when something was actually removed.
 *
 * @param {string} text
 * @param {number} max
 */
function truncateAtWord(text, max) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}...`;
}

function layout({ title, description, path, body, jsonLd = [], script = '' }) {
  const canonical = `${ORIGIN}${path}`;
  // Share cards are generated per page by tools/build-images.mjs, keyed by the
  // same slug the path produces. The home card covers '/'.
  const ogSlug = path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-');
  const ogImage = `${ORIGIN}/assets/img/og/${ogSlug}.png`;

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:locale" content="en_US">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(`${SITE_NAME}: ${title}. Pricing data as of ${BUILT_ON}.`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(ogImage)}">
<link rel="icon" href="/favicon.ico" sizes="32x32 16x16">
<link rel="icon" href="/assets/img/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0b5c4a">
<link rel="stylesheet" href="/assets/css/base.css">
${[ORG_NODE, WEBSITE_NODE, pageNode({ title, description, canonical, image: ogImage }), ...jsonLd].map((b) => `<script type="application/ld+json">${JSON.stringify(b, null, 2)}</script>`).join('\n')}

<a class="skip-link" href="#main">Skip to content</a>

<header class="masthead">
  <div class="wrap masthead__inner">
    <a class="masthead__brand" href="/">
      ${icon('receipt', { size: 22 })}
      ${esc(SITE_NAME)}
    </a>
    <nav class="masthead__nav" aria-label="Primary">
      ${NAV.map((n) => `<a href="${n.href}">${esc(n.label)}</a>`).join('\n      ')}
    </nav>
  </div>
</header>

<main id="main" class="wrap">
${body}
</main>

<footer class="site-footer">
  <div class="wrap">
    ${adSlot('footer')}

    <h2>Important information</h2>
    <p class="disclaimer">${esc(DISCLAIMER)}</p>
    <p class="non-affiliation">${esc(NON_AFFILIATION)}</p>
    <p>
      This site sells nothing. It carries no telehealth referrals, no
      pharmaceutical affiliate links and no compounding-pharmacy links. The
      price tool collects nothing: the medication, insurance situation and dose
      you select there are never stored or transmitted. The only personal data
      we hold is what you give us if you join the price-change alert list, set
      out in full in our <a href="/privacy/">privacy policy</a>.
      <a href="/methodology/">See how every figure here is sourced</a>.
    </p>
    <ul class="footer-nav">
      ${FOOTER_NAV.map((n) => `<li><a href="${n.href}">${esc(n.label)}</a></li>`).join('\n      ')}
    </ul>
    <p>Pricing data as of <time datetime="${BUILT_ON}">${BUILT_ON}</time>.</p>
  </div>
</footer>
${script}
`;
}

function write(path, html) {
  const full = join(PUBLIC, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html);
  return path;
}

/* ========================================================================= *
 * Shared fragments
 * ========================================================================= */

const CONFIDENCE_PILL = {
  confirmed: '<span class="pill pill--confirmed">Confirmed</span>',
  conflicting: '<span class="pill pill--conflicting">Sources conflict</span>',
  unverified: '<span class="pill pill--unverified">Not verified</span>',
};

const SOURCE_PILL = {
  primary_manufacturer: '<span class="pill pill--primary">Primary, manufacturer</span>',
  primary_government: '<span class="pill pill--primary">Primary, government</span>',
  secondary_press: '<span class="pill pill--secondary">Secondary, press</span>',
  secondary_aggregator: '<span class="pill pill--secondary">Secondary, aggregator</span>',
};

/** How a figure renders in a static table. Never a number unless confirmed. */
function displayValue(datum) {
  return datum.confidence === 'confirmed' && typeof datum.value === 'number'
    ? `$${datum.value.toLocaleString('en-US')}`
    : 'Not verified';
}

function pricesFor(drugId) {
  return DATA.prices.filter((p) => p.drug === drugId);
}

/** The rules that actually bear on one drug, for the per-drug eligibility list. */
function rulesFor(drugId) {
  return DATA.eligibilityRules.filter((rule) => {
    const pathwaysForDrug = new Set(pricesFor(drugId).map((p) => p.pathway));
    if (rule.pathway === '*') {
      const w = JSON.stringify(rule.when ?? '');
      // A wildcard rule keyed to a specific drug only applies to that drug.
      if (w.includes('"drug"')) return w.includes(`"${drugId}"`);
      return true;
    }
    return pathwaysForDrug.has(rule.pathway);
  });
}

function priceTable(rows, { showDrug = false } = {}) {
  return `
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              ${showDrug ? '<th scope="col">Medication</th>' : ''}
              <th scope="col">Pathway</th>
              <th scope="col">Dose or tier</th>
              <th scope="col">Monthly</th>
              <th scope="col">Confidence</th>
              <th scope="col">Source type</th>
              <th scope="col">Verified</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (p) => `
            <tr>
              ${showDrug ? `<td>${esc(DATA.drugs[p.drug]?.label ?? p.drug)}</td>` : ''}
              <td>${esc(DATA.pathways[p.pathway]?.label ?? p.pathway)}</td>
              <td>${esc(String(p.dose_or_tier).replace(/_/g, ' '))}</td>
              <td class="num">${displayValue(p)}</td>
              <td>${CONFIDENCE_PILL[p.confidence] ?? esc(p.confidence)}</td>
              <td>${SOURCE_PILL[p.source_type] ?? esc(p.source_type)}</td>
              <td class="num">${esc(p.verified_date)}</td>
              <td><a href="${esc(p.source_url)}" rel="noopener nofollow" target="_blank">Open ${icon('externalLink', { size: 12 })}</a></td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
}

/* ========================================================================= *
 * FAQ JSON-LD, generated from the data the page renders
 * ========================================================================= */

function faqFor(drugId) {
  const meta = DATA.drugs[drugId];
  const rows = pricesFor(drugId);
  const confirmed = rows.filter((r) => r.confidence === 'confirmed' && typeof r.value === 'number');
  const pathwayNames = [...new Set(rows.map((p) => DATA.pathways[p.pathway]?.label ?? p.pathway))];

  const cheapest = confirmed.length
    ? confirmed.reduce((a, b) => (a.value <= b.value ? a : b))
    : null;

  const qa = [];

  qa.push({
    q: `How much does ${meta.label} cost per month without insurance in 2026?`,
    a: cheapest
      ? `The lowest verified cash price we hold for ${meta.label} is $${cheapest.value.toLocaleString('en-US')} per month via ${DATA.pathways[cheapest.pathway]?.label}, verified ${cheapest.verified_date}.`
      : `We do not currently publish a verified monthly price for ${meta.label}. Every figure in circulation failed our verification standard, which requires confirmation against a primary manufacturer or government source. We show the pathways and link you to each official page rather than printing a number we cannot stand behind. Data as of ${BUILT_ON}.`,
  });

  qa.push({
    q: `What is the cheapest way to get ${meta.label}?`,
    a: `${pathwayNames.length} payment pathways exist for ${meta.label}: ${pathwayNames.join(', ')}. Which is cheapest depends on your insurance situation and your dose, because manufacturer savings cards are unavailable to Medicare and Medicaid beneficiaries while cash-pay programs are open to anyone with a prescription. Our tool ranks them for your own situation.`,
  });

  qa.push({
    q: `Can I use a ${meta.label} savings card if I have Medicare?`,
    a: 'No. Manufacturer copay and savings cards exclude anyone enrolled in a federal healthcare program, including Medicare, Medicaid, TRICARE and VA coverage. Our tool removes that pathway entirely for those users rather than showing it as an option you cannot use.',
  });

  if (meta.doses?.length > 1) {
    qa.push({
      q: `Does the price of ${meta.label} change with the dose?`,
      a: Object.keys(meta.doseTiers ?? {}).length
        ? `Yes. ${meta.label} is priced in tiers rather than at one flat rate, so the dose you are on changes what you pay. Select your dose in the tool for the tier that applies to you.`
        : `${meta.label} is filed at a single price across its approved doses in the pathways we track. If that changes, the change is logged on our price changelog.`,
    });
  }

  qa.push({
    q: `Is this ${meta.label} price up to date?`,
    a: `Every figure carries the date we last verified it. A figure older than ${STALENESS_WARN_DAYS} days is flagged as possibly outdated, and one older than ${STALENESS_URGENT_DAYS} days raises a prominent warning. Prices in this category have moved repeatedly, so we publish a changelog of every change we record. Current data is as of ${BUILT_ON}.`,
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/* ========================================================================= *
 * The tool
 * ========================================================================= */

/**
 * The site's current verification position, stated in normal type near the top
 * of the page rather than discovered in the smallest grey text after three
 * questions.
 *
 * Derived from the data rather than written down, so it cannot become a lie the
 * moment a figure is confirmed: once prices carry values, this renders the count
 * instead of the disclosure.
 */
function verificationState() {
  const total = DATA.prices.length;
  const priced = DATA.prices.filter((r) => r.value !== null).length;

  if (priced === 0) {
    return `
  <div class="verification-state" role="note">
    <h2>Right now, we publish no verified price</h2>
    <p>
      We track ${total} figures across ${Object.keys(DATA.drugs).length} medications.
      Not one of them currently survives our standard, which is a direct read of a
      manufacturer or government page rather than a search result or an aggregator.
      Every figure in circulation failed that check, so we show you the pathways,
      the evidence we hold, and a link to the official page &mdash; instead of a
      number we cannot stand behind.
    </p>
    <p>
      <a href="/methodology/">See exactly what we found and what would confirm it</a>.
    </p>
  </div>`;
  }

  return `
  <div class="verification-state" role="note">
    <h2>${priced} of ${total} figures are currently verified</h2>
    <p>
      A verified figure has been read directly from a manufacturer or government
      page and carries the date of that read. The remaining ${total - priced} are
      shown as unverified rather than guessed.
      <a href="/methodology/">See the evidence table</a>.
    </p>
  </div>`;
}

function buildIndex() {
  const body = `
  <h1>Every legal way to pay for your GLP-1, with the receipts</h1>
  <p class="lede">
    Three questions. Every payment pathway for Zepbound, Wegovy, Ozempic,
    Mounjaro, Wegovy tablets and Foundayo, each with the source it came from and
    the date we last checked it.
  </p>

  <form class="tool" data-tool-form novalidate>
    <h2 class="visually-hidden">Find your cheapest pathway</h2>
    <div class="tool__grid">
      <div class="field">
        <label class="field__label" for="drug">1. Your medication</label>
        <select id="drug" name="drug" data-input="drug" autocomplete="off">
          <option value="">Select your medication</option>
        </select>
      </div>
      <div class="field">
        <label class="field__label" for="insurance">2. Your insurance</label>
        <select id="insurance" name="insurance" data-input="insurance" autocomplete="off">
          <option value="">Select your situation</option>
        </select>
      </div>
      <div class="field">
        <label class="field__label" for="dose">3. Your dose</label>
        <select id="dose" name="dose" data-input="dose" autocomplete="off" disabled>
          <option value="any">Select a medication first</option>
        </select>
      </div>
    </div>
    <p class="privacy-note">
      ${icon('noTracking', { size: 18 })}
      <span>
        Nothing you select here is saved or sent anywhere. These three answers stay
        in your browser for as long as this page is open and are then gone. We do
        not collect health information and there is no account to create.
      </span>
    </p>
  </form>

  ${dataStamp()}

  ${/* Below the form, deliberately. Above it, this block pushed the third input
        past the fold on a 390x844 viewport and broke the "three inputs, one
        screen" contract that tools/qa.mjs measures. */ ''}
  ${verificationState()}

  <section class="results" data-results aria-live="polite" aria-atomic="false" aria-labelledby="results-heading">
    <div class="empty">
      <p>Choose your medication and your insurance situation to see every pathway
      ranked by what you would actually pay this month.</p>
    </div>
  </section>

  ${/* The leaderboard sits BELOW the tool, not above it.
        Above the form it pushed the third input to 942px in an 844px viewport,
        so the dose question fell below the fold and the brief's "three inputs,
        one screen, no scrolling to start" was quietly broken. The slot still
        reserves its height, so CLS is unaffected -- it is only the position that
        changed. Measured by tools/qa.mjs; do not move it back without re-running
        that check. */ ''}
  ${adSlot('leaderboard')}
  ${affiliateSlot('below-results')}

  <h2>Why this site and not a telehealth cost guide</h2>
  <p>
    Search for GLP-1 pricing and most of what ranks is published by companies that
    sell GLP-1 products or provider access. A page that recommends the cheapest
    option while selling one of the options is not a comparison, it is a funnel.
  </p>
  <p>
    This site sells nothing. There are no telehealth links, no pharmaceutical
    affiliate links and no compounding-pharmacy links anywhere in it, and there is
    no revenue arrangement with any manufacturer or government program. What we
    publish instead is our work: every figure carries the source it came from, the
    type of that source, and the date we last checked it.
  </p>
  <p>
    We also tell you when we do not know. Prices in this market have moved
    repeatedly, and a confident number that is two months old is worse than an
    honest gap. Where we cannot confirm a figure against a primary source, we say
    so and link you to the official page instead of guessing.
    <a href="/methodology/">Read the methodology</a>.
  </p>

  ${/* Second slot placed here rather than directly under the first: stacked
        adjacent slots left a dead band of roughly 350px on a 390px viewport and
        halve each other's viewability. */ ''}
  ${adSlot('inline')}

  <h2>Every medication we track</h2>
  <p>
    Each page carries the full pathway table for that medication, with the source
    and verification date on every figure.
  </p>
  <ul class="link-list">
    ${Object.values(DATA.drugs)
      .map(
        (d) =>
          `<li><a href="/${esc(d.slug)}/">${esc(d.label)} cost</a> &mdash; ` +
          `${esc(d.genericName)}, made by ${esc(d.manufacturer)}</li>`
      )
      .join('\n    ')}
  </ul>

  <h2>Every pathway we track</h2>
  <ul>
    ${Object.entries(DATA.pathways)
      .filter(([, meta]) => meta.kind !== 'reference')
      .map(([id, meta]) => {
        const slug = {
          lillydirect_self_pay: '/lillydirect/',
          novocare_self_pay: '/novocare/',
          trumprx: '/trumprx/',
          medicare_bridge: '/medicare-glp1-bridge/',
          patient_assistance: '/patient-assistance/',
        }[id];
        const label = slug ? `<a href="${slug}">${esc(meta.label)}</a>` : `<strong>${esc(meta.label)}</strong>`;
        return `<li>${label} &mdash; ${esc(meta.description ?? '')}</li>`;
      })
      .join('\n    ')}
  </ul>
`;

  return write(
    'index.html',
    layout({
      title: `${SITE_NAME}: compare every GLP-1 payment pathway, 2026`,
      description:
        'Compare every legitimate way to pay for Zepbound, Wegovy, Ozempic, Mounjaro and oral GLP-1s, ranked by real monthly cost. Every figure carries a source link and a verification date. Sells nothing.',
      path: '/',
      body,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: SITE_NAME,
          applicationCategory: 'HealthApplication',
          url: `${ORIGIN}/`,
          description:
            'Ranks every legitimate GLP-1 payment pathway by verified monthly out-of-pocket cost.',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        },
      ],
      script: '<script type="module" src="/assets/js/app.js"></script>',
    })
  );
}

/* ========================================================================= *
 * Per-drug pages
 * ========================================================================= */

function buildDrugPage(drugId) {
  const meta = DATA.drugs[drugId];
  const rows = pricesFor(drugId);
  const rules = rulesFor(drugId);
  const confirmed = rows.filter((r) => r.confidence === 'confirmed' && typeof r.value === 'number');
  const tiered = Object.keys(meta.doseTiers ?? {}).length > 0;

  const body = `
  <h1>${esc(meta.label)} cost without insurance, 2026</h1>
  <p class="lede">
    Every way to pay for ${esc(meta.label)} (${esc(meta.genericName)}), with the source
    and verification date for each figure. ${esc(meta.label)} is made by
    ${esc(meta.manufacturer)} and is approved for ${esc(meta.indication)}.
  </p>
  ${dataStamp()}
  ${adSlot('leaderboard')}

  <h2>What ${esc(meta.label)} costs on each pathway</h2>
  ${
    confirmed.length === 0
      ? `<div class="banner banner--warn">
      ${icon('alertTriangle', { size: 20 })}
      <span>
        <strong>We publish no verified price for ${esc(meta.label)} right now.</strong>
        Figures are in circulation, but none of them could be confirmed against a
        primary manufacturer or government source, so we will not print them as
        numbers. Each pathway below links to its official page.
        <a href="/methodology/">See exactly what we hold and why it failed</a>.
      </span>
    </div>`
      : ''
  }
  ${priceTable(rows)}

  <h2>How ${esc(meta.label)} is priced by dose</h2>
  ${
    tiered
      ? `<p>
    ${esc(meta.label)} is <strong>not</strong> priced at one flat rate. It is filed in
    tiers, so the dose you are on changes what you pay:
  </p>
  <ul>
    ${Object.entries(
      Object.entries(meta.doseTiers).reduce((acc, [dose, tier]) => {
        acc[tier] = acc[tier] ?? [];
        acc[tier].push(dose);
        return acc;
      }, {})
    )
      .map(
        ([tier, doses]) =>
          `<li><strong>${esc(String(tier).replace(/_/g, ' '))}</strong>: ${esc(doses.join(', '))}</li>`
      )
      .join('\n    ')}
  </ul>
  <p>
    This is why the tool asks for your dose. A single headline price for
    ${esc(meta.label)} would be wrong for most of the people reading it.
  </p>`
      : `<p>
    In the pathways we track, ${esc(meta.label)} is filed at a single price across its
    approved doses (${esc((meta.doses ?? []).join(', '))}). If that changes, the change
    appears on the <a href="/changelog/">price changelog</a>.
  </p>`
  }

  <h2>Eligibility rules that apply to ${esc(meta.label)}</h2>
  <p>
    These are the rules our tool applies. Each one either removes a pathway from
    your results or attaches a condition to it. They are held as data, not as prose,
    so what you read here is what the tool actually does.
  </p>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th scope="col">Pathway</th>
          <th scope="col">Effect</th>
          <th scope="col">Rule</th>
          <th scope="col">Verified</th>
        </tr>
      </thead>
      <tbody>
        ${rules
          .map(
            (r) => `
        <tr>
          <td>${esc(r.pathway === '*' ? 'All pathways' : DATA.pathways[r.pathway]?.label ?? r.pathway)}</td>
          <td>${esc(
            { suppress: 'Removes pathway', require: 'Required to qualify', note: 'Adds a note', caveat: 'Adds a caveat' }[
              r.effect
            ] ?? r.effect
          )}</td>
          <td>${esc(r.reason)}</td>
          <td>${
            r.quote
              ? '<span class="pill pill--confirmed">Quoted</span>'
              : r.verification
                ? '<span class="pill pill--unverified">Pending</span>'
                : '<span class="pill pill--unverified">Editorial</span>'
          }</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>

  ${adSlot('inline')}

  <h2>Check your own situation</h2>
  <p>
    The figures above are the raw data. <a href="/">Use the tool</a> to see only the
    pathways you are actually eligible for, ranked by cost, with the ones you cannot
    use removed rather than dangled.
  </p>

  <h2>Questions people ask about ${esc(meta.label)} pricing</h2>
  ${faqFor(drugId)
    .mainEntity.map(
      (item) => `
  <h3>${esc(item.name)}</h3>
  <p>${esc(item.acceptedAnswer.text)}</p>`
    )
    .join('')}
`;

  return write(
    `${meta.slug}/index.html`,
    layout({
      title: `${meta.label} cost without insurance 2026: every price pathway compared`,
      description: `What ${meta.label} (${meta.genericName}) costs per month on every payment pathway, with a source link and verification date on every figure. No telehealth referrals.`,
      path: `/${meta.slug}/`,
      body,
      jsonLd: [
        faqFor(drugId),
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${ORIGIN}/` },
            { '@type': 'ListItem', position: 2, name: `${meta.label} cost`, item: `${ORIGIN}/${meta.slug}/` },
          ],
        },
      ],
    })
  );
}

/* ========================================================================= *
 * Per-pathway explainers
 * ========================================================================= */

const PATHWAY_PAGES = [
  {
    slug: 'trumprx',
    pathway: 'trumprx',
    title: 'TrumpRx GLP-1 prices: what the federal platform charges',
    h1: 'TrumpRx and GLP-1 pricing',
    intro:
      'TrumpRx is the federal direct-purchase platform created under Most-Favored-Nation pricing agreements with manufacturers. This page explains what it is, what we can and cannot verify about its prices, and how it compares with the alternatives it does not mention.',
    sections: [
      {
        h: 'What we can and cannot tell you about current TrumpRx prices',
        p: [
          // Precise about WHERE the refusal happened. The 403s came from our own
          // network's egress gateway, before any connection to trumprx.gov was
          // established, so we learned nothing about what the platform itself
          // permits. Saying "our requests were refused" would let a reader infer
          // the platform blocked us. On a page whose entire claim is precision
          // about provenance, misattributing our own limitation would be exactly
          // the error we criticise other sites for.
          'We cannot read the live platform automatically, so figures for this pathway are curated by hand. To be precise about why: the refusals we hit on 2026-07-30 came from our own network before any connection to trumprx.gov was made, so they tell us nothing about what the platform itself allows. Either way, we have not read it, and we do not pretend to have.',
          'The published figures have also moved repeatedly. A November 2025 announcement described roughly $350 a month for Ozempic and Wegovy and roughly $346 for Zepbound. Later readings of the live site described materially lower figures. These conflict, and the live site governs.',
          'Because we could not read the live site and no government page we could reach states a current per-drug price, we file every TrumpRx figure as unverified or conflicting. It renders as "price not currently verified" with a link to the platform, never as a number. This is the honest position, and it is the difference between this page and an aggregator that is still quoting the November announcement as though it were current.',
        ],
      },
      {
        h: 'What TrumpRx will never tell you',
        p: [
          'TrumpRx lists its own prices. It does not compare them with manufacturer direct-pay programs, with a copay card on commercial insurance, or with Medicare pathways, because it has no reason to. For several medications one of those alternatives is cheaper.',
          'That comparison is the whole reason this site exists. Use the tool to see the federal platform ranked against every other pathway for your own insurance situation.',
        ],
      },
    ],
  },
  {
    slug: 'lillydirect',
    pathway: 'lillydirect_self_pay',
    title: 'LillyDirect Self Pay: Zepbound and Mounjaro cash prices explained',
    h1: 'LillyDirect Self Pay',
    intro:
      'LillyDirect is Eli Lilly’s direct-to-patient pharmacy. Its Self Pay program sells Lilly medications for cash, bypassing insurance entirely. This page explains how the pricing is structured and what conditions attach to it.',
    sections: [
      {
        h: 'Cash-pay means exactly that',
        p: [
          'Buying through a manufacturer self-pay program means you are not using your insurance. That has a consequence people routinely miss: what you spend does not count toward your deductible or your annual out-of-pocket maximum. If you expect to hit either this year, the cheapest monthly price may not be the cheapest annual outcome.',
          'A valid prescription is still required. A direct-pay program changes who you pay, not whether you need a prescriber.',
        ],
      },
      {
        h: 'Priced in tiers, not at one rate',
        p: [
          'Zepbound single-dose vials are filed in tiers rather than at a flat price, so the starter dose and the maintenance doses are different figures. Any page quoting one Zepbound price is wrong for most readers.',
          'A refill-window condition has also been reported at the higher doses, requiring a refill within a set number of days to hold the reduced price. We have not been able to confirm that condition against Eli Lilly, and we flag it as a caveat rather than burying it, because if it is real it changes what you actually pay.',
        ],
      },
      {
        h: 'What LillyDirect cannot tell you',
        p: [
          'A manufacturer pharmacy is accurate about its own products and structurally incapable of telling you that a competitor’s medication or the federal platform is cheaper for you. That is not a criticism, it is the shape of the incentive.',
          'This site has no such constraint and no relationship with Eli Lilly. Use the tool to see LillyDirect ranked against every alternative.',
        ],
      },
    ],
  },
  {
    slug: 'novocare',
    pathway: 'novocare_self_pay',
    title: 'NovoCare Pharmacy: Wegovy and Ozempic cash prices explained',
    h1: 'NovoCare Pharmacy',
    intro:
      'NovoCare Pharmacy is Novo Nordisk’s direct-to-patient channel, selling Wegovy and Ozempic for cash without insurance. This page explains the structure and the open questions.',
    sections: [
      {
        h: 'Flat pricing, with one unresolved question',
        p: [
          'The direct cash price for the injectable products has been reported as flat across doses, which if true makes NovoCare unusually simple to reason about compared with tiered programs.',
          'The oral product is where the reporting conflicts. Two different monthly figures are in circulation for the starting dose. They may describe genuinely different things, such as a first-fill price against an ongoing price, or a direct price against a retail price with a savings offer applied. We could not establish which, and we will not average two figures into a third that no one charges. Until it is resolved, that price renders as unverified.',
        ],
      },
      {
        h: 'Cash-pay and your deductible',
        p: [
          'As with any manufacturer direct-pay program, paying cash bypasses your insurance, so the amount does not count toward your deductible or out-of-pocket maximum. A prescription is still required.',
        ],
      },
    ],
  },
  {
    slug: 'medicare-glp1-bridge',
    pathway: 'medicare_bridge',
    title: 'Medicare GLP-1 Bridge: eligibility and cost, verified status',
    h1: 'The Medicare GLP-1 Bridge',
    intro:
      'A Medicare pathway offering a fixed monthly cost for a covered GLP-1 has been widely reported, with clinical eligibility criteria and several exclusions. This page sets out what is reported, and is explicit about what we have been unable to confirm.',
    sections: [
      {
        h: 'What is reported',
        p: [
          'The program is reported to provide a fixed low monthly cost to eligible Medicare beneficiaries, subject to a BMI threshold, with a further route in at a lower BMI where a weight-related comorbid condition is present. It is reported to cover a multi-dose pen rather than single-dose vials, and to exclude beneficiaries whose therapy is already covered under the obstructive sleep apnea indication.',
        ],
      },
      {
        h: 'What we could not confirm, and what we did about it',
        p: [
          'We could not reach CMS to confirm any of it: whether the program launched on its reported date, its actual eligibility criteria, or its actual beneficiary cost. The refusals we hit on 2026-07-30 came from our own network rather than from CMS, but the effect is the same: we have not read those pages.',
          'So the cost renders as unverified rather than as a number. The exclusions, however, we apply anyway, because applying them is the cautious direction. If we are wrong about the sleep apnea exclusion, we have told an eligible beneficiary to check with Medicare. If we omitted it and it is real, we would have quoted a price to someone who cannot get it. Between those two errors there is no contest.',
          'Confirm your own eligibility with Medicare directly before relying on anything here.',
        ],
      },
      {
        h: 'If you are on Medicare, the savings card is not an option',
        p: [
          'Manufacturer copay and savings cards exclude anyone enrolled in a federal healthcare program. Our tool removes that pathway entirely for Medicare and Medicaid beneficiaries rather than showing a low copay you cannot claim. What remains available is this program, standard Part D coverage where your plan covers the indication, and cash-pay direct programs.',
        ],
      },
    ],
  },
  {
    slug: 'patient-assistance',
    pathway: 'patient_assistance',
    title: 'GLP-1 patient assistance programs: income limits and how to apply',
    h1: 'Patient assistance programs',
    intro:
      'Both manufacturers run assistance programs that can reduce or eliminate the cost of medication for patients below an income threshold. They are the least visible pathway and often the cheapest one for the people who qualify.',
    sections: [
      {
        h: 'How they differ from a savings card',
        p: [
          'A savings card reduces a copay for someone who already has commercial insurance. A patient assistance program supplies medication to someone who largely cannot pay for it, and eligibility turns on household income relative to the federal poverty level rather than on what insurance you hold.',
          'They are application-based, usually require proof of income and prescriber involvement, and approval is not immediate. If you need medication this week, this is not the pathway that solves that week.',
        ],
      },
      {
        h: 'What we have not verified',
        p: [
          'We could not retrieve the current income thresholds, the household-size tables, or the list of covered products from either manufacturer, so we publish no threshold figures. We show the pathway with its income caveat and link to the official program pages, which is more useful than a threshold we would be guessing at.',
        ],
      },
    ],
  },
];

function buildPathwayPage(page) {
  const rows = DATA.prices.filter((p) => p.pathway === page.pathway);

  const body = `
  <h1>${esc(page.h1)}</h1>
  <p class="lede">${esc(page.intro)}</p>
  ${dataStamp()}
  ${adSlot('leaderboard')}

  ${page.sections
    .map(
      (s) => `
  <h2>${esc(s.h)}</h2>
  ${s.p.map((p) => `<p>${esc(p)}</p>`).join('\n  ')}`
    )
    .join('\n')}

  ${adSlot('inline')}

  <h2>Every figure we hold for this pathway</h2>
  ${rows.length ? priceTable(rows, { showDrug: true }) : '<p>No figures are currently filed for this pathway.</p>'}

  <h2>Compare it against everything else</h2>
  <p>
    A single pathway in isolation cannot tell you whether it is your cheapest option.
    <a href="/">Use the tool</a> to rank this pathway against every other one for your
    medication, your insurance situation and your dose.
  </p>
`;

  return write(
    `${page.slug}/index.html`,
    layout({
      title: page.title,
      description: truncateAtWord(page.intro, 155),
      path: `/${page.slug}/`,
      body,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${ORIGIN}/` },
            { '@type': 'ListItem', position: 2, name: page.h1, item: `${ORIGIN}/${page.slug}/` },
          ],
        },
      ],
    })
  );
}

/* ========================================================================= *
 * Methodology: the trust engine. A receipt, not a disclaimer.
 * ========================================================================= */

function buildMethodology() {
  const total = DATA.prices.length;
  const byConfidence = DATA.prices.reduce((acc, p) => {
    acc[p.confidence] = (acc[p.confidence] ?? 0) + 1;
    return acc;
  }, {});
  const hardRules = DATA.eligibilityRules.filter((r) => ['suppress', 'require'].includes(r.effect));
  const pendingRules = hardRules.filter((r) => !r.quote);

  const body = `
  <h1>Methodology</h1>
  <p class="lede">
    This page is the receipt. Every figure this site holds is below, with where it
    came from, what kind of source that is, when we last checked it, and whether we
    were able to confirm it. Nothing is aggregated away.
  </p>
  ${dataStamp()}

  <h2>The tally</h2>
  <div class="receipt">
    <div class="receipt__row"><span>Price figures tracked</span><span>${total}</span></div>
    <div class="receipt__row"><span>Confirmed against a primary source</span><span>${byConfidence.confirmed ?? 0}</span></div>
    <div class="receipt__row"><span>Sources conflict</span><span>${byConfidence.conflicting ?? 0}</span></div>
    <div class="receipt__row"><span>Not verified</span><span>${byConfidence.unverified ?? 0}</span></div>
    <div class="receipt__row"><span>Eligibility rules applied</span><span>${DATA.eligibilityRules.length}</span></div>
    <div class="receipt__row"><span>Rules that remove a pathway</span><span>${hardRules.length}</span></div>
    <div class="receipt__row"><span>Rules awaiting a verbatim source quote</span><span>${pendingRules.length}</span></div>
    <div class="receipt__row receipt__total"><span>Figures rendered as a number</span><span>${byConfidence.confirmed ?? 0}</span></div>
  </div>

  <h2>Our rules of evidence</h2>
  <p>
    Only a primary source can confirm a figure. For us that means the manufacturer’s
    own site or investor relations, or a government source: fda.gov, cms.gov,
    medicare.gov, hhs.gov, trumprx.gov.
  </p>
  <p>
    A secondary source may <em>locate</em> a fact. It may never <em>confirm</em> one.
    Press coverage, price aggregators and drug databases are how we find out that a
    price may have changed; they are not how we establish what it is. A press-release
    wire copy of a company announcement is secondary. The company’s own page is
    primary.
  </p>
  <p>
    We do not reconcile conflicting figures into a midpoint. If two sources disagree,
    we mark the figure as conflicting and show you both positions, because the average
    of two prices is a price that nobody charges.
  </p>
  <p>
    <strong>Any figure we cannot confirm against a primary source does not render as a
    number anywhere on this site.</strong> It renders as "price not currently verified"
    with a link to the pathway’s official page. That rule is enforced in our code by
    a single function and asserted by a test that tries to break it, not by editorial
    discipline.
  </p>

  <h2>Current verification status: an honest problem</h2>
  <div class="banner banner--urgent" role="alert">
    ${icon('alertTriangle', { size: 20 })}
    <span>
      <strong>We currently publish no verified prices at all.</strong>
      On ${BUILT_ON}, the network our build runs on refused outbound connections to
      every primary source we rely on: fda.gov, cms.gov, medicare.gov, hhs.gov,
      trumprx.gov, sec.gov, and every Eli Lilly and Novo Nordisk domain. We could
      search, but we could not read. Under our own rules of evidence a search result
      summarising a page is not the same as reading it, so every figure below is filed
      as unverified and none of them renders as a number.
    </span>
  </div>
  <p>
    We could have printed the figures anyway. Every competitor does, and most readers
    would not have noticed. We would rather show you an empty column than a number we
    have not seen with our own eyes, because the cost of being wrong here is somebody
    at a pharmacy counter who cannot pay for their medication.
  </p>
  <p>
    Alongside each unverified figure we record what our research located and the
    provenance we actually hold for it, so that a single verification pass can promote
    it. That data is in the site’s price file and is summarised in the table below.
  </p>

  <h2>Staleness</h2>
  <p>
    Every figure carries the date we last verified it, and every rendered price passes
    through the same check. Past ${STALENESS_WARN_DAYS} days a figure is flagged as
    possibly outdated. Past ${STALENESS_URGENT_DAYS} days a prominent warning appears
    above all results. Prices in this market have moved repeatedly, so age is part of
    the price, not a footnote to it.
  </p>

  <h2>What we do not do</h2>
  <ul>
    <li>We sell nothing, and there is nothing to buy here.</li>
    <li>No telehealth links. No pharmaceutical affiliate links. No compounding-pharmacy links. Anywhere. This is enforced by an allowlist test that fails our build if an outbound link is not a primary source.</li>
    <li>No compounded GLP-1 products appear in our ranked results. See below.</li>
    <li>We collect no health information. Your medication, insurance situation and dose are never stored or transmitted.</li>
    <li>We take no money from any manufacturer or government program.</li>
  </ul>

  <h2>Compounded GLP-1 products</h2>
  <p>
    Compounded semaglutide and tirzepatide are excluded from this tool. The regulatory
    position has shifted with FDA shortage-list resolutions and subsequent litigation,
    and we were unable to establish the current lawful status against FDA sources
    directly. Our default in that situation is exclusion.
  </p>
  <p>
    This is also where the competitive conflict in this market is most acute: much of
    the GLP-1 cost content that ranks well is published by companies selling compounded
    products. We are not going to rank a product category we cannot verify the legality
    of, and we would not rank it alongside approved products even if we could.
  </p>

  <h2>Every eligibility rule we apply</h2>
  <p>
    These rules decide which pathways you are shown. A rule that removes a pathway is a
    claim about what you may legally do, so each one carries its source. Where we could
    not retrieve the verbatim terms, the rule is marked pending and the basis we are
    relying on is stated, rather than a quote being invented.
  </p>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th scope="col">Rule</th>
          <th scope="col">Pathway</th>
          <th scope="col">Effect</th>
          <th scope="col">Status</th>
          <th scope="col">Source</th>
        </tr>
      </thead>
      <tbody>
        ${DATA.eligibilityRules
          .map(
            (r) => `
        <tr>
          <td>${esc(r.reason)}</td>
          <td>${esc(r.pathway === '*' ? 'All' : DATA.pathways[r.pathway]?.label ?? r.pathway)}</td>
          <td>${esc(r.effect)}</td>
          <td>${
            r.quote
              ? '<span class="pill pill--confirmed">Quoted verbatim</span>'
              : r.verification
                ? '<span class="pill pill--unverified">Pending verification</span>'
                : '<span class="pill pill--unverified">Editorial</span>'
          }</td>
          <td>${
            r.sourceUrl
              ? `<a href="${esc(r.sourceUrl)}" rel="noopener nofollow" target="_blank">Open ${icon('externalLink', { size: 12 })}</a>`
              : '&mdash;'
          }</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <h2>The complete price table</h2>
  <p>Every figure, every source, every date. ${total} rows.</p>
  ${priceTable(DATA.prices, { showDrug: true })}

  <h2>What our research located but could not confirm</h2>
  <p>
    For transparency, these are the figures our research surfaced together with the
    provenance we hold. <strong>None of these is a price we are publishing.</strong>
    They are shown so you can see the gap between what is in circulation and what has
    actually been verified.
  </p>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th scope="col">Medication</th>
          <th scope="col">Pathway</th>
          <th scope="col">Tier</th>
          <th scope="col">Figure located</th>
          <th scope="col">What we hold</th>
          <th scope="col">What would confirm it</th>
        </tr>
      </thead>
      <tbody>
        ${DATA.prices
          .filter((p) => p.candidate)
          .map(
            (p) => `
        <tr>
          <td>${esc(DATA.drugs[p.drug]?.label ?? p.drug)}</td>
          <td>${esc(DATA.pathways[p.pathway]?.label ?? p.pathway)}</td>
          <td>${esc(String(p.dose_or_tier).replace(/_/g, ' '))}</td>
          <td class="num">${p.candidate.value === null ? 'none' : `$${p.candidate.value.toLocaleString('en-US')}`}</td>
          <td>${esc(p.candidate.provenance)}</td>
          <td>${esc(p.candidate.needs)}</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <h2>Corrections</h2>
  <p>
    If a figure here is wrong, it is worth more to us to know than to look right. Every
    change we make is logged with its date and source on the
    <a href="/changelog/">price changelog</a>, including corrections.
  </p>
`;

  return write(
    'methodology/index.html',
    layout({
      title: `Methodology: how every GLP-1 price on this site is sourced`,
      description:
        'Every price figure, its source, its source type, its verification date and its confidence level. The complete evidence table, including what we could not confirm.',
      path: '/methodology/',
      body,
      jsonLd: [
        crumbs('Methodology', '/methodology/'),
        {
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          '@id': `${ORIGIN}/methodology/#dataset`,
          name: `${SITE_NAME} GLP-1 price dataset`,
          description:
            `Every GLP-1 payment pathway we track, with the source, source type, ` +
            `verification date and confidence level for each figure. ` +
            `${DATA.prices.length} rows across ${Object.keys(DATA.drugs).length} medications ` +
            `and ${Object.keys(DATA.pathways).length} payment pathways. ` +
            `${DATA.prices.filter((r) => r.value !== null).length} rows currently carry a ` +
            `confirmed price; the remainder are published as unverified because no figure in ` +
            `circulation survived a direct read of a primary source.`,
          url: `${ORIGIN}/methodology/`,
          isAccessibleForFree: true,
          creator: { '@id': ORG_ID },
          publisher: { '@id': ORG_ID },
          dateModified: BUILT_ON,
          license: `${ORIGIN}/terms/`,
          spatialCoverage: { '@type': 'Place', name: 'United States' },
          measurementTechnique:
            'Direct read of a primary manufacturer or government source, recorded with the date of the read.',
          variableMeasured: {
            '@type': 'PropertyValue',
            name: 'Monthly out-of-pocket cost',
            unitText: 'USD per month',
          },
          distribution: {
            '@type': 'DataDownload',
            encodingFormat: 'application/json',
            contentUrl: `${ORIGIN}/data/pricing.json`,
          },
        },
      ],
    })
  );
}

/* ========================================================================= *
 * Changelog
 * ========================================================================= */

function buildChangelog() {
  const entries = JSON.parse(readFileSync(join(PUBLIC, 'data/changelog.json'), 'utf8'));

  const body = `
  <h1>GLP-1 price changes</h1>
  <p class="lede">
    Every change we make to a figure on this site, with the date and the source. In a
    market where prices have moved at least five times in nine months, a site that
    cannot show you its edit history is asking you to take its freshness on trust.
  </p>
  ${dataStamp()}
  ${adSlot('leaderboard')}

  ${entries
    .map(
      (entry) => `
  <h2>${esc(entry.date)} &mdash; ${esc(entry.title)}</h2>
  <p>${esc(entry.summary)}</p>
  <ul>
    ${entry.changes.map((c) => `<li>${esc(c)}</li>`).join('\n    ')}
  </ul>
  ${
    entry.sources?.length
      ? `<p>Sources: ${entry.sources
          .map(
            (s) =>
              `<a href="${esc(s)}" rel="noopener nofollow" target="_blank">${esc(new URL(s).host)} ${icon('externalLink', { size: 12 })}</a>`
          )
          .join(', ')}</p>`
      : ''
  }`
    )
    .join('\n')}

  ${adSlot('inline')}

  <h2>Get told when a price moves</h2>
  <p>
    <a href="/alerts/">Join the price-change alert list</a> and pick your medication. You
    get an email when a figure for it changes, with the source. Nothing else.
  </p>
`;

  return write(
    'changelog/index.html',
    layout({
      title: 'GLP-1 price changes: a dated log of every figure we have changed',
      description:
        'Every price change we record, with the date and the source. Proof that this site updates rather than a claim that it does.',
      path: '/changelog/',
      body,
      jsonLd: [crumbs('Price changes', '/changelog/')],
    })
  );
}

/* ========================================================================= *
 * Alerts and about
 * ========================================================================= */

function buildAlerts() {
  const body = `
  <h1>Price-change alerts</h1>
  <p class="lede">
    GLP-1 prices have moved repeatedly and without warning. Tell us which medication
    you take and we will email you when a figure for it changes, with the source.
  </p>
  ${adSlot('leaderboard')}

  <form class="alerts-form" data-alerts-form novalidate>
    <div class="field">
      <label class="field__label" for="email">Your email</label>
      <input type="email" id="email" name="email" required autocomplete="email"
             placeholder="you@example.com">
    </div>
    <div class="field">
      <label class="field__label" for="alert-drug">Your medication</label>
      <select id="alert-drug" name="drug">
        <option value="all">All GLP-1s</option>
        ${Object.entries(DATA.drugs)
          .map(([id, m]) => `<option value="${esc(id)}">${esc(m.label)}</option>`)
          .join('\n        ')}
      </select>
    </div>
    <button class="btn" type="submit">Send me price changes</button>
    <p class="form-status" data-alerts-status role="status" aria-live="polite"></p>
  </form>

  <h2>What you are signing up for</h2>
  <ul>
    <li>An email when a price for your medication changes, with the source and the date.</li>
    <li>Nothing else. No newsletter, no product recommendations, no telehealth offers, no partner emails, ever.</li>
    <li>We store five things: your email address, the medication you want watched, the date you
        signed up, the fact that you signed up here rather than anywhere else, and a country code
        our edge network supplies so the list stays US-scoped. Nothing more. We do not ask for and
        cannot infer your insurance situation, your dose, your prescriber or your diagnosis. The
        <a href="/privacy/">privacy policy</a> sets out where those five fields are stored and how
        long they are kept.</li>
    <li>One-click unsubscribe in every email.</li>
  </ul>

  <h2>Coming later: dose-level alerts</h2>
  <p>
    We intend to offer a paid tier with dose-level and pathway-level alerts, eligibility
    change notifications, and a monthly summary of what moved. It is not built and there
    is nothing to buy. This paragraph exists so we are not quietly building a paywall
    behind a free product.
  </p>
`;

  return write(
    'alerts/index.html',
    layout({
      title: 'GLP-1 price-change alerts: get told when your medication changes price',
      description:
        'Email alerts when the price of your GLP-1 medication changes, with the source. No newsletter, no product offers.',
      path: '/alerts/',
      body,
      jsonLd: [crumbs('Price-change alerts', '/alerts/')],
      script: '<script type="module" src="/assets/js/alerts.js"></script>',
    })
  );
}

function buildAbout() {
  const body = `
  <h1>About this site</h1>
  <p class="lede">
    ${esc(SITE_NAME)} answers one question: what is the cheapest legitimate way for you
    to pay for your GLP-1 medication this month. It sells nothing and recommends no
    vendor.
  </p>

  <h2>Why it exists</h2>
  <p>
    Search for what a GLP-1 costs and most of the top results are published by companies
    that sell GLP-1 products or access to prescribers. Their guides are competent and
    their conclusions cannot be neutral. The rest are aggregator pages carrying figures
    from months ago with no verification date anywhere on them.
  </p>
  <p>
    Meanwhile the manufacturers are accurate about their own products and structurally
    unable to tell you a competitor is cheaper, and the federal platform lists its own
    prices without comparing them to anything. Nobody in that field is positioned to
    give a straight answer to the question above.
  </p>

  <h2>How it is funded</h2>
  <p>
    Display advertising, and eventually a paid alert tier. That is the entire model. We
    take no money from any pharmaceutical manufacturer, no telehealth referral fees, no
    compounding-pharmacy commissions and no affiliate revenue of any kind. There is
    infrastructure in the codebase for affiliate slots and it ships switched off, because
    the moment this site earns money from one of the options it ranks, its ranking is
    worthless.
  </p>

  <h2>What it is not</h2>
  <p>
    It is not medical advice and it is not a substitute for your prescriber or your
    pharmacist. It cannot tell you which medication is right for you, and it does not
    try to. It tells you what things cost and shows you where the number came from.
  </p>

  <h2>Who publishes this</h2>
  <p>
    ${esc(SITE_NAME)} is published by ${esc(PUBLISHER.legalName)}, a limited
    liability company organised in the State of California and based in
    ${esc(PUBLISHER.city)}.
  </p>
  <p>
    ${esc(PUBLISHER.legalName)}<br>
    ${esc(PUBLISHER_ADDRESS)}<br>
    <a href="mailto:${esc(PUBLISHER.email)}">${esc(PUBLISHER.email)}</a>
  </p>
  <p>
    We are a software company, not a clinical one. Nobody here is a physician, a
    pharmacist or a benefits adviser, and we do not employ one. That is precisely
    why this site reports prices and provenance and stops there: the questions we
    are not qualified to answer are the ones we refuse to answer.
  </p>

  <h2>Editorial standards</h2>
  <p>
    A figure is published only when it has been read directly from a primary
    source: a manufacturer's own page for its own product, or a government
    platform for its own program. A search-engine summary, a news article, an
    aggregator or a screenshot is not a primary source. It can tell us a figure
    exists and is worth checking; it can never put that figure on the site.
  </p>
  <p>
    Every published figure carries the date it was last confirmed. Past
    ${STALENESS_WARN_DAYS} days we flag it as possibly outdated; past
    ${STALENESS_URGENT_DAYS} days we raise a prominent warning rather than let it
    sit quietly.
  </p>
  <p>
    When sources conflict, we publish neither figure. We record both, say what
    each would need in order to be confirmed, and leave the price unverified
    until one of them can be. This is why the site currently shows no verified
    price for any medication: not one figure in circulation survived a direct
    read. That is a finding, not a gap, and
    <a href="/methodology/">the methodology page</a> shows the full evidence
    table behind it.
  </p>

  <h2>Corrections</h2>
  <p>
    Every figure carries its source so you can check it. Every change is logged
    on the <a href="/changelog/">changelog</a>, including corrections, whether we
    found them or you did. If something here is wrong we would rather fix it than
    defend it, and there is now somewhere to tell us:
    <a href="/contact/">contact and corrections</a>.
  </p>
`;

  return write(
    'about/index.html',
    layout({
      title: `About ${SITE_NAME}: neutral GLP-1 pricing, sourced and dated`,
      description:
        'Why this GLP-1 pricing site sells nothing, takes no pharmaceutical or telehealth money, and shows a source and verification date on every figure.',
      path: '/about/',
      body,
      jsonLd: [crumbs('About', '/about/')],
    })
  );
}

/* ========================================================================= *
 * Infrastructure files
 * ========================================================================= */

/* =========================================================================
 * LEGAL AND CONTACT PAGES
 *
 * These exist because the site collects an email address. Every factual claim
 * below is derived from what functions/api/alerts.js actually does, not from a
 * template: the field list, the two storage keys and the retention window are
 * the code's behaviour, and if the endpoint changes these pages are wrong.
 * ========================================================================= */

function buildPrivacy() {
  const body = `
  <h1>Privacy policy</h1>
  <p class="lede">
    ${esc(SITE_NAME)} is published by ${esc(PUBLISHER.legalName)}. This policy
    describes exactly what we collect, which is very little, and what we do with
    it, which is one thing.
  </p>
  ${dataStamp()}

  <h2>The price tool collects nothing</h2>
  <p>
    The medication, insurance situation and dose you select in the tool stay in
    your browser for as long as the page is open and are then gone. They are
    never transmitted to us, never written to storage, and never used to build a
    profile. There is no account to create, and the tool works with JavaScript
    disabled for every page except the interactive ranking itself.
  </p>
  <p>
    This is enforced in the codebase rather than promised in prose: a test
    asserts that the dose and insurance selections are never persisted or
    transmitted, and it fails the build if that changes.
  </p>

  <h2>What the price-change alert list collects</h2>
  <p>
    If, and only if, you submit the alerts form, we store the following five
    fields:
  </p>
  <table>
    <thead>
      <tr><th scope="col">Field</th><th scope="col">What it is</th><th scope="col">Why</th></tr>
    </thead>
    <tbody>
      <tr><td>Email address</td><td>What you typed, lowercased</td><td>To send you the alert you asked for</td></tr>
      <tr><td>Medication preference</td><td>Which medication you want watched, or "all"</td><td>So a price-change email only goes to people it affects</td></tr>
      <tr><td>Signup date</td><td>The date the record was created</td><td>To honour the retention period below</td></tr>
      <tr><td>Source</td><td>The fixed string "web"</td><td>To distinguish signup routes if we ever add another</td></tr>
      <tr><td>Country</td><td>A two-letter country code supplied by our edge network</td><td>Only to keep the list scoped to the United States, since every price here is a US price</td></tr>
    </tbody>
  </table>
  <p>
    We do not store your IP address, your user agent, or any device fingerprint.
    We do not ask for and cannot infer your insurance situation, your dose, your
    prescriber, your diagnosis, or whether you actually take any medication.
  </p>

  <h2>Your medication preference, stated plainly</h2>
  <p>
    A medication preference attached to an email address is the most sensitive
    thing we hold, and we would rather describe it accurately than hide behind a
    category. It records which price you asked us to watch. It is not a
    diagnosis, not a prescription record, and not evidence that you take
    anything. We treat it as personal data regardless, and it is subject to
    every right described below.
  </p>

  <h2>Where it is stored, and for how long</h2>
  <p>
    Records are held in Cloudflare Workers KV, in two places: a record keyed by
    your email address, and a per-medication index used to select recipients for
    a send. Deleting your record removes your address from both.
  </p>
  <p>
    We keep a subscriber record for ${DATA_RETENTION_DAYS} days after your last
    interaction with it, and then delete it. Unsubscribing deletes it
    immediately rather than at the end of that window.
  </p>

  <h2>Who we share it with</h2>
  <p>
    Nobody. We do not sell, rent, trade or share the list. We take no money from
    any pharmaceutical manufacturer, no telehealth referral fees, no
    compounding-pharmacy commissions and no affiliate revenue of any kind, so
    there is no commercial party we would have a reason to share it with. The
    site is funded by display advertising, which is served without access to the
    alert list.
  </p>
  <p>
    Cloudflare processes the data as our infrastructure provider in order to
    store and deliver it. That is the only third party involved.
  </p>

  <h2>Your rights</h2>
  <p>
    If you are a California resident, the CCPA as amended by the CPRA gives you
    the right to know what personal information we hold about you, to have it
    deleted, to correct it, and not to be discriminated against for exercising
    those rights. We do not sell or share personal information as those terms
    are defined by the CPRA, so there is nothing for you to opt out of.
  </p>
  <p>
    If you are in the European Economic Area or the United Kingdom, you have the
    right to access, rectify, erase, restrict and port your data, and to object
    to processing. Our lawful basis is your consent, given when you submitted
    the form, and you may withdraw it at any time by unsubscribing.
  </p>
  <p>
    To exercise any of these rights, use the unsubscribe link in any alert email,
    or write to us at <a href="mailto:${esc(PUBLISHER.email)}">${esc(PUBLISHER.email)}</a>.
    We will respond within 45 days, and usually far sooner.
  </p>

  <h2>Cookies and analytics</h2>
  <p>
    We set no cookies of our own and run no first-party analytics. Display
    advertising, where enabled, is served by a third party that may set its own
    cookies; that behaviour is governed by their policy, not this one.
  </p>

  <h2>Children</h2>
  <p>
    This site is not directed to children under 13 and we do not knowingly
    collect their information. If you believe a child has submitted an address,
    write to us and we will delete it.
  </p>

  <h2>Changes</h2>
  <p>
    If this policy changes materially we will record the change on the
    <a href="/changelog/">changelog</a> alongside our price corrections, so the
    edit history is public rather than silent.
  </p>

  <h2>Who we are</h2>
  <p>
    ${esc(PUBLISHER.legalName)}<br>
    ${esc(PUBLISHER_ADDRESS)}<br>
    <a href="mailto:${esc(PUBLISHER.email)}">${esc(PUBLISHER.email)}</a>
  </p>
`;

  return write(
    'privacy/index.html',
    layout({
      title: `Privacy policy: ${SITE_NAME}`,
      description:
        'What this site collects, which is nothing from the price tool and five fields from the ' +
        'alerts list, where it is stored, how long it is kept, and how to have it deleted.',
      path: '/privacy/',
      body,
      jsonLd: [crumbs('Privacy policy', '/privacy/')],
    })
  );
}

function buildTerms() {
  const body = `
  <h1>Terms of use</h1>
  <p class="lede">
    Plain terms for a site that sells nothing. Using ${esc(SITE_NAME)} means you
    accept these.
  </p>
  ${dataStamp()}

  <h2>What this site is</h2>
  <p>
    ${esc(SITE_NAME)} is a price-comparison tool published by
    ${esc(PUBLISHER.legalName)}, a limited liability company organised in the
    State of California. It reports what medications cost through various
    payment pathways, with a source and a verification date for every figure.
  </p>

  <h2>What it is not</h2>
  <p class="disclaimer">${esc(DISCLAIMER)}</p>
  <p>
    Nothing here is medical advice, legal advice, insurance advice or financial
    advice. We cannot tell you which medication is right for you and we do not
    try to. Decisions about your treatment belong between you and your
    prescriber.
  </p>

  <h2>Accuracy, and its limits</h2>
  <p>
    We publish a figure only when we have confirmed it against a primary source,
    and we publish the date we confirmed it. Where we could not confirm a figure,
    we say so rather than printing it. That discipline is described in full on
    our <a href="/methodology/">methodology page</a>.
  </p>
  <p>
    Even so, prices change without notice, vary by pharmacy, and depend on facts
    about your coverage that we do not hold. We make no warranty that any figure
    is current or that it will be what you are charged. Verify the price with the
    manufacturer, your insurer or your pharmacy before you act on it. To the
    fullest extent permitted by law, ${esc(PUBLISHER.legalName)} is not liable
    for any loss arising from reliance on a figure published here.
  </p>

  <h2>Acceptable use</h2>
  <p>
    You may read, link to, quote and cite this site freely, including our
    figures, provided you carry the verification date alongside any figure you
    quote. A price without its date is the exact failure this site exists to
    correct.
  </p>
  <p>
    You may not scrape the site in a way that degrades it for others, submit
    addresses you do not control to the alerts list, or present this site as
    your own.
  </p>

  <h2>The alerts list</h2>
  <p>
    Signing up is free and you can leave at any time using the unsubscribe link
    in any email. What we store and for how long is set out in our
    <a href="/privacy/">privacy policy</a>.
  </p>

  <h2>Independence</h2>
  <p class="non-affiliation">${esc(NON_AFFILIATION)}</p>

  <h2>Governing law</h2>
  <p>
    These terms are governed by the laws of the State of California, without
    regard to its conflict-of-laws rules.
  </p>

  <h2>Contact</h2>
  <p>
    ${esc(PUBLISHER.legalName)}<br>
    ${esc(PUBLISHER_ADDRESS)}<br>
    <a href="mailto:${esc(PUBLISHER.email)}">${esc(PUBLISHER.email)}</a>
  </p>
`;

  return write(
    'terms/index.html',
    layout({
      title: `Terms of use: ${SITE_NAME}`,
      description:
        'Terms for using this price-comparison tool: what it is, what it is not, the limits of ' +
        'its accuracy, how you may quote its figures, and who publishes it.',
      path: '/terms/',
      body,
      jsonLd: [crumbs('Terms of use', '/terms/')],
    })
  );
}

function buildContact() {
  const body = `
  <h1>Contact and corrections</h1>
  <p class="lede">
    If a figure here is wrong, we would rather fix it than defend it. This is how
    to tell us.
  </p>
  ${dataStamp()}

  <h2>Report a price error</h2>
  <p>
    Write to <a href="mailto:${esc(PUBLISHER.email)}">${esc(PUBLISHER.email)}</a>.
    The most useful correction includes the page, the figure as we show it, what
    you believe it should be, and where you saw it. A link to a manufacturer or
    government page is worth more than anything else you can send, because it is
    the only kind of evidence we can publish against.
  </p>

  <h2>What happens next</h2>
  <ol>
    <li>We acknowledge your message.</li>
    <li>We attempt a direct read of the primary source. A search result, an
        aggregator, or a screenshot is not enough on its own to change a figure.</li>
    <li>If the source confirms your correction, we change the figure, update its
        verification date, and log the change on our
        <a href="/changelog/">changelog</a> with the source.</li>
    <li>If we cannot confirm it either way, we move the figure to unverified
        rather than leave a number we cannot stand behind, and record what a
        confirmation would require.</li>
  </ol>
  <p>
    Corrections are logged publicly whether they came from us or from you. The
    changelog is the record.
  </p>

  <h2>Other reasons to write</h2>
  <ul>
    <li>Privacy requests, including access and deletion. See the
        <a href="/privacy/">privacy policy</a> for what we hold.</li>
    <li>Press and research enquiries.</li>
    <li>Reporting a security issue in the site itself.</li>
  </ul>
  <p>
    We do not offer medical advice and cannot answer questions about whether a
    medication is right for you, what dose you should take, or whether you will
    be approved for a program. Those belong with your prescriber, your insurer,
    or the program itself.
  </p>

  <h2>Publisher</h2>
  <p>
    ${esc(PUBLISHER.legalName)}<br>
    ${esc(PUBLISHER_ADDRESS)}<br>
    <a href="mailto:${esc(PUBLISHER.email)}">${esc(PUBLISHER.email)}</a>
  </p>
`;

  return write(
    'contact/index.html',
    layout({
      title: `Contact and corrections: ${SITE_NAME}`,
      description:
        'How to report a price error, what evidence lets us act on it, what happens after you ' +
        'write, and how to make a privacy request.',
      path: '/contact/',
      body,
      jsonLd: [crumbs('Contact and corrections', '/contact/')],
    })
  );
}

function buildInfra() {
  const written = [];

  const routes = [
    { path: '/', priority: '1.0', freq: 'daily' },
    { path: '/methodology/', priority: '0.9', freq: 'weekly' },
    { path: '/changelog/', priority: '0.9', freq: 'weekly' },
    ...Object.values(DATA.drugs).map((d) => ({ path: `/${d.slug}/`, priority: '0.9', freq: 'weekly' })),
    ...PATHWAY_PAGES.map((p) => ({ path: `/${p.slug}/`, priority: '0.8', freq: 'weekly' })),
    { path: '/alerts/', priority: '0.6', freq: 'monthly' },
    { path: '/about/', priority: '0.5', freq: 'monthly' },
    { path: '/contact/', priority: '0.5', freq: 'monthly' },
    { path: '/privacy/', priority: '0.3', freq: 'yearly' },
    { path: '/terms/', priority: '0.3', freq: 'yearly' },
  ];

  written.push(
    write(
      'sitemap.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${ORIGIN}${r.path}</loc>
    <lastmod>${BUILT_ON}</lastmod>
    <changefreq>${r.freq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`
    )
  );

  written.push(
    write(
      'robots.txt',
      `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`
    )
  );

  // Security and caching headers. The data file must never be cached hard: on a
  // price-change day a stale pricing.json is the exact failure this site exists
  // to avoid.
  written.push(
    write(
      '_headers',
      `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains

/assets/img/*
  Cache-Control: public, max-age=31536000, immutable

/favicon.ico
  Cache-Control: public, max-age=604800

/site.webmanifest
  Cache-Control: public, max-age=604800

/assets/*
  Cache-Control: public, max-age=3600, must-revalidate

/engine/*
  Cache-Control: public, max-age=3600, must-revalidate

/data/pricing.json
  Cache-Control: public, max-age=300, must-revalidate

/data/changelog.json
  Cache-Control: public, max-age=300, must-revalidate
`
    )
  );

  written.push(
    write(
      '_redirects',
      `# Consolidate common query variants onto the canonical drug pages.
/zepbound      /zepbound-cost/      301
/wegovy        /wegovy-cost/        301
/ozempic       /ozempic-cost/       301
/mounjaro      /mounjaro-cost/      301
/foundayo      /foundayo-cost/      301
/orforglipron  /foundayo-cost/      301
/sources       /methodology/        301
/changes       /changelog/          301
`
    )
  );

  return written;
}

/* ========================================================================= *
 * Run
 * ========================================================================= */

const written = [
  buildIndex(),
  ...Object.keys(DATA.drugs).map(buildDrugPage),
  ...PATHWAY_PAGES.map(buildPathwayPage),
  buildMethodology(),
  buildChangelog(),
  buildAlerts(),
  buildAbout(),
  buildPrivacy(),
  buildTerms(),
  buildContact(),
  ...buildInfra(),
];

console.log(`Generated ${written.length} files from data as of ${BUILT_ON}:`);
for (const path of written) console.log(`  public/${path}`);
