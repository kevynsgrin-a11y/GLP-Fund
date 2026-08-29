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
 * UNSUBSCRIBE lives here rather than in a second Pages Function, deliberately.
 * A mailing list cannot lawfully exist without a working opt-out -- CAN-SPAM
 * requires one, and /alerts/ promises one -- so removal is part of the single
 * permitted purpose rather than a second one. It is served from this same
 * endpoint by method and query string, so the "one function" envelope holds.
 *
 * Bindings required:
 *   KV namespace `ALERTS`.
 *   Secret `ALERTS_SECRET` -- signs unsubscribe tokens so a link cannot be
 *   forged and a stranger cannot remove someone else's address. Without it,
 *   unsubscribe fails closed and signup is unaffected.
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

/* --------------------------------------------------------------- unsubscribe */

/**
 * Sign an email address for use in an unsubscribe link.
 *
 * HMAC-SHA256 over the lowercased address, hex encoded. The token is not a
 * secret in itself -- it is a proof that we generated the link -- so it is safe
 * in a URL, and it cannot be produced for an arbitrary address without the
 * signing secret.
 *
 * @param {string} email
 * @param {string} secret
 * @returns {Promise<string>} hex token
 */
export async function signUnsubscribe(email, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normaliseEmail(email)));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time-ish comparison. Both values are hex of the same length, so a
 * length check plus a full-width XOR accumulation is enough to avoid leaking
 * where the first difference is.
 *
 * @param {string} a
 * @param {string} b
 */
function tokensMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Remove an address from both places it is stored: its own record and every
 * per-drug index. Idempotent -- unsubscribing twice is a success, because a
 * person clicking twice should not see an error.
 *
 * @param {string} email already normalised
 * @param {{ALERTS: KVNamespace}} env
 * @returns {Promise<boolean>} whether a record existed
 */
export async function removeSubscriber(email, env) {
  const key = `subscriber:${email}`;
  const existing = await env.ALERTS.get(key, { type: 'json' });

  await env.ALERTS.delete(key);

  // The index the subscriber is filed under is whichever drug they chose, but a
  // preference change could have left them in an older one. Sweep them all
  // rather than trusting the record we may have just failed to read.
  for (const drug of ALLOWED_DRUGS) {
    const indexKey = `index:${drug}`;
    const index = await env.ALERTS.get(indexKey, { type: 'json' });
    if (!Array.isArray(index) || !index.includes(email)) continue;
    const next = index.filter((e) => e !== email);
    await env.ALERTS.put(indexKey, JSON.stringify(next));
  }

  return Boolean(existing);
}

const UNSUB_PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/**
 * A self-contained confirmation page. It carries no stylesheet link because it
 * must render correctly even if the address being removed belongs to someone
 * whose mail client stripped everything else.
 *
 * @param {string} heading
 * @param {string} message
 * @param {number} status
 */
function unsubPage(heading, message, status = 200) {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<meta name="robots" content="noindex">` +
      `<title>${heading}</title>` +
      `<link rel="stylesheet" href="/assets/css/base.css"></head><body>` +
      `<main class="wrap"><h1>${heading}</h1><p>${message}</p>` +
      `<p><a href="/">Back to the price tool</a></p></main></body></html>`,
    { status, headers: UNSUB_PAGE_HEADERS }
  );
}

/**
 * Handle an unsubscribe request.
 *
 * Two shapes reach here. A person clicking the link in an email sends a GET and
 * gets an HTML confirmation. A mail provider honouring RFC 8058 one-click sends
 * a POST and gets JSON. Both remove the address.
 *
 * @param {{request: Request, env: object}} context
 */
async function handleUnsubscribe(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get('unsubscribe');
  const token = url.searchParams.get('t');
  const wantsHtml = request.method === 'GET';

  const fail = (message, status) =>
    wantsHtml
      ? unsubPage('We could not unsubscribe you', message, status)
      : json({ error: message }, status);

  if (!env?.ALERTS) {
    console.error('alerts: KV namespace binding ALERTS is missing');
    return fail('This is our fault, not yours. Please write to us and we will remove you by hand.', 500);
  }
  if (!env?.ALERTS_SECRET) {
    // Fail closed. An unsigned unsubscribe would let anyone remove any address.
    console.error('alerts: ALERTS_SECRET is missing; unsubscribe cannot verify tokens');
    return fail('This is our fault, not yours. Please write to us and we will remove you by hand.', 500);
  }
  if (!isValidEmail(email) || !token) {
    return fail('That unsubscribe link is not valid. Please write to us and we will remove you by hand.', 400);
  }

  const normalised = normaliseEmail(email);
  const expected = await signUnsubscribe(normalised, env.ALERTS_SECRET);
  if (!tokensMatch(token, expected)) {
    return fail('That unsubscribe link is not valid. Please write to us and we will remove you by hand.', 403);
  }

  try {
    await removeSubscriber(normalised, env);
  } catch (error) {
    console.error('alerts: KV delete failed', error);
    return fail('Something went wrong on our side. Please write to us and we will remove you by hand.', 500);
  }

  return wantsHtml
    ? unsubPage(
        'You are unsubscribed',
        'Your address has been deleted from our alert list. We keep no record that you were ever on it.'
      )
    : json({ ok: true });
}

/**
 * Method router. Signup is POST with a JSON body. Unsubscribe is any request
 * carrying an `unsubscribe` query parameter, which is how both a clicked link
 * and an RFC 8058 one-click POST arrive. No listing endpoint exists, by design.
 */
export async function onRequest(context) {
  const { request } = context;
  const hasUnsubParam = new URL(request.url).searchParams.has('unsubscribe');

  if (hasUnsubParam && (request.method === 'GET' || request.method === 'POST')) {
    return handleUnsubscribe(context);
  }
  if (request.method === 'POST') return onRequestPost(context);

  return json({ error: 'Method not allowed.' }, 405, {
    Allow: 'POST',
  });
}
