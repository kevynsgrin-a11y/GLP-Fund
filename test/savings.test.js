/**
 * Savings arithmetic. The dollar figures in Appendix B vector 11 are asserted
 * in pricing.test.js against verified data; this file proves the arithmetic and
 * -- more importantly -- proves that null never becomes a number.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  annualize,
  delta,
  percentReduction,
  formatUsd,
  cheapestOf,
  isUsableAmount,
  roundCents,
  MONTHS_PER_YEAR,
} from '../public/engine/savings.js';

test('annualize is monthly x 12', () => {
  assert.equal(MONTHS_PER_YEAR, 12);
  assert.equal(annualize(299), 3588);
  assert.equal(annualize(399), 4788);
  assert.equal(annualize(449), 5388);
  assert.equal(annualize(199), 2388);
  assert.equal(annualize(50), 600);
  assert.equal(annualize(0), 0);
});

test('annualize propagates absence rather than inventing zero', () => {
  // If this returned 0, an unverified monthly price would render as a confident
  // "$0 per year". This assertion is load-bearing for the integrity invariant.
  assert.equal(annualize(null), null);
  assert.equal(annualize(undefined), null);
  assert.equal(annualize(NaN), null);
  assert.equal(annualize(Infinity), null);
  assert.equal(annualize(-100), null);
  assert.equal(annualize('299'), null);
  assert.equal(annualize({}), null);
});

test('isUsableAmount distinguishes absent from free', () => {
  assert.equal(isUsableAmount(0), true, 'zero is a real price, not an absent one');
  assert.equal(isUsableAmount(null), false);
  assert.equal(isUsableAmount(-1), false);
  assert.equal(isUsableAmount(NaN), false);
});

test('delta reports savings with a positive sign', () => {
  const d = delta(1086, 299);
  assert.equal(d.monthlyDelta, 787);
  assert.equal(d.annualDelta, 9444);
  assert.equal(d.isSaving, true);
  assert.equal(d.comparable, true);
});

test('delta is willing to report that the current path is already cheaper', () => {
  // The tool must not hide this outcome to manufacture a win.
  const d = delta(50, 299);
  assert.equal(d.monthlyDelta, -249);
  assert.equal(d.annualDelta, -2988);
  assert.equal(d.isSaving, false);
  assert.equal(d.comparable, true);
});

test('delta against an unverified price is incomparable, not zero', () => {
  for (const pair of [[null, 299], [1086, null], [null, null]]) {
    const d = delta(pair[0], pair[1]);
    assert.equal(d.monthlyDelta, null);
    assert.equal(d.annualDelta, null);
    assert.equal(d.comparable, false);
    assert.equal(d.isSaving, false);
  }
});

test('percentReduction rounds to whole percent and refuses undefined bases', () => {
  assert.equal(percentReduction(1086, 299), 72);
  assert.equal(percentReduction(1349, 199), 85);
  assert.equal(percentReduction(299, 299), 0);
  assert.equal(percentReduction(0, 299), null, 'a percentage off zero is undefined');
  assert.equal(percentReduction(null, 299), null);
  assert.equal(percentReduction(1086, null), null);
});

test('roundCents removes float noise', () => {
  assert.equal(roundCents(0.1 + 0.2), 0.3);
  assert.equal(roundCents(299.004), 299);
  assert.equal(roundCents(299.005), 299.01);
});

test('formatUsd renders whole dollars without cents', () => {
  assert.equal(formatUsd(299), '$299');
  assert.equal(formatUsd(3588), '$3,588');
  assert.equal(formatUsd(1086), '$1,086');
  assert.equal(formatUsd(0), '$0');
  assert.equal(formatUsd(299.5), '$299.50');
});

test('formatUsd renders absence as a display string, never a number', () => {
  assert.equal(formatUsd(null), 'Price not currently verified');
  assert.equal(formatUsd(undefined), 'Price not currently verified');
  assert.equal(formatUsd(NaN), 'Price not currently verified');
  assert.equal(formatUsd(null, 'Check trumprx.gov directly'), 'Check trumprx.gov directly');
});

test('cheapestOf ignores pathways without a verified numeric cost', () => {
  const results = [
    { pathway: 'trumprx', monthlyCost: null },
    { pathway: 'lillydirect_self_pay', monthlyCost: 449 },
    { pathway: 'medicare_bridge', monthlyCost: 50 },
  ];
  assert.equal(cheapestOf(results).pathway, 'medicare_bridge');
});

test('cheapestOf breaks ties alphabetically so the choice is deterministic', () => {
  // Appendix B vector 12: the UI must never flicker between renders.
  const results = [
    { pathway: 'novocare_self_pay', monthlyCost: 199 },
    { pathway: 'copay_card', monthlyCost: 199 },
    { pathway: 'trumprx', monthlyCost: 199 },
  ];
  assert.equal(cheapestOf(results).pathway, 'copay_card');
  // Reversing the input must not change the answer.
  assert.equal(cheapestOf([...results].reverse()).pathway, 'copay_card');
});

test('cheapestOf returns null when nothing is priced', () => {
  assert.equal(cheapestOf([]), null);
  assert.equal(cheapestOf(null), null);
  assert.equal(cheapestOf([{ pathway: 'trumprx', monthlyCost: null }]), null);
});
