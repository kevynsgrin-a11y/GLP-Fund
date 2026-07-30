/**
 * Mechanical integrity gates.
 *
 * These four rules are the ones most likely to be violated by accident, months
 * from now, by someone in a hurry on a price-change day. Every one of them is
 * therefore a failing build rather than a line in a style guide:
 *
 *   1. Zero emoji, anywhere.
 *   2. No outbound link to any host outside the primary-source allowlist --
 *      which structurally forbids telehealth, pharmaceutical affiliate and
 *      compounding-pharmacy links without needing to enumerate them.
 *   3. No client-side persistence of the dose or insurance selection.
 *   4. The compliance strings are verbatim.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

import { DISCLAIMER, NON_AFFILIATION, FLAGS } from '../public/engine/config.js';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP_DIRS = new Set(['.git', 'node_modules', '.wrangler']);
const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.html', '.css', '.json', '.md', '.txt', '.svg', '.xml', '.webmanifest',
]);

/** Recursively collect text files, skipping VCS and dependency directories. */
function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectFiles(full, out);
    } else if (TEXT_EXTENSIONS.has(extname(entry)) || entry === '_headers' || entry === '_redirects') {
      out.push(full);
    }
  }
  return out;
}

const ALL_FILES = collectFiles(ROOT);
const PUBLIC_FILES = ALL_FILES.filter((f) => relative(ROOT, f).startsWith('public/'));

test('the repository has files to check', () => {
  assert.ok(ALL_FILES.length > 5, `expected a populated tree, found ${ALL_FILES.length} files`);
});

/* ------------------------------------------------------------------------- *
 * 1. ZERO EMOJI
 * ------------------------------------------------------------------------- */

/**
 * Extended_Pictographic covers the emoji blocks. Three legacy symbols carry the
 * property but are typographic rather than emoji -- (c), (r) and the trademark
 * sign -- so they are permitted in text form only. Followed by U+FE0F they are
 * requesting emoji presentation, and that is a violation.
 */
const TYPOGRAPHIC_EXCEPTIONS = new Set(['©', '®', '™']);
const PICTOGRAPHIC = /\p{Extended_Pictographic}/gu;
const EMOJI_PRESENTATION_SELECTOR = /️/u;
const REGIONAL_INDICATOR = /[\u{1F1E6}-\u{1F1FF}]/u;
const ZWJ_SEQUENCE = /‍[\p{Extended_Pictographic}]/u;

test('zero emoji in any source or rendered file', () => {
  const violations = [];

  for (const file of ALL_FILES) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);

    // This test file necessarily names the ranges it forbids; skip only itself.
    if (rel === 'test/integrity.test.js') continue;

    for (const match of text.matchAll(PICTOGRAPHIC)) {
      if (TYPOGRAPHIC_EXCEPTIONS.has(match[0])) continue;
      const line = text.slice(0, match.index).split('\n').length;
      const codepoint = match[0].codePointAt(0).toString(16).toUpperCase();
      violations.push(`${rel}:${line} contains U+${codepoint}`);
    }

    if (EMOJI_PRESENTATION_SELECTOR.test(text)) {
      violations.push(`${rel} contains U+FE0F, an emoji presentation selector`);
    }
    if (REGIONAL_INDICATOR.test(text)) {
      violations.push(`${rel} contains a regional indicator (flag emoji)`);
    }
    if (ZWJ_SEQUENCE.test(text)) {
      violations.push(`${rel} contains a zero-width-joiner emoji sequence`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    'Emoji are forbidden portfolio-wide. On a health-pricing page they read as a ' +
      'content farm, and a visitor who distrusts the presentation will not trust ' +
      `the numbers.\n${violations.join('\n')}`
  );
});

/* ------------------------------------------------------------------------- *
 * 2. NEUTRALITY -- OUTBOUND LINK ALLOWLIST
 * ------------------------------------------------------------------------- */

/**
 * An allowlist, not a denylist. A denylist of telehealth vendors would need
 * maintaining forever and would still miss the next one. Requiring every
 * outbound link to be a primary source makes a telehealth, pharmaceutical
 * affiliate or compounding-pharmacy link impossible to add without a failing
 * build -- which is the neutrality guarantee stated as code.
 */
