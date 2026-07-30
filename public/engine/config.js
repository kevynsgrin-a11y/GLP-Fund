/**
 * Site configuration. Pure data, no DOM access, importable from both the
 * browser and the Node test runner.
 *
 * This is the single source of truth for the CONFIG block in the project brief.
 * Nothing else in the codebase may hardcode a site name, domain or threshold.
 */

export const SITE_NAME = 'GLP-1 Price Check';

/**
 * PLACEHOLDER. Availability has NOT been verified with a registrar.
 * Nothing in the build depends on this value resolving; it is used only for
 * canonical URLs and structured data, both of which are regenerated on
 * domain change. See docs/ops-runbook.md before pointing DNS at anything.
 */
export const DOMAIN = 'glp1pricecheck.com';

export const SLUG = 'glp1-price-check';

/** Served path of the hand-curated price spine. Relative to the site root. */
export const DATA_FILE = '/data/pricing.json';

/** Served path of the full source manifest rendered by /methodology/. */
export const SOURCES_FILE = '/data/sources.json';

/** Past this many days since verified_date, a price renders "may be outdated". */
export const STALENESS_WARN_DAYS = 30;

/** Past this many days, a prominent stale banner renders above all results. */
export const STALENESS_URGENT_DAYS = 60;

/**
 * Monetization flags. Affiliate infrastructure ships built but empty and
 * disabled. Flipping this to true in v1 is a policy violation, not a feature
 * toggle: the site's only durable competitive wedge is that it sells nothing.
 * See docs/ops-runbook.md, "Neutrality guarantee".
 */
export const FLAGS = Object.freeze({
  AFFILIATE_SLOTS_ENABLED: false,
  DISPLAY_ADS_ENABLED: true,
  ALERT_CAPTURE_ENABLED: true,
  PREMIUM_TIER_ENABLED: false,
});

/** Exact compliance strings. Rendered verbatim; never paraphrased. */
export const DISCLAIMER =
  'This tool provides pricing information only. It is not medical advice and ' +
  'is not a substitute for consultation with a licensed healthcare provider. ' +
  'Prices change frequently and may differ at your pharmacy. Verify all costs ' +
  'directly with the manufacturer, your insurer, or your pharmacy before ' +
  'making decisions about your treatment.';

export const NON_AFFILIATION =
  'Not affiliated with, endorsed by, or sponsored by Eli Lilly, Novo Nordisk, ' +
  'the U.S. Department of Health and Human Services, or any government program.';
