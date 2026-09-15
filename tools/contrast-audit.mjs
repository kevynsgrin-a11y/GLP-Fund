/**
 * WCAG 2.2 contrast audit, measured against the rendered page.
 *
 * Reading the ratios off the token table would only prove the tokens are fine.
 * What ships is a cascade: a muted paragraph inside a tinted panel inside a
 * paper band, text over a two-layer gradient veil, a border whose neighbour is
 * three surfaces up. So every pair below is taken from a real element on a real
 * page in real Chromium, using the same DevTools API the browser's own contrast
 * tool uses (CSS.getBackgroundColors), which resolves what is actually painted
 * behind a node rather than what its nearest opaque ancestor declares.
 *
 * Two families of check, because WCAG sets two thresholds:
 *
 *   TEXT   1.4.3 Contrast (Minimum), AA. 4.5:1, or 3:1 where the text is large
 *          (>=24px, or >=18.66px at weight 700+).
 *   NONTEXT 1.4.11 Non-text Contrast, AA. 3:1 for the visual boundary of a
 *          control a user has to find and operate, and for the focus indicator.
 *          Purely decorative hairlines are out of scope and are reported as
 *          such rather than silently skipped.
 *
 * Exit code is non-zero if any pair fails, so this is usable as a gate.
 *
 *   node tools/contrast-audit.mjs            # table to stdout
 *   node tools/contrast-audit.mjs --markdown # same, as a markdown table
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const MARKDOWN = process.argv.includes('--markdown');

const CHROME_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
].filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Every pairing this site actually renders, named so a failure says WHICH
 * promise broke rather than which hex value moved.
 *
 * `probe` is evaluated in the page and must return an element or null. A null
 * probe is reported as "not on this page", never as a pass: a contrast table
 * that quietly skips the element it could not find is worse than no table.
 */
const TEXT_PAIRS = [
  ['/', 'Display headline over the hero veil', '.hero h1'],
  ['/', 'Hero lede over the hero veil', '.hero .lede'],
  ['/', 'Masthead brand', '.masthead__brand'],
  ['/', 'Masthead nav link', '.masthead__nav a'],
  ['/', 'Field label on the tool panel', '.field__label'],
  ['/', 'Select control text', '.field select'],
  ['/', 'Disabled select text', '.field select:disabled'],
  ['/', 'Privacy note on the tool panel', '.privacy-note span'],
  ['/', 'Data stamp', '.data-stamp'],
  ['/', 'Verification-state heading', '.verification-state h2'],
  ['/', 'Verification-state body', '.verification-state p'],
  ['/', 'Verification-state link', '.verification-state a'],
  ['/', 'Empty-results text', '.empty p'],
  ['/', 'Advertisement label', '.ad-slot__label'],
  ['/', 'Paper-band heading (inverted)', '.paper-band h2'],
  ['/', 'Paper-band prose (inverted)', '.prose p'],
  ['/', 'Paper-band link (inverted)', '.prose a'],
  ['/', 'Index link', '.link-list a'],
  ['/', 'Index link trailing text', '.link-list li'],
  ['/', 'Footer disclaimer', '.disclaimer'],
  ['/', 'Footer non-affiliation', '.non-affiliation'],
  ['/', 'Footer body text', '.site-footer .wrap > p:last-of-type'],
  ['/', 'Footer nav link', '.footer-nav a'],
  ['/', 'Footer link in body text', '.site-footer p a'],
  ['/', 'Skip link (focused)', '.skip-link'],
  ['/methodology/', 'Interior headline', 'main.interior > h1'],
  ['/methodology/', 'Interior lede', 'main.interior > .lede'],
  ['/methodology/', 'Body paragraph', 'main.interior > p'],
  ['/methodology/', 'Receipt row label', '.receipt__row dt'],
  ['/methodology/', 'Receipt total', '.receipt__total dt'],
  ['/methodology/', 'Receipt count value', '.receipt__row dd'],
  ['/methodology/', 'Pipeline step number', '.pipeline__n'],
  ['/methodology/', 'Pipeline step body', '.pipeline__body'],
  ['/methodology/', 'Pipeline muted step', '.pipeline__step--muted'],
  ['/methodology/', 'Pipeline note', '.pipeline__note'],
  ['/methodology/', 'Urgent banner text', '.banner--urgent'],
  ['/methodology/', 'Table header', 'th'],
  ['/methodology/', 'Table cell', 'td'],
  ['/methodology/', 'Table numeric cell', 'td.num'],
  ['/methodology/', 'Table link', 'td a'],
  ['/methodology/', 'Pill: confirmed', '.pill--confirmed'],
  ['/methodology/', 'Pill: sources conflict', '.pill--conflicting'],
  ['/methodology/', 'Pill: not verified', '.pill--unverified'],
  ['/zepbound-cost/', 'Intro-warning heading', '.intro-warning h2'],
  ['/zepbound-cost/', 'Intro-warning body', '.intro-warning p'],
  ['/zepbound-cost/', 'Intro-warning scope note', '.intro-warning__scope'],
  ['/zepbound-cost/', 'Warn banner text', '.banner--warn'],
  ['/lillydirect/', 'Eligibility list item', '.eligibility li'],
  ['/medicare-glp1-bridge/', 'Eligibility pending note', '.eligibility__pending'],
  ['/alerts/', 'Email input text', ".alerts-form input[type='email']"],
  ['/alerts/', 'Submit button label', '.btn'],
];