const ALLOWED_HOSTS = new Set([
  // Government, primary.
  'www.fda.gov', 'fda.gov', 'accessdata.fda.gov',
  'www.cms.gov', 'cms.gov', 'www.medicare.gov', 'medicare.gov',
  'www.hhs.gov', 'hhs.gov', 'aspe.hhs.gov',
  'trumprx.gov', 'www.trumprx.gov',
  'www.sec.gov', 'sec.gov',
  'www.federalregister.gov', 'federalregister.gov',
  'www.usa.gov', 'www.medicaid.gov', 'medicaid.gov',
  // Manufacturer, primary.
  'www.lilly.com', 'lilly.com', 'investor.lilly.com',
  'lillydirect.lilly.com', 'www.lillydirect.com', 'lillydirect.com',
  'zepbound.lilly.com', 'www.zepbound.com', 'zepbound.com',
  'mounjaro.lilly.com', 'www.mounjaro.com', 'mounjaro.com',
  'www.lillycares.com', 'lillycares.com',
  // Lilly's statutory price-disclosure host. A primary manufacturer source, and
  // the correct citation for a list or WAC figure.
  'pricinginfo.lilly.com',
  'www.novonordisk.com', 'novonordisk.com', 'www.novonordisk-us.com',
  'www.novocare.com', 'novocare.com',
  'www.wegovy.com', 'wegovy.com', 'www.ozempic.com', 'ozempic.com',
  'www.novonordiskpap.com', 'novonordiskpap.com',
  // Self. Must match DOMAIN in public/engine/config.js, or the build fails on
  // its own canonical URL -- which is the intended behaviour, since a canonical
  // pointing at a host we do not control is worse than a failing test.
  'glp1-fund.com', 'www.glp1-fund.com',
  // Vocabulary and namespace identifiers. These appear in JSON-LD `@context` and
  // in the sitemap's XML namespace declaration. They identify a schema; they are
  // not links a visitor can follow or that pass any authority.
  'schema.org',
  'www.sitemaps.org',
]);

/**
 * The three categories the brief forbids outright: telehealth vendors,
 * pharmaceutical affiliates, and compounding pharmacies. Asserted explicitly as
 * a regression guard even though the allowlist already excludes them, and named
 * so a future maintainer reading a failure understands the intent.
 *
 * Price aggregators are deliberately NOT on this list. They are competitors
 * named in the brief's competitive analysis, not forbidden partners: the
 * allowlist already keeps them out of the deployed tree, and a gate writeup or a
 * research fixture must remain free to cite one in order to explain that it is a
 * secondary source and therefore cannot confirm a price. Naming a source in
 * order to disqualify it is the opposite of endorsing it.
 */
const EXPLICITLY_FORBIDDEN = [
  'hims.com', 'forhims.com', 'hers.com', 'ro.co', 'getro.com', 'lifemd.com',
  'henrymeds.com', 'noom.com', 'calibrate.health', 'joinsequence.com',
  'weightwatchers.com', 'plushcare.com', 'teladoc.com', 'amwell.com',
  'sesamecare.com', 'mochi.health', 'formhealth.co', 'knownwell.health',
  'ivimhealth.com', 'emergeweightloss.com', 'orderlymeds.com',
  'empowerpharmacy.com', 'hallandalepharmacy.com', 'olympiapharmacy.com',
  'belmarpharmasolutions.com', 'tailormadecompounding.com', 'revivedrx.com',
  'struthealth.com', 'redboxrx.com', 'invigormedical.com',
  'telehealthally.com', 'findhonestcare.com',
];

