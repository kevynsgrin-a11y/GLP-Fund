/**
 * APPENDIX B GOLDEN VECTORS.
 *
 * Every vector in Appendix B is a test here. A failing price test is a
 * build-stopping event, not a warning.
 *
 * Two datasets are exercised, deliberately:
 *
 *   ENGINE   test/fixtures/engine-dataset.json -- carries confirmed numbers so
 *            that ranking, dose-tier resolution, tie-breaking and suppression
 *            can be proved. Read its header: it is engine-exercise data, not
 *            verified truth.
 *
 *   SHIPPED  public/data/pricing.json -- the real spine. Every price in it is
 *            unverified because no primary source was reachable on 2026-07-30,
 *            so the assertions against it are integrity assertions: that it is
 *            structurally valid, and that it renders no numbers.
 *
 * Where Appendix A's draft value and Phase 1 disagree, the verified value wins
 * and the vector is rewritten. Phase 1 could confirm nothing, so no vector
 * asserts a real-world price as fact -- the rewrite is recorded in
 * docs/gate-resolutions.md and docs/discrepancy-report.md.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  rankPathways,
  suppressedPathways,
  overallStaleness,
  savingsSummary,
  validateDataset,
  comparePathways,
  resolveDoseTiers,
  UNVERIFIED_DISPLAY,
} from '../public/engine/pricing.js';
import { verificationDebt, toContext } from '../public/engine/eligibility.js';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const ENGINE = load('./fixtures/engine-dataset.json');
const SHIPPED = load('../public/data/pricing.json');

const TODAY = '2026-07-30';
const at = { today: TODAY };

/** Find one pathway in a result set. */
const find = (results, pathway) => results.find((r) => r.pathway === pathway);

/* ========================================================================= *
 * DATASET VALIDITY -- both datasets must be structurally sound
 * ========================================================================= */

test('the shipped dataset is structurally valid', () => {
  assert.deepEqual(validateDataset(SHIPPED), []);
});

test('the engine fixture dataset is structurally valid', () => {
  assert.deepEqual(validateDataset(ENGINE), []);
});

test('the shipped dataset renders no numbers at all, by design', () => {
  // The consequence of the egress blockade, asserted so it cannot regress into
  // "someone pasted a number in without a source".
  const numeric = SHIPPED.prices.filter((p) => p.value !== null);
  assert.deepEqual(
    numeric.map((p) => `${p.drug}|${p.dose_or_tier}|${p.pathway}`),
    [],
    'No shipped price may carry a value until it is confirmed against a primary source.'
  );
  const confirmed = SHIPPED.prices.filter((p) => p.confidence === 'confirmed');
  assert.deepEqual(confirmed, [], 'No shipped price may be marked confirmed yet.');
});

test('the shipped dataset states its verification status out loud', () => {
  assert.equal(SHIPPED.verification.status, 'primary_sources_unreachable');
  assert.match(SHIPPED.verification.summary, /unverified/);
  assert.ok(SHIPPED.verification.discrepancyReport, 'must point at the discrepancy report');
});

