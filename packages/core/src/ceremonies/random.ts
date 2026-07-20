import { KitError } from '../errors';

/**
 * Cryptographically-random bytes, isomorphic (browser + Node global crypto).
 * Throws instead of silently returning all-zero bytes when no secure RNG is
 * present — an all-zero challenge would be catastrophic, not a soft fallback.
 */
export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const webcrypto = globalThis.crypto as Crypto | undefined;
  if (typeof webcrypto?.getRandomValues !== 'function') {
    throw new KitError(
      'UNSUPPORTED_AUTHENTICATOR',
      'no secure random source (globalThis.crypto.getRandomValues) is available in this environment',
    );
  }
  const out = new Uint8Array(new ArrayBuffer(length));
  webcrypto.getRandomValues(out);
  return out;
}
