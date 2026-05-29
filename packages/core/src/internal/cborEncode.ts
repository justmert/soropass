import type { CborValue } from './cbor';
import { utf8ToBytes } from './encoding';

/**
 * Minimal CBOR encoder — the inverse of `cbor.ts`, supporting the same major
 * types (uint, negint, byte string, text string, array, map). Used by the
 * deterministic mock authenticator (S15) to synthesize real attestationObject /
 * COSE-key bytes, so the mock create path goes through the exact same
 * `extractPublicKeyFromAttestationObject` as production. Not canonical-ordered
 * (our decoder is order-agnostic) and intentionally narrow.
 */
function head(major: number, arg: number): number[] {
  const m = major << 5;
  if (arg < 24) return [m | arg];
  if (arg < 0x100) return [m | 24, arg];
  if (arg < 0x10000) return [m | 25, (arg >> 8) & 0xff, arg & 0xff];
  return [m | 26, (arg >>> 24) & 0xff, (arg >> 16) & 0xff, (arg >> 8) & 0xff, arg & 0xff];
}

function write(value: CborValue, out: number[]): void {
  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value >= 0) out.push(...head(0, value));
    else out.push(...head(1, -1 - value));
  } else if (value instanceof Uint8Array) {
    out.push(...head(2, value.length));
    for (const b of value) out.push(b);
  } else if (typeof value === 'string') {
    const bytes = utf8ToBytes(value);
    out.push(...head(3, bytes.length));
    for (const b of bytes) out.push(b);
  } else if (Array.isArray(value)) {
    out.push(...head(4, value.length));
    for (const item of value) write(item, out);
  } else if (value instanceof Map) {
    out.push(...head(5, value.size));
    for (const [k, v] of value) {
      write(k, out);
      write(v, out);
    }
  } else {
    throw new Error('CBOR encode: unsupported value');
  }
}

export function encodeCbor(value: CborValue): Uint8Array {
  const out: number[] = [];
  write(value, out);
  return Uint8Array.from(out);
}
