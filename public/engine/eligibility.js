/**
 * Eligibility evaluation.
 *
 * Eligibility rules are encoded as DATA, not as branching prose. Adding a rule
 * means adding a row to a table; it must never mean adding an `if` to a
 * function. That constraint is what keeps the rules auditable: /methodology/
 * renders the rule table directly, so a rule that is not in the table does not
 * exist, and a rule in the table cannot be silently different from the one the
 * engine applies.
 *
 * Pure. No DOM, no fetch, no imports.
 *
 * ---------------------------------------------------------------------------
 * THE SUPPRESSION / DERANKING DISTINCTION
 *
 * A pathway a user cannot legally use is not a bad deal, it is not an option.
 * Manufacturer copay cards bar federal-programme beneficiaries outright, so for
 * a Medicare user the copay card must be ABSENT from results, not ranked last.
 * Showing it ranked last would tell a Medicare user that a $25 copay exists for
 * them. It does not, and they would find that out at the pharmacy counter.
 *
 * Hence two distinct rule effects:
 *   suppress / require -> the pathway is removed from the result set entirely
 *   note / caveat      -> the pathway stays, carrying text the user must read
 * ---------------------------------------------------------------------------
 */

/** Rule effects. `suppress` and `require` are hard; `note` and `caveat` are soft. */
export const EFFECTS = Object.freeze({
  /** Remove the pathway when the predicate MATCHES. */
  SUPPRESS: 'suppress',
  /** Remove the pathway when the predicate does NOT match. */
  REQUIRE: 'require',
  /** Keep the pathway, attach an eligibility note when the predicate matches. */
  NOTE: 'note',
  /** Keep the pathway, attach a caveat when the predicate matches. */
  CAVEAT: 'caveat',
});

const HARD_EFFECTS = new Set([EFFECTS.SUPPRESS, EFFECTS.REQUIRE]);

/**
 * Marks a hard rule whose source could not be read at build time. Set on a rule
 * INSTEAD of a verbatim quote, and only alongside a `basis` explaining the
 * evidence actually held. See validateRules for why this state is permitted for
 * rules but never for prices.
 */
export const PENDING_VERIFICATION = 'pending_primary_verification';

/**
 * Count hard rules still awaiting a verbatim quote. Rendered on /methodology/
 * and asserted by the test suite, so the verification debt is visible rather
 * than buried in a data file.
 *
 * @param {Array<object>} rules
 * @returns {{total: number, pending: number, pendingIds: string[]}}
 */
export function verificationDebt(rules) {
  const hard = (rules ?? []).filter((r) => HARD_EFFECTS.has(r?.effect));
  const pending = hard.filter((r) => r.verification === PENDING_VERIFICATION);
  return {
    total: hard.length,
    pending: pending.length,
    pendingIds: pending.map((r) => r.id),
  };
}

/**
 * ---------------------------------------------------------------------------
 * THE PREDICATE LANGUAGE
 *
 * Deliberately tiny. It exists so a rule can be expressed as JSON-serialisable
 * data and still be rendered as readable English on /methodology/. It is not a
 * general expression language and must not grow into one: if a rule cannot be
 * expressed here, that is a signal the rule is not well understood yet, which
 * on YMYL content is a reason to stop rather than to add an operator.
 *
 * Shapes:
 *   {field, op: 'eq'|'ne', value}
 *   {field, op: 'in'|'nin', value: []}
 *   {field, op: 'gte'|'lte'|'gt'|'lt', value: number}
 *   {field, op: 'truthy'|'falsy'}
 *   {all: [...]} {any: [...]} {not: {...}}
 *   true  (always matches -- used for unconditional caveats)
 * ---------------------------------------------------------------------------
 */

const OPS = Object.freeze({
  eq: (actual, expected) => actual === expected,
  ne: (actual, expected) => actual !== expected,
  in: (actual, expected) => Array.isArray(expected) && expected.includes(actual),
  nin: (actual, expected) => Array.isArray(expected) && !expected.includes(actual),
  gte: (actual, expected) => typeof actual === 'number' && actual >= expected,
  lte: (actual, expected) => typeof actual === 'number' && actual <= expected,
  gt: (actual, expected) => typeof actual === 'number' && actual > expected,
  lt: (actual, expected) => typeof actual === 'number' && actual < expected,
  truthy: (actual) => Boolean(actual),
  falsy: (actual) => !actual,
});

/**
 * Evaluate a predicate against a user context.
 *
 * An unknown operator throws rather than returning false. A silently-false
 * predicate on a `suppress` rule would quietly stop suppressing a pathway the
 * user cannot use, which is exactly the failure this module exists to prevent.
 *
 * @param {object|true} predicate
 * @param {object} ctx
 * @returns {boolean}
 */
