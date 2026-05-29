import { describe, expect, it } from 'vitest';
import { coseKeyToSec1, extractPublicKeyFromAttestationObject } from './publicKey';
import { KitError } from '../errors';
import { bytesToHex } from '../internal/bytes';
import { ASSERTION, ATTESTATION_OBJECT, EXPECTED } from '../__fixtures__/realAssertion';

describe('public-key extraction', () => {
  it('converts a COSE EC2 key to SEC-1 (0x04‖X‖Y)', () => {
    const sec1 = coseKeyToSec1(ASSERTION.coseKey);
    expect(sec1.length).toBe(65);
    expect(sec1[0]).toBe(0x04);
    expect(bytesToHex(sec1)).toBe(EXPECTED.sec1PubKeyHex);
  });

  it('extracts SEC-1 from a real attestationObject (none fmt)', () => {
    const sec1 = extractPublicKeyFromAttestationObject(ATTESTATION_OBJECT);
    expect(sec1.length).toBe(65);
    expect(bytesToHex(sec1)).toBe(EXPECTED.attestationSec1Hex);
  });

  it('rejects RS256 keys with ES256_NOT_SUPPORTED (invariant #1)', () => {
    // map(3){ 1:3 (RSA kty), 3:-257 (RS256 alg), -1:1 } — alg is checked first.
    const rs256 = new Uint8Array([0xa3, 0x01, 0x03, 0x03, 0x39, 0x01, 0x00, 0x20, 0x01]);
    try {
      coseKeyToSec1(rs256);
      throw new Error('did not throw');
    } catch (e) {
      expect((e as KitError).code).toBe('ES256_NOT_SUPPORTED');
    }
  });

  it('rejects non-map COSE input with INVALID_PUBLIC_KEY', () => {
    try {
      coseKeyToSec1(new Uint8Array([0x00]));
      throw new Error('did not throw');
    } catch (e) {
      expect((e as KitError).code).toBe('INVALID_PUBLIC_KEY');
    }
  });

  it('rejects an off-curve point with INVALID_PUBLIC_KEY', () => {
    // valid ES256/EC2/P-256 headers but X = Y = 0xFF*32 (not on the curve)
    const ff = new Array<number>(32).fill(0xff);
    const cose = new Uint8Array([
      0xa5,
      0x01,
      0x02,
      0x03,
      0x26,
      0x20,
      0x01,
      0x21,
      0x58,
      0x20,
      ...ff,
      0x22,
      0x58,
      0x20,
      ...ff,
    ]);
    try {
      coseKeyToSec1(cose);
      throw new Error('did not throw');
    } catch (e) {
      expect((e as KitError).code).toBe('INVALID_PUBLIC_KEY');
    }
  });
});