const URL_PATTERN = /https?:\/\/([^\s"'`)<>\]}\\]+)/g;

test('every outbound link in the deployed tree is a primary source', () => {
  const violations = [];

  for (const file of PUBLIC_FILES) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);

    for (const match of text.matchAll(URL_PATTERN)) {
      let host;
      try {
        host = new URL(match[0]).host.toLowerCase();
      } catch {
        continue;
      }
      if (!ALLOWED_HOSTS.has(host)) {
        const line = text.slice(0, match.index).split('\n').length;
        violations.push(`${rel}:${line} links to non-allowlisted host "${host}"`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    'Outbound links must be primary sources. Neutrality is this site\'s only ' +
      'durable wedge: the entire competitive field monetises exactly the links ' +
      `this test forbids.\n${violations.join('\n')}`
  );
});

test('no forbidden host is LINKED from anywhere in the repository', () => {
  // Scoped to links, not mentions. The methodology page and the gate writeups
  // must be able to name drugs.com in order to explain that it is a secondary
  // source and therefore cannot confirm a price; a fixture must be able to
  // record that a secondary source was consulted and rejected. Naming a source
  // in order to disqualify it is the opposite of endorsing it. An actual URL is
  // the thing that must never exist.
  const violations = [];

  for (const file of ALL_FILES) {
    const rel = relative(ROOT, file);
    if (rel === 'test/integrity.test.js') continue;

    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(URL_PATTERN)) {
      let host;
      try {
        host = new URL(match[0]).host.toLowerCase().replace(/^www\./, '');
      } catch {
        continue;
      }
      if (EXPLICITLY_FORBIDDEN.includes(host)) {
        const line = text.slice(0, match.index).split('\n').length;
        violations.push(`${rel}:${line} LINKS to ${host}`);
      }
    }
  }

  assert.deepEqual(violations, [], violations.join('\n'));
});

test('no forbidden host is even mentioned inside the deployed tree', () => {
  // Inside public/ the stricter rule applies: a bare mention could become a
  // link with one careless edit, and nothing in the deployed tree needs to name
  // a telehealth vendor at all.
  const violations = [];

  for (const file of PUBLIC_FILES) {
    const text = readFileSync(file, 'utf8').toLowerCase();
    const rel = relative(ROOT, file);
    for (const host of EXPLICITLY_FORBIDDEN) {
      if (text.includes(host)) violations.push(`${rel} mentions ${host}`);
    }
  }

  assert.deepEqual(violations, [], violations.join('\n'));
});

test('the affiliate slot flag ships disabled', () => {
  assert.equal(
    FLAGS.AFFILIATE_SLOTS_ENABLED,
    false,
    'Affiliate infrastructure ships built but empty and disabled in v1.'
  );
  assert.equal(FLAGS.PREMIUM_TIER_ENABLED, false, 'The premium tier is copy and docs only.');
});

/* ------------------------------------------------------------------------- *
 * 3. NO HEALTH-INFORMATION PERSISTENCE
 * ------------------------------------------------------------------------- */

/**
 * Strip comments so the lint reads CODE, not prose.
 *
 * Without this, app.js fails its own check purely for containing a comment that
 * promises not to use localStorage. A lint that punishes documenting the rule
 * teaches people to stop documenting the rule.
 *
 * Newlines are preserved so reported line numbers stay accurate.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

test('the dose and insurance selections are never persisted or transmitted', () => {
  const FORBIDDEN_APIS = [
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie',
    'navigator.sendBeacon',
  ];
  const violations = [];

  for (const file of PUBLIC_FILES.filter((f) => extname(f) === '.js' || extname(f) === '.html')) {
    const text = stripComments(readFileSync(file, 'utf8'));
    const rel = relative(ROOT, file);
    for (const api of FORBIDDEN_APIS) {
      const index = text.indexOf(api);
      if (index !== -1) {
        const line = text.slice(0, index).split('\n').length;
        violations.push(`${rel}:${line} references ${api}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    'The tool collects no health information. Dose and insurance status are ' +
      'ephemeral client-side state: never persisted, never transmitted. The only ' +
      `permitted network write is the alert-list email capture.\n${violations.join('\n')}`
  );
});

test('stripComments hides prose but never hides code', () => {
  // A lint that has quietly stopped detecting anything is worse than no lint, so
  // the comment-stripper is itself tested.
  assert.ok(!stripComments('// we never use localStorage here').includes('localStorage'));
  assert.ok(!stripComments('/* no localStorage, no sessionStorage */').includes('localStorage'));
  assert.ok(!stripComments('<!-- localStorage is forbidden -->').includes('localStorage'));

  // Real usage survives, in every form that matters.
  assert.ok(stripComments('localStorage.setItem("dose", d)').includes('localStorage'));
  assert.ok(stripComments('window.localStorage["dose"] = d').includes('localStorage'));
  assert.ok(stripComments('const s = sessionStorage; s.setItem("x", 1)').includes('sessionStorage'));

  // A URL's double slash must not be mistaken for a line comment and swallow the
  // rest of the line.
  assert.ok(stripComments('const u = "https://example.gov/x"; localStorage.clear()').includes('localStorage'));

  // Line numbers are preserved so a reported violation points at the right line.
  assert.equal(stripComments('a\n// c\nb').split('\n').length, 3);
});

/* ------------------------------------------------------------------------- *
 * 3b. NO CREDENTIALS IN THE REPOSITORY
 * ------------------------------------------------------------------------- */

