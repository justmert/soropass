import { describe, expect, it } from 'vitest';
import { reconstructSignedPayload } from './payload';
import { bytesToHex } from '../internal/bytes';
import { ASSERTION, EXPECTED } from '../__fixtures__/realAssertion';

describe('reconstructSignedPayload', () => {
  it('computes SHA256(authData ‖ SHA256(clientDataJSON))', () => {
    const payload = reconstructSignedPayload({
      authenticatorData: ASSERTION.authenticatorData,
      clientDataJSON: ASSERTION.clientDataJSON,
    });
    expect(payload.length).toBe(32);
    expect(bytesToHex(payload)).toBe(EXPECTED.payloadHex);
  });
});
