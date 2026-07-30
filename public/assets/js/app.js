/**
 * The only file in this project that touches the DOM.
 *
 * Everything it renders comes from the pure engine and the pure view layer, so
 * this file contains no monetary logic and no eligibility logic. If a price
 * looks wrong, it is not wrong here.
 *
 * NO PERSISTENCE. The medication, insurance situation and dose the visitor
 * selects are health information. They live in this module's local variables for
 * the lifetime of the page and nowhere else: no localStorage, no sessionStorage,
 * no cookie, no query string, no beacon, no analytics event. The only network
 * write this site performs anywhere is the alert-list email capture, which the
 * visitor initiates explicitly. test/integrity.test.js fails the build if a
 * storage API appears in this directory.
 */

import { DATA_FILE } from '../../engine/config.js';
import { rankPathways, suppressedPathways, overallStaleness, savingsSummary } from '../../engine/pricing.js';
import {
  renderResults,
  renderDrugOptions,
  renderDoseOptions,
  renderInsuranceOptions,
} from './render.js';

/** Ephemeral selection state. Never written anywhere. */
const selection = { drug: '', insurance: '', dose: 'any' };

let dataset = null;

const el = {
  form: document.querySelector('[data-tool-form]'),
  drug: document.querySelector('[data-input="drug"]'),
  insurance: document.querySelector('[data-input="insurance"]'),
  dose: document.querySelector('[data-input="dose"]'),
  results: document.querySelector('[data-results]'),
};

/**
 * Today, as YYYY-MM-DD in the visitor's own timezone.
 *
 * Local rather than UTC deliberately: staleness is a claim about how old a price
 * looks to the person reading it, and a visitor in Los Angeles should not see a
 * price flip to "may be outdated" because UTC has already rolled over.
 *
 * @returns {string}
 */
function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Render the current selection, or a prompt if it is incomplete.
 *
 * Results replace the region's contents wholesale rather than being patched.
 * With at most a dozen cards that is cheaper than diffing, and it makes it
 * impossible for a stale price to survive a re-render.
 */
function render() {
  if (!el.results) return;

  if (!dataset) {
    el.results.innerHTML =
      '<div class="empty"><p>Loading verified pricing data.</p></div>';
    return;
  }

  if (!selection.drug || !selection.insurance) {
    el.results.innerHTML = `
      <div class="empty">
        <p>Choose your medication and your insurance situation to see every
        pathway ranked by what you would actually pay this month.</p>
      </div>`;
    return;
  }

  const input = {
    drug: selection.drug,
    dose: selection.dose,
    insurance: selection.insurance,
  };
  const options = { today: today() };

  const results = rankPathways(input, dataset, options);
  const hidden = suppressedPathways(input, dataset, options);
  const summary = savingsSummary(results, dataset, { drug: selection.drug });

  el.results.innerHTML = renderResults({
    results,
    hidden,
    summary,
    drugMeta: dataset.drugs[selection.drug],
    staleness: overallStaleness(results),
    today: options.today,
  });
}

/** Repopulate the dose selector for the chosen drug. */
function syncDoseOptions() {
  if (!el.dose) return;

  if (!selection.drug) {
    el.dose.innerHTML = '<option value="any">Select a medication first</option>';
    el.dose.disabled = true;
    return;
  }

  el.dose.disabled = false;
  el.dose.innerHTML = renderDoseOptions(dataset, selection.drug);
  // A dose from a previous drug is meaningless for this one.
  selection.dose = 'any';
  el.dose.value = 'any';
}

function bind() {
  if (!el.form) return;

  el.drug?.addEventListener('change', (event) => {
    selection.drug = event.target.value;
    syncDoseOptions();
    render();
  });

  el.insurance?.addEventListener('change', (event) => {
    selection.insurance = event.target.value;
    render();
  });

  el.dose?.addEventListener('change', (event) => {
    selection.dose = event.target.value || 'any';
    render();
  });

  // The form has no server action. It is a grouping element for three selects,
  // and a stray Enter keypress must not navigate away from a filled-in result.
  el.form.addEventListener('submit', (event) => event.preventDefault());
}

async function init() {
  if (el.drug) el.drug.innerHTML = renderDrugOptions({ drugs: {} });
  if (el.insurance) el.insurance.innerHTML = renderInsuranceOptions();

  bind();
  render();

  try {
    const response = await fetch(DATA_FILE, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    dataset = await response.json();
  } catch (error) {
    // Never a blank screen and never a silent failure. A visitor standing in a
    // pharmacy must be told to go to the source rather than left guessing.
    if (el.results) {
      el.results.innerHTML = `
        <div class="empty">
          <p><strong>Pricing data could not be loaded.</strong></p>
          <p>Do not assume a price from this page. Check
          <a href="/methodology/">our sources</a> directly, or reload.</p>
        </div>`;
    }
    return;
  }

  if (el.drug) {
    el.drug.innerHTML = renderDrugOptions(dataset);
    el.drug.value = selection.drug;
  }
  syncDoseOptions();
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
