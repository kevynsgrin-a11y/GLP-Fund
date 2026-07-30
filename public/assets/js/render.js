/**
 * View layer. Pure string builders: takes engine output, returns HTML.
 *
 * No DOM access here either, which keeps rendering unit-testable and keeps the
 * one file that does touch the DOM (app.js) small enough to read in a sitting.
 *
 * This file is the layer a later design pass replaces. It may change every tag
 * and every class name. It may not change the engine or its data contract.
 * See docs/v0-handoff.md.
 */

import { icon } from './icons.js';
import { describeAge } from '../../engine/staleness.js';
import { UNVERIFIED_DISPLAY } from '../../engine/pricing.js';

/**
 * Escape text for HTML interpolation.
 *
 * Every dynamic value in this file goes through here. The data file is authored
 * in-house, so this is not primarily an XSS control -- it is a correctness
 * control: a drug name or a caveat containing an ampersand must render as an
 * ampersand rather than silently breaking the markup around a price.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Map a confidence value to the icon that represents it. */
const CONFIDENCE_ICON = {
  confirmed: 'checkCircle',
  conflicting: 'scaleConflict',
  unverified: 'helpCircle',
};

/** Human label for a staleness state, used in the verified stamp. */
const STALENESS_LABEL = {
  fresh: 'Verified',
  warn: 'Verified, may be outdated',
  urgent: 'Verified, likely outdated',
};

/**
 * The verified stamp. Rendered on every result card, non-optionally, with a link
 * to the primary source. If a price is on screen, this is on screen.
 *
 * @param {object} result
 * @param {string} today
 * @returns {string}
 */
export function renderVerifiedStamp(result, today) {
  const unverified = result.confidence !== 'confirmed';
  const state = unverified ? 'unverified' : result.staleness;
  const label = unverified
    ? result.confidence === 'conflicting'
      ? 'Sources conflict'
      : 'Not verified'
    : STALENESS_LABEL[result.staleness];

  const iconName = unverified ? CONFIDENCE_ICON[result.confidence] : 'clock';

  return `
    <p class="card__verified">
      <span class="card__verified-state card__verified-state--${esc(state)}">
        ${icon(iconName, { size: 15 })}
        ${esc(label)} ${esc(result.verifiedDate)}
      </span>
      <span class="card__source">
        <a href="${esc(result.sourceUrl)}" rel="noopener nofollow" target="_blank">
          Source ${icon('externalLink', { size: 14 })}<span class="visually-hidden">, opens in a new tab</span>
        </a>
      </span>
      <span class="visually-hidden">${esc(describeAge(result.verifiedDate, today))}</span>
    </p>`;
}

/**
 * One result card.
 *
 * @param {object} result
 * @param {number} index
 * @param {string} today
 * @returns {string}
 */
export function renderCard(result, index, today) {
  const isBest = index === 0 && result.monthlyCost !== null;
  const unverified = result.monthlyCost === null;

  const rank = isBest
    ? `<p class="card__rank">${icon('rankDown', { size: 14 })} Lowest verified cost</p>`
    : '';

  const cost = unverified
    ? `<p class="card__cost card__cost--unverified">${esc(UNVERIFIED_DISPLAY)}</p>
       <p class="card__annual">
         <a href="${esc(result.officialUrl)}" rel="noopener nofollow" target="_blank">
           Check ${esc(result.pathwayLabel)} directly ${icon('arrowRight', { size: 13 })}
         </a>
       </p>`
    : `<p class="card__cost">${esc(result.displayCost)}<span class="visually-hidden"> per month</span></p>
       <p class="card__annual">${esc(result.displayAnnualCost)} per year</p>`;

  const notes = [
    ...result.eligibilityNotes.map(
      (n) => `<li class="card__note">${icon('shield', { size: 15 })}<span>${esc(n)}</span></li>`
    ),
    ...result.caveats.map(
      (c) => `<li class="card__caveat">${icon('alertTriangle', { size: 15 })}<span>${esc(c)}</span></li>`
    ),
  ].join('');

  return `
    <li class="card${isBest ? ' card--best' : ''}">
      ${rank}
      <h3 class="card__name">${esc(result.pathwayLabel)}</h3>
      ${cost}
      ${notes ? `<ul class="card__notes">${notes}</ul>` : ''}
      ${renderVerifiedStamp(result, today)}
    </li>`;
}

/**
 * The staleness banner. `warn` renders inline on the affected card via its
 * stamp; `urgent` renders here, prominently, above all results.
 *
 * @param {'fresh'|'warn'|'urgent'} state
 * @returns {string}
 */
export function renderStalenessBanner(state) {
  if (state === 'fresh') return '';

  if (state === 'urgent') {
    return `
      <div class="banner banner--urgent" role="alert">
        ${icon('alertTriangle', { size: 20 })}
        <span>
          <strong>These prices are likely out of date.</strong>
          At least one figure below was last verified more than 60 days ago. GLP-1
          prices have moved repeatedly. Confirm directly with the manufacturer or
          your pharmacy before acting on anything here.
        </span>
      </div>`;
  }

  return `
    <div class="banner banner--warn">
      ${icon('clock', { size: 20 })}
      <span>
        <strong>Some prices may be outdated.</strong>
        At least one figure below was last verified more than 30 days ago. Check the
        verification date on each card.
      </span>
    </div>`;
}

/**
 * The savings summary. Renders nothing at all when the comparison is not
 * possible: an incomparable delta must not be dressed up as a zero saving.
 *
 * @param {object} summary
 * @param {object} drugMeta
 * @returns {string}
 */