/**
 * States the stylesheet ships but the current DATA never reaches.
 *
 * Nothing on this site is confirmed yet, so `.pill--confirmed` renders on no
 * page. Leaving it out would let a real state go unmeasured until the day a
 * price is verified -- which is the day nobody is looking at contrast. So the
 * shipped class is applied to a real element on a real page, measured through
 * the real cascade, and reported as what it is.
 */
const INJECTED_PAIRS = [
  ['/methodology/', 'Pill: confirmed (no data yet; class applied in place)', '.pill', 'pill--confirmed'],
  ['/methodology/', 'Pill: primary source (no data yet; class applied in place)', '.pill', 'pill--primary'],
  ['/methodology/', 'Pill: secondary source (no data yet; class applied in place)', '.pill', 'pill--secondary'],
];

/** Pairs measured after driving the tool, because they only exist once results render. */
const RESULT_TEXT_PAIRS = [
  ['Card pathway name', '.card__name'],
  ['Card price (verified)', '.card__cost'],
  ['Card price (unverified)', '.card__cost--unverified'],
  ['Card annual figure', '.card__annual'],
  ['Card rank line', '.card__rank'],
  ['Card note', '.card__note'],
  ['Card caveat', '.card__caveat'],
  ['Verified stamp: fresh', '.card__verified-state--fresh'],
  ['Verified stamp: warn', '.card__verified-state--warn'],
  ['Verified stamp: urgent', '.card__verified-state--urgent'],
  ['Verified stamp: unverified', '.card__verified-state--unverified'],
  ['Card source link', '.card__source a'],
  ['Results count line', '.results__count'],
  ['Savings figure', '.savings__figure'],
  ['Suppression summary', '.suppressed summary'],
  ['Suppression item', '.suppressed li'],
];

/**
 * Non-text pairs: the boundary of something the user has to find and operate,
 * plus the focus indicator. `decorative` pairs are reported for completeness
 * and are not gated -- WCAG 1.4.11 exempts purely decorative boundaries, and
 * claiming a hairline rule is a UI component would make the table dishonest in
 * the other direction.
 */
