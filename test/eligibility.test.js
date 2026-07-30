/**
 * The eligibility evaluator, proved with synthetic rules.
 *
 * These tests exercise the MACHINERY. The real rule table -- with its verbatim
 * quotes from manufacturer and CMS terms -- is asserted in pricing.test.js
 * against Appendix B vectors 6, 7 and 8. Separating the two means a broken
 * evaluator and a wrong rule produce different failures.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  matches,
  describePredicate,
  validateRules,
  evaluatePathway,
  toContext,
  EFFECTS,
} from '../public/engine/eligibility.js';

const SOURCE = 'https://example.gov/terms';
const QUOTE = 'This offer is not valid for patients enrolled in any federal healthcare programme.';

test('comparison operators evaluate against the context', () => {
  const ctx = { insuranceStatus: 'medicare', bmi: 35, osaCovered: false, incomeTier: 'low' };

  assert.equal(matches({ field: 'insuranceStatus', op: 'eq', value: 'medicare' }, ctx), true);
  assert.equal(matches({ field: 'insuranceStatus', op: 'ne', value: 'medicare' }, ctx), false);
  assert.equal(matches({ field: 'insuranceStatus', op: 'in', value: ['medicare', 'medicaid'] }, ctx), true);
  assert.equal(matches({ field: 'insuranceStatus', op: 'nin', value: ['none', 'commercial'] }, ctx), true);
  assert.equal(matches({ field: 'bmi', op: 'gte', value: 35 }, ctx), true);
  assert.equal(matches({ field: 'bmi', op: 'gt', value: 35 }, ctx), false);
  assert.equal(matches({ field: 'bmi', op: 'lte', value: 35 }, ctx), true);
  assert.equal(matches({ field: 'bmi', op: 'lt', value: 27 }, ctx), false);
  assert.equal(matches({ field: 'osaCovered', op: 'falsy' }, ctx), true);
  assert.equal(matches({ field: 'osaCovered', op: 'truthy' }, ctx), false);
});

test('numeric operators do not coerce non-numbers', () => {
  // A missing BMI must not satisfy a BMI threshold. `null >= 27` is true in JS,
  // which would grant Bridge eligibility to a user who never entered a BMI.
  assert.equal(matches({ field: 'bmi', op: 'gte', value: 27 }, { bmi: null }), false);
  assert.equal(matches({ field: 'bmi', op: 'gte', value: 27 }, {}), false);
  assert.equal(matches({ field: 'bmi', op: 'gte', value: 27 }, { bmi: '40' }), false);
});

test('all / any / not compose', () => {
  const ctx = { insuranceStatus: 'medicare', bmi: 30, hasComorbidity: true };

  const bridgeCriteria = {
    any: [
      { field: 'bmi', op: 'gte', value: 35 },
      { all: [{ field: 'bmi', op: 'gte', value: 27 }, { field: 'hasComorbidity', op: 'truthy' }] },
    ],
  };
  assert.equal(matches(bridgeCriteria, ctx), true);
  assert.equal(matches(bridgeCriteria, { ...ctx, hasComorbidity: false }), false);
  assert.equal(matches(bridgeCriteria, { ...ctx, bmi: 40, hasComorbidity: false }), true);
  assert.equal(matches({ not: bridgeCriteria }, { ...ctx, hasComorbidity: false }), true);
});

test('`true` always matches, for unconditional caveats', () => {
  assert.equal(matches(true, {}), true);
  assert.equal(matches(false, {}), false);
});

test('an unknown operator throws rather than silently returning false', () => {
  // A suppression rule whose predicate silently returns false stops suppressing.
  assert.throws(
    () => matches({ field: 'bmi', op: 'approximately', value: 30 }, { bmi: 30 }),
    /Unknown predicate operator/
  );
  assert.throws(() => matches({ op: 'eq', value: 1 }, {}), /missing a field/);
  assert.throws(() => matches(null, {}), /Malformed predicate/);
  assert.throws(() => matches('medicare', {}), /Malformed predicate/);
});

test('predicates render as English for the methodology page', () => {
  assert.equal(
    describePredicate({ field: 'insuranceStatus', op: 'in', value: ['medicare', 'medicaid'] }),
    'insuranceStatus is one of [medicare, medicaid]'
  );
  assert.equal(
    describePredicate({
      all: [{ field: 'bmi', op: 'gte', value: 27 }, { field: 'hasComorbidity', op: 'truthy' }],
    }),
    'bmi is at least 27 and hasComorbidity is true'
  );
  assert.equal(describePredicate({ not: { field: 'osaCovered', op: 'truthy' } }), 'not (osaCovered is true)');
  assert.equal(describePredicate(true), 'always');
});

test('suppress removes the pathway entirely, it does not derank it', () => {
  const rules = [
    {
      id: 'copay-federal-bar',
      pathway: 'copay_card',
      effect: EFFECTS.SUPPRESS,
      when: { field: 'federalProgramme', op: 'truthy' },
      reason: 'Manufacturer savings cards exclude federal healthcare programme beneficiaries.',
      sourceUrl: SOURCE,
      quote: QUOTE,
    },
  ];

  const medicare = evaluatePathway('copay_card', toContext({ insuranceStatus: 'medicare' }), rules);
  assert.equal(medicare.eligible, false);
  assert.equal(medicare.suppressedBy.id, 'copay-federal-bar');

  const commercial = evaluatePathway('copay_card', toContext({ insuranceStatus: 'commercial_covered' }), rules);
  assert.equal(commercial.eligible, true);
  assert.equal(commercial.suppressedBy, null);
});

test('require removes the pathway when the predicate does NOT match', () => {
  const rules = [
    {
      id: 'bridge-requires-bmi',
      pathway: 'medicare_bridge',
      effect: EFFECTS.REQUIRE,
      when: {
        any: [
          { field: 'bmi', op: 'gte', value: 35 },
          { all: [{ field: 'bmi', op: 'gte', value: 27 }, { field: 'hasComorbidity', op: 'truthy' }] },
        ],
      },
      reason: 'The Bridge requires BMI of at least 35, or at least 27 with a comorbidity.',
      sourceUrl: SOURCE,
      quote: QUOTE,
    },
  ];

  assert.equal(evaluatePathway('medicare_bridge', { bmi: 40 }, rules).eligible, true);
  assert.equal(evaluatePathway('medicare_bridge', { bmi: 30, hasComorbidity: true }, rules).eligible, true);
  assert.equal(evaluatePathway('medicare_bridge', { bmi: 30, hasComorbidity: false }, rules).eligible, false);
  // A user who entered no BMI cannot be granted eligibility by omission.
  assert.equal(evaluatePathway('medicare_bridge', {}, rules).eligible, false);
});

test('note and caveat keep the pathway and attach text', () => {
  const rules = [
    {
      id: 'needs-rx',
      pathway: 'lillydirect_self_pay',
      effect: EFFECTS.CAVEAT,
      when: true,
      reason: 'Requires a valid prescription from a licensed healthcare provider.',
    },
    {
      id: 'medicare-cash-note',
      pathway: 'lillydirect_self_pay',
      effect: EFFECTS.NOTE,
      when: { field: 'federalProgramme', op: 'truthy' },
      reason: 'Paying cash means this purchase does not count toward your Part D out-of-pocket total.',
    },
  ];

  const medicare = evaluatePathway('lillydirect_self_pay', toContext({ insuranceStatus: 'medicare' }), rules);
  assert.equal(medicare.eligible, true, 'a note must never suppress');
  assert.deepEqual(medicare.caveats, ['Requires a valid prescription from a licensed healthcare provider.']);
  assert.equal(medicare.eligibilityNotes.length, 1);

  const uninsured = evaluatePathway('lillydirect_self_pay', toContext({ insuranceStatus: 'none' }), rules);
  assert.equal(uninsured.eligibilityNotes.length, 0);
  assert.equal(uninsured.caveats.length, 1);
});

test('wildcard rules apply to every pathway', () => {
  const rules = [
    {
      id: 'universal-verify',
      pathway: '*',
      effect: EFFECTS.CAVEAT,
      when: true,
      reason: 'Confirm this price with your pharmacy before you rely on it.',
    },
  ];
  assert.equal(evaluatePathway('anything_at_all', {}, rules).caveats.length, 1);
});

test('notes still accumulate when a pathway is suppressed, for the audit trail', () => {
  const rules = [
    {
      id: 'sup',
      pathway: 'copay_card',
      effect: EFFECTS.SUPPRESS,
      when: true,
      reason: 'Suppressed for federal programme beneficiaries.',
      sourceUrl: SOURCE,
      quote: QUOTE,
    },
    {
      id: 'note',
      pathway: 'copay_card',
      effect: EFFECTS.NOTE,
      when: true,
      reason: 'Commercial insurance only.',
    },
  ];
  const result = evaluatePathway('copay_card', {}, rules);
  assert.equal(result.eligible, false);
  assert.deepEqual(result.eligibilityNotes, ['Commercial insurance only.']);
  assert.deepEqual(result.appliedRules, ['sup', 'note']);
});

test('validateRules demands a source and a verbatim quote on every hard rule', () => {
  const unsourced = [
    {
      id: 'no-source',
      pathway: 'copay_card',
      effect: EFFECTS.SUPPRESS,
      when: true,
      reason: 'Suppressed for a reason nobody wrote down.',
    },
  ];
  const problems = validateRules(unsourced);
  assert.ok(problems.some((p) => /sourceUrl/.test(p)), 'must demand a sourceUrl');
  assert.ok(problems.some((p) => /verbatim quote/.test(p)), 'must demand a quote');
});

test('validateRules accepts a well-formed hard rule and needs nothing extra of soft rules', () => {
  const good = [
    {
      id: 'hard-ok',
      pathway: 'copay_card',
      effect: EFFECTS.SUPPRESS,
      when: { field: 'federalProgramme', op: 'truthy' },
      reason: 'Manufacturer savings cards exclude federal healthcare programme beneficiaries.',
      sourceUrl: SOURCE,
      quote: QUOTE,
    },
    {
      id: 'soft-ok',
      pathway: 'trumprx',
      effect: EFFECTS.CAVEAT,
      when: true,
      reason: 'Prices on this platform have changed repeatedly since launch.',
    },
  ];
  assert.deepEqual(validateRules(good), []);
});

test('validateRules catches duplicates, bad effects and dead predicates', () => {
  const bad = [
    { id: 'dup', pathway: 'a', effect: EFFECTS.NOTE, when: true, reason: 'A reason long enough.' },
    { id: 'dup', pathway: 'a', effect: 'derank', when: true, reason: 'A reason long enough.' },
    { id: 'broken', pathway: 'a', effect: EFFECTS.NOTE, when: { field: 'x', op: 'nope' }, reason: 'A reason long enough.' },
    { id: 'terse', pathway: 'a', effect: EFFECTS.NOTE, when: true, reason: 'no' },
  ];
  const problems = validateRules(bad);
  assert.ok(problems.some((p) => /duplicate id/.test(p)));
  assert.ok(problems.some((p) => /invalid effect/.test(p)));
  assert.ok(problems.some((p) => /does not evaluate/.test(p)));
  assert.ok(problems.some((p) => /human-readable sentence/.test(p)));
});

test('toContext derives federalProgramme so a forgotten flag cannot widen options', () => {
  assert.equal(toContext({ insuranceStatus: 'medicare' }).federalProgramme, true);
  assert.equal(toContext({ insuranceStatus: 'medicaid' }).federalProgramme, true);
  assert.equal(toContext({ insuranceStatus: 'tricare' }).federalProgramme, true);
  assert.equal(toContext({ insuranceStatus: 'commercial_covered' }).federalProgramme, false);
  assert.equal(toContext({ insuranceStatus: 'none' }).federalProgramme, false);

  // medicareEligible follows the insurance selection unless explicitly overridden.
  assert.equal(toContext({ insuranceStatus: 'medicare' }).medicareEligible, true);
  assert.equal(toContext({ insuranceStatus: 'none' }).medicareEligible, false);
  assert.equal(toContext({ insuranceStatus: 'none', medicareEligible: true }).medicareEligible, true);
});

test('toContext accepts the Appendix B shorthand key `insurance`', () => {
  // Appendix B vectors are written as {drug, dose, insurance}. The engine must
  // accept the vector verbatim so tests cannot drift from the specification.
  assert.equal(toContext({ insurance: 'medicare' }).insuranceStatus, 'medicare');
  assert.equal(toContext({ insurance: 'medicare' }).federalProgramme, true);
});

test('toContext defaults osaCovered to false and dose to any', () => {
  const ctx = toContext({ drug: 'zepbound' });
  assert.equal(ctx.osaCovered, false);
  assert.equal(ctx.dose, 'any');
  assert.equal(ctx.incomeTier, 'unknown');
  assert.equal(ctx.bmi, null);
});
