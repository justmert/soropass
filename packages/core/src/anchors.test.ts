import { describe, expect, it } from 'vitest';
import { p256 } from '@noble/curves/nist';
import { BATTLE_TESTED_ANCHORS, assertES256, assertUserActivation } from './anchors';
import { derToCompact, isLowS, normalizeLowS } from './webauthn/signature';
import { coseKeyToSec1 } from './webauthn/publicKey';
import { reconstructSignedPayload } from './webauthn/payload';
import { KitError } from './errors';
import { bytesToHex } from './internal/bytes';
import { ASSERTION, EXPECTED } from './__fixtures__/realAssertion';

const fromHex = (h: string): Uint8Array =>
  Uint8Array.from((h.match(/../g) ?? []).map((b) => parseInt(b, 16)));

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error('did not throw');
  } catch (e) {
    expect(e).toBeInstanceOf(KitError);
    expect((e as KitError).code).toBe(code);
  }
}

// ── Anchor 1 ─────────────────────────────────────────────────────────────────
describe(`anchor: ${BATTLE_TESTED_ANCHORS.LOW_S_NORMALIZATION} (Apple low-S — THE killer bug)`, () => {
  const low = derToCompact(ASSERTION.signatureDer); // captured fixture is already low-S
  const high = fromHex(EXPECTED.highSCompactSigHex); // same R, S' = n − S
  const publicKey = coseKeyToSec1(ASSERTION.coseKey);
  const payload = reconstructSignedPayload({
    authenticatorData: ASSERTION.authenticatorData,
    clientDataJSON: ASSERTION.clientDataJSON,
  });
  const verify = (sig: Uint8Array, lowS: boolean): boolean =>
    p256.verify(sig, payload, publicKey, { lowS, format: 'compact' });

  it('distinguishes high-S from low-S', () => {
    expect(isLowS(low)).toBe(true);
    expect(isLowS(high)).toBe(false);
  });

  it('high-S in → canonical low-S out (idempotent on low-S)', () => {
    expect(bytesToHex(normalizeLowS(high))).toBe(EXPECTED.compactSigHex);
    expect(isLowS(normalizeLowS(high))).toBe(true);
    expect(bytesToHex(normalizeLowS(low))).toBe(EXPECTED.compactSigHex); // unchanged
  });

  it('the normalized signature still verifies (host fn does not enforce low-S)', () => {
    expect(verify(normalizeLowS(high), false)).toBe(true);
  });

  it('a non-normalized (high-S) signature is rejected by a low-S enforcer', () => {
    expect(verify(high, true)).toBe(false); // ⛔ reject-if-not-normalized
    expect(verify(normalizeLowS(high), true)).toBe(true);
    expect(verify(low, true)).toBe(true);
  });
});

// ── Anchor 2 ─────────────────────────────────────────────────────────────────
describe(`anchor: ${BATTLE_TESTED_ANCHORS.RS256_HARD_FAIL}`, () => {
  it('create-time pubkey extraction hard-fails on RS256 with ES256_NOT_SUPPORTED', () => {
    // COSE map advertising alg -257 (RS256): map(3){ 1:3, 3:-257, -1:1 }
    const rs256Cose = new Uint8Array([0xa3, 0x01, 0x03, 0x03, 0x39, 0x01, 0x00, 0x20, 0x01]);
    expectCode(() => coseKeyToSec1(rs256Cose), 'ES256_NOT_SUPPORTED');
  });

  it('assertES256 accepts -7 and rejects every other algorithm', () => {
    expect(() => assertES256(-7)).not.toThrow();
    for (const alg of [-257, -8, -36, 0, 7]) {
      expectCode(() => assertES256(alg), 'ES256_NOT_SUPPORTED');
    }
  });
});

// ── Anchor 3 ─────────────────────────────────────────────────────────────────
describe(`anchor: ${BATTLE_TESTED_ANCHORS.APPLE_USER_GESTURE}`, () => {
  it('throws USER_CANCELLED when there is no active user activation', () => {
    expectCode(() => assertUserActivation({ isActive: false }), 'USER_CANCELLED');
  });

  it('passes with an active activation and is lenient when unknown', () => {
    expect(() => assertUserActivation({ isActive: true })).not.toThrow();
    expect(() => assertUserActivation()).not.toThrow(); // no navigator.userActivation in node
  });
});
