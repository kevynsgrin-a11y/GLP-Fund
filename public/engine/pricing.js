/**
 * The ranking engine.
 *
 * Given a user's medication, insurance situation and dose, return every
 * available access pathway ranked by real monthly out-of-pocket cost, each
 * carrying a source citation and a verification date.
 *
 * Pure. No DOM, no fetch. The caller supplies the already-parsed dataset, so
 * this module is identical in the browser and in the test runner.
 *
 * ---------------------------------------------------------------------------
 * THE INTEGRITY INVARIANT
 *
 * There is exactly ONE function in this codebase that may produce a numeric
 * monthlyCost: `resolveMonthlyCost`. It returns null unless the datum's
 * confidence is precisely "confirmed". Nothing else reads `datum.value`.
 *
 * That single chokepoint is deliberate. The alternative -- copying `value`
 * through and filtering later -- means every future edit is one forgotten
 * filter away from printing an unverified price. A wrong price sends a real
 * person to a pharmacy counter with a wrong expectation, so the guarantee is
 * structural rather than procedural, and test/pricing.test.js asserts that no
 * code path can violate it.
 * ---------------------------------------------------------------------------
 */

import { annualize, formatUsd, isUsableAmount, cheapestOf, delta, percentReduction } from './savings.js';
import { classify, worstOf } from './staleness.js';
import { toContext, evaluatePathway, validateRules } from './eligibility.js';

export const UNVERIFIED_DISPLAY = 'Price not currently verified';

/**
 * THE CHOKEPOINT. The only function permitted to yield a numeric monthly cost.
 *
 * @param {{value: number|null, confidence: string}} datum
 * @returns {number|null}
 */
function resolveMonthlyCost(datum) {
  if (!datum || datum.confidence !== 'confirmed') return null;
  if (!isUsableAmount(datum.value)) return null;
  return datum.value;
}

/**
 * Resolve a user-selected dose to the tier key its price is filed under.
 *
 * The mapping is DATA, held in `drugs[drug].doseTiers`, because dose tiers are a
 * commercial decision by a manufacturer and they change. Zepbound currently
 * files 2.5 mg and 5 mg individually and everything above them under a single
 * tier; encoding that as a branch in code would mean a code change the next
 * time Lilly restructures it.
 *
 * @param {object} dataset
 * @param {string} drug
 * @param {string} dose
 * @returns {string[]} tier keys to accept, most specific first
 */
export function resolveDoseTiers(dataset, drug, dose) {
  const drugMeta = dataset?.drugs?.[drug];
  const tiers = [];

  if (dose && dose !== 'any') {
    const mapped = drugMeta?.doseTiers?.[dose];
    if (mapped) tiers.push(mapped);
    tiers.push(dose);
    // "any" always matches: it is how a flat-priced drug is filed.
    tiers.push('any');
    return [...new Set(tiers)];
  }

  // No dose selected. A tiered drug files nothing under "any", so matching only
  // "any" would return an empty result set for Zepbound -- the tool would look
  // broken to a user who has not reached the dose question yet. Accept every
  // declared tier instead, and let `selectDatum` pick the cheapest, flagged with
  // a caveat that the figure is dose-dependent.
  tiers.push('any');
  for (const tier of Object.values(drugMeta?.doseTiers ?? {})) tiers.push(tier);
  return [...new Set(tiers)];
}

/**
 * True when a drug prices by dose tier at all. Drives whether an unspecified
 * dose needs the dose-dependence caveat.
 *
 * @param {object} dataset
 * @param {string} drug
 * @returns {boolean}
 */
function isTiered(dataset, drug) {
  return Object.keys(dataset?.drugs?.[drug]?.doseTiers ?? {}).length > 0;
}

/**
 * Choose which of several tier-matching data for one pathway governs.
 *
 * Dose selected: the most specific tier wins, because it is the more precise
 * claim about this particular user.
 *
 * Dose not selected: the cheapest confirmed figure wins, because the question
 * the site answers is "what is the cheapest legitimate way to pay" and an
 * unselected dose must not be answered by silently picking the dearest tier.
 * The caveat added in `buildResult` keeps that honest.
 *
 * @param {object[]} data
 * @param {string[]} acceptableTiers
 * @param {boolean} doseSpecified
 * @returns {object}
 */
