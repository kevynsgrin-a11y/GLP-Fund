/**
 * Alert list: signup and unsubscribe.
 *
 * The unsubscribe path is legally load-bearing -- /alerts/ promises one-click
 * removal and CAN-SPAM requires it -- so it is tested against a fake KV rather
 * than trusted. The fake mirrors the two places an address is written: its own
 * record, and the per-drug index used to select recipients.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onRequest, signUnsubscribe, removeSubscriber } from '../functions/api/alerts.js';

const SECRET = 'test-signing-secret';

/** Minimal in-memory stand-in for a KV namespace. */
function fakeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key, opts) {
      const raw = store.get(key);
      if (raw === undefined) return null;
      return opts?.type === 'json' ? JSON.parse(raw) : raw;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

function subscribedEnv(email = 'reader@example.com', drug = 'zepbound') {
  return {
    ALERTS: fakeKV({
      [`subscriber:${email}`]: JSON.stringify({ email, drug, createdAt: '2026-01-01T00:00:00.000Z' }),
      [`index:${drug}`]: JSON.stringify([email, 'someone-else@example.com']),
      'index:all': JSON.stringify(['unrelated@example.com']),
    }),
    ALERTS_SECRET: SECRET,
  };
}

function unsubRequest(email, token, method = 'GET') {
  const url = new URL('https://glp1-fund.com/api/alerts');
  if (email !== null) url.searchParams.set('unsubscribe', email);
  if (token !== null) url.searchParams.set('t', token);
  return new Request(url, { method });
}

test('a signed unsubscribe link removes the address from both storage locations', async () => {
  const email = 'reader@example.com';
  const env = subscribedEnv(email);
  const token = await signUnsubscribe(email, SECRET);

  const res = await onRequest({ request: unsubRequest(email, token), env });

  assert.equal(res.status, 200);
  assert.match(await res.text(), /You are unsubscribed/);
  assert.equal(env.ALERTS.store.get(`subscriber:${email}`), undefined);
  assert.deepEqual(JSON.parse(env.ALERTS.store.get('index:zepbound')), ['someone-else@example.com']);
});

test('unsubscribing twice succeeds, because a person may click twice', async () => {
  const email = 'reader@example.com';
  const env = subscribedEnv(email);
  const token = await signUnsubscribe(email, SECRET);

  await onRequest({ request: unsubRequest(email, token), env });
  const second = await onRequest({ request: unsubRequest(email, token), env });

  assert.equal(second.status, 200);
});

test('an unsigned or forged token cannot remove an address', async () => {
  const email = 'reader@example.com';

  for (const token of ['', 'deadbeef', 'f'.repeat(64)]) {
    const env = subscribedEnv(email);
    const res = await onRequest({ request: unsubRequest(email, token), env });
    assert.ok(res.status === 400 || res.status === 403, `token ${token || '(empty)'} must be rejected`);
    assert.ok(env.ALERTS.store.has(`subscriber:${email}`), 'record must survive a bad token');
  }
});

test('one address cannot be signed and used to remove a different one', async () => {
  const env = subscribedEnv('reader@example.com');
  const attackerToken = await signUnsubscribe('attacker@example.com', SECRET);

  const res = await onRequest({ request: unsubRequest('reader@example.com', attackerToken), env });

  assert.equal(res.status, 403);
  assert.ok(env.ALERTS.store.has('subscriber:reader@example.com'));
});

test('unsubscribe fails closed when the signing secret is unset', async () => {
  const env = subscribedEnv('reader@example.com');
  delete env.ALERTS_SECRET;
  const token = await signUnsubscribe('reader@example.com', SECRET);

  const res = await onRequest({ request: unsubRequest('reader@example.com', token), env });

  assert.equal(res.status, 500);
  assert.ok(env.ALERTS.store.has('subscriber:reader@example.com'), 'must not delete without verification');
});

test('an RFC 8058 one-click POST unsubscribes and answers JSON', async () => {
  const email = 'reader@example.com';
  const env = subscribedEnv(email);
  const token = await signUnsubscribe(email, SECRET);

  const res = await onRequest({ request: unsubRequest(email, token, 'POST'), env });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(env.ALERTS.store.get(`subscriber:${email}`), undefined);
});

test('removeSubscriber sweeps every per-drug index, not just the recorded one', async () => {
  const email = 'reader@example.com';
  const env = {
    ALERTS: fakeKV({
      [`subscriber:${email}`]: JSON.stringify({ email, drug: 'wegovy_injection' }),
      'index:wegovy_injection': JSON.stringify([email]),
      // A stale entry left behind by an earlier preference change.
      'index:ozempic': JSON.stringify([email, 'other@example.com']),
    }),
  };

  await removeSubscriber(email, env);

  assert.deepEqual(JSON.parse(env.ALERTS.store.get('index:wegovy_injection')), []);
  assert.deepEqual(JSON.parse(env.ALERTS.store.get('index:ozempic')), ['other@example.com']);
});

test('a request with no unsubscribe parameter and no body is still method-checked', async () => {
  const res = await onRequest({
    request: new Request('https://glp1-fund.com/api/alerts', { method: 'GET' }),
    env: { ALERTS: fakeKV() },
  });

  assert.equal(res.status, 405);
});
