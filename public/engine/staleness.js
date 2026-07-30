/**
 * Staleness classification.
 *
 * Every price rendered anywhere on this site passes through this module. In a
 * market where prices have moved at least five times in nine months, a price
 * without an age is a liability: the competitive field publishes figures from
 * months prior with no verification date at all. Age is therefore not metadata
 * here, it is part of the price.
 *
 * Pure. No DOM, no clock access, no imports outside config. `today` is always
 * injected so the classifier is testable without mocking time and so a QA pass
 * can backdate a verified_date to prove the banner fires.
 */

import { STALENESS_WARN_DAYS, STALENESS_URGENT_DAYS } from './config.js';

export const FRESH = 'fresh';
export const WARN = 'warn';
export const URGENT = 'urgent';

const MS_PER_DAY = 86400000;

/**
 * Parse a YYYY-MM-DD date string to a UTC epoch-milliseconds value.
 *
 * Deliberately strict and deliberately UTC. `new Date('2026-07-30')` is parsed
 * as UTC midnight but `new Date('2026-7-30')` is parsed as *local* midnight,
 * so a loose parser would make staleness depend on the visitor's timezone and
 * flip a boundary case for users west of UTC. Anything not exactly YYYY-MM-DD
 * throws rather than silently becoming NaN and comparing false everywhere.
 *
 * @param {string} value
 * @returns {number} epoch ms at UTC midnight
 */
export function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`Expected a YYYY-MM-DD date string, received: ${JSON.stringify(value)}`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const ms = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(ms);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    throw new RangeError(`Not a real calendar date: ${value}`);
  }
  return ms;
}

/**
 * Whole days elapsed between two YYYY-MM-DD dates. Negative if verifiedDate is
 * in the future, which is a data-entry error rather than an impossibility, so
 * it is representable rather than clamped here.
 *
 * @param {string} verifiedDate
 * @param {string} today
 * @returns {number}
 */
export function ageInDays(verifiedDate, today) {
  return Math.floor((parseIsoDate(today) - parseIsoDate(verifiedDate)) / MS_PER_DAY);
}

/**
 * Classify a verification date into a staleness state.
 *
 * Boundaries are inclusive-fresh: the thresholds mean "past this many days",
 * so an age of exactly STALENESS_WARN_DAYS is still fresh and warn begins the
 * day after. Same for urgent.
 *
 *   age <= warnDays              -> fresh
 *   warnDays < age <= urgentDays -> warn
 *   age > urgentDays             -> urgent
 *
 * A verified_date in the future is treated as `fresh` for display purposes --
 * it cannot be stale -- but callers that care about data hygiene should use
 * `ageInDays` directly and check for a negative value.
 *
 * @param {string} verifiedDate YYYY-MM-DD
 * @param {string} today YYYY-MM-DD
 * @param {{warnDays?: number, urgentDays?: number}} [thresholds]
 * @returns {'fresh'|'warn'|'urgent'}
 */
export function classify(verifiedDate, today, thresholds = {}) {
  const warnDays = thresholds.warnDays ?? STALENESS_WARN_DAYS;
  const urgentDays = thresholds.urgentDays ?? STALENESS_URGENT_DAYS;

  if (!(urgentDays > warnDays)) {
    throw new RangeError(
      `urgentDays (${urgentDays}) must exceed warnDays (${warnDays}); ` +
        'otherwise the warn state is unreachable and prices silently skip it.'
    );
  }

  const age = ageInDays(verifiedDate, today);
  if (age > urgentDays) return URGENT;
  if (age > warnDays) return WARN;
  return FRESH;
}

/**
 * The most severe state in a set. Used to decide whether the results view
 * renders the prominent top-of-results banner: one urgent price among twelve
 * fresh ones still warrants the banner, because the user may be about to act
 * on precisely that one.
 *
 * @param {Array<'fresh'|'warn'|'urgent'>} states
 * @returns {'fresh'|'warn'|'urgent'}
 */
export function worstOf(states) {
  if (states.includes(URGENT)) return URGENT;
  if (states.includes(WARN)) return WARN;
  return FRESH;
}

/**
 * Human-readable age, for the "verified [date]" stamp that accompanies every
 * rendered price. Returns display strings only; carries no styling decision.
 *
 * @param {string} verifiedDate
 * @param {string} today
 * @returns {string}
 */
export function describeAge(verifiedDate, today) {
  const age = ageInDays(verifiedDate, today);
  if (age < 0) return 'verification date is in the future';
  if (age === 0) return 'verified today';
  if (age === 1) return 'verified yesterday';
  if (age < 30) return `verified ${age} days ago`;
  if (age < 60) return 'verified over a month ago';
  return `verified over ${Math.floor(age / 30)} months ago`;
}
