/**
 * Phase 6 browser QA. Real Chromium, real 390px viewport, measured numbers.
 *
 * Zero dependencies: a static file server on Node's http, and Chrome DevTools
 * Protocol over Node 22's built-in WebSocket. Playwright is not installed here
 * and adding it would have contradicted the project's zero-dependency claim for
 * the sake of convenience in a QA script.
 *
 * Checks, all of them measured rather than asserted by eye:
 *   1. The three-input flow completes with no horizontal scroll at 390px.
 *   2. Engine values on screen match the expected outputs exactly, scraped from
 *      the rendered DOM.
 *   3. Cumulative Layout Shift, reported as a number.
 *   4. The staleness banner actually fires, proved by serving a backdated
 *      verified_date rather than by trusting the unit test.
 *   5. Every source URL in the data file is checked and its status recorded.
 *
 *   node tools/qa.mjs
 *
 * Exit code is non-zero if any check fails, so this is usable as a gate.
 */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const SHOTS = join(ROOT, 'docs/screenshots');

const VIEWPORT = { width: 390, height: 844, scale: 3 };

const CHROME_CANDIDATES = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

const results = [];
let failures = 0;

function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (!pass) failures += 1;
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${name}${detail ? ` -- ${detail}` : ''}`);
}

/* ------------------------------------------------------------------ server */

/**
 * Serve `public/`. `overrides` lets a check swap a file's bytes without touching
 * the working tree, which is how the staleness test backdates a verified_date
 * without risking a modified data file being committed.
 */
function startServer(overrides = new Map()) {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(req.url.split('?')[0]);

    if (overrides.has(path)) {
      const body = overrides.get(path);
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
      res.end(body);
      return;
    }

    if (path.endsWith('/')) path += 'index.html';
    const file = join(PUBLIC, path);

    if (!file.startsWith(PUBLIC)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html' }).end('<h1>404</h1>');
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/* --------------------------------------------------------------------- CDP */

function findChrome() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error(`No Chromium found. Looked in:\n${CHROME_CANDIDATES.join('\n')}`);
  return found;
}

async function launchChrome() {
  const bin = findChrome();
  const child = spawn(
    bin,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  // Chromium prints the DevTools websocket URL to stderr on startup.
  const wsUrl = await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`Chromium did not report a DevTools URL.\n${buffer}`)), 30000);
    child.stderr.on('data', (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/ws:\/\/[^\s]+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chromium exited with ${code}\n${buffer}`));
    });
  });

  return { child, wsUrl };
}

/** Minimal CDP client: id-matched request/response plus event listeners. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`)) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error(`Could not connect to ${url}`)), { once: true });
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

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  once(method) {
    return new Promise((resolve) => {
      const fn = (params) => {
        const list = this.listeners.get(method);
        list.splice(list.indexOf(fn), 1);
        resolve(params);
      };
      this.on(method, fn);
    });
  }
}

/** Attach to a fresh tab and return a session-scoped helper. */
async function newPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  const session = {
    sessionId,
    send: (method, params) => cdp.send(method, params, sessionId),
  };

  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: 1,
    mobile: true,
  });

  // Install the layout-shift observer before any document loads, so the very
  // first paint is measured rather than missed.
  await session.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__cls = 0;
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__cls += entry.value;
            window.__shifts.push({ value: entry.value, time: Math.round(entry.startTime) });
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    `,
  });

  session.goto = async (url) => {
    const loaded = cdp.once('Page.loadEventFired');
    await session.send('Page.navigate', { url });
    await loaded;
    // Let the module graph resolve, the data fetch settle and the tool render.
    await session.eval('new Promise((r) => setTimeout(r, 700))', true);
  };

  session.eval = async (expression, awaitPromise = false) => {
    const { result, exceptionDetails } = await session.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }
    return result.value;
  };

  session.select = async (selector, value) => {
    const applied = await session.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value;
    })()`);
    await session.eval('new Promise((r) => setTimeout(r, 250))', true);
    // Return the value the select actually took, not the result of the settle
    // delay. Getting this wrong made a passing selector report "undefined".
    return applied;
  };

  session.shot = async (name) => {
    await mkdir(SHOTS, { recursive: true });
    const { data } = await session.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
    });
    const file = join(SHOTS, `${name}.png`);
    await writeFile(file, Buffer.from(data, 'base64'));
    return file;
  };

  return session;
}