export function matches(predicate, ctx) {
  if (predicate === true) return true;
  if (predicate === false) return false;
  if (predicate == null || typeof predicate !== 'object') {
    throw new TypeError(`Malformed predicate: ${JSON.stringify(predicate)}`);
  }

  if (Array.isArray(predicate.all)) return predicate.all.every((p) => matches(p, ctx));
  if (Array.isArray(predicate.any)) return predicate.any.some((p) => matches(p, ctx));
  if (predicate.not !== undefined) return !matches(predicate.not, ctx);

  const { field, op, value } = predicate;
  const fn = OPS[op];
  if (!fn) {
    throw new TypeError(
      `Unknown predicate operator "${op}". Refusing to evaluate: a predicate that ` +
        'silently returns false would stop a suppression rule from suppressing.'
    );
  }
  if (typeof field !== 'string' || field.length === 0) {
    throw new TypeError(`Predicate is missing a field: ${JSON.stringify(predicate)}`);
  }
  return fn(ctx?.[field], value);
}

/**
 * Render a predicate as English, for /methodology/. Keeps the rule table
 * self-documenting so the page is generated from the same data the engine
 * applies rather than from hand-written prose that can drift.
 *
 * @param {object|true} predicate
 * @returns {string}
 */
export function describePredicate(predicate) {
  if (predicate === true) return 'always';
  if (predicate === false) return 'never';
  if (Array.isArray(predicate.all)) {
    return predicate.all.map(describePredicate).join(' and ');
  }
  if (Array.isArray(predicate.any)) {
    return `(${predicate.any.map(describePredicate).join(' or ')})`;
  }
  if (predicate.not !== undefined) return `not (${describePredicate(predicate.not)})`;

  const { field, op, value } = predicate;
  const list = Array.isArray(value) ? value.join(', ') : value;
  switch (op) {
    case 'eq': return `${field} is ${value}`;
    case 'ne': return `${field} is not ${value}`;
    case 'in': return `${field} is one of [${list}]`;
    case 'nin': return `${field} is not one of [${list}]`;
    case 'gte': return `${field} is at least ${value}`;
    case 'lte': return `${field} is at most ${value}`;
    case 'gt': return `${field} is above ${value}`;
    case 'lt': return `${field} is below ${value}`;
    case 'truthy': return `${field} is true`;
    case 'falsy': return `${field} is false or absent`;
    default: return `${field} ${op} ${list}`;
  }
}

/**
 * Validate a rule table. Called by the test suite over the real table, so a
 * malformed or unsourced rule is a build-stopping event.
 *
 * Every HARD rule must carry a `sourceUrl` and a `quote`. A rule that removes a
 * pathway from a user's options is a claim about what that user may legally do;
 * making an unsourced claim of that kind is the same class of error as printing
 * an unverified price.
 *
 * @param {Array<object>} rules
 * @returns {string[]} problems; empty means valid
 */
export function validateRules(rules) {
  const problems = [];
  const seenIds = new Set();

  if (!Array.isArray(rules)) return ['Rule table is not an array'];

  rules.forEach((rule, index) => {
    const where = `rules[${index}]${rule?.id ? ` (${rule.id})` : ''}`;

    if (!rule || typeof rule !== 'object') {
      problems.push(`${where}: not an object`);
      return;
    }
    if (typeof rule.id !== 'string' || !rule.id) problems.push(`${where}: missing id`);
    if (seenIds.has(rule.id)) problems.push(`${where}: duplicate id "${rule.id}"`);
    seenIds.add(rule.id);

    if (typeof rule.pathway !== 'string' || !rule.pathway) {
      problems.push(`${where}: missing pathway`);
    }
    if (!Object.values(EFFECTS).includes(rule.effect)) {
      problems.push(`${where}: invalid effect "${rule.effect}"`);
    }
    if (typeof rule.reason !== 'string' || rule.reason.length < 10) {
      problems.push(`${where}: reason must be a human-readable sentence`);
    }

    // The predicate must actually evaluate. An empty context is enough to catch
    // a malformed operator or a missing field name.
    try {
      matches(rule.when, {});
    } catch (error) {
      problems.push(`${where}: predicate does not evaluate -- ${error.message}`);
    }

    if (HARD_EFFECTS.has(rule.effect)) {
      if (typeof rule.sourceUrl !== 'string' || !/^https:\/\//.test(rule.sourceUrl)) {
        problems.push(
          `${where}: hard rule needs an https sourceUrl -- removing a pathway is a ` +
            'claim about what the user may legally do'
        );
      }

      // A hard rule must either quote its source verbatim, or say out loud that
      // it has not yet been able to. The second state exists because primary
      // sources were unreachable at build time (see docs/discrepancy-report.md);
      // it is deliberately noisy rather than silent, and the count of pending
      // rules is asserted by the test suite and rendered on /methodology/.
      //
      // Shipping a pending SUPPRESS or REQUIRE rule is the conservative
      // direction: both effects only ever NARROW a user's apparent options, so
      // an over-broad suppression tells someone to check with their plan, while
      // its absence would tell them a copay card is available when it is not.
      // Prices get no such latitude -- those are gated by confidence alone.
      if (rule.verification === PENDING_VERIFICATION) {
        if (typeof rule.basis !== 'string' || rule.basis.length < 20) {
          problems.push(
            `${where}: a rule pending verification must state the basis actually held ` +
              'for it, so a reviewer can judge the risk of applying it'
          );
        }
      } else if (typeof rule.quote !== 'string' || rule.quote.length < 20) {
        problems.push(
          `${where}: hard rule needs a verbatim quote from its source, or ` +
            `verification: "${PENDING_VERIFICATION}" plus a basis`
        );
      }
    }
  });

  return problems;
}

