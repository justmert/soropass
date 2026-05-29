import { KitError } from '../errors';
import { base64UrlToBytes, bytesToBase64Url, bytesToUtf8 } from '../internal/encoding';

/** The subset of clientDataJSON fields we rely on. */
export interface ClientData {
  type: string;
  /** base64url-encoded challenge as embedded by the client. */
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}

/** Encode a raw challenge as the base64url string embedded in clientDataJSON. */
export function encodeChallenge(challenge: Uint8Array): string {
  return bytesToBase64Url(challenge);
}

/** Decode the base64url challenge embedded in clientDataJSON back to bytes. */
export function decodeChallenge(challenge: string): Uint8Array {
  return base64UrlToBytes(challenge);
}

/** Parse clientDataJSON bytes into a typed, validated-shape object. */
export function parseClientDataJSON(clientDataJSON: Uint8Array): ClientData {
  let raw: unknown;
  try {
    raw = JSON.parse(bytesToUtf8(clientDataJSON));
  } catch (cause) {
    throw new KitError('UNSUPPORTED_AUTHENTICATOR', 'clientDataJSON is not valid JSON', { cause });
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new KitError('UNSUPPORTED_AUTHENTICATOR', 'clientDataJSON is not a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  const { type, challenge, origin, crossOrigin } = obj;
  if (typeof type !== 'string' || typeof challenge !== 'string' || typeof origin !== 'string') {
    throw new KitError('UNSUPPORTED_AUTHENTICATOR', 'clientDataJSON is missing required fields');
  }
  return {
    type,
    challenge,
    origin,
    crossOrigin: typeof crossOrigin === 'boolean' ? crossOrigin : undefined,
  };
}

/**
 * Parse and verify clientDataJSON for an authentication (`webauthn.get`)
 * assertion: the ceremony type, the origin (exact match against one or more
 * allowed origins), and the embedded challenge (base64url string).
 */
export function verifyClientDataJSON(
  clientDataJSON: Uint8Array,
  expected: { origin: string | string[]; challenge: string },
): ClientData {
  const data = parseClientDataJSON(clientDataJSON);
  if (data.type !== 'webauthn.get') {
    throw new KitError(
      'UNSUPPORTED_AUTHENTICATOR',
      `clientDataJSON.type "${data.type}" is not "webauthn.get"`,
    );
  }
  const allowed = Array.isArray(expected.origin) ? expected.origin : [expected.origin];
  if (!allowed.includes(data.origin)) {
    throw new KitError('ORIGIN_MISMATCH', `origin "${data.origin}" not in [${allowed.join(', ')}]`);
  }
  if (data.challenge !== expected.challenge) {
    throw new KitError('CHALLENGE_MISMATCH', 'clientDataJSON challenge does not match expected');
  }
  return data;
}
