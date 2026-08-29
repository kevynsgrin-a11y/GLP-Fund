/**
 * Generate the site's brand images: app icons, favicon.ico and per-page share
 * cards.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT PART OF build-pages.mjs
 *
 * The repository shipped with no images at all -- no favicon, so every page
 * load 404'd, and no og:image, so every share rendered as a grey text box. The
 * obvious fix, committing an .svg, is impossible here: `.svg` is scanned as
 * text by the integrity suite, and the mandatory `xmlns="http://www.w3.org/..."`
 * declaration is read as a non-allowlisted outbound link and fails the build.
 * That is why every icon in this project lives as an inline SVG string with no
 * xmlns. Raster output has no such problem, so these are rasterised here.
 *
 * This runs separately from `build-pages.mjs` on purpose. CI regenerates the
 * pages and fails on any diff under public/; screenshot bytes can vary with the
 * font stack and the browser build, so folding image generation into that step
 * would make the drift check flaky for reasons that have nothing to do with the
 * data. Images are generated deliberately, reviewed by eye, and committed.
 *
 *   node tools/build-images.mjs
 *
 * There is no dependency to install. Chromium is driven over the DevTools
 * Protocol using Node's built-in WebSocket, the same approach as tools/qa.mjs.
 *
 * REVIEW REQUIREMENT: nothing in the test suite can see inside a PNG. The
 * emoji ban, the no-invented-prices rule and the no-trade-dress rule are all
 * unenforceable here. A human must look at the output before it ships.
 */

import { spawn } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SITE_NAME, PUBLISHER } from '../public/engine/config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const IMG_DIR = join(PUBLIC, 'assets/img');
const OG_DIR = join(IMG_DIR, 'og');

const DATA = JSON.parse(readFileSync(join(PUBLIC, 'data/pricing.json'), 'utf8'));
const BUILT_ON = DATA.generatedAt;

const CHROME_CANDIDATES = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
];

/* ------------------------------------------------------------------ tokens */
/* Mirrored from public/assets/css/base.css. Kept literal rather than parsed:
 * these images are generated rarely and reviewed by eye, and a silent parse
 * failure producing an off-brand card is worse than a value to keep in step. */
const INK = '#14171a';
const INK_SOFT = '#4a5259';
const PAPER = '#ffffff';
const ACCENT = '#0b5c4a';
const ACCENT_INK = '#ffffff';
const RULE = '#d8dde2';

/** The masthead mark, drawn at 24x24 like every icon in icons.js. */
const RECEIPT_PATHS =
  '<path d="M5 2.75h14v16.6l-2.33-1.4-2.34 1.4-2.33-1.4-2.34 1.4L7.33 18 5 19.35Z"/>' +
  '<line x1="8.25" y1="7.5" x2="15.75" y2="7.5"/>' +
  '<line x1="8.25" y1="11" x2="15.75" y2="11"/>' +
  '<line x1="8.25" y1="14.5" x2="13" y2="14.5"/>';

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/* --------------------------------------------------------------------- CDP */

function findChrome() {
  const candidates = [process.env.CHROMIUM_PATH, ...CHROME_CANDIDATES].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `No Chromium found. Looked in:\n${candidates.join('\n')}\nSet CHROMIUM_PATH.`
    );
  }
  return found;
}

async function launchChrome() {
  const child = spawn(
    findChrome(),
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

  const wsUrl = await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(
      () => reject(new Error(`Chromium did not report a DevTools URL.\n${buffer}`)),
      30000
    );
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

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error(`Could not connect to ${url}`)), {
        once: true,
      });
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
}

/** Render an HTML string at a fixed size and return the PNG bytes. */
async function shoot(cdp, html, width, height) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const session = (m, p) => cdp.send(m, p, sessionId);

  await session('Page.enable');
  await session('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await session('Page.setDocumentContent', {
    frameId: targetId,
    html,
  });
  // One frame is not always enough for webfont-free layout to settle.
  await new Promise((r) => setTimeout(r, 250));

  const { data } = await session('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width, height, scale: 1 },
    captureBeyondViewport: true,
  });

  await cdp.send('Target.closeTarget', { targetId });
  return Buffer.from(data, 'base64');
}

/* ------------------------------------------------------------------ markup */

/**
 * The app icon: the receipt mark reversed out of the brand green.
 *
 * Deliberately not a pill, a syringe or anything resembling a manufacturer's
 * trade dress. The subject of this site is prices and evidence, not medication,
 * and the receipt is already the masthead mark.
 */
function iconHtml(size) {
  const pad = Math.round(size * 0.19);
  const inner = size - pad * 2;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}
    .plate{width:${size}px;height:${size}px;background:${ACCENT};display:flex;
      align-items:center;justify-content:center}
    svg{width:${inner}px;height:${inner}px;display:block}
  </style></head><body>
    <div class="plate">
      <svg viewBox="0 0 24 24" fill="none" stroke="${ACCENT_INK}"
           stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        ${RECEIPT_PATHS}
      </svg>
    </div>
  </body></html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A share card.
 *
 * "GLP-1" is rendered with a non-breaking hyphen (U+2011) so the product name
 * never splits across lines, which it did at this type size. U+2011 is one of
 * the punctuation characters the emoji gate permits; a heavy checkmark or a
 * warning triangle would fail the build.
 *
 * Carries the site name, the page title and the data date, and nothing else.
 * It states no price, because no price on this site is verified, and a share
 * card asserting a figure the page does not stand behind would be the single
 * most damaging thing this repository could publish.
 */