/**
 * Apply a rule table to one pathway for one user context.
 *
 * @param {string} pathwayId
 * @param {object} ctx user context: {drug, dose, insuranceStatus, medicareEligible, incomeTier, osaCovered, ...}
 * @param {Array<object>} rules
 * @returns {{eligible: boolean, suppressedBy: object|null, eligibilityNotes: string[], caveats: string[], appliedRules: string[]}}
 */
export function evaluatePathway(pathwayId, ctx, rules) {
  const applicable = rules.filter((r) => r.pathway === pathwayId || r.pathway === '*');

  let suppressedBy = null;
  const eligibilityNotes = [];
  const caveats = [];
  const appliedRules = [];

  for (const rule of applicable) {
    const hit = matches(rule.when, ctx);

    if (rule.effect === EFFECTS.SUPPRESS && hit) {
      // First suppression wins, but keep scanning so notes still accumulate for
      // the methodology page's "why was this hidden" explanation.
      if (!suppressedBy) suppressedBy = rule;
      appliedRules.push(rule.id);
    } else if (rule.effect === EFFECTS.REQUIRE && !hit) {
      if (!suppressedBy) suppressedBy = rule;
      appliedRules.push(rule.id);
    } else if (rule.effect === EFFECTS.NOTE && hit) {
      eligibilityNotes.push(rule.reason);
      appliedRules.push(rule.id);
    } else if (rule.effect === EFFECTS.CAVEAT && hit) {
      caveats.push(rule.reason);
      appliedRules.push(rule.id);
    }
  }

  return {
    eligible: suppressedBy === null,
    suppressedBy,
    eligibilityNotes,
    caveats,
    appliedRules,
  };
}

/**
 * Normalise a raw user selection into an evaluation context.
 *
 * Defaults are deliberately conservative. `medicareEligible` defaults to the
 * insurance status rather than to false so that a Medicare selection cannot
 * fail to trigger the copay-card bar because a caller forgot a flag. Absent
 * data must never widen a user's apparent options.
 *
 * @param {object} input
 * @returns {object}
 */
export function toContext(input = {}) {
  const insuranceStatus = input.insuranceStatus ?? input.insurance ?? 'unknown';
  const federalProgramme = ['medicare', 'medicaid', 'tricare', 'va'].includes(insuranceStatus);

  return {
    drug: input.drug ?? null,
    dose: input.dose ?? 'any',
    insuranceStatus,
    federalProgramme,
    medicareEligible: input.medicareEligible ?? insuranceStatus === 'medicare',
    incomeTier: input.incomeTier ?? 'unknown',
    osaCovered: input.osaCovered ?? false,
    /**
     * Whether the user can already get a GLP-1 through their Part D plan.
     *
     * Research indicates the Medicare Bridge disqualifier is broader than the
     * "already covered for sleep apnea" exclusion originally specified: what
     * disqualifies is HAVING a Part D-qualifying diagnosis (type 2 diabetes,
     * moderate to severe obstructive sleep apnea, or noncirrhotic MASH), not
     * being enrolled in coverage for one. Kept as a separate field from
     * osaCovered so the narrower originally-specified rule and the broader
     * mechanism can both be expressed, and so a future verification pass can
     * retire whichever turns out to be wrong.
     */
    partDGlp1Eligible: input.partDGlp1Eligible ?? false,
    hasPrescription: input.hasPrescription ?? true,
    bmi: typeof input.bmi === 'number' ? input.bmi : null,
    hasComorbidity: input.hasComorbidity ?? null,
    indicationCovered: input.indicationCovered ?? null,
  };
}