function selectDatum(data, acceptableTiers, doseSpecified) {
  if (data.length === 1) return data[0];

  if (doseSpecified) {
    return data.reduce((best, candidate) =>
      acceptableTiers.indexOf(candidate.dose_or_tier) < acceptableTiers.indexOf(best.dose_or_tier)
        ? candidate
        : best
    );
  }

  return data.reduce((best, candidate) => {
    const bestCost = resolveMonthlyCost(best);
    const candidateCost = resolveMonthlyCost(candidate);
    if (candidateCost === null && bestCost === null) {
      return String(candidate.dose_or_tier) < String(best.dose_or_tier) ? candidate : best;
    }
    if (candidateCost === null) return best;
    if (bestCost === null) return candidate;
    if (candidateCost !== bestCost) return candidateCost < bestCost ? candidate : best;
    return String(candidate.dose_or_tier) < String(best.dose_or_tier) ? candidate : best;
  });
}

/**
 * Build one result object from one price datum.
 *
 * @param {object} datum
 * @param {object} dataset
 * @param {object} ctx
 * @param {string} today
 * @returns {object}
 */
function buildResult(datum, dataset, ctx, today, extraCaveats = []) {
  const pathwayMeta = dataset.pathways?.[datum.pathway] ?? {};
  const evaluation = evaluatePathway(datum.pathway, ctx, dataset.eligibilityRules ?? []);

  const monthlyCost = resolveMonthlyCost(datum);
  const staleness = classify(datum.verified_date, today);

  return {
    pathway: datum.pathway,
    pathwayLabel: pathwayMeta.label ?? datum.pathway,
    drug: datum.drug,
    doseOrTier: datum.dose_or_tier,

    monthlyCost,
    annualCost: annualize(monthlyCost),
    displayCost: formatUsd(monthlyCost, UNVERIFIED_DISPLAY),
    displayAnnualCost: formatUsd(annualize(monthlyCost), UNVERIFIED_DISPLAY),

    eligibilityNotes: [...evaluation.eligibilityNotes, ...(datum.eligibilityNotes ?? [])],
    caveats: [...evaluation.caveats, ...(datum.caveats ?? []), ...extraCaveats],

    sourceUrl: datum.source_url,
    sourceType: datum.source_type,
    officialUrl: pathwayMeta.officialUrl ?? datum.source_url,
    verifiedDate: datum.verified_date,
    confidence: datum.confidence,
    staleness,

    // Retained so the methodology page can explain a hidden pathway rather than
    // silently omitting it. The tool view never renders suppressed pathways.
    eligible: evaluation.eligible,
    suppressedBy: evaluation.suppressedBy ? evaluation.suppressedBy.id : null,
    suppressionReason: evaluation.suppressedBy ? evaluation.suppressedBy.reason : null,
    appliedRules: evaluation.appliedRules,
  };
}

/**
 * Deterministic ordering.
 *
 * 1. Pathways with a verified numeric cost, cheapest first.
 * 2. Pathways without one, after all priced pathways -- an unverified price
 *    cannot be claimed to be cheaper or dearer than anything.
 * 3. Ties broken alphabetically by pathway id, so the ordering is stable and
 *    the UI never flickers between renders (Appendix B vector 12).
 *
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function comparePathways(a, b) {
  const aPriced = isUsableAmount(a.monthlyCost);
  const bPriced = isUsableAmount(b.monthlyCost);

  if (aPriced && !bPriced) return -1;
  if (!aPriced && bPriced) return 1;

  if (aPriced && bPriced && a.monthlyCost !== b.monthlyCost) {
    return a.monthlyCost - b.monthlyCost;
  }
  if (a.pathway !== b.pathway) return a.pathway < b.pathway ? -1 : 1;
  // Same pathway at the same cost: fall back to the tier label so the sort is
  // total and Array.prototype.sort stability is never relied upon.
  return String(a.doseOrTier).localeCompare(String(b.doseOrTier));
}

/**
 * Rank every access pathway for a user's situation.
 *
 * @param {object} input {drug, dose, insuranceStatus|insurance, medicareEligible, incomeTier, osaCovered, bmi, hasComorbidity}
 * @param {object} dataset parsed pricing.json
 * @param {{today?: string}} [options]
 * @returns {object[]} ranked results
 */
