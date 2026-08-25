import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken } from '../functions/_utils.js';

test('session token: valid round trip', async () => {
  const token = await createSessionToken('secret-a', '0555000001', 30);
  const session = await verifySessionToken(token, 'secret-a');
  assert.ok(session);
  assert.equal(session.phone, '0555000001');
});

test('session token: tampered signature is rejected', async () => {
  const token = await createSessionToken('secret-a', '0555000001', 30);
  const [payload] = token.split('.');
  const tampered = `${payload}.forged-signature`;
  const session = await verifySessionToken(tampered, 'secret-a');
  assert.equal(session, null);
});

test('session token: tampered payload (phone swap) is rejected', async () => {
  const token = await createSessionToken('secret-a', '0555000001', 30);
  const [, sig] = token.split('.');
  const forgedPayload = btoa(JSON.stringify({ phone: '0555999999', exp: Date.now() + 999999 }));
  const forged = `${forgedPayload}.${sig}`;
  const session = await verifySessionToken(forged, 'secret-a');
  assert.equal(session, null);
});

test('session token: wrong secret is rejected', async () => {
  const token = await createSessionToken('secret-a', '0555000001', 30);
  const session = await verifySessionToken(token, 'secret-b');
  assert.equal(session, null);
});

test('session token: expired token is rejected', async () => {
  const payload = btoa(JSON.stringify({ phone: '0555000001', exp: Date.now() - 1000 }));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode('secret-a'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  const expiredToken = `${payload}.${sig}`;
  const session = await verifySessionToken(expiredToken, 'secret-a');
  assert.equal(session, null);
});

test('session token: malformed token (no dot separator) is rejected', async () => {
  assert.equal(await verifySessionToken('not-a-valid-token', 'secret-a'), null);
});

test('session token: empty/null token is rejected', async () => {
  assert.equal(await verifySessionToken(null, 'secret-a'), null);
  assert.equal(await verifySessionToken('', 'secret-a'), null);
});