export function renderSavings(summary, drugMeta) {
  if (!summary.comparable || !summary.isSaving) return '';

  return `
    <section class="savings" aria-labelledby="savings-heading">
      <h2 id="savings-heading" class="visually-hidden">Potential saving</h2>
      <p>
        Against the ${esc(drugMeta?.label ?? 'medication')} list price of
        ${esc(summary.displayCurrentMonthly)} a month, the lowest verified pathway saves
      </p>
      <p class="savings__figure">${esc(summary.displayMonthlyDelta)} a month</p>
      <p>
        That is <strong>${esc(summary.displayAnnualDelta)} a year</strong>${
          summary.percentReduction !== null
            ? `, a ${esc(summary.percentReduction)} percent reduction`
            : ''
        }. List price is shown as a reference point, not as an option.
      </p>
    </section>`;
}

/**
 * Pathways hidden for this user, with the rule and reason that hid each.
 *
 * Silently omitting an option makes a tool look incomplete. Explaining the
 * omission makes it look honest, and it pre-empts the single most common
 * support question a pricing tool receives: "why don't I see the copay card?"
 *
 * @param {object[]} hidden
 * @returns {string}
 */
export function renderSuppressed(hidden) {
  if (hidden.length === 0) return '';

  const items = hidden
    .map(
      (h) => `
      <li>
        <strong>${esc(h.pathwayLabel)}</strong> is not shown.
        ${esc(h.suppressionReason ?? 'You are not eligible for this pathway.')}
      </li>`
    )
    .join('');

  return `
    <details class="suppressed">
      <summary>${icon('chevronDown', { size: 14 })} Why am I not seeing ${hidden.length === 1 ? 'one pathway' : `${hidden.length} pathways`}?</summary>
      <ul>${items}</ul>
    </details>`;
}

/**
 * The full results region.
 *
 * @param {object} params
 * @returns {string}
 */
export function renderResults({ results, hidden, summary, drugMeta, staleness, today }) {
  if (results.length === 0) {
    return `
      <div class="empty">
        ${icon('helpCircle', { size: 24 })}
        <p>No pathway data is available for this combination yet.</p>
        <p><a href="/methodology/">See what we have verified and what we have not</a>.</p>
      </div>
      ${renderSuppressed(hidden)}`;
  }

  const priced = results.filter((r) => r.monthlyCost !== null).length;

  // "Cheapest first" is a claim about the ordering, and it is only true when
  // there are verified prices to order BY. With no priced pathway every result
  // ties, so the list falls back to alphabetical -- and a heading promising a
  // cost ranking over an alphabetical list is exactly the kind of small, quiet
  // dishonesty this site exists to avoid. The heading tells the truth about what
  // the ordering actually is.
  const heading =
    priced === 0
      ? 'Your pathways'
      : priced === 1
        ? 'Your pathways, verified price first'
        : 'Your pathways, cheapest first';

  const orderNote =
    priced === 0
      ? `<p class="results__count">
           ${results.length} pathway${results.length === 1 ? '' : 's'} available to you.
           <strong>None has a price we have been able to verify</strong>, so these are listed
           alphabetically rather than by cost. We cannot tell you which is cheapest.
           <a href="/methodology/">Why</a>.
         </p>`
      : `<p class="results__count">
           ${results.length} pathway${results.length === 1 ? '' : 's'},
           ${priced} with a verified price${
             priced < results.length
               ? '. Pathways we could not verify are listed after the priced ones and are not ranked'
               : ''
           }.
         </p>`;

  return `
    ${renderStalenessBanner(staleness)}
    <div class="results__head">
      <h2 id="results-heading">${heading}</h2>
      ${orderNote}
    </div>
    <ol class="card-list">
      ${results.map((r, i) => renderCard(r, i, today)).join('')}
    </ol>
    ${renderSavings(summary, drugMeta)}
    ${renderSuppressed(hidden)}`;
}

/**
 * Options for the dose selector, derived from the dataset rather than hardcoded
 * so a dose ladder change is a data edit.
 *
 * @param {object} dataset
 * @param {string} drug
 * @returns {string}
 */
export function renderDoseOptions(dataset, drug) {
  const doses = dataset?.drugs?.[drug]?.doses ?? [];
  const label = (d) =>
    d
      .replace(/_/g, ' ')
      .replace(/^lowest dose$/, 'Lowest dose')
      .replace(/^higher doses$/, 'Higher doses');

  return [
    '<option value="any">Not sure yet, or any dose</option>',
    ...doses.map((d) => `<option value="${esc(d)}">${esc(label(d))}</option>`),
  ].join('');
}

/**
 * Options for the medication selector.
 *
 * @param {object} dataset
 * @returns {string}
 */
export function renderDrugOptions(dataset) {
  return [
    '<option value="">Select your medication</option>',
    ...Object.entries(dataset?.drugs ?? {}).map(
      ([id, meta]) =>
        `<option value="${esc(id)}">${esc(meta.label)}${
          meta.genericName ? ` (${esc(meta.genericName)})` : ''
        }</option>`
    ),
  ].join('');
}

/** The insurance situations the engine's rule table knows how to reason about. */
export const INSURANCE_OPTIONS = Object.freeze([
  { value: 'none', label: 'No insurance, paying cash' },
  { value: 'commercial_covered', label: 'Commercial insurance, covers this medication' },
  { value: 'commercial_not_covered', label: 'Commercial insurance, does not cover it' },
  { value: 'medicare', label: 'Medicare' },
  { value: 'medicaid', label: 'Medicaid' },
]);

/**
 * @returns {string}
 */
export function renderInsuranceOptions() {
  return [
    '<option value="">Select your situation</option>',
    ...INSURANCE_OPTIONS.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`),
  ].join('');
}
