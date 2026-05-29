import { describe, expect, it } from 'vitest';
import { parseAuthenticatorData, verifyRpIdHash } from './authData';
import { KitError } from '../errors';
import { bytesToHex } from '../internal/bytes';
import { ASSERTION } from '../__fixtures__/realAssertion';

describe('parseAuthenticatorData', () => {
  it('parses rpIdHash, flags and signCount', () => {
    const ad = parseAuthenticatorData(ASSERTION.authenticatorData);
    expect(ad.rpIdHash.length).toBe(32);
    expect(bytesToHex(ad.rpIdHash)).toBe(
      '3ddc4710e9c088b229dba89d563220bb39f7229aff465b0a656b1afb9a8af8a0',
    );
    expect(ad.flags.up).toBe(true);
    expect(ad.flags.at).toBe(false); // a get-assertion has no attested data
    expect(typeof ad.signCount).toBe('number');
  });

  it('rejects too-short authenticatorData', () => {
    expect(() => parseAuthenticatorData(new Uint8Array(10))).toThrowError(KitError);
  });
});

describe('verifyRpIdHash', () => {
  it('passes for the correct rpId', () => {
    expect(() => verifyRpIdHash(ASSERTION.authenticatorData, ASSERTION.rpId)).not.toThrow();
  });

  it('throws RP_ID_MISMATCH for a wrong rpId', () => {
    try {
      verifyRpIdHash(ASSERTION.authenticatorData, 'evil.example');
      throw new Error('did not throw');
    } catch (e) {
      expect((e as KitError).code).toBe('RP_ID_MISMATCH');
    }
  });
});