test('no credential is committed to the repository', () => {
  // A Cloudflare Pages token can publish arbitrary content to a live health
  // information site, so a leaked one is a defacement risk rather than merely an
  // embarrassment. This test exists because the moment of highest risk is the
  // moment someone is holding a fresh token and looking for somewhere to put it.
  //
  // The right place is GitHub Actions secrets, which are write-only once saved.
  // See docs/ops-runbook.md section 6.0.
  const PATTERNS = [
    // Cloudflare API tokens: 40 chars of base62 with - and _ .
    { name: 'Cloudflare API token', re: /\b[A-Za-z0-9_-]{40}\b/, confirm: /(cloudflare|api[_-]?token|CF_API)/i },
    { name: 'Cloudflare global API key', re: /\b[0-9a-f]{37}\b/, confirm: /(cloudflare|api[_-]?key)/i },
    { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/, confirm: null },
    { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{16,}\b/, confirm: null },
    { name: 'private key block', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, confirm: null },
    { name: 'Bearer token literal', re: /Bearer\s+[A-Za-z0-9_\-.]{24,}/, confirm: null },
  ];

  const violations = [];

  for (const file of ALL_FILES) {
    const rel = relative(ROOT, file);
    // This file necessarily contains the patterns it forbids.
    if (rel === 'test/integrity.test.js') continue;
    // Frozen research fixtures contain long hashes and URL slugs that trip the
    // generic 40-character heuristic without being credentials.
    if (rel.startsWith('test/fixtures/')) continue;

    const text = readFileSync(file, 'utf8');

    for (const { name, re, confirm } of PATTERNS) {
      const match = text.match(re);
      if (!match) continue;
      // The generic length heuristics need a nearby keyword to avoid firing on
      // git SHAs, base64 asset data and long URL paths. The specific prefixed
      // formats need no confirmation -- they are unambiguous.
      if (confirm && !confirm.test(text)) continue;
      const line = text.slice(0, match.index).split('\n').length;
      violations.push(`${rel}:${line} looks like a ${name}: ${match[0].slice(0, 8)}...`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    'A credential appears to be committed. Revoke it in the provider dashboard ' +
      'FIRST, then remove it from the repository and its history.\n' +
      violations.join('\n')
  );
});

test('no secret-bearing filename is tracked', () => {
  const FORBIDDEN_NAMES = ['.dev.vars', '.env', 'credentials.json', 'secrets.json'];
  const offenders = ALL_FILES.map((f) => relative(ROOT, f)).filter((rel) =>
    FORBIDDEN_NAMES.some((n) => rel === n || rel.endsWith(`/${n}`))
  );
  assert.deepEqual(offenders, [], `these are gitignored for a reason: ${offenders.join(', ')}`);
});

/* ------------------------------------------------------------------------- *
 * 4. VERBATIM COMPLIANCE STRINGS
 * ------------------------------------------------------------------------- */

test('the footer disclaimer is byte-exact', () => {
  assert.equal(
    DISCLAIMER,
    'This tool provides pricing information only. It is not medical advice and is ' +
      'not a substitute for consultation with a licensed healthcare provider. ' +
      'Prices change frequently and may differ at your pharmacy. Verify all costs ' +
      'directly with the manufacturer, your insurer, or your pharmacy before making ' +
      'decisions about your treatment.'
  );
});

test('the non-affiliation statement is byte-exact', () => {
  assert.equal(
    NON_AFFILIATION,
    'Not affiliated with, endorsed by, or sponsored by Eli Lilly, Novo Nordisk, the ' +
      'U.S. Department of Health and Human Services, or any government program.'
  );
});

/* ------------------------------------------------------------------------- *
 * ICON SET
 * ------------------------------------------------------------------------- */

test('every icon is well-formed inline SVG with no external reference', async () => {
  const iconsPath = join(ROOT, 'public/assets/js/icons.js');
  if (!existsSync(iconsPath)) return;

  const { ICONS, icon } = await import('../public/assets/js/icons.js');
  assert.ok(Object.keys(ICONS).length >= 15, 'the icon set should be substantive');

  for (const [name, fn] of Object.entries(ICONS)) {
    const markup = fn();
    assert.match(markup, /^<svg /, `${name}: must be an inline svg element`);
    assert.match(markup, /<\/svg>$/, `${name}: must be closed`);
    assert.match(markup, /viewBox="0 0 24 24"/, `${name}: must use the 24x24 grid`);
    assert.match(markup, /stroke="currentColor"/, `${name}: must inherit colour`);
    assert.ok(!/<image|xlink:href|url\(/.test(markup), `${name}: must not reference an external asset`);
    assert.ok(!/<text/.test(markup), `${name}: must be drawn, not typeset`);

    // Balanced tags. A malformed icon injected into innerHTML can swallow the
    // rest of a result card, including its price.
    const opens = (markup.match(/<(svg|g|path|line|circle|rect|polyline)\b/g) ?? []).length;
    const closes = (markup.match(/<\/(svg|g)>|\/>/g) ?? []).length;
    assert.equal(opens, closes, `${name}: unbalanced markup`);
  }

  assert.equal(icon('does-not-exist'), '', 'an unknown icon degrades to nothing, never throws');
});

test('icons default to aria-hidden and accept an accessible name when needed', async () => {
  const { pill } = await import('../public/assets/js/icons.js');
  assert.match(pill(), /aria-hidden="true"/);
  assert.match(pill({ title: 'Medication' }), /role="img" aria-label="Medication"/);
  assert.ok(!/aria-hidden/.test(pill({ title: 'Medication' })));
  // Attribute injection must not be possible from an icon title.
  assert.match(pill({ title: 'a"b' }), /aria-label="a&quot;b"/);
});