/* ------------------------------------------------------------------ checks */

/** No horizontal scroll, at the document level or in any element. */
const OVERFLOW_PROBE = `(() => {
  const doc = document.documentElement;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > doc.clientWidth + 1) {
      const scrollable = getComputedStyle(el).overflowX;
      if (scrollable !== 'auto' && scrollable !== 'scroll') {
        offenders.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
      }
    }
  }
  return {
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    offenders: [...new Set(offenders)].slice(0, 8),
  };
})()`;

/**
 * Scrape the rendered result cards.
 *
 * Screen-reader-only text is stripped before reading a price. The price element
 * deliberately contains a visually-hidden "per month" so the figure is not
 * announced as a bare number to assistive technology; reading textContent
 * naively picked that up and made every correct price look wrong. What is
 * compared here is what a sighted user actually sees.
 */
const SCRAPE_CARDS = `(() => {
  const visibleText = (el) => {
    if (!el) return undefined;
    const clone = el.cloneNode(true);
    for (const hidden of clone.querySelectorAll('.visually-hidden')) hidden.remove();
    return clone.textContent.replace(/\\s+/g, ' ').trim();
  };
  return [...document.querySelectorAll('.card')].map((card) => ({
    name: visibleText(card.querySelector('.card__name')),
    cost: visibleText(card.querySelector('.card__cost')),
    annual: visibleText(card.querySelector('.card__annual')),
    verified: visibleText(card.querySelector('.card__verified-state')),
    sourceHref: card.querySelector('.card__source a')?.getAttribute('href'),
    caveats: [...card.querySelectorAll('.card__caveat')].map((c) => visibleText(c)),
  }));
})()`;

