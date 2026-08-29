/**
 * Provenance rules that survive publishing a price.
 *
 * test/pricing.test.js asserts that every shipped value is null. That is a true
 * statement about today and a useful regression guard, but it is not a
 * provenance check: it protects against a fabricated figure only as a side
 * effect of the site publishing no figures at all. The day the first price is
 * confirmed, that assertion must be relaxed -- and on that day nothing would be
 * left checking that a published number has a source behind it.
 *
 * These tests are the replacement. They are vacuously true while every value is
 * null, and become the real gate the moment one is not.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DATA = JSON.parse(readFileSync(join(ROOT, 'public/data/pricing.json'), 'utf8'));

/** Source types that can put a number on this site. */
const PRIMARY_SOURCE_TYPES = new Set([
  'primary_manufacturer',
  'primary_government',
]);

const priced = DATA.prices.filter((row) => row.value !== null);

test('every published price carries a primary source, a date and confirmed confidence', () => {
  const violations = [];

  for (const row of priced) {
    const id = `${row.drug}|${row.dose_or_tier}|${row.pathway}`;

    if (typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 0) {
      violations.push(`${id}: value must be a non-negative finite number`);
    }
    if (row.confidence !== 'confirmed') {
      violations.push(`${id}: a rendered number requires confidence "confirmed", found "${row.confidence}"`);
    }
    if (!PRIMARY_SOURCE_TYPES.has(row.source_type)) {
      violations.push(`${id}: source_type "${row.source_type}" is not a primary source`);
    }
    if (!/^https:\/\//.test(row.source_url ?? '')) {
      violations.push(`${id}: source_url must be an https primary source`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.verified_date ?? '')) {
      violations.push(`${id}: verified_date must be an ISO date`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    'A figure may only render as a number when it was read directly from a primary ' +
      `source on a recorded date.\n${violations.join('\n')}`
  );
});

test('a row still holding an unresolved candidate may not also publish a value', () => {
  const violations = priced
    .filter((row) => row.candidate && row.candidate.needs)
    .map((row) => `${row.drug}|${row.pathway}: publishes a value while its candidate still records what it needs`);

  assert.deepEqual(violations, [], violations.join('\n'));
});

test('confidence and value agree in both directions', () => {
  const violations = [];

  for (const row of DATA.prices) {
    const id = `${row.drug}|${row.dose_or_tier}|${row.pathway}`;
    if (row.confidence === 'confirmed' && row.value === null) {
      violations.push(`${id}: marked confirmed but carries no value`);
    }
    if (row.value !== null && row.confidence !== 'confirmed') {
      violations.push(`${id}: carries a value but is not confirmed`);
    }
  }

  assert.deepEqual(violations, [], violations.join('\n'));
});

test('the introductory-pricing caveat reaches every page whose data carries it', () => {
  const affectedDrugs = new Set();
  const affectedPathways = new Set();

  for (const row of DATA.prices) {
    if (!(row.caveats ?? []).some((c) => /INTRODUCTORY/i.test(c))) continue;
    affectedDrugs.add(row.drug);
    affectedPathways.add(row.pathway);
  }

  assert.ok(affectedDrugs.size > 0, 'fixture check: the data should carry this caveat');

  const pathwaySlugs = {
    lillydirect_self_pay: 'lillydirect',
    novocare_self_pay: 'novocare',
    trumprx: 'trumprx',
    medicare_bridge: 'medicare-glp1-bridge',
    patient_assistance: 'patient-assistance',
  };

  const expected = [
    ...[...affectedDrugs].map((d) => DATA.drugs[d]?.slug),
    ...[...affectedPathways].map((p) => pathwaySlugs[p]),
  ].filter(Boolean);

  const missing = expected.filter((slug) => {
    const html = readFileSync(join(ROOT, `public/${slug}/index.html`), 'utf8');
    return !html.includes('intro-warning');
  });

  assert.deepEqual(
    missing,
    [],
    'The introductory-pricing warning is the most consequential thing this site knows. ' +
      `It must render on every page whose data carries it.\nMissing from: ${missing.join(', ')}`
  );
});

test('the warning does not appear on pages whose data does not carry it', () => {
  const unaffected = Object.values(DATA.drugs)
    .filter((d) => !DATA.prices.some(
      (r) => r.drug === Object.keys(DATA.drugs).find((k) => DATA.drugs[k] === d) &&
        (r.caveats ?? []).some((c) => /INTRODUCTORY/i.test(c))
    ))
    .map((d) => d.slug);

  const overreach = unaffected.filter((slug) => {
    const html = readFileSync(join(ROOT, `public/${slug}/index.html`), 'utf8');
    return html.includes('intro-warning');
  });

  assert.deepEqual(overreach, [], `Warning shown where the data does not support it: ${overreach.join(', ')}`);
});