const NONTEXT_PAIRS = [
  ['/', 'Select border against the tool panel', '.field select', 'borderTopColor', false],
  ['/', 'Focus ring against the tool panel', '.field select', 'outlineColor', false, ':focus-visible'],
  ['/', 'Tool panel edge against the page', '.tool', 'borderTopColor', false],
  ['/', 'Advertisement slot edge', '.ad-slot', 'borderTopColor', false],
  ['/', 'Verification-state accent edge', '.verification-state', 'borderLeftColor', false],
  ['/', 'Hairline rule inside a panel', '.privacy-note', 'borderTopColor', true],
  ['/methodology/', 'Table hairline', 'td', 'borderBottomColor', true],
  ['/alerts/', 'Email input border', ".alerts-form input[type='email']", 'borderTopColor', false],
  // The submit button is a filled control: its boundary against the page is its
  // own background, not its border, which is the same amber by design.
  ['/alerts/', 'Submit button against the form panel', '.btn', 'backgroundColor', false, null, '.alerts-form'],
];

const RESULT_NONTEXT_PAIRS = [
  ['Best-card accent edge', '.card--best', 'borderLeftColor', false],
  ['Card leading edge against the page', '.card', 'borderLeftColor', false],
  ['Card hairline edge', '.card', 'borderTopColor', false],
  ['Urgent banner edge', '.banner--urgent', 'borderLeftColor', false],
  ['Warn banner edge', '.banner', 'borderLeftColor', false],
];

/* ------------------------------------------------------------------ colour */

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function relativeLuminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map((v) => toLinear(v / 255));
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite a possibly-translucent foreground over an opaque backdrop. */
function flatten([r, g, b, a], over) {
  if (a === undefined || a >= 1) return [r, g, b];
  return [0, 1, 2].map((i) => Math.round([r, g, b][i] * a + over[i] * (1 - a)));
}

/** Large text per WCAG: >= 24px, or >= 18.66px at weight 700 or heavier. */
function isLargeText(px, weight) {
  return px >= 24 || (px >= 18.66 && Number(weight) >= 700);
}

/* ------------------------------------------------------------------ server */

async function serve(overrides = new Map()) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (overrides.has(url.pathname)) {
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
      res.end(overrides.get(url.pathname));
      return;
    }
    let file = join(PUBLIC, decodeURIComponent(url.pathname));
    if (url.pathname.endsWith('/')) file = join(file, 'index.html');
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

/* --------------------------------------------------------------------- CDP */

