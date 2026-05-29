import { describe, expect, it } from 'vitest';
import { p256 } from '@noble/curves/nist';
import { derToCompact } from './webauthn/signature';
import { reconstructSignedPayload } from './webauthn/payload';
import { coseKeyToSec1 } from './webauthn/publicKey';
import { verifyAssertionSignature } from './webauthn/verify';
import { verifyClientDataJSON } from './webauthn/clientData';
import { verifyRpIdHash } from './webauthn/authData';
import { bytesToHex } from './internal/bytes';
import { ASSERTION, EXPECTED } from './__fixtures__/realAssertion';

// ⛔ S03 VALIDATION GATE (YK-429): a real captured P-256 assertion must verify
// via p256.verify before any feature work proceeds.
describe('VALIDATION GATE — real captured assertion verifies via p256.verify', () => {
  it('binds clientData + rpId, reconstructs the payload, and verifies the signature', () => {
    // 1. challenge / origin / ceremony-type binding
    verifyClientDataJSON(ASSERTION.clientDataJSON, {
      origin: ASSERTION.origin,
      challenge: ASSERTION.challenge,
    });
    // 2. rpId binding
    verifyRpIdHash(ASSERTION.authenticatorData, ASSERTION.rpId);

    // 3. primitives
    const publicKey = coseKeyToSec1(ASSERTION.coseKey);
    const payload = reconstructSignedPayload({
      authenticatorData: ASSERTION.authenticatorData,
      clientDataJSON: ASSERTION.clientDataJSON,
    });
    const compact = derToCompact(ASSERTION.signatureDer);

    expect(bytesToHex(publicKey)).toBe(EXPECTED.sec1PubKeyHex);
    expect(bytesToHex(payload)).toBe(EXPECTED.payloadHex);
    expect(bytesToHex(compact)).toBe(EXPECTED.compactSigHex);

    // 4. THE GATE — direct p256.verify
    expect(p256.verify(compact, payload, publicKey)).toBe(true);

    // 5. and via the high-level helper (lowS:false, mirrors the host fn)
    expect(
      verifyAssertionSignature({
        publicKey,
        authenticatorData: ASSERTION.authenticatorData,
        clientDataJSON: ASSERTION.clientDataJSON,
        signature: ASSERTION.signatureDer,
      }),
    ).toBe(true);
  });
});
