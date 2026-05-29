/** Cryptographically-random bytes, isomorphic (browser + Node global crypto). */
export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(length));
  (globalThis.crypto as Crypto | undefined)?.getRandomValues(out);
  return out;
}