async function launchChrome() {
  const bin = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!bin) throw new Error(`No Chromium found. Looked in:\n${CHROME_CANDIDATES.join('\n')}`);
  const child = spawn(
    bin,
    ['--headless=new', '--remote-debugging-port=0', '--no-sandbox', '--disable-dev-shm-usage',
     '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`Chromium did not report a DevTools URL.\n${buffer}`)), 30000);
    child.stderr.on('data', (chunk) => {
      buffer += chunk.toString();
      const m = buffer.match(/ws:\/\/[^\s]+/);
      if (m) { clearTimeout(timer); resolve(m[0]); }
    });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Chromium exited with ${code}\n${buffer}`)); });
  });
  return { child, wsUrl };
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error(`Could not connect to ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  on(m, fn) { if (!this.listeners.has(m)) this.listeners.set(m, []); this.listeners.get(m).push(fn); }
  once(m) { return new Promise((r) => { const fn = (p) => { const l = this.listeners.get(m); l.splice(l.indexOf(fn), 1); r(p); }; this.on(m, fn); }); }
}

async function newPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const s = { send: (m, p) => cdp.send(m, p, sessionId) };
  await s.send('Page.enable');
  await s.send('Runtime.enable');
  await s.send('DOM.enable');
  await s.send('CSS.enable');
  await s.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  s.goto = async (url) => {
    const loaded = cdp.once('Page.loadEventFired');
    await s.send('Page.navigate', { url });
    await loaded;
    await s.eval('new Promise((r) => setTimeout(r, 700))', true);
  };
  s.eval = async (expression, awaitPromise = false) => {
    const { result, exceptionDetails } = await s.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  s.select = async (sel, v) => {
    await s.eval(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(el){el.value=${JSON.stringify(v)};el.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
    await s.eval('new Promise((r) => setTimeout(r, 300))', true);
  };
  /** Resolve a selector to a CDP nodeId, or null. */
  s.nodeFor = async (selector) => {
    const { root } = await s.send('DOM.getDocument', { depth: -1 });
    try {
      const { nodeId } = await s.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      return nodeId || null;
    } catch { return null; }
  };
  return s;
}

/**
 * Every CSS colour string the page can produce, resolved to RGBA through the
 * browser's own parser. oklch(), color-mix() and currentColor all go through
 * canvas rather than through a hand-written parser that would drift.
 */
const RESOLVE = (expr) => `(() => {
  const v = ${expr};
  if (!v) return null;
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000'; ctx.fillStyle = v;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
})()`;

async function measureText(page, label, selector, pathLabel, forceState) {
  const exists = await page.eval(`!!document.querySelector(${JSON.stringify(selector)})`);
  if (!exists) return { label, page: pathLabel, kind: 'text', missing: true };

  const nodeId = await page.nodeFor(selector);
  if (forceState && nodeId) {
    await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [forceState.replace(':', '')] });
  }

  const info = await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const cs = getComputedStyle(el);
    return { color: cs.color, px: parseFloat(cs.fontSize), weight: cs.fontWeight, text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) };
  })()`);

  const fgRaw = await page.eval(RESOLVE(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).color`));

  // CSS.getBackgroundColors is what DevTools itself uses: it resolves what is
  // actually painted behind the node, gradients and translucent layers included.
  let bgList = [];
  try {
    const r = await page.send('CSS.getBackgroundColors', { nodeId });
    bgList = r.backgroundColors ?? [];
  } catch { /* fall through to the body backdrop below */ }

  if (!bgList.length) {
    bgList = [await page.eval(`getComputedStyle(document.body).backgroundColor`)];
  }

  const bgs = [];
  for (const b of bgList) {
    const v = await page.eval(RESOLVE(JSON.stringify(b)));
    if (v) bgs.push(v);
  }
  if (!bgs.length) return { label, page: pathLabel, kind: 'text', missing: true };

  const pageBg = await page.eval(RESOLVE(`getComputedStyle(document.body).backgroundColor`));
  const opaquePageBg = flatten(pageBg, [0, 0, 0]);

  // Where the backdrop is a gradient, getBackgroundColors returns every stop it
  // finds. Take the WORST of them: a headline is only as legible as its
  // least-favourable pixel.
  let worst = Infinity, worstBg = null;
  for (const bg of bgs) {
    const solidBg = flatten(bg, opaquePageBg);
    const fg = flatten(fgRaw, solidBg);
    const ratio = contrastRatio(fg, solidBg);
    if (ratio < worst) { worst = ratio; worstBg = solidBg; }
  }

  const large = isLargeText(info.px, info.weight);
  const required = large ? 3 : 4.5;

  if (forceState && nodeId) {
    await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
  }

  return {
    label, page: pathLabel, kind: 'text',
    fg: flatten(fgRaw, worstBg), bg: worstBg,
    px: info.px, weight: info.weight, large,
    ratio: worst, required, pass: worst >= required,
    sample: info.text,
  };
}

