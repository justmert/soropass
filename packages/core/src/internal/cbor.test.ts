import { describe, expect, it } from 'vitest';
import { decodeCbor, decodeCborFirst } from './cbor';
import { bytesToHex } from './bytes';
import { ASSERTION } from '../__fixtures__/realAssertion';

describe('decodeCbor', () => {
  it('decodes ints, negative ints and text strings', () => {
    expect(decodeCborFirst(new Uint8Array([0x00]))).toBe(0);
    expect(decodeCborFirst(new Uint8Array([0x17]))).toBe(23);
    expect(decodeCborFirst(new Uint8Array([0x18, 0x2a]))).toBe(42); // 1-byte uint
    expect(decodeCborFirst(new Uint8Array([0x20]))).toBe(-1);
    expect(decodeCborFirst(new Uint8Array([0x39, 0x01, 0x00]))).toBe(-257); // = RS256 alg
    expect(decodeCborFirst(new Uint8Array([0x63, 0x66, 0x6d, 0x74]))).toBe('fmt');
  });

  it('reports the number of bytes consumed', () => {
    expect(decodeCbor(new Uint8Array([0x18, 0x2a, 0xff]), 0).length).toBe(2);
  });

  it('decodes a real COSE EC2 key map', () => {
    const decoded = decodeCborFirst(ASSERTION.coseKey);
    expect(decoded).toBeInstanceOf(Map);
    const map = decoded as Map<number, unknown>;
    expect(map.get(1)).toBe(2); // kty EC2
    expect(map.get(3)).toBe(-7); // alg ES256
    expect(map.get(-1)).toBe(1); // crv P-256
    const x = map.get(-2) as Uint8Array;
    const y = map.get(-3) as Uint8Array;
    expect(x.length).toBe(32);
    expect(y.length).toBe(32);
    expect(bytesToHex(x)).toBe('885e169faee86bc54f62cd1a8bdfdd9ad3d2215506c03fefaad1cacc511bd035');
  });

  it('throws on truncated input', () => {
    expect(() => decodeCborFirst(new Uint8Array([0x18]))).toThrow(/end of input/);
  });

  it('rejects duplicate map keys (non-canonical CBOR)', () => {
    // map(2){ 1:2, 1:3 } — duplicate key 1
    expect(() => decodeCborFirst(new Uint8Array([0xa2, 0x01, 0x02, 0x01, 0x03]))).toThrow(
      /duplicate map key/,
    );
  });

  it('rejects pathologically nested input (depth cap)', () => {
    // 20 nested single-element arrays exceeds MAX_DEPTH
    const nested = new Uint8Array(21).fill(0x81);
    nested[20] = 0x00;
    expect(() => decodeCborFirst(nested)).toThrow(/nesting depth/);
  });
});
