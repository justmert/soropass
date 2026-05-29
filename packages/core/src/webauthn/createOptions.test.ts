import { describe, expect, it } from 'vitest';
import { buildCreateOptions } from './createOptions';
import { base64UrlToBytes, bytesToUtf8 } from '../internal/encoding';

describe('buildCreateOptions', () => {
  it('offers ES256 and only ES256 (alg -7)', () => {
    const opts = buildCreateOptions({
      rpId: 'example.com',
      rpName: 'Example',
      userName: 'alice',
      challenge: new Uint8Array([1, 2, 3]),
    });
    expect(opts.pubKeyCredParams).toEqual([{ type: 'public-key', alg: -7 }]);
  });

  it('sets rp / user / base64url challenge with sensible defaults', () => {
    const challenge = new Uint8Array([9, 8, 7, 6]);
    const opts = buildCreateOptions({
      rpId: 'example.com',
      rpName: 'Example',
      userName: 'alice',
      challenge,
    });
    expect(opts.rp).toEqual({ id: 'example.com', name: 'Example' });
    expect(opts.user.name).toBe('alice');
    expect(opts.user.displayName).toBe('alice');
    expect(bytesToUtf8(base64UrlToBytes(opts.user.id))).toBe('alice');
    expect(base64UrlToBytes(opts.challenge)).toEqual(challenge);
    expect(opts.authenticatorSelection.residentKey).toBe('required');
    expect(opts.authenticatorSelection.requireResidentKey).toBe(true);
    expect(opts.attestation).toBe('none');
  });
});