async function measureNonText(page, label, selector, prop, decorative, pathLabel, forceState, backdropSelector) {
  const exists = await page.eval(`!!document.querySelector(${JSON.stringify(selector)})`);
  if (!exists) return { label, page: pathLabel, kind: 'non-text', missing: true };

  const nodeId = await page.nodeFor(selector);
  if (forceState && nodeId) {
    await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [forceState.replace(':', '')] });
  }

  const fgRaw = await page.eval(RESOLVE(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).${prop}`));

  // A filled control's boundary IS its own fill, so it has to be measured
  // against what sits behind the control, not against the control itself.
  const backdropNode = backdropSelector ? await page.nodeFor(backdropSelector) : nodeId;
  let bgList = [];
  try {
    const r = await page.send('CSS.getBackgroundColors', { nodeId: backdropNode });
    bgList = r.backgroundColors ?? [];
  } catch { /* fall through */ }
  if (!bgList.length) bgList = [await page.eval(`getComputedStyle(document.body).backgroundColor`)];

  const pageBg = await page.eval(RESOLVE(`getComputedStyle(document.body).backgroundColor`));
  const opaquePageBg = flatten(pageBg, [0, 0, 0]);

  let worst = Infinity, worstBg = null;
  for (const b of bgList) {
    const v = await page.eval(RESOLVE(JSON.stringify(b)));
    if (!v) continue;
    const solidBg = flatten(v, opaquePageBg);
    const fg = flatten(fgRaw, solidBg);
    const ratio = contrastRatio(fg, solidBg);
    if (ratio < worst) { worst = ratio; worstBg = solidBg; }
  }

  if (forceState && nodeId) {
    await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
  }

  if (worstBg === null) return { label, page: pathLabel, kind: 'non-text', missing: true };

  return {
    label, page: pathLabel, kind: decorative ? 'decorative' : 'non-text',
    fg: flatten(fgRaw, worstBg), bg: worstBg,
    ratio: worst, required: decorative ? 0 : 3,
    pass: decorative ? true : worst >= 3,
  };
}

/* -------------------------------------------------------------------- main */

const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/**
 * The shipped data confirms nothing, so the fresh / warn / urgent / savings /
 * best-card states never appear on the live site. The same fixtures tools/qa.mjs
 * uses to prove the engine are served here, so those states are measured on real
 * rendered output instead of being asserted from the token table.
 */
const shipped = JSON.parse(await readFile(join(PUBLIC, 'data/pricing.json'), 'utf8'));
const engineFixture = JSON.parse(await readFile(join(ROOT, 'test/fixtures/engine-dataset.json'), 'utf8'));
const backdate = (data, date) => {
  const c = structuredClone(data);
  c.prices = c.prices.map((p) => ({ ...p, verified_date: date }));
  return c;
};
// STALENESS_WARN_DAYS is 30 and STALENESS_URGENT_DAYS is 60; these two dates sit
// either side of both, relative to the fixture's own generatedAt.
const overrides = new Map([
  ['/data/pricing.engine.json', JSON.stringify(engineFixture)],
  ['/data/pricing.fresh.json', JSON.stringify(backdate(engineFixture, isoDaysAgo(5)))],
  ['/data/pricing.warn.json', JSON.stringify(backdate(engineFixture, isoDaysAgo(40)))],
  ['/data/pricing.urgent.json', JSON.stringify(backdate(engineFixture, isoDaysAgo(120)))],
  ['/data/pricing.stale.json', JSON.stringify(backdate(shipped, isoDaysAgo(120)))],
]);

function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  const p = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const { server, port } = await serve(overrides);
const { child, wsUrl } = await launchChrome();
const cdp = await Cdp.connect(wsUrl);

const rows = [];
const byPage = new Map();
for (const [path, label, selector] of TEXT_PAIRS) {
  if (!byPage.has(path)) byPage.set(path, []);
  byPage.get(path).push(['text', label, selector]);
}
for (const [path, label, selector, prop, decorative, forceState, backdrop] of NONTEXT_PAIRS) {
  if (!byPage.has(path)) byPage.set(path, []);
  byPage.get(path).push(['non-text', label, selector, prop, decorative, forceState, backdrop]);
}

for (const [path, items] of byPage) {
  const page = await newPage(cdp);
  await page.goto(`http://127.0.0.1:${port}${path}`);
  // The skip link only has a paintable box when focused.
  await page.eval(`document.querySelector('.skip-link')?.focus()`);
  for (const item of items) {
    if (item[0] === 'text') rows.push(await measureText(page, item[1], item[2], path));
    else rows.push(await measureNonText(page, item[1], item[2], item[3], item[4], path, item[5], item[6]));
  }
}

