import { describe, expect, it } from 'vitest';
import { derToCompact } from './signature';
import { KitError } from '../errors';
import { bytesToHex } from '../internal/bytes';
import { ASSERTION, EXPECTED } from '../__fixtures__/realAssertion';

describe('derToCompact', () => {
  it('converts a real DER signature to 64-byte R‖S', () => {
    const compact = derToCompact(ASSERTION.signatureDer);
    expect(compact.length).toBe(64);
    expect(bytesToHex(compact)).toBe(EXPECTED.compactSigHex);
  });

  it('rejects DER longer than 72 bytes with INVALID_SIGNATURE_DER', () => {
    try {
      derToCompact(new Uint8Array(73));
      throw new Error('did not throw');
    } catch (e) {
      expect(e).toBeInstanceOf(KitError);
      expect((e as KitError).code).toBe('INVALID_SIGNATURE_DER');
    }
  });

  it('rejects malformed DER', () => {
    expect(() => derToCompact(new Uint8Array([0x01, 0x02, 0x03]))).toThrowError(KitError);
  });
});
