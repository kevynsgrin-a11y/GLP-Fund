/**
 * Savings arithmetic.
 *
 * Pure. No DOM, no data loading, no imports. Every function here either returns
 * a number or returns null; none of them ever returns a number derived from an
 * unverified price, because none of them invents a value when given null.
 *
 * The null-propagation discipline is the point of this module. The integrity
 * invariant (no unverified price may render as a number) is only as strong as
 * its weakest arithmetic path: if `annualize(null)` returned 0, an unverified
 * monthly price would surface as a confident "$0 per year". So every function
 * here propagates null outward rather than coercing it.
 */

/** Months used to annualize. Named so the assumption is visible, not buried. */
export const MONTHS_PER_YEAR = 12;

/**
 * Assert a value is a usable money figure. Rejects NaN, Infinity, negatives and
 * non-numbers. Money that is absent must be `null`, never 0 and never undefined:
 * "no verified price" and "free" are different claims and the UI renders them
 * differently.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUsableAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Round to whole cents. Monthly prices in this domain are whole dollars, but
 * deltas and annualized figures can accumulate float error, and a price ending
 * in .00000000004 on a pharmacy-facing page is a credibility problem.
 *
 * @param {number} value
 * @returns {number}
 */
export function roundCents(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Annual cost from a monthly cost.
 *
 * Returns null for an absent monthly cost. This is the single most important
 * null-propagation path in the codebase: it is what stops an unverified price
 * from being laundered into a confident annual figure.
 *
 * @param {number|null} monthlyCost
 * @returns {number|null}
 */
export function annualize(monthlyCost) {
  if (!isUsableAmount(monthlyCost)) return null;
  return roundCents(monthlyCost * MONTHS_PER_YEAR);
}

/**
 * The delta between what the user is likely paying now and the cheapest
 * verified pathway. Both figures must be usable for a delta to exist; a
 * comparison against an unverified price is not a saving, it is a guess.
 *
 * Sign convention: a positive delta means the cheapest pathway is CHEAPER than
 * the current path, i.e. the user saves that much. A negative delta means the
 * user's current path is already cheaper, which is a real outcome the tool must
 * be willing to report rather than hiding it to manufacture a win.
 *
 * @param {number|null} currentMonthlyCost
 * @param {number|null} cheapestMonthlyCost
 * @returns {{monthlyDelta: number|null, annualDelta: number|null, isSaving: boolean, comparable: boolean}}
 */
export function delta(currentMonthlyCost, cheapestMonthlyCost) {
  if (!isUsableAmount(currentMonthlyCost) || !isUsableAmount(cheapestMonthlyCost)) {
    return { monthlyDelta: null, annualDelta: null, isSaving: false, comparable: false };
  }
  const monthlyDelta = roundCents(currentMonthlyCost - cheapestMonthlyCost);
  return {
    monthlyDelta,
    annualDelta: roundCents(monthlyDelta * MONTHS_PER_YEAR),
    isSaving: monthlyDelta > 0,
    comparable: true,
  };
}

/**
 * Percentage reduction from the current path to the cheapest path, for content
 * like "82 percent less than list price". Returns null when incomparable or
 * when the current cost is zero, since a percentage off zero is undefined
 * rather than infinite.
 *
 * @param {number|null} currentMonthlyCost
 * @param {number|null} cheapestMonthlyCost
 * @returns {number|null} whole percent, or null
 */
export function percentReduction(currentMonthlyCost, cheapestMonthlyCost) {
  if (!isUsableAmount(currentMonthlyCost) || !isUsableAmount(cheapestMonthlyCost)) return null;
  if (currentMonthlyCost === 0) return null;
  const reduction = ((currentMonthlyCost - cheapestMonthlyCost) / currentMonthlyCost) * 100;
  return Math.round(reduction);
}

/**
 * Format a money figure for display. Returns the caller-supplied fallback for
 * absent amounts so that the "price not currently verified" string lives in one
 * place at the call site rather than being duplicated across views.
 *
 * Whole dollars are rendered without cents: a stressed user scanning prices on
 * a phone does not benefit from "$299.00".
 *
 * @param {number|null} amount
 * @param {string} [fallback]
 * @returns {string}
 */
export function formatUsd(amount, fallback = 'Price not currently verified') {
  if (!isUsableAmount(amount)) return fallback;
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

/**
 * The cheapest pathway among results, ignoring any without a verified numeric
 * cost. Ties are broken by pathway name so the choice is deterministic and the
 * UI never flickers between renders (Appendix B vector 12).
 *
 * @param {Array<{pathway: string, monthlyCost: number|null}>} results
 * @returns {{pathway: string, monthlyCost: number|null}|null}
 */
export function cheapestOf(results) {
  const priced = (results ?? []).filter((r) => isUsableAmount(r?.monthlyCost));
  if (priced.length === 0) return null;
  return priced.reduce((best, candidate) => {
    if (candidate.monthlyCost < best.monthlyCost) return candidate;
    if (candidate.monthlyCost > best.monthlyCost) return best;
    return candidate.pathway < best.pathway ? candidate : best;
  });
}