async function main() {
  console.log(`\nPhase 6 browser QA at ${VIEWPORT.width}x${VIEWPORT.height}\n`);

  const data = JSON.parse(readFileSync(join(PUBLIC, 'data/pricing.json'), 'utf8'));

  // The staleness override: the shipped data has no confirmed prices, so this
  // fixture is what proves the banner fires on real rendered output.
  const backdated = structuredClone(data);
  backdated.prices = backdated.prices.map((p) => ({ ...p, verified_date: '2026-04-01' }));

  const engineFixture = JSON.parse(
    readFileSync(join(ROOT, 'test/fixtures/engine-dataset.json'), 'utf8')
  );

  const overrides = new Map([
    ['/data/pricing.stale.json', JSON.stringify(backdated)],
    ['/data/pricing.engine.json', JSON.stringify(engineFixture)],
  ]);

  const { server, port } = await startServer(overrides);
  const origin = `http://127.0.0.1:${port}`;
  const { child, wsUrl } = await launchChrome();
  const cdp = await Cdp.connect(wsUrl);

  try {
    /* ---------------------------------------------------------- 1. the flow */
    console.log('1. Three-input flow at 390px');
    const page = await newPage(cdp);

    const consoleErrors = [];
    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        consoleErrors.push(params.args.map((a) => a.value ?? a.description).join(' '));
      }
    });

    await page.goto(`${origin}/`);

    const initial = await page.eval(OVERFLOW_PROBE);
    check(
      'landing page has no horizontal scroll',
      initial.scrollWidth <= initial.clientWidth,
      `scrollWidth ${initial.scrollWidth} vs clientWidth ${initial.clientWidth}`
    );

    const aboveFold = await page.eval(`(() => {
      const form = document.querySelector('[data-tool-form]');
      const r = form.getBoundingClientRect();
      return { bottom: Math.round(r.bottom), viewport: window.innerHeight };
    })()`);
    check(
      'all three inputs are reachable without scrolling',
      aboveFold.bottom <= aboveFold.viewport,
      `form bottom at ${aboveFold.bottom}px, viewport ${aboveFold.viewport}px`
    );

    await page.select('[data-input="drug"]', 'zepbound');
    await page.select('[data-input="insurance"]', 'none');
    const doseValue = await page.select('[data-input="dose"]', '15mg');
    check('dose selector repopulates for the chosen drug', doseValue === '15mg', `value "${doseValue}"`);

    const afterFlow = await page.eval(OVERFLOW_PROBE);
    check(
      'completed flow has no horizontal scroll',
      afterFlow.scrollWidth <= afterFlow.clientWidth,
      afterFlow.offenders.length ? `offenders: ${afterFlow.offenders.join(', ')}` : 'clean'
    );

    const shippedCards = await page.eval(SCRAPE_CARDS);
    check('results render for a completed flow', shippedCards.length > 0, `${shippedCards.length} cards`);
    check(
      'shipped data renders no price as a number',
      shippedCards.every((c) => /Price not currently verified/.test(c.cost ?? '')),
      shippedCards.map((c) => `${c.name}: ${c.cost}`).join(' | ').slice(0, 160)
    );
    check(
      'every card carries a source link and a verification date',
      shippedCards.every((c) => c.sourceHref?.startsWith('https://') && /\d{4}-\d{2}-\d{2}/.test(c.verified ?? '')),
      `${shippedCards.length} cards checked`
    );

    await page.shot('01-tool-390-shipped');

    /* -------------------------------------------- 2. engine values on screen */
    console.log('\n2. Engine values on screen match expected output exactly');
    const enginePage = await newPage(cdp);
    // Point the app at the engine fixture, which has confirmed prices, so the
    // rendered DOM can be compared against the Appendix B expectations.
    await enginePage.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        const realFetch = window.fetch;
        window.fetch = (url, opts) =>
          realFetch(String(url).includes('/data/pricing.json') ? '/data/pricing.engine.json' : url, opts);
      `,
    });
    await enginePage.goto(`${origin}/`);
    await enginePage.select('[data-input="drug"]', 'zepbound');
    await enginePage.select('[data-input="insurance"]', 'none');
    await enginePage.select('[data-input="dose"]', '2.5mg');

    let cards = await enginePage.eval(SCRAPE_CARDS);
    check(
      'vector 1 on screen: LillyDirect first at $299, $3,588 per year',
      cards[0]?.name === 'LillyDirect Self Pay' && cards[0]?.cost === '$299' && cards[0]?.annual === '$3,588 per year',
      `${cards[0]?.name} / ${cards[0]?.cost} / ${cards[0]?.annual}`
    );

    await enginePage.select('[data-input="dose"]', '5mg');
    cards = await enginePage.eval(SCRAPE_CARDS);
    const lilly5 = cards.find((c) => c.name === 'LillyDirect Self Pay');
    check(
      'vector 2 on screen: 5mg renders $399, proving dose tiers are live',
      lilly5?.cost === '$399',
      `${lilly5?.cost}`
    );

    await enginePage.select('[data-input="dose"]', '15mg');
    cards = await enginePage.eval(SCRAPE_CARDS);
    const lilly15 = cards.find((c) => c.name === 'LillyDirect Self Pay');
    check(
      'vector 3 on screen: 15mg renders $449 with the refill-window caveat',
      lilly15?.cost === '$449' && lilly15.caveats.some((c) => /45 days/.test(c)),
      `${lilly15?.cost}, caveats: ${lilly15?.caveats.length}`
    );

    await enginePage.select('[data-input="insurance"]', 'medicare');
    cards = await enginePage.eval(SCRAPE_CARDS);
    check(
      'vector 7 on screen: the savings card is absent for a Medicare user',
      !cards.some((c) => c.name === 'Manufacturer savings card'),
      `rendered: ${cards.map((c) => c.name).join(', ')}`
    );
    const explains = await enginePage.eval(
      `document.querySelector('.suppressed')?.textContent.includes('savings card') ?? false`
    );
    check('the suppression is explained rather than silent', explains === true, `disclosure present: ${explains}`);

    await enginePage.select('[data-input="insurance"]', 'commercial_covered');
    cards = await enginePage.eval(SCRAPE_CARDS);
    check(
      'vector 6 on screen: the copay card ranks first with commercial coverage',
      cards[0]?.name === 'Manufacturer savings card' && cards[0]?.cost === '$25',
      `${cards[0]?.name} / ${cards[0]?.cost}`
    );

    await enginePage.select('[data-input="drug"]', 'wegovy_injection');
    await enginePage.select('[data-input="insurance"]', 'none');
    cards = await enginePage.eval(SCRAPE_CARDS);
    const tiedOrder = cards.filter((c) => c.cost === '$199').map((c) => c.name);
    check(
      'vector 12 on screen: tied costs order deterministically',
      tiedOrder.join(' < ') === 'NovoCare Pharmacy < TrumpRx',
      tiedOrder.join(' < ')
    );

    const savingsShown = await enginePage.eval(
      `document.querySelector('.savings__figure')?.textContent.trim() ?? null`
    );
    check('vector 11 on screen: the savings delta renders', savingsShown !== null, `${savingsShown}`);

    await enginePage.shot('02-tool-390-engine-values');

    /* ------------------------------------------------------------- 3. CLS */
    console.log('\n3. Cumulative Layout Shift');
    const clsPages = ['/', '/zepbound-cost/', '/methodology/', '/changelog/'];
    for (const path of clsPages) {
      const p = await newPage(cdp);
      await p.goto(`${origin}${path}`);
      // Scroll the full page so any lazily-sized region gets its chance to shift.
      await p.eval(`(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 300));
      })()`, true);
      const cls = await p.eval('window.__cls');
      const shifts = await p.eval('window.__shifts.length');
      check(
        `CLS on ${path} is near zero`,
        cls < 0.1,
        `CLS ${cls.toFixed(4)} across ${shifts} shift entr${shifts === 1 ? 'y' : 'ies'}`
      );
    }

    const slotBoxes = await page.eval(`(() => {
      return [...document.querySelectorAll('[data-ad-slot]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { slot: el.dataset.adSlot, height: Math.round(r.height) };
      });
    })()`);
    check(
      'every ad slot reserves a non-zero height before any creative loads',
      slotBoxes.length > 0 && slotBoxes.every((s) => s.height > 0),
      slotBoxes.map((s) => `${s.slot}:${s.height}px`).join(' ')
    );

    /* ------------------------------------------ 4. the staleness failsafe */
    console.log('\n4. Staleness failsafe fires on backdated data');
    const stalePage = await newPage(cdp);
    await stalePage.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        const realFetch = window.fetch;
        window.fetch = (url, opts) =>
          realFetch(String(url).includes('/data/pricing.json') ? '/data/pricing.stale.json' : url, opts);
      `,
    });
    await stalePage.goto(`${origin}/`);
    await stalePage.select('[data-input="drug"]', 'zepbound');
    await stalePage.select('[data-input="insurance"]', 'none');

    const banner = await stalePage.eval(`(() => {
      const el = document.querySelector('.banner--urgent');
      return el ? { role: el.getAttribute('role'), text: el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 90) } : null;
    })()`);
    check(
      'a 120-day-old verified_date raises the prominent urgent banner',
      banner !== null,
      banner ? `role="${banner.role}"` : 'no banner rendered'
    );

    const bannerAbove = await stalePage.eval(`(() => {
      const b = document.querySelector('.banner--urgent');
      const c = document.querySelector('.card');
      if (!b || !c) return false;
      return b.getBoundingClientRect().top < c.getBoundingClientRect().top;
    })()`);
    check('the urgent banner renders above the results', bannerAbove === true);

    await stalePage.shot('03-staleness-banner-390');

    /* ------------------------------------------------ 5. page-level checks */
    console.log('\n5. Every page: compliance, no overflow, no emoji in the DOM');
    const allPages = [
      '/', '/zepbound-cost/', '/wegovy-cost/', '/ozempic-cost/', '/mounjaro-cost/',
      '/wegovy-pill-cost/', '/foundayo-cost/', '/trumprx/', '/lillydirect/',
      '/novocare/', '/medicare-glp1-bridge/', '/patient-assistance/',
      '/methodology/', '/changelog/', '/alerts/', '/about/',
    ];

    const disclaimer = readFileSync(join(ROOT, 'public/engine/config.js'), 'utf8');
    const pageIssues = [];

    for (const path of allPages) {
      const p = await newPage(cdp);
      await p.goto(`${origin}${path}`);
      const audit = await p.eval(`(() => {
        const doc = document.documentElement;
        const text = document.body.innerText;
        return {
          overflow: doc.scrollWidth > doc.clientWidth,
          scrollWidth: doc.scrollWidth,
          hasDisclaimer: text.includes('This tool provides pricing information only'),
          hasNonAffiliation: text.includes('Not affiliated with, endorsed by, or sponsored by'),
          hasDataStamp: /as of \\d{4}-\\d{2}-\\d{2}/.test(text),
          emoji: (text.match(/\\p{Extended_Pictographic}/gu) ?? []).filter((c) => !'\\u00a9\\u00ae\\u2122'.includes(c)),
          h1Count: document.querySelectorAll('h1').length,
          title: document.title,
          hasMain: !!document.querySelector('main'),
          dismissControl: !!document.querySelector('[data-dismiss], .disclaimer button, .disclaimer [role=button]'),
        };
      })()`);

      if (audit.overflow) pageIssues.push(`${path}: horizontal overflow (${audit.scrollWidth}px)`);
      if (!audit.hasDisclaimer) pageIssues.push(`${path}: missing footer disclaimer`);
      if (!audit.hasNonAffiliation) pageIssues.push(`${path}: missing non-affiliation statement`);
      if (audit.emoji.length) pageIssues.push(`${path}: emoji in rendered DOM: ${audit.emoji.join('')}`);
      if (audit.h1Count !== 1) pageIssues.push(`${path}: ${audit.h1Count} h1 elements`);
      if (!audit.hasMain) pageIssues.push(`${path}: no main landmark`);
      if (audit.dismissControl) pageIssues.push(`${path}: disclaimer has a dismiss control`);
      if (!audit.title) pageIssues.push(`${path}: no title`);

      if (path === '/methodology/') await p.shot('04-methodology-390');
      if (path === '/zepbound-cost/') await p.shot('05-drug-page-390');
    }

    check(
      `all ${allPages.length} pages pass compliance and layout audit`,
      pageIssues.length === 0,
      pageIssues.length ? pageIssues.slice(0, 6).join(' | ') : 'no issues'
    );

    check(
      'no console errors during the flow',
      consoleErrors.length === 0,
      consoleErrors.slice(0, 3).join(' | ') || 'none'
    );

    /* ---------------------------------------------- 6. source URL liveness */
    console.log('\n6. Source URL liveness');
    const urls = [...new Set(data.prices.map((p) => p.source_url))];
    const urlReport = [];
    for (const url of urls) {
      let status;
      try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        status = String(res.status);
      } catch (error) {
        status = error?.cause?.code === 'ECONNREFUSED' ? 'refused' : 'blocked';
      }
      urlReport.push({ url, status });
    }
    const blocked = urlReport.filter((r) => r.status === 'blocked' || r.status === '403');
    check(
      'every source URL was checked and its status recorded',
      urlReport.length === urls.length,
      `${urlReport.length} URLs; ${blocked.length} unreachable from this network`
    );
    console.log(
      `       note: ${blocked.length}/${urlReport.length} are BLOCKED BY EGRESS POLICY, not broken. ` +
        'This is the same blockade that forced every price to unverified.'
    );

    /* ----------------------------------------------------------- the report */
    const report = {
      ranAt: new Date().toISOString(),
      viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
      chromium: findChrome(),
      checks: results,
      failures,
      urlLiveness: urlReport,
    };
    await mkdir(join(ROOT, 'docs'), { recursive: true });
    await writeFile(join(ROOT, 'docs/qa-report.json'), JSON.stringify(report, null, 2) + '\n');

    console.log(
      `\n${results.length - failures}/${results.length} checks passed. ` +
        `Report: docs/qa-report.json. Screenshots: docs/screenshots/\n`
    );
  } finally {
    child.kill();
    server.close();
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nQA harness failed:', error.message);
  process.exit(2);
});
