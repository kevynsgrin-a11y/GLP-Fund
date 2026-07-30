/**
 * Appendix B golden vector 9, plus the boundary and hygiene cases that vector
 * implies. A failing staleness test is a build-stopping event: the staleness
 * system is the mechanism by which a moved price degrades visibly instead of
 * lying quietly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classify,
  ageInDays,
  parseIsoDate,
  worstOf,
  describeAge,
  FRESH,
  WARN,
  URGENT,
} from '../public/engine/staleness.js';
import { STALENESS_WARN_DAYS, STALENESS_URGENT_DAYS } from '../public/engine/config.js';

/** Fixed "today" so these tests never depend on the wall clock. */
const TODAY = '2026-07-30';

/** Build the YYYY-MM-DD date that is exactly `days` before TODAY. */
function daysBefore(days) {
  const ms = parseIsoDate(TODAY) - days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

test('CONFIG thresholds are the values the brief specifies', () => {
  assert.equal(STALENESS_WARN_DAYS, 30);
  assert.equal(STALENESS_URGENT_DAYS, 60);
});

test('vector 9: 5 days past verification is fresh', () => {
  assert.equal(classify(daysBefore(5), TODAY), FRESH);
});

test('vector 9: 45 days past verification warns', () => {
  assert.equal(classify(daysBefore(45), TODAY), WARN);
});

test('vector 9: 75 days past verification is urgent', () => {
  assert.equal(classify(daysBefore(75), TODAY), URGENT);
});

test('boundaries are inclusive-fresh: "past N days" means N is not yet stale', () => {
  // Exactly at the warn threshold is still fresh; warn begins the following day.
  assert.equal(classify(daysBefore(30), TODAY), FRESH, '30 days is not yet past 30 days');
  assert.equal(classify(daysBefore(31), TODAY), WARN);

  // Same rule at the urgent boundary.
  assert.equal(classify(daysBefore(60), TODAY), WARN, '60 days is not yet past 60 days');
  assert.equal(classify(daysBefore(61), TODAY), URGENT);
});

test('a price verified today is fresh', () => {
  assert.equal(classify(TODAY, TODAY), FRESH);
});

test('thresholds are injectable so QA can backdate without editing config', () => {
  // Phase 6 proves the banner fires by backdating a verified_date. The same
  // mechanism is used here, in reverse, to shrink the window instead.
  assert.equal(classify(daysBefore(10), TODAY, { warnDays: 5, urgentDays: 8 }), URGENT);
  assert.equal(classify(daysBefore(10), TODAY, { warnDays: 5, urgentDays: 20 }), WARN);
  assert.equal(classify(daysBefore(10), TODAY, { warnDays: 15, urgentDays: 40 }), FRESH);
});

test('inverted thresholds throw rather than silently skipping the warn state', () => {
  assert.throws(
    () => classify(daysBefore(10), TODAY, { warnDays: 60, urgentDays: 30 }),
    RangeError
  );
  assert.throws(
    () => classify(daysBefore(10), TODAY, { warnDays: 30, urgentDays: 30 }),
    RangeError
  );
});

test('ageInDays is exact and timezone-independent', () => {
  assert.equal(ageInDays('2026-07-30', '2026-07-30'), 0);
  assert.equal(ageInDays('2026-07-29', '2026-07-30'), 1);
  assert.equal(ageInDays('2026-06-30', '2026-07-30'), 30);
  // Across a month boundary and across a leap-day-free February.
  assert.equal(ageInDays('2026-01-01', '2026-03-01'), 59);
});

test('a future verified_date is representable, not clamped', () => {
  // This is a data-entry error. The ops runbook checks for it; the classifier
  // must not hide it by clamping to zero.
  assert.equal(ageInDays('2026-08-01', TODAY), -2);
  assert.equal(classify('2026-08-01', TODAY), FRESH);
  assert.match(describeAge('2026-08-01', TODAY), /future/);
});

test('malformed dates throw instead of becoming NaN', () => {
  // NaN comparisons are all false, so a loose parser would classify a garbage
  // date as fresh and render a stale price with no warning at all.
  for (const bad of ['2026-7-30', '07/30/2026', '2026-07', '', 'today', null, undefined, 20260730]) {
    assert.throws(() => classify(bad, TODAY), /Expected a YYYY-MM-DD date string/);
  }
});

test('impossible calendar dates throw', () => {
  assert.throws(() => parseIsoDate('2026-02-30'), RangeError);
  assert.throws(() => parseIsoDate('2026-13-01'), RangeError);
  assert.throws(() => parseIsoDate('2026-00-10'), RangeError);
});

test('worstOf drives the top-of-results banner', () => {
  assert.equal(worstOf([FRESH, FRESH, FRESH]), FRESH);
  assert.equal(worstOf([FRESH, WARN, FRESH]), WARN);
  // One urgent price among many fresh ones still warrants the banner: the user
  // may be about to act on precisely that one.
  assert.equal(worstOf([FRESH, WARN, URGENT, FRESH]), URGENT);
  assert.equal(worstOf([]), FRESH);
});

test('describeAge produces a human stamp without inventing precision', () => {
  assert.equal(describeAge(TODAY, TODAY), 'verified today');
  assert.equal(describeAge(daysBefore(1), TODAY), 'verified yesterday');
  assert.equal(describeAge(daysBefore(12), TODAY), 'verified 12 days ago');
  assert.equal(describeAge(daysBefore(45), TODAY), 'verified over a month ago');
  assert.equal(describeAge(daysBefore(75), TODAY), 'verified over 2 months ago');
});
