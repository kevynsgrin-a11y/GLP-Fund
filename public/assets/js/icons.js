/**
 * Hand-drawn inline SVG icon set.
 *
 * PORTFOLIO-WIDE RULE: icons are hand-drawn inline SVG only. Never emoji.
 * Emoji rendering is the single most damaging credibility signal identified
 * across our sites -- on a health-pricing page it reads as a content farm, and
 * a visitor who does not trust the presentation will not trust the numbers.
 * Enforced by the "zero emoji" test in test/integrity.test.js, not by discipline.
 *
 * Every path below is authored for this project on a 24x24 grid with a 1.75
 * stroke, round caps and round joins. No icon font, no sprite sheet, no
 * external request. Each function returns an SVG string, so this module has no
 * DOM dependency and is testable.
 *
 * Accessibility: icons default to aria-hidden="true" because they sit beside
 * text that already carries the meaning. Pass a `title` only when an icon is
 * the sole carrier of meaning, which should be rare.
 */

const VIEWBOX = '0 0 24 24';

/**
 * Wrap path content in a consistent svg element.
 *
 * @param {string} body inner SVG markup
 * @param {{size?: number, title?: string, className?: string}} [options]
 * @returns {string}
 */
function svg(body, options = {}) {
  const size = options.size ?? 20;
  const cls = options.className ? ` class="${options.className}"` : '';
  const labelled = options.title
    ? ` role="img" aria-label="${escapeAttribute(options.title)}"`
    : ' aria-hidden="true" focusable="false"';

  return (
    `<svg${cls} width="${size}" height="${size}" viewBox="${VIEWBOX}"` +
    ` fill="none" stroke="currentColor" stroke-width="1.75"` +
    ` stroke-linecap="round" stroke-linejoin="round"${labelled}>${body}</svg>`
  );
}

/** Minimal attribute escaping. Icon titles are authored, not user input, but a
 *  view-layer helper that can emit raw quotes into an attribute is a bug
 *  waiting for its first dynamic caller. */
function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Capsule on the diagonal with a seam across its short axis. Medication. */
export const pill = (o) =>
  svg(
    '<g transform="rotate(-45 12 12)">' +
      '<rect x="2" y="8.5" width="20" height="7" rx="3.5"/>' +
      '<line x1="12" y1="8.5" x2="12" y2="15.5"/>' +
      '</g>',
    o
  );

/** Barrel, plunger, graduations and needle. Injectable pathway. */
export const syringe = (o) =>
  svg(
    '<g transform="rotate(-45 12 12)">' +
      '<rect x="6" y="9" width="10.5" height="6" rx="1"/>' +
      '<line x1="16.5" y1="12" x2="21" y2="12"/>' +
      '<line x1="6" y1="12" x2="3" y2="12"/>' +
      '<line x1="3" y1="10" x2="3" y2="14"/>' +
      '<line x1="9.5" y1="9" x2="9.5" y2="11.5"/>' +
      '<line x1="12" y1="9" x2="12" y2="11.5"/>' +
      '<line x1="14.5" y1="9" x2="14.5" y2="11.5"/>' +
      '</g>',
    o
  );

/** Tablet: circle with a score line. The oral pathway, distinct from a capsule. */
export const tablet = (o) =>
  svg('<circle cx="12" cy="12" r="8.5"/><line x1="6" y1="12" x2="18" y2="12"/>', o);

/** Shield. Insurance coverage. */
export const shield = (o) =>
  svg(
    '<path d="M12 2.75 20 5.9v6.35c0 4.4-3.35 7.9-8 9.25-4.65-1.35-8-4.85-8-9.25V5.9Z"/>',
    o
  );

/** Shield with a check. Coverage confirmed. */
export const shieldCheck = (o) =>
  svg(
    '<path d="M12 2.75 20 5.9v6.35c0 4.4-3.35 7.9-8 9.25-4.65-1.35-8-4.85-8-9.25V5.9Z"/>' +
      '<path d="M8.5 12.1 11 14.6l4.5-5"/>',
    o
  );

/** Receipt with a torn foot and ruled lines. The methodology page's own mark:
 *  the brief asks for that page to look like a receipt, not a disclaimer. */
export const receipt = (o) =>
  svg(
    '<path d="M5 2.75h14v16.6l-2.33-1.4-2.34 1.4-2.33-1.4-2.34 1.4L7.33 18 5 19.35Z"/>' +
      '<line x1="8.25" y1="7.5" x2="15.75" y2="7.5"/>' +
      '<line x1="8.25" y1="11" x2="15.75" y2="11"/>' +
      '<line x1="8.25" y1="14.5" x2="13" y2="14.5"/>',
    o
  );

/** Clock. Verification date and staleness. */
export const clock = (o) =>
  svg('<circle cx="12" cy="12" r="8.75"/><path d="M12 7.25V12l3.4 2.1"/>', o);

/** Triangle with a bang. Staleness warning, risk language. */
export const alertTriangle = (o) =>
  svg(
    '<path d="M12 3.5 21.5 20H2.5Z"/>' +
      '<line x1="12" y1="9.75" x2="12" y2="14"/>' +
      '<line x1="12" y1="16.75" x2="12" y2="16.85"/>',
    o
  );

/** Circle with a check. A confirmed figure. */
export const checkCircle = (o) =>
  svg('<circle cx="12" cy="12" r="8.75"/><path d="M8.25 12.25 11 15l4.75-5.5"/>', o);

