import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserWebAuthnClient } from './browserClient';
import { buildCreateOptions } from '../webauthn/createOptions';
import { isKitError } from '../errors';

const OPTIONS = buildCreateOptions({
  rpId: 'example.com',
  rpName: 'Example',
  userName: 'alice',
  challenge: new Uint8Array(32),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browserWebAuthnClient cancel-path mapping (S20 polish)', () => {
  it('maps a NotAllowedError (sheet dismissed) to USER_CANCELLED on create()', async () => {
    vi.stubGlobal('navigator', {
      credentials: {
        create: () => Promise.reject(new DOMException('dismissed', 'NotAllowedError')),
        get: () => Promise.reject(new DOMException('dismissed', 'NotAllowedError')),
      },
    });
    const client = browserWebAuthnClient();
    await expect(client.create(OPTIONS)).rejects.toMatchObject({ code: 'USER_CANCELLED' });
    await expect(client.get({ rpId: 'example.com', allowCredentials: [] })).rejects.toMatchObject({
      code: 'USER_CANCELLED',
    });
  });

  it('maps any other rejection to UNSUPPORTED_AUTHENTICATOR (catch-all)', async () => {
    vi.stubGlobal('navigator', {
      credentials: {
        create: () => Promise.reject(new Error('boom')),
        get: () => Promise.reject(new Error('boom')),
      },
    });
    const client = browserWebAuthnClient();
    await client.create(OPTIONS).then(
      () => expect.fail('should reject'),
      (error: unknown) => {
        expect(isKitError(error) && error.code).toBe('UNSUPPORTED_AUTHENTICATOR');
      },
    );
  });

  it('throws UNSUPPORTED_AUTHENTICATOR when navigator.credentials is unavailable', () => {
    vi.stubGlobal('navigator', {});
    expect(() => browserWebAuthnClient()).toThrowError(/navigator\.credentials/);
  });
});
