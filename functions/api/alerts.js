/**
 * Cloudflare Pages Function: price-change alert list capture.
 *
 * THIS IS THE ONLY SERVER-SIDE CODE IN THE PROJECT. The technical envelope
 * permits a Pages Function plus KV for exactly one purpose -- email capture for
 * the price-change alert list -- and nothing else. Do not add a second endpoint
 * here. If something appears to need one, the answer is almost certainly that it
 * belongs in the static build or in the pure engine.
 *
 * Accepts exactly two fields: `email` and `drug`. Anything else in the body is
 * ignored rather than stored. The visitor's insurance situation and dose are
 * health information and are never transmitted from the client, so this endpoint
 * has no field to receive them and would drop them if it did.
 *
 * Binding required: KV namespace `ALERTS`.
 *   wrangler.toml, or Pages project settings, Functions, KV namespace bindings.
 */

const MAX_BODY_BYTES = 2048;

/** Medications the alert list can segment on. Kept in sync with data/pricing.json. */
const ALLOWED_DRUGS = new Set([
  'all',
  'zepbound',
  'mounjaro',
  'wegovy_injection',
  'wegovy_pill',
  'ozempic',
  'foundayo',
]);

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * Validate an email address well enough to store it.
 *
 * Deliberately conservative rather than RFC-exhaustive: this is a mailing list,
 * so an address that cannot receive mail is worthless, and a strict-ish check
 * that rejects a genuine oddity is a better failure than a KV full of typos.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const email = value.trim();
  if (email.length < 6 || email.length > 254) return false;
  if (/\s/.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Normalise for use as a KV key: lowercase, trimmed. Storing a canonical form
 * makes the write idempotent, so a double-submit does not create two records and
 * the same person does not get two emails on a price-change day.
 *
 * @param {string} email
 * @returns {string}
 */
function normaliseEmail(email) {
  return email.trim().toLowerCase();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ALERTS) {
    // Fail loudly in logs, vaguely to the visitor. A misconfigured binding is an
    // operator problem and its details are not the visitor's business.
    console.error('alerts: KV namespace binding ALERTS is missing');
    return json({ error: 'The alert list is temporarily unavailable.' }, 503);
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return json({ error: 'Expected a JSON body.' }, 415);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: 'Request body too large.' }, 413);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Malformed JSON body.' }, 400);
  }

  if (!isValidEmail(body?.email)) {
    return json({ error: 'That does not look like a valid email address.' }, 400);
  }

  const email = normaliseEmail(body.email);
  const drug = ALLOWED_DRUGS.has(body?.drug) ? body.drug : 'all';

  // Only these fields. `drug` is a preference, not a diagnosis: it says which
  // price the person wants watched, which is exactly what a price-alert list
  // needs and is the minimum that makes segmented sends possible.
  const record = {
    email,
    drug,
    createdAt: new Date().toISOString(),
    source: 'web',
    // Country is provided by the edge and is used only to keep the list
    // US-scoped, since every price on this site is a US price. No IP address, no
    // user agent, no fingerprint, and nothing that could identify a device.
    country: request.headers.get('cf-ipcountry') ?? 'unknown',
  };

  try {
    const key = `subscriber:${email}`;
    const existing = await env.ALERTS.get(key, { type: 'json' });

    if (existing) {
      // Idempotent: update the preference, preserve the original signup date so a
      // re-submit does not look like a new subscriber.
      await env.ALERTS.put(
        key,
        JSON.stringify({ ...existing, drug, updatedAt: record.createdAt })
      );
      return json({ ok: true, updated: true });
    }

    await env.ALERTS.put(key, JSON.stringify(record));

    // A per-drug index so a price-change send can fetch only the affected
    // segment. KV has no query, so the index has to be maintained on write.
    const indexKey = `index:${drug}`;
    const index = (await env.ALERTS.get(indexKey, { type: 'json' })) ?? [];
    if (!index.includes(email)) {
      index.push(email);
      await env.ALERTS.put(indexKey, JSON.stringify(index));
    }

    return json({ ok: true, updated: false });
  } catch (error) {
    console.error('alerts: KV write failed', error);
    return json({ error: 'We could not save your signup. Please try again shortly.' }, 500);
  }
}

/** Anything other than POST. No listing endpoint exists, by design. */
export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'Method not allowed.' }, 405, {
    Allow: 'POST',
  });
}