export function rankPathways(input, dataset, options = {}) {
  if (!dataset || !Array.isArray(dataset.prices)) {
    throw new TypeError('rankPathways requires a dataset with a prices array');
  }
  const today = options.today ?? dataset.generatedAt;
  if (!today) {
    throw new TypeError(
      'rankPathways needs a `today` date: staleness is not optional, so a price ' +
        'cannot be rendered without knowing how old it is.'
    );
  }

  const ctx = toContext(input);
  const doseSpecified = Boolean(input.dose) && input.dose !== 'any';
  const acceptableTiers = resolveDoseTiers(dataset, ctx.drug, ctx.dose);

  const candidates = dataset.prices.filter((datum) => {
    if (datum.drug !== ctx.drug) return false;
    if (datum.excludeFromRanking) return false;
    // Reference pathways such as list price are never offered as an option. This
    // is a presentation fact, not an eligibility rule, so it is not expressed as
    // one: an eligibility rule must cite a source, and "list price is a
    // reference" has no source to cite.
    if (dataset.pathways?.[datum.pathway]?.kind === 'reference') return false;
    return acceptableTiers.includes(datum.dose_or_tier);
  });

  const grouped = new Map();
  for (const datum of candidates) {
    if (!grouped.has(datum.pathway)) grouped.set(datum.pathway, []);
    grouped.get(datum.pathway).push(datum);
  }

  const tiered = isTiered(dataset, ctx.drug);

  return [...grouped.values()]
    .map((group) => {
      const datum = selectDatum(group, acceptableTiers, doseSpecified);
      const extraCaveats =
        !doseSpecified && tiered && group.length > 1
          ? [
              'You have not selected a dose. This is the lowest price tier for this ' +
                'medication; higher doses can cost more. Select your dose for the figure ' +
                'that applies to you.',
            ]
          : [];
      return buildResult(datum, dataset, ctx, today, extraCaveats);
    })
    .filter((result) => result.eligible)
    .sort(comparePathways);
}

/**
 * Pathways that exist for this drug but were suppressed for this user, with the
 * rule and source that suppressed each. Powers the "why am I not seeing a
 * copay card" explanation, which is a trust feature: silently omitting an
 * option looks like an incomplete tool rather than an honest one.
 *
 * @param {object} input
 * @param {object} dataset
 * @param {{today?: string}} [options]
 * @returns {object[]}
 */
export function suppressedPathways(input, dataset, options = {}) {
  const today = options.today ?? dataset.generatedAt;
  const ctx = toContext(input);
  const acceptableTiers = resolveDoseTiers(dataset, ctx.drug, ctx.dose);

  return dataset.prices
    .filter(
      (d) =>
        d.drug === ctx.drug &&
        acceptableTiers.includes(d.dose_or_tier) &&
        dataset.pathways?.[d.pathway]?.kind !== 'reference'
    )
    .map((datum) => buildResult(datum, dataset, ctx, today))
    .filter((result) => !result.eligible)
    .sort(comparePathways);
}

/**
 * The staleness state governing the whole results view: the worst state among
 * rendered results. One urgent price among many fresh ones still raises the
 * banner, because the user may be about to act on precisely that one.
 *
 * @param {object[]} results
 * @returns {'fresh'|'warn'|'urgent'}
 */
export function overallStaleness(results) {
  return worstOf(results.map((r) => r.staleness));
}

/**
 * The saving available against the user's likely current path.
 *
 * `currentPathway` defaults to the drug's list price, because the uninsured
 * user the tool is built for is by definition facing list. Returns an
 * incomparable result rather than a zero when either side is unverified.
 *
 * @param {object[]} results ranked results from rankPathways
 * @param {object} dataset
 * @param {{drug: string, currentPathway?: string}} params
 * @returns {object}
 */
export function savingsSummary(results, dataset, params) {
  const currentPathwayId = params.currentPathway ?? 'list_price';
  const listDatum = dataset.prices.find(
    (d) => d.drug === params.drug && d.pathway === currentPathwayId
  );

  const currentMonthly = resolveMonthlyCost(listDatum);
  const cheapest = cheapestOf(results);
  const cheapestMonthly = cheapest ? cheapest.monthlyCost : null;
  const d = delta(currentMonthly, cheapestMonthly);

  return {
    currentPathway: currentPathwayId,
    currentMonthlyCost: currentMonthly,
    displayCurrentMonthly: formatUsd(currentMonthly, UNVERIFIED_DISPLAY),
    cheapestPathway: cheapest ? cheapest.pathway : null,
    cheapestMonthlyCost: cheapestMonthly,
    displayCheapestMonthly: formatUsd(cheapestMonthly, UNVERIFIED_DISPLAY),
    monthlyDelta: d.monthlyDelta,
    annualDelta: d.annualDelta,
    displayMonthlyDelta: formatUsd(d.monthlyDelta, UNVERIFIED_DISPLAY),
    displayAnnualDelta: formatUsd(d.annualDelta, UNVERIFIED_DISPLAY),
    percentReduction: percentReduction(currentMonthly, cheapestMonthly),
    isSaving: d.isSaving,
    comparable: d.comparable,
  };
}