test('the engine never reads the candidate block', () => {
  // The candidate figures exist for the methodology page and for a future
  // promotion pass. If the engine ever read them, the integrity invariant would
  // be bypassed entirely.
  const source = readFileSync(new URL('../public/engine/pricing.js', import.meta.url), 'utf8');
  // Property ACCESS, not the bare word: `candidate` is also a perfectly ordinary
  // local variable name in a reducer, and banning the word would be a lint that
  // teaches people to rename variables rather than to avoid unverified data.
  const accesses = source.match(/\.candidate\b|\[['"]candidate['"]\]|['"]candidate['"]\s*:/g) ?? [];
  assert.deepEqual(
    accesses,
    [],
    'pricing.js must never read the `candidate` property: those figures are unverified ' +
      'by construction, and reading them would bypass the integrity invariant entirely.'
  );

  // Nor may any other engine module.
  for (const mod of ['savings.js', 'staleness.js', 'eligibility.js']) {
    const text = readFileSync(new URL(`../public/engine/${mod}`, import.meta.url), 'utf8');
    assert.ok(!/\.candidate\b/.test(text), `${mod} must not read the candidate property`);
  }
});

test('the verification debt on hard eligibility rules is visible and counted', () => {
  const debt = verificationDebt(SHIPPED.eligibilityRules);
  assert.ok(debt.total > 0);
  assert.equal(
    debt.pending,
    debt.total,
    'Under the egress blockade every hard rule is pending a verbatim quote. ' +
      'When that changes, this assertion should be updated deliberately, not by accident.'
  );
  // The fixture, standing in for a verified world, has zero pending rules.
  assert.equal(verificationDebt(ENGINE.eligibilityRules).pending, 0);
});

/* ========================================================================= *
 * VECTOR 1 -- zepbound 2.5mg uninsured
 * ========================================================================= */

test('vector 1: zepbound 2.5mg uninsured ranks the LillyDirect vial pathway first', () => {
  const results = rankPathways({ drug: 'zepbound', dose: '2.5mg', insurance: 'none' }, ENGINE, at);

  assert.equal(results[0].pathway, 'lillydirect_self_pay');
  assert.equal(results[0].monthlyCost, 299);
  assert.equal(results[0].annualCost, 299 * 12);
  assert.equal(results[0].annualCost, 3588);
  assert.equal(results[0].confidence, 'confirmed');
  assert.equal(results[0].displayCost, '$299');
  assert.equal(results[0].displayAnnualCost, '$3,588');

  // Every rendered price carries a source link and a verification date.
  assert.match(results[0].sourceUrl, /^https:\/\//);
  assert.equal(results[0].verifiedDate, '2026-07-30');
  assert.equal(results[0].staleness, 'fresh');
});

/* ========================================================================= *
 * VECTOR 2 -- dose-tier logic is live, not flat
 * ========================================================================= */

test('vector 2: zepbound 5mg returns the 5mg tier, and it differs from 2.5mg', () => {
  const two = rankPathways({ drug: 'zepbound', dose: '2.5mg', insurance: 'none' }, ENGINE, at);
  const five = rankPathways({ drug: 'zepbound', dose: '5mg', insurance: 'none' }, ENGINE, at);

  const lillyTwo = find(two, 'lillydirect_self_pay');
  const lillyFive = find(five, 'lillydirect_self_pay');

  assert.equal(lillyFive.monthlyCost, 399);
  assert.equal(lillyFive.doseOrTier, '5mg');
  assert.notEqual(
    lillyFive.monthlyCost,
    lillyTwo.monthlyCost,
    'If these matched, the tool would be flat-priced and the dose selector decorative.'
  );
  assert.equal(lillyFive.annualCost, 4788);
});

/* ========================================================================= *
 * VECTOR 3 -- the "all other doses" tier and its refill-window caveat
 * ========================================================================= */

test('vector 3: zepbound 15mg resolves to the all-other-doses tier with the refill caveat', () => {
  const results = rankPathways({ drug: 'zepbound', dose: '15mg', insurance: 'none' }, ENGINE, at);
  const lilly = find(results, 'lillydirect_self_pay');

  assert.equal(lilly.doseOrTier, 'all_other_doses');
  assert.equal(lilly.monthlyCost, 449);
  assert.equal(lilly.annualCost, 5388);

  // The refill-window condition materially changes real monthly cost, so it must
  // reach the user rather than living only in the data file.
  assert.ok(
    lilly.caveats.some((c) => /refill within 45 days/i.test(c)),
    `expected a refill-window caveat, got: ${JSON.stringify(lilly.caveats)}`
  );
  // And the universal prescription caveat still applies.
  assert.ok(lilly.caveats.some((c) => /valid prescription/i.test(c)));
});

test('every dose above 5mg maps to the same tier', () => {
  for (const dose of ['7.5mg', '10mg', '12.5mg', '15mg']) {
    const lilly = find(rankPathways({ drug: 'zepbound', dose, insurance: 'none' }, ENGINE, at), 'lillydirect_self_pay');
    assert.equal(lilly.monthlyCost, 449, `dose ${dose}`);
    assert.equal(lilly.doseOrTier, 'all_other_doses', `dose ${dose}`);
  }
});

test('resolveDoseTiers prefers the specific tier over the flat one', () => {
  assert.deepEqual(resolveDoseTiers(ENGINE, 'zepbound', '2.5mg'), ['2.5mg', 'any']);
  assert.deepEqual(resolveDoseTiers(ENGINE, 'zepbound', '15mg'), ['all_other_doses', '15mg', 'any']);
  assert.deepEqual(resolveDoseTiers(ENGINE, 'wegovy_injection', 'any'), ['any']);
});

/* ========================================================================= *
 * VECTOR 4 -- cross-manufacturer comparison in one view
 * ========================================================================= */

test('vector 4: wegovy injection uninsured returns both NovoCare and TrumpRx, ranked, both sourced', () => {
  const results = rankPathways({ drug: 'wegovy_injection', dose: 'any', insurance: 'none' }, ENGINE, at);
  const pathways = results.map((r) => r.pathway);

  assert.ok(pathways.includes('novocare_self_pay'), 'NovoCare must appear');
  assert.ok(pathways.includes('trumprx'), 'TrumpRx must appear');

  // This is the wedge: a manufacturer site structurally cannot tell a user that
  // the federal platform is cheaper, and the federal platform does not compare
  // itself to manufacturer direct-pay. Both appear here, in one view.
  for (const r of results) {
    assert.match(r.sourceUrl, /^https:\/\//, `${r.pathway} must carry a source link`);
    assert.ok(r.verifiedDate, `${r.pathway} must carry a verification date`);
  }

  // Ranked by cost, ascending.
  const costs = results.filter((r) => r.monthlyCost !== null).map((r) => r.monthlyCost);
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b));
});

/* ========================================================================= *
 * VECTOR 5 -- the oral starting dose
 * ========================================================================= */

test('vector 5: wegovy pill 1.5mg returns the oral starting-dose tier', () => {
  const results = rankPathways({ drug: 'wegovy_pill', dose: '1.5mg', insurance: 'none' }, ENGINE, at);
  const novo = find(results, 'novocare_self_pay');

  assert.equal(novo.doseOrTier, '1.5mg');
  assert.equal(novo.monthlyCost, 149);
  assert.equal(novo.annualCost, 1788);

  // And the higher oral doses are a genuinely different tier.
  const higher = find(rankPathways({ drug: 'wegovy_pill', dose: '25mg', insurance: 'none' }, ENGINE, at), 'novocare_self_pay');
  assert.equal(higher.doseOrTier, 'higher_doses');
  assert.notEqual(higher.monthlyCost, novo.monthlyCost);
});

test('vector 5, shipped data: the 149-vs-199 conflict renders as unverified, not as a picked side', () => {
  // The brief asks this vector to "resolve the $149 vs $199 conflict". Phase 1
  // could not resolve it: both figures are in circulation and novocare.com was
  // unreachable. Reconciling them into one number would be a guess, and a guess
  // is what this site exists not to do. So the shipped datum is `conflicting`
  // with a null value, and the UI says so.
  // The apparent conflict is now reported to resolve as a strength-and-deadline
  // distinction rather than a contradiction -- but it is still not CONFIRMED, so
  // the datum stays conflicting with a null value. What changed is that the raw
  // figures no longer appear in the card prose; they live in the candidate block,
  // which /methodology/ renders under an explicit "located but not confirmed"
  // heading. See the bare-figure invariant below for why that matters.
  const datum = SHIPPED.prices.find(
    (p) => p.drug === 'wegovy_pill' && p.dose_or_tier === '1.5mg' && p.pathway === 'novocare_self_pay'
  );
  assert.equal(datum.confidence, 'conflicting');
  assert.equal(datum.value, null);
  assert.match(datum.notes, /different strengths and different offer windows/);
  assert.equal(datum.candidate.value, null);

  const results = rankPathways({ drug: 'wegovy_pill', dose: '1.5mg', insurance: 'none' }, SHIPPED, at);
  const novo = find(results, 'novocare_self_pay');
  assert.equal(novo.monthlyCost, null);
  assert.equal(novo.displayCost, UNVERIFIED_DISPLAY);
});

/* ========================================================================= *
 * VECTOR 6 -- copay card outranks cash for a commercially covered user
 * ========================================================================= */

test('no rendered note or caveat contains a currency figure', () => {
  // The integrity invariant covers the price FIELD. This covers the prose beside
  // it, which is the same hazard wearing different clothes: a card that shows
  // "Price not currently verified" directly above a note reading "$149" has told
  // the user a price, whatever the price field says. A user scanning six cards on
  // a phone will not parse the distinction.
  //
  // Magnitudes may still be conveyed in words -- "roughly 150 dollars", "four
  // figures a month" -- which reads as an estimate rather than a quotable price.
  // The located figures themselves live in the candidate block, which
  // /methodology/ renders under an explicit not-confirmed heading.
  const offenders = [];

  for (const datum of SHIPPED.prices) {
    for (const [field, text] of [
      ['notes', datum.notes],
      ...(datum.caveats ?? []).map((c, i) => [`caveats[${i}]`, c]),
    ]) {
      const found = String(text ?? '').match(/\$\s?[\d,]+/g);
      if (found) {
        offenders.push(`${datum.drug}|${datum.dose_or_tier}|${datum.pathway} ${field}: ${found.join(', ')}`);
      }
    }
  }

  for (const rule of SHIPPED.eligibilityRules) {
    const found = String(rule.reason ?? '').match(/\$\s?[\d,]+/g);
    if (found) offenders.push(`rule ${rule.id}: ${found.join(', ')}`);
  }

  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('vector 6: ozempic with commercial coverage ranks the copay card above cash pathways', () => {
  const results = rankPathways({ drug: 'ozempic', insurance: 'commercial_covered' }, ENGINE, at);

  assert.equal(results[0].pathway, 'copay_card');
  assert.equal(results[0].monthlyCost, 25);

  const copayIndex = results.findIndex((r) => r.pathway === 'copay_card');
  const cashIndex = results.findIndex((r) => r.pathway === 'novocare_self_pay');
  assert.ok(copayIndex < cashIndex, 'the copay card must rank above the cash pathway');
});

test('vector 6: the copay card states the Medicare and Medicaid exclusion on its face', () => {
  const results = rankPathways({ drug: 'ozempic', insurance: 'commercial_covered' }, ENGINE, at);
  const copay = find(results, 'copay_card');

  // A commercially insured user today may be a Medicare beneficiary next year.
  // The exclusion belongs on the card even when it does not currently bite.
  const text = [...copay.eligibilityNotes, ...copay.caveats, copay.pathwayLabel].join(' ');
  const ruleText = ENGINE.eligibilityRules.find((r) => r.id === 'copay-card-federal-program-bar').reason;
  assert.match(ruleText, /Medicare/);
  assert.match(ruleText, /Medicaid/);
  assert.ok(text.length > 0);
});

/* ========================================================================= *
 * VECTOR 7 -- Medicare: the copay card is SUPPRESSED, not deranked
 * ========================================================================= */

test('vector 7: zepbound on Medicare suppresses the copay card entirely', () => {
  const results = rankPathways({ drug: 'zepbound', insurance: 'medicare' }, ENGINE, at);
  const pathways = results.map((r) => r.pathway);

  // ABSENT, not last. Showing it ranked last would tell a Medicare beneficiary
  // that a $25 copay exists for them. It does not, and they would discover that
  // at the pharmacy counter.
  assert.ok(
    !pathways.includes('copay_card'),
    `the copay card must be absent for a Medicare user, got: ${pathways.join(', ')}`
  );

  // The Bridge and the cash pathways are returned.
  assert.ok(pathways.includes('medicare_bridge'), 'the Bridge must be offered');
  assert.ok(pathways.includes('lillydirect_self_pay'), 'cash-pay must remain available');

  // And the suppression is explainable rather than silent.
  const hidden = suppressedPathways({ drug: 'zepbound', insurance: 'medicare' }, ENGINE, at);
  const hiddenCopay = find(hidden, 'copay_card');
  assert.ok(hiddenCopay, 'the suppressed pathway must still be inspectable');
  assert.equal(hiddenCopay.suppressedBy, 'copay-card-federal-program-bar');
  assert.match(hiddenCopay.suppressionReason, /federal healthcare program/);
});

test('vector 7: the Bridge is the cheapest Medicare option and is ranked first', () => {
  const results = rankPathways({ drug: 'zepbound', insurance: 'medicare' }, ENGINE, at);
  assert.equal(results[0].pathway, 'medicare_bridge');
  assert.equal(results[0].monthlyCost, 50);
});

test('the copay card is also suppressed for Medicaid, TRICARE and VA', () => {
  for (const insurance of ['medicaid', 'tricare', 'va']) {
    const results = rankPathways({ drug: 'zepbound', insurance }, ENGINE, at);
    assert.ok(
      !results.some((r) => r.pathway === 'copay_card'),
      `copay card must be suppressed for ${insurance}`
    );
  }
});

test('the copay card is suppressed for an uninsured user too, for a different reason', () => {
  const results = rankPathways({ drug: 'zepbound', insurance: 'none' }, ENGINE, at);
  assert.ok(!results.some((r) => r.pathway === 'copay_card'));

  const hidden = suppressedPathways({ drug: 'zepbound', insurance: 'none' }, ENGINE, at);
  assert.equal(find(hidden, 'copay_card').suppressedBy, 'copay-card-requires-commercial-coverage');
});

/* ========================================================================= *
 * VECTOR 8 -- the OSA exclusion
 * ========================================================================= */

test('vector 8: zepbound on Medicare with OSA coverage suppresses the Bridge', () => {
  const withoutOsa = rankPathways({ drug: 'zepbound', insurance: 'medicare', osaCovered: false }, ENGINE, at);
  const withOsa = rankPathways({ drug: 'zepbound', insurance: 'medicare', osaCovered: true }, ENGINE, at);

  assert.ok(withoutOsa.some((r) => r.pathway === 'medicare_bridge'), 'control: Bridge present without OSA');
  assert.ok(
    !withOsa.some((r) => r.pathway === 'medicare_bridge'),
    'the Bridge must be absent for a beneficiary already covered via the OSA pathway'
  );

  const hidden = suppressedPathways({ drug: 'zepbound', insurance: 'medicare', osaCovered: true }, ENGINE, at);
  assert.equal(find(hidden, 'medicare_bridge').suppressedBy, 'medicare-bridge-osa-exclusion');
});

test('vector 8: cash pathways survive the OSA exclusion, so the user is not left with nothing', () => {
  const withOsa = rankPathways({ drug: 'zepbound', insurance: 'medicare', osaCovered: true }, ENGINE, at);
  assert.ok(withOsa.length > 0, 'suppressing the Bridge must not empty the result set');
  assert.ok(withOsa.some((r) => r.pathway === 'lillydirect_self_pay'));
});

test('vector 8, shipped data: the Bridge disqualifier is the broader Part D one', () => {
  // Research indicates the real mechanism is having a Part D-qualifying diagnosis
  // (type 2 diabetes, moderate to severe OSA, or noncirrhotic MASH), not merely
  // "already covered for sleep apnea". The shipped rule suppresses on either
  // signal, so both readings are honoured until one can be confirmed.
  const base = { drug: 'wegovy_injection', insurance: 'medicare' };
  const control = rankPathways(base, SHIPPED, at);
  assert.ok(control.some((r) => r.pathway === 'medicare_bridge'), 'control: Bridge offered');

  for (const disqualifier of [{ osaCovered: true }, { partDGlp1Eligible: true }]) {
    const results = rankPathways({ ...base, ...disqualifier }, SHIPPED, at);
    assert.ok(
      !results.some((r) => r.pathway === 'medicare_bridge'),
      `Bridge must be suppressed for ${JSON.stringify(disqualifier)}`
    );
    const hidden = suppressedPathways({ ...base, ...disqualifier }, SHIPPED, at);
    assert.equal(
      find(hidden, 'medicare_bridge').suppressedBy,
      'medicare-bridge-part-d-eligible-exclusion'
    );
  }
});

test('the introductory-pricing trap reaches the user as a caveat', () => {
  // The most consequential consumer finding in the research: the low headline
  // figures for these pathways are reported to be introductory, covering the
  // lowest doses and the first two fills only. Omitting that is how a patient
  // ends up budgeting a number that triples. It must be on the card, not in a
  // footnote, and not only in the data file.
  const checks = [
    { drug: 'wegovy_injection', dose: '0.25mg', pathway: 'novocare_self_pay' },
    { drug: 'wegovy_injection', dose: 'any', pathway: 'trumprx' },
    { drug: 'ozempic', dose: 'any', pathway: 'trumprx' },
    { drug: 'ozempic', dose: 'any', pathway: 'novocare_self_pay' },
    { drug: 'zepbound', dose: 'any', pathway: 'trumprx' },
  ];

  for (const c of checks) {
    const result = find(rankPathways({ drug: c.drug, dose: c.dose, insurance: 'none' }, SHIPPED, at), c.pathway);
    assert.ok(result, `${c.drug}/${c.pathway} should be offered`);
    assert.ok(
      result.caveats.some((x) => /INTRODUCTORY price/.test(x)),
      `${c.drug}/${c.pathway} must carry the introductory-pricing caveat, got: ${JSON.stringify(result.caveats)}`
    );
  }
});

test('Wegovy injection is dose-tiered, not flat', () => {
  // Appendix B vector 4 was written assuming a flat price across doses. Research
  // contradicts that: the low doses and the standard doses are reported to be
  // priced differently, so dose "any" was an invalid modelling assumption. The
  // vector is rewritten, per the brief's instruction that verified findings win.
  const low = find(rankPathways({ drug: 'wegovy_injection', dose: '0.25mg', insurance: 'none' }, SHIPPED, at), 'novocare_self_pay');
  const standard = find(rankPathways({ drug: 'wegovy_injection', dose: '2.4mg', insurance: 'none' }, SHIPPED, at), 'novocare_self_pay');

  assert.equal(low.doseOrTier, 'low_doses');
  assert.equal(standard.doseOrTier, 'standard_doses');
  assert.notEqual(low.doseOrTier, standard.doseOrTier, 'the two tiers must be distinct');
});

test('vector 4, shipped data: NovoCare and TrumpRx both appear for an uninsured user', () => {
  const results = rankPathways({ drug: 'wegovy_injection', dose: '0.5mg', insurance: 'none' }, SHIPPED, at);
  const pathways = results.map((r) => r.pathway);
  assert.ok(pathways.includes('novocare_self_pay'));
  assert.ok(pathways.includes('trumprx'));
  for (const r of results) {
    assert.match(r.sourceUrl, /^https:\/\//);
    assert.ok(r.verifiedDate);
  }
});

test('an irreconcilable eligibility conflict neither suppresses nor silently offers', () => {
  // Sources disagree on whether a Medicare beneficiary may buy through LillyDirect
  // Self Pay at all. Suppressing would strand a user who does qualify; offering it
  // silently would send one who does not to a program that will refuse them. The
  // only honest handling of an unresolved conflict is to keep the pathway AND say
  // out loud that its eligibility is disputed.
  const results = rankPathways({ drug: 'zepbound', insurance: 'medicare' }, SHIPPED, at);
  const lilly = find(results, 'lillydirect_self_pay');

  assert.ok(lilly, 'the pathway must not be suppressed on a conflict we could not settle');
  assert.ok(
    lilly.eligibilityNotes.some((n) => /sources disagree/i.test(n)),
    `the dispute must reach the user, got: ${JSON.stringify(lilly.eligibilityNotes)}`
  );

  // And an uninsured user, for whom no dispute exists, must not see the warning.
  const uninsured = find(rankPathways({ drug: 'zepbound', insurance: 'none' }, SHIPPED, at), 'lillydirect_self_pay');
  assert.ok(!uninsured.eligibilityNotes.some((n) => /sources disagree/i.test(n)));
});

test('the copay-card bar does not sweep in FEHB or exchange plans', () => {
  // Research contradicted the brief's premise here: located savings-offer terms
  // state that FEHB, ACA exchange and state employee plans are NOT federal or
  // state healthcare programs for the offer's purposes. Treating an FEHB enrollee
  // as barred would wrongly remove a pathway they can actually use, so
  // federalProgramme is deliberately limited to the four programs named.
  assert.equal(toContext({ insurance: 'fehb' }).federalProgramme, false);
  assert.equal(toContext({ insurance: 'commercial_covered' }).federalProgramme, false);
  for (const program of ['medicare', 'medicaid', 'tricare', 'va']) {
    assert.equal(toContext({ insurance: program }).federalProgramme, true, program);
  }
});

/* ========================================================================= *
 * VECTOR 10 -- THE INTEGRITY INVARIANT
 * ========================================================================= */

test('vector 10: an unverified pathway returns monthlyCost null and a display string', () => {
  const results = rankPathways(
    { drug: 'zepbound', dose: '2.5mg', insurance: 'none', incomeTier: 'low' },
    ENGINE,
    at
  );
  const pap = find(results, 'patient_assistance');

  assert.ok(pap, 'the unverified pathway must still be offered, with a link out');
  assert.equal(pap.confidence, 'unverified');
  assert.equal(pap.monthlyCost, null);
  assert.equal(pap.annualCost, null);
  assert.equal(pap.displayCost, UNVERIFIED_DISPLAY);
  assert.equal(pap.displayAnnualCost, UNVERIFIED_DISPLAY);
  assert.match(pap.officialUrl, /^https:\/\//, 'it must link to the pathway official page');
  assert.equal(typeof pap.displayCost, 'string');
});

test('vector 10: NO code path can return an unverified pathway with a numeric cost', () => {
  // Adversarial: a dataset that has been poisoned exactly as a careless edit
  // would poison it -- values present, confidence not confirmed. The chokepoint
  // must null every one of them.
  const poisoned = structuredClone(ENGINE);
  for (const price of poisoned.prices) {
    price.value = 12345;
    price.confidence = price.pathway === 'copay_card' ? 'unverified' : 'conflicting';
  }

  const inputs = [
    { drug: 'zepbound', dose: '2.5mg', insurance: 'none' },
    { drug: 'zepbound', dose: '5mg', insurance: 'commercial_covered' },
    { drug: 'zepbound', dose: '15mg', insurance: 'medicare' },
    { drug: 'zepbound', insurance: 'medicare', osaCovered: true },
    { drug: 'wegovy_injection', insurance: 'none' },
    { drug: 'wegovy_pill', dose: '1.5mg', insurance: 'none' },
    { drug: 'ozempic', insurance: 'commercial_covered' },
  ];

  for (const input of inputs) {
    const label = JSON.stringify(input);
    for (const set of [
      rankPathways(input, poisoned, at),
      suppressedPathways(input, poisoned, at),
    ]) {
      for (const r of set) {
        assert.equal(r.monthlyCost, null, `${label} ${r.pathway}: monthlyCost leaked`);
        assert.equal(r.annualCost, null, `${label} ${r.pathway}: annualCost leaked`);
        assert.equal(r.displayCost, UNVERIFIED_DISPLAY, `${label} ${r.pathway}: displayCost leaked`);
        assert.ok(!/12345/.test(JSON.stringify(r)), `${label} ${r.pathway}: the poisoned value appears somewhere in the result`);
      }
    }

    // The savings summary must not manufacture a delta from unverified figures.
    const ranked = rankPathways(input, poisoned, at);
    const summary = savingsSummary(ranked, poisoned, { drug: input.drug });
    assert.equal(summary.monthlyDelta, null, `${label}: delta leaked`);
    assert.equal(summary.annualDelta, null, `${label}: annual delta leaked`);
    assert.equal(summary.comparable, false);
  }
});

test('vector 10: the invariant holds across the real shipped dataset', () => {
  for (const drug of Object.keys(SHIPPED.drugs)) {
    for (const insurance of ['none', 'commercial_covered', 'commercial_not_covered', 'medicare', 'medicaid']) {
      const results = rankPathways({ drug, insurance }, SHIPPED, at);
      for (const r of results) {
        assert.equal(r.monthlyCost, null, `${drug}/${insurance}/${r.pathway}`);
        assert.equal(r.displayCost, UNVERIFIED_DISPLAY, `${drug}/${insurance}/${r.pathway}`);
      }
    }
  }
});

test('vector 10: a confirmed confidence with a null value still yields no number', () => {
  // The other direction of the same failure: metadata says confirmed, the value
  // is absent. isUsableAmount catches it.
  const dataset = structuredClone(ENGINE);
  dataset.prices.find((p) => p.pathway === 'lillydirect_self_pay' && p.dose_or_tier === '2.5mg').value = null;

  const lilly = find(rankPathways({ drug: 'zepbound', dose: '2.5mg', insurance: 'none' }, dataset, at), 'lillydirect_self_pay');
  assert.equal(lilly.monthlyCost, null);
  assert.equal(lilly.displayCost, UNVERIFIED_DISPLAY);
});

/* ========================================================================= *
 * VECTOR 11 -- the savings delta
 * ========================================================================= */

test('vector 11: uninsured user at list price sees the delta as both monthly and annual', () => {
  const results = rankPathways({ drug: 'zepbound', dose: '2.5mg', insurance: 'none' }, ENGINE, at);
  const summary = savingsSummary(results, ENGINE, { drug: 'zepbound' });

  assert.equal(summary.currentPathway, 'list_price');
  assert.equal(summary.currentMonthlyCost, 1086);
  assert.equal(summary.cheapestPathway, 'lillydirect_self_pay');
  assert.equal(summary.cheapestMonthlyCost, 299);

  assert.equal(summary.monthlyDelta, 787);
  assert.equal(summary.annualDelta, 9444);
  assert.equal(summary.displayMonthlyDelta, '$787');
  assert.equal(summary.displayAnnualDelta, '$9,444');
  assert.equal(summary.percentReduction, 72);
  assert.equal(summary.isSaving, true);
  assert.equal(summary.comparable, true);
});

test('vector 11: list price is never offered as a pathway to choose', () => {
  for (const insurance of ['none', 'commercial_covered', 'medicare']) {
    const results = rankPathways({ drug: 'zepbound', insurance }, ENGINE, at);
    assert.ok(
      !results.some((r) => r.pathway === 'list_price'),
      'list price is the reference point, not an option'
    );
  }
});

test('vector 11: the delta is incomparable rather than zero when list price is unverified', () => {
  const results = rankPathways({ drug: 'wegovy_pill', dose: '1.5mg', insurance: 'none' }, SHIPPED, at);
  const summary = savingsSummary(results, SHIPPED, { drug: 'wegovy_pill' });
  assert.equal(summary.comparable, false);
  assert.equal(summary.monthlyDelta, null);
  assert.equal(summary.displayMonthlyDelta, UNVERIFIED_DISPLAY);
});

/* ========================================================================= *
 * VECTOR 12 -- deterministic ordering
 * ========================================================================= */

test('vector 12: two pathways at identical cost order alphabetically by pathway name', () => {
  const results = rankPathways({ drug: 'wegovy_injection', insurance: 'none' }, ENGINE, at);
  const tied = results.filter((r) => r.monthlyCost === 199).map((r) => r.pathway);

  assert.deepEqual(tied, ['novocare_self_pay', 'trumprx'], 'ties must order alphabetically');
});

test('vector 12: ordering is stable under input permutation, so the UI never flickers', () => {
  const baseline = rankPathways({ drug: 'wegovy_injection', insurance: 'none' }, ENGINE, at).map((r) => r.pathway);

  for (let i = 0; i < 12; i += 1) {
    const shuffled = structuredClone(ENGINE);
    // A deterministic rotation, since Math.random is unavailable and a fixed
    // permutation set is a stronger test than a random one anyway.
    shuffled.prices = [...shuffled.prices.slice(i), ...shuffled.prices.slice(0, i)].reverse();
    const order = rankPathways({ drug: 'wegovy_injection', insurance: 'none' }, shuffled, at).map((r) => r.pathway);
    assert.deepEqual(order, baseline, `rotation ${i} changed the order`);
  }
});

test('vector 12: comparePathways is a total order', () => {
  const rows = [
    { pathway: 'b', monthlyCost: 100, doseOrTier: 'any' },
    { pathway: 'a', monthlyCost: 100, doseOrTier: 'any' },
    { pathway: 'c', monthlyCost: null, doseOrTier: 'any' },
    { pathway: 'a', monthlyCost: null, doseOrTier: 'any' },
    { pathway: 'd', monthlyCost: 50, doseOrTier: 'any' },
  ];
  const sorted = [...rows].sort(comparePathways).map((r) => `${r.pathway}:${r.monthlyCost}`);

  // Priced first ascending, then unpriced alphabetically.
  assert.deepEqual(sorted, ['d:50', 'a:100', 'b:100', 'a:null', 'c:null']);

  // Antisymmetry and reflexivity. Summing the signs avoids comparing 0 against
  // -0, which Node's strict equality treats as a difference.
  for (const x of rows) {
    assert.equal(comparePathways(x, x), 0, `reflexivity for ${x.pathway}`);
    for (const y of rows) {
      const ab = Math.sign(comparePathways(x, y));
      const ba = Math.sign(comparePathways(y, x));
      assert.equal(ab + ba, 0, `antisymmetry for ${x.pathway}/${y.pathway}`);
    }
  }
});

test('unverified pathways always sort after every priced pathway', () => {
  const results = rankPathways(
    { drug: 'zepbound', dose: '2.5mg', insurance: 'none', incomeTier: 'low' },
    ENGINE,
    at
  );
  const firstUnpriced = results.findIndex((r) => r.monthlyCost === null);
  if (firstUnpriced !== -1) {
    for (let i = firstUnpriced; i < results.length; i += 1) {
      assert.equal(results[i].monthlyCost, null, 'no priced pathway may follow an unpriced one');
    }
  }
});

/* ========================================================================= *
 * STALENESS INTEGRATION -- vector 9 wired through the engine
 * ========================================================================= */

test('vector 9 integration: every rendered price carries a staleness state', () => {
  const results = rankPathways({ drug: 'zepbound', dose: '2.5mg', insurance: 'none' }, ENGINE, at);
  for (const r of results) {
    assert.ok(['fresh', 'warn', 'urgent'].includes(r.staleness), `${r.pathway}: ${r.staleness}`);
  }
  assert.equal(overallStaleness(results), 'fresh');
});

test('vector 9 integration: backdating a verified_date raises the banner', () => {
  // This is the Phase 6 QA procedure, executed as a unit test as well as in the
  // browser: the failsafe must be provable, not assumed.
  const warned = structuredClone(ENGINE);
  warned.prices.find((p) => p.pathway === 'lillydirect_self_pay' && p.dose_or_tier === '2.5mg').verified_date = '2026-06-15';
  const warnResults = rankPathways({ drug: 'zepbound', dose: '2.5mg', insurance: 'none' }, warned, at);
  assert.equal(find(warnResults, 'lillydirect_self_pay').staleness, 'warn');
  assert.equal(overallStaleness(warnResults), 'warn');

  const urgent = structuredClone(ENGINE);
  urgent.prices.find((p) => p.pathway === 'lillydirect_self_pay' && p.dose_or_tier === '2.5mg').verified_date = '2026-05-01';
  const urgentResults = rankPathways({ drug: 'zepbound', dose: '2.5mg', insurance: 'none' }, urgent, at);
  assert.equal(find(urgentResults, 'lillydirect_self_pay').staleness, 'urgent');
  assert.equal(overallStaleness(urgentResults), 'urgent');
});

/* ========================================================================= *
 * GUARDS
 * ========================================================================= */

test('rankPathways refuses to run without a date, because staleness is not optional', () => {
  const undated = structuredClone(ENGINE);
  delete undated.generatedAt;
  assert.throws(
    () => rankPathways({ drug: 'zepbound', insurance: 'none' }, undated, {}),
    /needs a `today` date/
  );
});

test('rankPathways refuses a malformed dataset', () => {
  assert.throws(() => rankPathways({ drug: 'zepbound' }, null, at), /requires a dataset/);
  assert.throws(() => rankPathways({ drug: 'zepbound' }, {}, at), /requires a dataset/);
});

test('an unknown drug returns an empty result set rather than throwing', () => {
  // A stressed user on a phone must never see a broken page.
  assert.deepEqual(rankPathways({ drug: 'not_a_drug', insurance: 'none' }, ENGINE, at), []);
});

test('every price datum in the shipped dataset resolves to a known drug and pathway', () => {
  for (const p of SHIPPED.prices) {
    assert.ok(SHIPPED.drugs[p.drug], `unknown drug ${p.drug}`);
    assert.ok(SHIPPED.pathways[p.pathway], `unknown pathway ${p.pathway}`);
  }
});

test('every drug in the shipped dataset has at least one pathway a user can reach', () => {
  for (const drug of Object.keys(SHIPPED.drugs)) {
    const results = rankPathways({ drug, insurance: 'none' }, SHIPPED, at);
    assert.ok(results.length > 0, `${drug} offers an uninsured user nothing at all`);
  }
});
