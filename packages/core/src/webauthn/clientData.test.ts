import { describe, expect, it } from 'vitest';
import {
  decodeChallenge,
  encodeChallenge,
  parseClientDataJSON,
  verifyClientDataJSON,
} from './clientData';
import { KitError } from '../errors';
import { ASSERTION } from '../__fixtures__/realAssertion';

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error('did not throw');
  } catch (e) {
    expect(e).toBeInstanceOf(KitError);
    expect((e as KitError).code).toBe(code);
  }
}

describe('clientDataJSON', () => {
  it('parses type / origin / challenge', () => {
    const data = parseClientDataJSON(ASSERTION.clientDataJSON);
    expect(data.type).toBe('webauthn.get');
    expect(data.origin).toBe(ASSERTION.origin);
    expect(data.challenge).toBe(ASSERTION.challenge);
  });

  it('verifies origin (single + allowed list) and challenge', () => {
    expect(
      verifyClientDataJSON(ASSERTION.clientDataJSON, {
        origin: ASSERTION.origin,
        challenge: ASSERTION.challenge,
      }).type,
    ).toBe('webauthn.get');
    expect(
      verifyClientDataJSON(ASSERTION.clientDataJSON, {
        origin: ['https://other.example', ASSERTION.origin],
        challenge: ASSERTION.challenge,
      }).origin,
    ).toBe(ASSERTION.origin);
  });

  it('throws ORIGIN_MISMATCH and CHALLENGE_MISMATCH', () => {
    expectCode(
      () =>
        verifyClientDataJSON(ASSERTION.clientDataJSON, {
          origin: 'https://evil.example',
          challenge: ASSERTION.challenge,
        }),
      'ORIGIN_MISMATCH',
    );
    expectCode(
      () =>
        verifyClientDataJSON(ASSERTION.clientDataJSON, {
          origin: ASSERTION.origin,
          challenge: 'wrong-challenge',
        }),
      'CHALLENGE_MISMATCH',
    );
  });

  it('rejects a non-"webauthn.get" ceremony type', () => {
    const create = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.create', challenge: 'x', origin: ASSERTION.origin }),
    );
    expectCode(
      () => verifyClientDataJSON(create, { origin: ASSERTION.origin, challenge: 'x' }),
      'UNSUPPORTED_AUTHENTICATOR',
    );
  });

  it('rejects invalid JSON', () => {
    expectCode(
      () => parseClientDataJSON(new Uint8Array([0x7b, 0x00])),
      'UNSUPPORTED_AUTHENTICATOR',
    );
  });

  it('challenge codec round-trips', () => {
    const bytes = decodeChallenge(ASSERTION.challenge);
    expect(encodeChallenge(bytes)).toBe(ASSERTION.challenge);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