/**
 * Validate a dataset. Called by the test suite against the real data file, so a
 * malformed datum is a build-stopping event rather than a runtime surprise.
 *
 * @param {object} dataset
 * @returns {string[]} problems; empty means valid
 */
export function validateDataset(dataset) {
  const problems = [];
  const SOURCE_TYPES = new Set([
    'primary_manufacturer', 'primary_government', 'secondary_press', 'secondary_aggregator',
  ]);
  const CONFIDENCE = new Set(['confirmed', 'conflicting', 'unverified']);

  if (!dataset || typeof dataset !== 'object') return ['dataset is not an object'];
  if (!Array.isArray(dataset.prices)) return ['dataset.prices is not an array'];
  if (!dataset.generatedAt) problems.push('dataset.generatedAt is missing');

  dataset.prices.forEach((datum, i) => {
    const id = `prices[${i}] (${datum?.drug}|${datum?.dose_or_tier}|${datum?.pathway})`;

    for (const field of [
      'unit', 'drug', 'dose_or_tier', 'pathway', 'source_url', 'source_type',
      'verified_date', 'confidence',
    ]) {
      if (!datum?.[field]) problems.push(`${id}: missing ${field}`);
    }

    if (datum?.unit && datum.unit !== 'USD/month') {
      problems.push(`${id}: unit must be "USD/month", found "${datum.unit}"`);
    }
    if (datum?.source_type && !SOURCE_TYPES.has(datum.source_type)) {
      problems.push(`${id}: invalid source_type "${datum.source_type}"`);
    }
    if (datum?.confidence && !CONFIDENCE.has(datum.confidence)) {
      problems.push(`${id}: invalid confidence "${datum.confidence}"`);
    }
    if (datum?.source_url && !/^https:\/\//.test(datum.source_url)) {
      problems.push(`${id}: source_url must be https -- every price needs a live citation`);
    }
    if (datum?.verified_date && !/^\d{4}-\d{2}-\d{2}$/.test(datum.verified_date)) {
      problems.push(`${id}: verified_date must be YYYY-MM-DD`);
    }
    if (datum?.value !== null && !isUsableAmount(datum?.value)) {
      problems.push(`${id}: value must be a non-negative number or null`);
    }

    // The invariant, checked at the data layer as well as the engine layer.
    if (datum?.confidence !== 'confirmed' && datum?.value !== null) {
      problems.push(
        `${id}: confidence is "${datum?.confidence}" but value is ${datum?.value}. ` +
          'A figure that is not confirmed must carry value null so that no code ' +
          'path can render it as a number.'
      );
    }

    if (datum?.pathway && dataset.pathways && !dataset.pathways[datum.pathway]) {
      problems.push(`${id}: pathway "${datum.pathway}" has no entry in dataset.pathways`);
    }
    if (datum?.drug && dataset.drugs && !dataset.drugs[datum.drug]) {
      problems.push(`${id}: drug "${datum.drug}" has no entry in dataset.drugs`);
    }
  });

  problems.push(...validateRules(dataset.eligibilityRules ?? []));

  // Every declared dose must reach a price datum. Foundayo shipped briefly with
  // six declared doses and an empty doseTiers map, so an unspecified dose matched
  // only the "any" tier, no datum matched, and the drug silently offered an
  // uninsured user nothing at all. That is the worst failure mode this tool has:
  // not a wrong number, but a blank screen that reads as "no options exist".
  for (const [drugId, drugMeta] of Object.entries(dataset.drugs ?? {})) {
    const filedTiers = new Set(
      dataset.prices.filter((p) => p.drug === drugId).map((p) => p.dose_or_tier)
    );
    if (filedTiers.size === 0) {
      problems.push(`drugs.${drugId}: declared but has no price data at all`);
      continue;
    }
    for (const dose of drugMeta.doses ?? []) {
      const tier = drugMeta.doseTiers?.[dose] ?? dose;
      if (!filedTiers.has(tier) && !filedTiers.has('any')) {
        problems.push(
          `drugs.${drugId}: dose "${dose}" maps to tier "${tier}", which has no price ` +
            'datum and no "any" fallback, so selecting it returns nothing'
        );
      }
    }
  }

  return problems;
}