// Result-card pairs need a completed flow. Four runs: the shipped data for the
// unverified states the site renders today, and three fixture datasets for the
// priced states it will render the day a figure is confirmed.
for (const [dataset, label] of [
  [null, 'results, shipped'],
  ['/data/pricing.fresh.json', 'results, fresh'],
  ['/data/pricing.warn.json', 'results, 40d old'],
  ['/data/pricing.urgent.json', 'results, 120d old'],
]) {
  const page = await newPage(cdp);
  if (dataset) {
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `const rf = window.fetch;
        window.fetch = (u, o) => rf(String(u).includes('/data/pricing.json') ? ${JSON.stringify(dataset)} : u, o);`,
    });
  }
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.select('[data-input="drug"]', 'zepbound');
  await page.select('[data-input="insurance"]', 'none');
  for (const [name, selector] of RESULT_TEXT_PAIRS) {
    rows.push(await measureText(page, name, selector, label));
  }
  for (const [name, selector, prop, decorative] of RESULT_NONTEXT_PAIRS) {
    rows.push(await measureNonText(page, name, selector, prop, decorative, label));
  }
}

// States the data never reaches: the shipped class is applied to a real element
// in its real page context and measured through the real cascade.
{
  const page = await newPage(cdp);
  await page.goto(`http://127.0.0.1:${port}/methodology/`);
  for (const [, label, host, cls] of INJECTED_PAIRS) {
    await page.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(host)});
      if (!el) return;
      el.className = 'pill ' + ${JSON.stringify(cls)};
    })()`);
    rows.push(await measureText(page, label, host, '/methodology/'));
  }
}

server.close();
child.kill();

const measured = rows.filter((r) => !r.missing);
const missing = rows.filter((r) => r.missing);
const failures = measured.filter((r) => !r.pass);

if (MARKDOWN) {
  console.log('| Pair | Page | Foreground | Background | Size / weight | Ratio | Needs | Result |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of measured) {
    const size = r.kind === 'text' ? `${r.px}px / ${r.weight}${r.large ? ' (large)' : ''}` : r.kind === 'decorative' ? 'decorative' : 'UI boundary';
    const needs = r.required ? `${r.required.toFixed(2)}` : 'n/a';
    const verdict = r.kind === 'decorative' ? 'exempt' : r.pass ? 'PASS' : 'FAIL';
    console.log(`| ${r.label} | \`${r.page}\` | \`${hex(r.fg)}\` | \`${hex(r.bg)}\` | ${size} | **${r.ratio.toFixed(2)}** | ${needs} | ${verdict} |`);
  }
} else {
  const w = (s, n) => String(s).padEnd(n);
  console.log(w('Pair', 42) + w('Page', 16) + w('fg', 10) + w('bg', 10) + w('size', 16) + w('ratio', 8) + w('needs', 7) + 'result');
  console.log('-'.repeat(118));
  for (const r of measured) {
    const size = r.kind === 'text' ? `${r.px}px/${r.weight}${r.large ? ' L' : ''}` : r.kind === 'decorative' ? 'decorative' : 'UI boundary';
    console.log(
      w(r.label, 42) + w(r.page, 16) + w(hex(r.fg), 10) + w(hex(r.bg), 10) + w(size, 16) +
      w(r.ratio.toFixed(2), 8) + w(r.required ? r.required.toFixed(2) : '-', 7) +
      (r.kind === 'decorative' ? 'exempt' : r.pass ? 'PASS' : 'FAIL')
    );
  }
}

console.log(`\n${measured.length} pairs measured. ${failures.length} below threshold.`);
if (missing.length) {
  console.log(`\nNot present on the page probed (reported, never counted as a pass):`);
  for (const r of missing) console.log(`  ${r.label} (${r.page})`);
}
for (const r of failures) {
  console.log(`  FAIL ${r.label} on ${r.page}: ${r.ratio.toFixed(2)} against a required ${r.required}`);
}

process.exit(failures.length ? 1 : 0);
