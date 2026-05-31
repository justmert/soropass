import { describe, expect, it } from 'vitest';
import { browserPasskeySigner } from './browserSigner';
import type { WebAuthnClient, WebAuthnGetOptions } from './types';
import { bytesToBase64Url } from '../internal/encoding';

describe('browserPasskeySigner', () => {
  it('decodes the base64url challenge to bytes and maps the assertion', async () => {
    const challengeBytes = new Uint8Array([1, 2, 3, 4, 5, 250, 0, 99]);
    const challengeB64 = bytesToBase64Url(challengeBytes);
    let seen: WebAuthnGetOptions | undefined;
    const webauthn: WebAuthnClient = {
      create: () => Promise.reject(new Error('unused')),
      get: (o) => {
        seen = o;
        return Promise.resolve({
          id: 'cred-id',
          rawId: new Uint8Array([9, 9, 9]),
          authenticatorData: new Uint8Array(37),
          clientDataJSON: new Uint8Array([7, 8]),
          signature: new Uint8Array(70), // DER-ish; SDK normalizes downstream
        });
      },
    };

    const sign = browserPasskeySigner({
      rpId: 'wallet.example.com',
      allowCredentials: ['cred-id'],
      webauthn,
    });
    const result = await sign(challengeB64);

    // the raw bytes (not the base64url string) reach navigator.credentials.get
    expect(seen?.rpId).toBe('wallet.example.com');
    expect([...(seen?.challenge ?? [])]).toEqual([...challengeBytes]);
    expect(seen?.allowCredentials).toEqual(['cred-id']);
    expect(seen?.userVerification).toBe('preferred');

    // the assertion maps to the AssertionResult the auth assembler consumes
    expect([...result.credentialId]).toEqual([9, 9, 9]);
    expect([...result.clientDataJSON]).toEqual([7, 8]);
    expect(result.signature).toHaveLength(70);
    expect(result.authenticatorData).toHaveLength(37);
  });

  it('defaults to a discoverable prompt (empty allowCredentials)', async () => {
    let seen: WebAuthnGetOptions | undefined;
    const webauthn: WebAuthnClient = {
      create: () => Promise.reject(new Error('unused')),
      get: (o) => {
        seen = o;
        return Promise.resolve({
          id: 'x',
          rawId: new Uint8Array(1),
          authenticatorData: new Uint8Array(37),
          clientDataJSON: new Uint8Array(1),
          signature: new Uint8Array(64),
        });
      },
    };
    await browserPasskeySigner({ rpId: 'example.com', webauthn })('AQID');
    expect(seen?.allowCredentials).toEqual([]);
  });
});
