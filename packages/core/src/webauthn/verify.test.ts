import { describe, expect, it } from 'vitest';
import { verifyAssertionSignature } from './verify';
import { derToCompact } from './signature';
import { coseKeyToSec1 } from './publicKey';
import { ASSERTION } from '../__fixtures__/realAssertion';

describe('verifyAssertionSignature', () => {
  const publicKey = coseKeyToSec1(ASSERTION.coseKey);
  const base = {
    publicKey,
    authenticatorData: ASSERTION.authenticatorData,
    clientDataJSON: ASSERTION.clientDataJSON,
  };

  it('accepts a DER signature', () => {
    expect(verifyAssertionSignature({ ...base, signature: ASSERTION.signatureDer })).toBe(true);
  });

  it('accepts a 64-byte compact signature (read as compact, not DER)', () => {
    const compact = derToCompact(ASSERTION.signatureDer);
    expect(compact.length).toBe(64);
    expect(verifyAssertionSignature({ ...base, signature: compact })).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const tampered = ASSERTION.authenticatorData.slice();
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(
      verifyAssertionSignature({
        ...base,
        authenticatorData: tampered,
        signature: ASSERTION.signatureDer,
      }),
    ).toBe(false);
  });
});