/** Circle with a query. An unverified figure -- never a price. */
export const helpCircle = (o) =>
  svg(
    '<circle cx="12" cy="12" r="8.75"/>' +
      '<path d="M9.5 9.4a2.6 2.6 0 1 1 3.6 2.4c-.68.3-1.1.98-1.1 1.72v.23"/>' +
      '<line x1="12" y1="16.6" x2="12" y2="16.7"/>',
    o
  );

/** Two figures split by a slash. A conflicting figure. */
export const scaleConflict = (o) =>
  svg(
    '<line x1="7" y1="19" x2="17" y2="5"/>' +
      '<circle cx="7.25" cy="7.25" r="2.75"/>' +
      '<circle cx="16.75" cy="16.75" r="2.75"/>',
    o
  );

/** Box with an escaping arrow. Every source link carries one. */
export const externalLink = (o) =>
  svg(
    '<path d="M13.5 4.5H19.5V10.5"/>' +
      '<line x1="19.5" y1="4.5" x2="11.5" y2="12.5"/>' +
      '<path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4"/>',
    o
  );

/** Bell. The price-change alert list. */
export const bell = (o) =>
  svg(
    '<path d="M18 9.5a6 6 0 1 0-12 0c0 4.2-1.5 5.5-1.5 5.5h15S18 13.7 18 9.5Z"/>' +
      '<path d="M10.4 18.5a1.85 1.85 0 0 0 3.2 0"/>',
    o
  );

/** Colonnaded facade. Federal programmes, Medicare, TrumpRx. */
export const government = (o) =>
  svg(
    '<path d="M3.5 9 12 4l8.5 5"/>' +
      '<line x1="3.5" y1="20" x2="20.5" y2="20"/>' +
      '<line x1="5.25" y1="9" x2="5.25" y2="20"/>' +
      '<line x1="9.75" y1="12" x2="9.75" y2="20"/>' +
      '<line x1="14.25" y1="12" x2="14.25" y2="20"/>' +
      '<line x1="18.75" y1="9" x2="18.75" y2="20"/>',
    o
  );

/** Factory-ish flask. Manufacturer direct-pay. */
export const flask = (o) =>
  svg(
    '<path d="M9.5 3.5h5v5l4.4 8.1A2 2 0 0 1 17.14 20H6.86a2 2 0 0 1-1.76-3.4L9.5 8.5Z"/>' +
      '<line x1="9.5" y1="3.5" x2="14.5" y2="3.5"/>' +
      '<line x1="7.4" y1="14.5" x2="16.6" y2="14.5"/>',
    o
  );

/** Open hand. Patient assistance, income-gated programmes. */
export const helpingHand = (o) =>
  svg(
    '<path d="M4 13.5V8.75a1.5 1.5 0 0 1 3 0v3.25"/>' +
      '<path d="M7 11.5V6.25a1.5 1.5 0 0 1 3 0v5.25"/>' +
      '<path d="M10 11.5V7a1.5 1.5 0 0 1 3 0v4.5"/>' +
      '<path d="M13 11.75V9.5a1.5 1.5 0 0 1 3 0v5.25c0 3.1-2.35 5.25-5.5 5.25S5 17.85 5 14.75V13.5"/>',
    o
  );

/** Downward chevron. Progressive disclosure. */
export const chevronDown = (o) => svg('<path d="M5.5 9.25 12 15.75l6.5-6.5"/>', o);

/** Rightward arrow. Source and pathway links. */
export const arrowRight = (o) =>
  svg('<line x1="4" y1="12" x2="19" y2="12"/><path d="M13.25 6.25 19 12l-5.75 5.75"/>', o);

/** Descending bars. Cheapest-first ranking. */
export const rankDown = (o) =>
  svg(
    '<line x1="4.5" y1="5.5" x2="19.5" y2="5.5"/>' +
      '<line x1="4.5" y1="12" x2="14.5" y2="12"/>' +
      '<line x1="4.5" y1="18.5" x2="9.5" y2="18.5"/>',
    o
  );

/** Crossed-out eye. The no-tracking, nothing-persisted promise. */
export const noTracking = (o) =>
  svg(
    '<path d="M4 12s3.4-5.5 8-5.5 8 5.5 8 5.5-3.4 5.5-8 5.5S4 12 4 12Z"/>' +
      '<circle cx="12" cy="12" r="2.25"/>' +
      '<line x1="4.5" y1="19.5" x2="19.5" y2="4.5"/>',
    o
  );

/** The complete registry, for the handoff doc and the icon lint. */
export const ICONS = Object.freeze({
  pill,
  syringe,
  tablet,
  shield,
  shieldCheck,
  receipt,
  clock,
  alertTriangle,
  checkCircle,
  helpCircle,
  scaleConflict,
  externalLink,
  bell,
  government,
  flask,
  helpingHand,
  chevronDown,
  arrowRight,
  rankDown,
  noTracking,
});

/**
 * Look up an icon by name. Returns an empty string for an unknown name rather
 * than throwing: a missing decorative icon must never take down a page that is
 * rendering a price someone is standing in a pharmacy to read.
 *
 * @param {string} name
 * @param {object} [options]
 * @returns {string}
 */
export function icon(name, options) {
  const fn = ICONS[name];
  return fn ? fn(options) : '';
}