function cardHtml({ title, kicker }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:1200px;height:630px;overflow:hidden}
    body{font-family:${FONT_STACK};background:${PAPER};color:${INK};
      -webkit-font-smoothing:antialiased}
    .card{width:1200px;height:630px;box-sizing:border-box;padding:76px 84px;
      display:flex;flex-direction:column;justify-content:space-between;
      border-top:14px solid ${ACCENT}}
    .brand{display:flex;align-items:center;gap:18px}
    .brand svg{width:44px;height:44px;display:block}
    .brand span{font-size:30px;font-weight:650;letter-spacing:-0.01em}
    h1{margin:0;font-size:${title.length > 78 ? 54 : title.length > 52 ? 62 : 72}px;
      line-height:1.1;letter-spacing:-0.022em;font-weight:680;max-width:17ch;
      text-wrap:balance}
    .foot{display:flex;align-items:center;justify-content:space-between;
      border-top:2px solid ${RULE};padding-top:26px;font-size:24px;color:${INK_SOFT}}
    .kicker{color:${ACCENT};font-weight:650}
  </style></head><body>
    <div class="card">
      <div class="brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="${ACCENT}" stroke-width="1.75"
             stroke-linecap="round" stroke-linejoin="round">${RECEIPT_PATHS}</svg>
        <span>${escapeHtml(SITE_NAME)}</span>
      </div>
      <h1>${escapeHtml(title).replace(/GLP-1/g, 'GLP\u20111')}</h1>
      <div class="foot">
        <span class="kicker">${escapeHtml(kicker)}</span>
        <span>Pricing data as of ${escapeHtml(BUILT_ON)}</span>
      </div>
    </div>
  </body></html>`;
}

/* --------------------------------------------------------------------- ICO */

/**
 * Pack PNG buffers into a multi-resolution .ico.
 *
 * The format is a 6-byte header, a 16-byte directory entry per image, then the
 * payloads. Modern browsers accept PNG payloads inside ICO, so no BMP encoding
 * is needed. A dimension of 256 is written as 0 by the spec; nothing here is
 * that large, but the rule is honoured anyway.
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

/* -------------------------------------------------------------------- pages */

/** Every built page, with the title and slug its card needs. */
function collectPages() {
  const pages = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (['assets', 'data', 'engine'].includes(entry)) continue;
        walk(full);
      } else if (entry === 'index.html') {
        const html = readFileSync(full, 'utf8');
        const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? SITE_NAME;
        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
        const rel = relative(PUBLIC, full).replace(/index\.html$/, '');
        pages.push({
          slug: rel === '' ? 'home' : rel.replace(/\/$/, '').replace(/\//g, '-'),
          path: `/${rel}`,
          title: h1.replace(/<[^>]+>/g, '').trim() || title.split(':')[0].trim(),
        });
      }
    }
  };
  walk(PUBLIC);
  return pages.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** A short label describing what kind of page this is. */
function kickerFor(path) {
  if (path === '/') return 'Compare every payment pathway';
  if (path.endsWith('-cost/')) return 'Sourced and dated';
  if (path === '/methodology/') return 'How every figure is sourced';
  if (path === '/changelog/') return 'Every change, logged';
  if (path === '/privacy/' || path === '/terms/' || path === '/contact/') return 'Publisher information';
  if (path === '/about/') return `Published by ${PUBLISHER.shortName}`;
  if (path === '/alerts/') return 'Free price-change alerts';
  return 'Sourced and dated';
}

/* --------------------------------------------------------------------- main */

async function main() {
  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(OG_DIR, { recursive: true });

  const { child, wsUrl } = await launchChrome();
  const cdp = await Cdp.connect(wsUrl);
  const written = [];

  try {
    // App icons.
    const iconSizes = [512, 192, 180, 48, 32, 16];
    const rendered = new Map();
    for (const size of iconSizes) {
      rendered.set(size, await shoot(cdp, iconHtml(size), size, size));
    }

    await writeFile(join(IMG_DIR, 'icon-512.png'), rendered.get(512));
    await writeFile(join(IMG_DIR, 'icon-192.png'), rendered.get(192));
    await writeFile(join(IMG_DIR, 'apple-touch-icon.png'), rendered.get(180));
    written.push('assets/img/icon-512.png', 'assets/img/icon-192.png', 'assets/img/apple-touch-icon.png');

    const ico = buildIco([16, 32, 48].map((size) => ({ size, png: rendered.get(size) })));
    await writeFile(join(PUBLIC, 'favicon.ico'), ico);
    written.push('favicon.ico');

    // Share cards.
    for (const page of collectPages()) {
      const png = await shoot(cdp, cardHtml({ title: page.title, kicker: kickerFor(page.path) }), 1200, 630);
      await writeFile(join(OG_DIR, `${page.slug}.png`), png);
      written.push(`assets/img/og/${page.slug}.png`);
    }
  } finally {
    cdp.ws.close();
    child.kill();
  }

  console.log(`Generated ${written.length} images:`);
  for (const path of written) console.log(`  public/${path}`);
  console.log('\nThese are not checked by any test. Review them by eye before committing.');
}

await main();
