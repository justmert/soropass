import { describe, expect, it } from 'vitest';
import { KIT_ERROR_CODES, KitError, isKitError } from './errors';

describe('KitError', () => {
  it('freezes the code taxonomy with exactly the 10 codes', () => {
    expect(Object.isFrozen(KIT_ERROR_CODES)).toBe(true);
    expect([...KIT_ERROR_CODES]).toEqual([
      'USER_CANCELLED',
      'ES256_NOT_SUPPORTED',
      'RP_ID_MISMATCH',
      'ORIGIN_MISMATCH',
      'CHALLENGE_MISMATCH',
      'INVALID_SIGNATURE_DER',
      'INVALID_PUBLIC_KEY',
      'CONTRACT_AUTH_FAILED',
      'NETWORK_ERROR',
      'UNSUPPORTED_AUTHENTICATOR',
    ]);
  });

  it('is an Error subclass carrying a code and a stable name', () => {
    const e = new KitError('ES256_NOT_SUPPORTED', 'nope');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(KitError);
    expect(e.code).toBe('ES256_NOT_SUPPORTED');
    expect(e.name).toBe('KitError');
    expect(e.message).toBe('nope');
    expect(isKitError(e)).toBe(true);
    expect(isKitError(new Error('x'))).toBe(false);
  });

  it('defaults the message to the code and supports a cause', () => {
    const cause = new Error('root');
    const e = new KitError('NETWORK_ERROR', undefined, { cause });
    expect(e.message).toBe('NETWORK_ERROR');
    expect(e.cause).toBe(cause);
  });
});
